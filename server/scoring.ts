// ---------------------------------------------------------------------------
// Motor de qualificação de leads.
//
// O site recebe tráfego de Meta, Google, TikTok, busca orgânica e motores de IA
// ao mesmo tempo. O papel dele é filtrar: separar quem vale uma ligação agora de
// quem está só olhando, para o consultor não tratar os dois igual.
//
// Antes disso, o que chegava no n8n era um campo `resumo` — uma frase
// concatenada com pedaços de resposta. Todos os leads de Compra caíam no mesmo
// webhook, sem nota e sem ordem.
//
// Quase todos os sinais abaixo JÁ eram coletados pelo funil e descartados. O que
// muda aqui é somar, gravar e rotear.
//
// Os pesos são um ponto de partida defensável, não verdade revelada. Depois de
// ~200 leads com nota gravada, cruzar nota x negócio fechado e recalibrar.
// ---------------------------------------------------------------------------

import { telefoneValido, dddDe } from './telefone';

export type Faixa = 'quente' | 'morno' | 'frio';

export interface ResultadoScore {
  score: number;
  faixa: Faixa;
  /** Por que o lead recebeu essa nota — vai junto para o consultor decidir. */
  motivos: string[];
  /** Só telefone inválido descarta. Geografia é sinal negativo, não veto. */
  descartar: boolean;
  motivo_descarte: string | null;
  fora_do_raio: boolean;
}

// ---------------------------------------------------------------------------
// Área de atendimento
// ---------------------------------------------------------------------------

// Alto Vale do Itajaí (praça principal) + Vale/litoral onde há a unidade de
// Itapema. Fora daqui o lead não é descartado — só não ganha os pontos de
// proximidade, porque a logística de avaliação e troca fica mais difícil.
const CIDADES_ATENDIDAS = new Set([
  // Alto Vale
  'rio do sul', 'ituporanga', 'taio', 'presidente getulio', 'ibirama', 'lontras',
  'aurora', 'agronomica', 'laurentino', 'rio do oeste', 'trombudo central',
  'braco do trombudo', 'pouso redondo', 'salete', 'santa terezinha', 'mirim doce',
  'vitor meireles', 'jose boiteux', 'witmarsum', 'dona emma', 'presidente nereu',
  'petrolandia', 'imbuia', 'chapadao do lageado', 'atalanta', 'agrolandia',
  'vidal ramos', 'alfredo wagner', 'leoberto leal', 'santa terezinha do progresso',
  // Médio Vale
  'apiuna', 'rodeio', 'ascurra', 'indaial', 'timbo', 'blumenau', 'gaspar',
  'pomerode', 'brusque', 'guabiruba', 'botuvera',
  // Litoral / unidade de Itapema
  'itapema', 'balneario camboriu', 'camboriu', 'itajai', 'navegantes',
  'porto belo', 'bombinhas', 'tijucas', 'penha', 'piçarras', 'picarras',
]);

// DDDs da praça: 47 (Vale/litoral norte), 49 (oeste/serra), 48 (Grande Fpolis).
const DDDS_REGIAO = new Set(['47', '48', '49']);

function normalizar(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\/\-–]\s*(sc|santa catarina)\s*$/i, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export { telefoneValido };

/**
 * Casamento por palavra inteira. Um `includes` simples dava falso positivo —
 * "Taiobeiras" (MG) casava com "Taió" e ganhava os pontos de proximidade.
 */
function contemCidade(texto: string, cidade: string): boolean {
  return (
    texto === cidade ||
    texto.startsWith(cidade + ' ') ||
    texto.endsWith(' ' + cidade) ||
    texto.includes(' ' + cidade + ' ')
  );
}

export function cidadeAtendida(cidade: string): boolean {
  const c = normalizar(cidade);
  if (!c) return false;
  if (CIDADES_ATENDIDAS.has(c)) return true;
  // Cobre "Rio do Sul SC", "Centro Blumenau" e afins.
  for (const atendida of CIDADES_ATENDIDAS) {
    if (contemCidade(c, atendida)) return true;
  }
  return false;
}


// ---------------------------------------------------------------------------
// Sinais de origem
// ---------------------------------------------------------------------------

// Quem chega buscando modelo/marca já tem intenção formada. Quem vem de
// prospecção fria em feed social ainda está sendo apresentado à ideia.
const CANAIS_ALTA_INTENCAO = new Set([
  'google_ads', 'google_organico', 'bing_ads', 'bing_organico',
  'chatgpt', 'perplexity', 'claude', 'gemini', 'site_principal',
]);

function horarioComercialBRT(): boolean {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dia = dias[partes.weekday] ?? 1;
  const hora = parseInt(partes.hour, 10) % 24;

  if (dia === 0) return false;
  if (dia === 6) return hora >= 8 && hora < 13;
  return hora >= 8 && hora < 19;
}

/** Converte "R$ 95.000,00", "95000" e afins em número. */
function paraNumero(valor: unknown): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const texto = String(valor ?? '');
  if (!texto) return 0;
  // Formato BR: separador de milhar "." e decimal ","
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

function faixaDe(score: number): Faixa {
  if (score >= 70) return 'quente';
  if (score >= 40) return 'morno';
  return 'frio';
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export interface LeadParaScore {
  lead_type: string;
  phone?: string;
  cidade?: string;
  canal?: string;
  /** Detalhes do funil de compra/financiamento (App.tsx). */
  details?: Record<string, unknown>;
  /** Campos achatados do funil de venda (/vendasrapidas). */
  venda?: {
    placa?: string | null;
    fipe?: string | null;
    valor_desejado?: number | null;
    km?: number | null;
    marca?: string | null;
  };
}

/**
 * Nota de 0 a 100. Compra e Financiamento pontuam pela intenção declarada no
 * funil; Venda pontua pela viabilidade real do negócio (FIPE x preço pedido).
 */
export function calcularScore(lead: LeadParaScore): ResultadoScore {
  const motivos: string[] = [];
  let score = 0;

  if (!telefoneValido(lead.phone || '')) {
    return {
      score: 0,
      faixa: 'frio',
      motivos: ['Telefone inválido'],
      descartar: true,
      motivo_descarte: 'telefone_invalido',
      fora_do_raio: false,
    };
  }

  const d = lead.details ?? {};
  const cidade = String(lead.cidade || d.cidade || '');
  const noRaio = cidadeAtendida(cidade);

  if (lead.lead_type === 'Venda') {
    const v = lead.venda ?? {};

    if (v.placa && v.fipe) {
      score += 25;
      motivos.push('Placa consultada com FIPE');
    } else if (v.placa) {
      score += 10;
      motivos.push('Informou a placa');
    }

    const fipe = paraNumero(v.fipe);
    const pedido = paraNumero(v.valor_desejado);
    if (fipe > 0 && pedido > 0) {
      const razao = pedido / fipe;
      if (razao <= 1.1) {
        score += 20;
        motivos.push('Preço pedido dentro da FIPE');
      } else if (razao > 1.25) {
        score -= 25;
        motivos.push(`Preço pedido ${Math.round((razao - 1) * 100)}% acima da FIPE`);
      }
    }

    const km = paraNumero(v.km);
    if (km > 0 && km < 120000) {
      score += 10;
      motivos.push('Quilometragem baixa');
    }
  } else {
    // Compra e Financiamento
    if (d.id_veiculo) {
      score += 25;
      motivos.push('Escolheu um carro específico do estoque');
    }
    if (d.tem_troca === 'Sim') {
      score += 15;
      motivos.push('Tem carro na troca');
    }
    if (typeof d.down_payment === 'string' && /20 mil|acima/i.test(d.down_payment)) {
      score += 15;
      motivos.push('Entrada acima de R$ 20 mil');
    } else if (typeof d.down_payment === 'string' && /10 mil/i.test(d.down_payment)) {
      score += 8;
      motivos.push('Entrada declarada');
    }
    if (d.has_interest === 'Sim') {
      score += 10;
      motivos.push('Buscou um modelo pelo nome');
    }
    if (d.quer_financiamento === 'Não') {
      score += 10;
      motivos.push('Compra à vista');
    }
  }

  // Sinais comuns aos dois lados
  if (noRaio) {
    score += 10;
    motivos.push('Cidade dentro da área de atendimento');
  }

  const dddCliente = dddDe(lead.phone || '');
  if (DDDS_REGIAO.has(dddCliente)) {
    score += 5;
    motivos.push(`DDD ${dddCliente} da região`);
  }

  if (lead.canal && CANAIS_ALTA_INTENCAO.has(lead.canal)) {
    score += 10;
    motivos.push(`Origem de alta intenção (${lead.canal})`);
  }

  if (horarioComercialBRT()) {
    score += 5;
    motivos.push('Chegou em horário comercial');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    faixa: faixaDe(score),
    motivos,
    descartar: false,
    motivo_descarte: null,
    fora_do_raio: !noRaio && cidade !== '',
  };
}

/**
 * O que o consultor deve fazer com este lead. Sai junto no payload para o n8n
 * poder rotear sem reimplementar a regra.
 */
export function acaoRecomendada(r: ResultadoScore): string {
  if (r.descartar) return 'descartar_telefone_invalido';
  if (r.faixa === 'quente') return 'ligar_agora_meta_5min';
  if (r.faixa === 'morno') return 'fila_do_dia_whatsapp';
  return 'nutricao_automatica';
}
