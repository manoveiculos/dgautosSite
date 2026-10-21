// Camada única de eventos de conversão.
//
// Antes disso o site carregava GTM e GA4 no index.html mas nunca empurrava nada
// para o dataLayer — o Google Ads não tinha uma única conversão para otimizar, e
// o /vendasrapidas não reportava nada para plataforma nenhuma.
//
// Todo evento sai por três canais:
//   - dataLayer  -> GTM, que dispara a conversão do Google Ads e o evento do GA4
//   - fbq        -> pixel da Meta
//   - oaiq       -> pixel do OpenAI Ads (anúncios dentro do ChatGPT)
//
// Cada evento carrega um `event_id` estável. O pixel e o Conversions API
// (server-side) precisam do MESMO id para a Meta deduplicar em vez de contar
// duas vezes — por isso o id é gerado aqui e devolvido para quem chamar. O
// mesmo id vai para a OpenAI, que deduplica do mesmo jeito quando o Conversions
// API dela entrar.

import { getAttribution, getChannel } from './attribution';
import { idDoVisitante, telefoneParaMeta } from './visitante';

type Json = Record<string, unknown>;

export type LeadTipo = 'Compra' | 'Venda' | 'Financiamento';

function eventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function pushDataLayer(event: string, payload: Json): void {
  try {
    const w = window as unknown as { dataLayer?: Json[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...payload });
  } catch (err) {
    console.error('[tracking] dataLayer error:', err);
  }
}

function fbqTrack(kind: 'track' | 'trackCustom', name: string, payload: Json, id?: string): void {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (!fbq) return;
    if (id) fbq(kind, name, payload, { eventID: id });
    else fbq(kind, name, payload);
  } catch (err) {
    console.error('[tracking] fbq error:', err);
  }
}

/**
 * Pixel do OpenAI Ads.
 *
 * A assinatura é `oaiq("measure", nome, dados, opcoes)` — e a separação importa:
 * `type`, `amount` e `currency` vão nos DADOS; `event_id` vai nas OPÇÕES. Trocar
 * os dois de lugar não dá erro, o evento só chega sem o id de deduplicação.
 *
 * `amount` é inteiro na especificação, por isso o arredondamento fica aqui e não
 * espalhado em cada chamada.
 */
function oaiqMeasure(evento: string, dados: Json, opcoes?: Json): void {
  try {
    const oaiq = (window as unknown as { oaiq?: (...args: unknown[]) => void }).oaiq;
    if (!oaiq) return;
    if (opcoes) oaiq('measure', evento, dados, opcoes);
    else oaiq('measure', evento, dados);
  } catch (err) {
    console.error('[tracking] oaiq error:', err);
  }
}

/**
 * Espelha um evento no servidor, para ele reenviar pela Conversions API.
 *
 * `sendBeacon` de propósito: clique de WhatsApp navega para fora do site, e um
 * fetch normal seria cancelado no meio pela troca de página. O beacon é
 * entregue pelo navegador depois, mesmo com a aba já fechada.
 *
 * O mesmo `event_id` vai para o pixel e para cá — é o que impede a conversão de
 * contar duas vezes.
 */
function espelharNoServidor(evento: string, eventId: string, extras: Json = {}): void {
  try {
    const corpo = JSON.stringify({ evento, event_id: eventId, atribuicao: getAttribution(), ...extras });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/ads/conversao', new Blob([corpo], { type: 'application/json' }));
      return;
    }
    void fetch('/api/ads/conversao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: true,
    });
  } catch (err) {
    console.error('[tracking] beacon error:', err);
  }
}

/**
 * Advanced matching: passa ao pixel o que a pessoa já informou.
 *
 * Reinicializar o pixel com esses dados é a forma documentada de atualizá-los —
 * eles passam a acompanhar todo evento seguinte, não só o próximo. Os valores
 * vão em claro para o `fbq`, que os normaliza e hasheia no navegador antes de
 * qualquer requisição; o mesmo dado sai hasheado pelo servidor em
 * server/meta.ts, e os dois lados chegam ao mesmo hash.
 */
export function identificarVisitante(dados: {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
}): void {
  try {
    const w = window as unknown as { fbq?: (...args: unknown[]) => void; __manosPixelId?: string };
    const pixelId = w.__manosPixelId;
    if (!w.fbq || !pixelId) return;

    const avancado: Record<string, string> = { external_id: idDoVisitante() };
    const telefone = telefoneParaMeta(dados.telefone ?? '');
    if (telefone) avancado.ph = telefone;
    if (dados.email) avancado.em = dados.email.trim().toLowerCase();
    if (dados.nome) {
      const partes = dados.nome.trim().toLowerCase().split(/\s+/);
      if (partes[0]) avancado.fn = partes[0];
      if (partes.length > 1) avancado.ln = partes[partes.length - 1];
    }

    w.fbq('init', pixelId, avancado);
  } catch (err) {
    console.error('[tracking] advanced matching error:', err);
  }
}

/** Contexto de origem anexado a todo evento, para segmentar campanha no GA4/GTM. */
function baseContext(): Json {
  return { canal: getChannel() };
}

// ---------------------------------------------------------------------------
// Funil
// ---------------------------------------------------------------------------

/** Escolha inicial do visitante (Comprar / Vender / Financiar). */
export function trackFunnelStart(tipo: LeadTipo): void {
  pushDataLayer('funnel_start', { lead_tipo: tipo, ...baseContext() });
  fbqTrack('trackCustom', 'FunnelStart', { lead_tipo: tipo });
}

/**
 * Avanço de etapa. Evento customizado de propósito: a versão anterior disparava
 * `PageView` a cada passo "para manter a atividade alta", o que inflava o volume
 * de PageView em ~9x sem mexer no Lead e ensinava a Meta com um sinal falso.
 */
export function trackFunnelStep(tipo: LeadTipo | null, step: number): void {
  pushDataLayer('funnel_step', { lead_tipo: tipo ?? 'Indefinido', funnel_step: step, ...baseContext() });
  fbqTrack('trackCustom', 'FunnelStep', { lead_tipo: tipo ?? 'Indefinido', step });
}

/** Visitante abriu um veículo específico (deep link vindo do catálogo /estoque). */
export function trackViewVehicle(v: { id: string; description: string; price: number }): void {
  pushDataLayer('view_vehicle', {
    item_id: v.id,
    item_name: v.description,
    value: v.price,
    currency: 'BRL',
    ...baseContext(),
  });
  fbqTrack('track', 'ViewContent', {
    content_ids: [v.id],
    content_type: 'product',
    content_name: v.description,
    value: v.price,
    currency: 'BRL',
  });
  oaiqMeasure('contents_viewed', {
    type: 'contents',
    amount: Math.round(v.price),
    currency: 'BRL',
    contents: [{ id: v.id, name: v.description, content_type: 'vehicle', quantity: 1, amount: Math.round(v.price) }],
  });
}

/** Visitante selecionou um veículo dentro do funil. */
export function trackSelectVehicle(v: { id: string; description: string; price: number }): void {
  pushDataLayer('select_vehicle', {
    item_id: v.id,
    item_name: v.description,
    value: v.price,
    currency: 'BRL',
    ...baseContext(),
  });
  fbqTrack('track', 'AddToCart', {
    content_ids: [v.id],
    content_type: 'product',
    content_name: v.description,
    value: v.price,
    currency: 'BRL',
  });
  oaiqMeasure('items_added', {
    type: 'contents',
    amount: Math.round(v.price),
    currency: 'BRL',
    contents: [{ id: v.id, name: v.description, content_type: 'vehicle', quantity: 1, amount: Math.round(v.price) }],
  });
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

interface LeadEventArgs {
  tipo: LeadTipo;
  /** Valor do veículo quando houver — vira o valor da conversão no Google/Meta. */
  valor?: number | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
}

/**
 * Contato capturado no início do funil. É a conversão que realmente existe hoje
 * em volume — vale como conversão secundária no Google Ads, nunca como a
 * principal, para o lance não otimizar por quem só deixa telefone.
 */
export function trackLeadParcial(args: LeadEventArgs): string {
  const id = eventId();
  pushDataLayer('lead_parcial', {
    event_id: id,
    lead_tipo: args.tipo,
    value: args.valor ?? 0,
    currency: 'BRL',
    ...getAttribution(),
  });
  fbqTrack(
    'trackCustom',
    'LeadParcial',
    { lead_tipo: args.tipo, value: args.valor ?? 0, currency: 'BRL' },
    id,
  );
  // Evento customizado, não `lead_created`: o contato parcial não é o mesmo
  // acontecimento que o lead qualificado. Mandar os dois com o mesmo nome faria
  // a OpenAI otimizar por quem só deixa telefone — o mesmo erro que já foi
  // corrigido no pixel da Meta.
  oaiqMeasure(
    'custom',
    { type: 'custom', amount: Math.round(args.valor ?? 0), currency: 'BRL' },
    { event_id: id, custom_event_name: 'lead_parcial' },
  );
  return id;
}

/** Lead completo e qualificado — a conversão principal das campanhas. */
export function trackLead(args: LeadEventArgs): string {
  const id = eventId();
  pushDataLayer('lead', {
    event_id: id,
    lead_tipo: args.tipo,
    item_id: args.vehicleId ?? null,
    item_name: args.vehicleName ?? null,
    value: args.valor ?? 0,
    currency: 'BRL',
    ...getAttribution(),
  });
  fbqTrack(
    'track',
    'Lead',
    {
      content_name: args.tipo,
      content_category: args.tipo,
      content_ids: args.vehicleId ? [args.vehicleId] : [],
      content_type: 'product',
      value: args.valor ?? 0,
      currency: 'BRL',
    },
    id,
  );
  // `lead_created` é o evento padrão para envio de lead. O exemplo que vem no
  // painel da OpenAI usa `registration_completed`, que descreve criação de
  // conta — aqui ninguém cria conta, e otimizar por ele ensinaria a campanha a
  // buscar a ação errada.
  oaiqMeasure(
    'lead_created',
    { type: 'customer_action', amount: Math.round(args.valor ?? 0), currency: 'BRL' },
    { event_id: id },
  );
  return id;
}

/** Consulta de placa concluída no /vendasrapidas — sinal forte de intenção real. */
export function trackPlacaConsultada(ok: boolean): void {
  pushDataLayer('placa_consultada', { sucesso: ok, ...baseContext() });
  fbqTrack('trackCustom', 'PlacaConsultada', { sucesso: ok });
}

/**
 * Clique em WhatsApp ou telefone.
 *
 * Para uma revenda isto é conversão de verdade, não sinal secundário: boa parte
 * do negócio começa e termina no WhatsApp, sem passar pelo formulário. Por isso
 * vai também para o servidor — é o clique com maior chance de ser perdido por
 * bloqueador, e é justamente o que a Conversions API recupera.
 */
export function trackContato(canal: 'whatsapp' | 'telefone', contexto: string): string {
  const id = eventId();
  pushDataLayer('contato_direto', { canal_contato: canal, contexto, ...baseContext() });
  fbqTrack('track', 'Contact', { content_name: contexto, source: canal });
  // No pixel o nome do evento custom vai nas OPÇÕES (4º argumento).
  oaiqMeasure(
    'custom',
    { type: 'custom' },
    { event_id: id, custom_event_name: canal },
  );
  espelharNoServidor(canal, id, { contexto });
  return id;
}
