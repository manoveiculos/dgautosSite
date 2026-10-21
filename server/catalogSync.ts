// ---------------------------------------------------------------------------
// Mapeamento placa -> content_id do catálogo da Meta.
//
// O catálogo do Gerenciador de Comércio é alimentado pela Autos 360, que gera
// um id próprio para cada veículo — diferente do `id` do feed da Altimus, que é
// o que o site manda nos eventos. Enquanto sair o id da Altimus, a Meta não
// reconhece o produto: a taxa de correspondência do catálogo fica em 0% mesmo
// com o pixel disparando certo. Eram dois problemas independentes; o pixel já
// foi resolvido, este é o que sobrou.
//
// A Altimus foi acionada e não fornece essa correspondência, então a solução
// não pode depender deles. O catálogo é da loja: dá para lê-lo pela Graph API e
// casar cada veículo pelo NOME (a Autos 360 copia a `descricao` da Altimus, só
// normaliza espaço duplo), com o PREÇO como trava de segurança.
//
// O resultado vai para `vehicle_meta_mapping` (SQL em
// supabase/vehicle_meta_mapping.sql) e é lido pelo catálogo quando o cache do
// feed é renovado.
//
// Sem META_CATALOG_ACCESS_TOKEN ou SUPABASE_SERVICE_ROLE_KEY nada disso roda e
// o site segue mandando o id da Altimus — exatamente o comportamento de antes,
// nunca um erro na página.
// ---------------------------------------------------------------------------

const GRAPH_VERSION = 'v21.0';
const CATALOG_ID = process.env.META_CATALOG_ID || '712583511204994';
const CATALOG_TOKEN = process.env.META_CATALOG_ACCESS_TOKEN || '';
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://jkblxdxnbmciicakusnl.supabase.co';
// A tabela guarda placa e é service-role-only, então a chave publishable usada
// no resto do projeto não serve aqui.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABELA = 'vehicle_meta_mapping';
const FETCH_TIMEOUT_MS = 15_000;
/** Mesma janela do cache do feed: o mapeamento só muda quando o estoque muda. */
const MAPA_TTL_MS = 10 * 60 * 1000;
/**
 * Quanto tempo a linha de um veículo vendido continua na tabela.
 *
 * O carro sai do feed no dia em que é vendido, mas a venda só é confirmada no
 * CRM depois — às vezes dias depois. Apagar na hora deixaria o `Purchase` sem
 * content_id justamente no evento que mais importa.
 */
const RETENCAO_APOS_SAIDA_DIAS = 90;

export type Confianca = 'exact' | 'fuzzy' | 'ambiguous' | 'unmatched';

export interface VeiculoParaSync {
  id: string;
  placa: string;
  title: string;
  price: number;
}

export interface ResultadoMatch {
  placa: string;
  altimusId: string;
  metaContentId: string | null;
  matchedName: string | null;
  confidence: Confianca;
  /** fuzzy/ambíguo: serve para ViewContent, não para atribuir venda. */
  needsReview: boolean;
}

interface ProdutoCatalogo {
  /** Id interno da Graph. NÃO é o que a Meta casa com os eventos. */
  id: string;
  /**
   * SKU que veio do feed — é ESTE valor que precisa ir em content_ids para o
   * catálogo reconhecer o produto. Confundir um com o outro deixa a taxa de
   * correspondência em 0% com tudo parecendo certo dos dois lados.
   */
  retailer_id?: string;
  name: string;
  price: string; // "219900.00 BRL"
}

/** O que vai em content_ids: retailer_id quando existir, id interno como último recurso. */
function idParaEvento(p: ProdutoCatalogo): string {
  return p.retailer_id || p.id;
}

export function mapeamentoConfigurado(): boolean {
  return Boolean(CATALOG_TOKEN && SERVICE_KEY);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchComTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Colapsa espaço duplo e tira acento — a diferença conhecida entre os textos. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function precoDoCatalogo(valor: string): number {
  const n = parseFloat(String(valor).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Tolerância relativa (8%): preço serve para separar carros diferentes, não
 * para exigir que as duas tabelas estejam sincronizadas ao centavo. Com
 * tolerância fixa em reais, um reajuste normal viraria "sem correspondência".
 */
function precosCompativeis(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= Math.max(a, b) * 0.08;
}

/**
 * Levenshtein com duas linhas e poda pelo limite — o catálogo inteiro é
 * comparado com cada veículo, então vale cortar cedo o que já passou do teto.
 */
function distanciaEdicao(a: string, b: string, maximo: number): number {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;

  let anterior: number[] = new Array(b.length + 1);
  let atual: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) anterior[j] = j;

  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    let melhorDaLinha = atual[0];
    for (let j = 1; j <= b.length; j++) {
      atual[j] =
        a[i - 1] === b[j - 1]
          ? anterior[j - 1]
          : 1 + Math.min(anterior[j], atual[j - 1], anterior[j - 1]);
      if (atual[j] < melhorDaLinha) melhorDaLinha = atual[j];
    }
    if (melhorDaLinha > maximo) return maximo + 1;
    const troca = anterior;
    anterior = atual;
    atual = troca;
  }

  return anterior[b.length];
}

/**
 * Só placa em formato conhecido entra em filtro de URL do PostgREST. O valor
 * vem de um feed de terceiro; sem isto, um caractere estranho quebraria a
 * consulta — ou apagaria a linha errada.
 */
function placaValida(placa: string): boolean {
  return /^[A-Za-z0-9]{5,8}$/.test(placa);
}

function cabecalhosSupabase(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Leitura do mapeamento (usada pelo catálogo a cada renovação do cache)
// ---------------------------------------------------------------------------

export interface MapeamentoVeiculo {
  contentId: string;
  /** Match aproximado ou ambíguo: bom para ViewContent, não para venda. */
  needsReview: boolean;
}

let mapaCache: { at: number; mapa: Map<string, MapeamentoVeiculo> } | null = null;

/**
 * placa -> content_id. Nunca lança e nunca segura a página: sem configuração ou
 * com o Supabase fora do ar, devolve mapa vazio e o catálogo usa o id da
 * Altimus, como antes.
 */
export async function lerMapeamento(): Promise<Map<string, MapeamentoVeiculo>> {
  if (mapaCache && Date.now() - mapaCache.at < MAPA_TTL_MS) return mapaCache.mapa;
  if (!SERVICE_KEY) return new Map();

  try {
    const res = await fetchComTimeout(
      `${SUPABASE_URL}/rest/v1/${TABELA}?select=placa,meta_content_id,needs_review&meta_content_id=not.is.null`,
      { headers: cabecalhosSupabase() },
    );
    if (!res.ok) {
      console.warn(`vehicle_meta_mapping leitura non-ok (${res.status}) — confira a tabela/RLS`);
      return mapaCache?.mapa ?? new Map();
    }
    const linhas = (await res.json()) as {
      placa: string;
      meta_content_id: string;
      needs_review: boolean;
    }[];
    const mapa = new Map<string, MapeamentoVeiculo>();
    for (const linha of linhas) {
      if (linha.placa && linha.meta_content_id) {
        mapa.set(linha.placa.toUpperCase(), {
          contentId: linha.meta_content_id,
          needsReview: Boolean(linha.needs_review),
        });
      }
    }
    mapaCache = { at: Date.now(), mapa };
    return mapa;
  } catch (err) {
    console.error('vehicle_meta_mapping leitura falhou:', err);
    return mapaCache?.mapa ?? new Map();
  }
}

export type MotivoVenda = 'ok' | 'placa_invalida' | 'sem_mapeamento' | 'precisa_revisao';

/**
 * content_id para atribuir uma VENDA — regra mais dura que a da página.
 *
 * Na página, um match aproximado no máximo gera ruído no catálogo. Numa venda,
 * ele credita dinheiro ao veículo errado: dois carros de nome e preço parecidos
 * não se distinguem só por esses dados. Então match `needs_review` é recusado
 * aqui de propósito, e o evento sai sem produto em vez de sair com o errado.
 */
export async function contentIdParaVenda(
  placa: string,
): Promise<{ contentId: string | null; motivo: MotivoVenda }> {
  const chave = (placa || '').trim().toUpperCase();
  if (!placaValida(chave)) return { contentId: null, motivo: 'placa_invalida' };

  const entrada = (await lerMapeamento()).get(chave);
  if (!entrada) return { contentId: null, motivo: 'sem_mapeamento' };
  if (entrada.needsReview) return { contentId: null, motivo: 'precisa_revisao' };

  return { contentId: entrada.contentId, motivo: 'ok' };
}

/**
 * Carimba `metaContentId` nos veículos do feed. Quem não tem match fica sem o
 * campo, e o catálogo cai no id da Altimus.
 */
export async function aplicarMapeamento<T extends { placa?: string; metaContentId?: string }>(
  veiculos: T[],
): Promise<T[]> {
  if (!SERVICE_KEY) return veiculos;

  const mapa = await lerMapeamento();
  if (mapa.size === 0) return veiculos;

  for (const veiculo of veiculos) {
    const placa = (veiculo.placa || '').toUpperCase();
    // Aqui o match aproximado vale: na página, o pior caso é ruído no catálogo.
    const entrada = placa ? mapa.get(placa) : undefined;
    if (entrada) veiculo.metaContentId = entrada.contentId;
  }
  return veiculos;
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

async function lerCatalogoMeta(): Promise<ProdutoCatalogo[]> {
  const produtos: ProdutoCatalogo[] = [];
  // Token no header, não na query: URL de Graph API aparece em log de servidor
  // e de proxy.
  let url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${CATALOG_ID}/products` +
    `?fields=id,retailer_id,name,price&limit=100`;

  // Teto de páginas: paginação com defeito não pode virar laço infinito.
  for (let pagina = 0; url && pagina < 50; pagina++) {
    const res = await fetchComTimeout(url, {
      headers: { Authorization: `Bearer ${CATALOG_TOKEN}` },
    });
    const json = (await res.json()) as {
      data?: ProdutoCatalogo[];
      paging?: { next?: string };
      error?: unknown;
    };
    if (json.error) throw new Error(`Graph API: ${JSON.stringify(json.error)}`);
    produtos.push(...(json.data ?? []));
    url = json.paging?.next ?? '';
  }

  return produtos;
}

function casarVeiculos(
  veiculos: VeiculoParaSync[],
  produtos: ProdutoCatalogo[],
): ResultadoMatch[] {
  const catalogo = produtos.map((p) => ({
    ...p,
    nomeNormalizado: normalizar(p.name),
    preco: precoDoCatalogo(p.price),
  }));

  // Um produto do catálogo não pode ser atribuído a dois veículos na mesma
  // rodada — senão duas unidades parecidas apontariam para o mesmo anúncio.
  const usados = new Set<string>();
  const resultados: ResultadoMatch[] = [];

  for (const veiculo of veiculos) {
    const alvo = normalizar(veiculo.title);
    const disponiveis = catalogo.filter((p) => !usados.has(p.id));
    let confidence: Confianca = 'unmatched';
    let escolhido: (typeof catalogo)[number] | undefined;

    const exatos = disponiveis.filter((p) => p.nomeNormalizado === alvo);

    if (exatos.length === 1) {
      // Nome idêntico e único: confiável sozinho, sem exigir preço.
      escolhido = exatos[0];
      confidence = 'exact';
    } else if (exatos.length > 1) {
      // Duas unidades do mesmo modelo/cor/ano — o preço é o único critério que
      // resta. Se ele não separar, não adivinha: fica para revisão.
      const porPreco = exatos.filter((p) => precosCompativeis(p.preco, veiculo.price));
      if (porPreco.length === 1) {
        escolhido = porPreco[0];
        confidence = 'exact';
      } else {
        confidence = 'ambiguous';
      }
    } else {
      // Nome aproximado EXIGE preço compatível. "Preta"/"Prata" e
      // "Branca"/"Branco" têm distância 1: sem a trava de preço, uma venda
      // seria atribuída ao carro errado.
      const candidatos = disponiveis
        .filter((p) => precosCompativeis(p.preco, veiculo.price))
        .map((p) => ({ p, dist: distanciaEdicao(p.nomeNormalizado, alvo, 4) }))
        .filter(({ dist }) => dist <= 4)
        .sort((a, b) => a.dist - b.dist);

      if (candidatos.length > 0) {
        escolhido = candidatos[0].p;
        confidence = 'fuzzy';
      }
    }

    if (escolhido) usados.add(escolhido.id);

    resultados.push({
      placa: veiculo.placa,
      altimusId: veiculo.id,
      metaContentId: escolhido ? idParaEvento(escolhido) : null,
      matchedName: escolhido?.name ?? null,
      confidence,
      needsReview: confidence === 'fuzzy' || confidence === 'ambiguous',
    });
  }

  return resultados;
}

interface LinhaTabela {
  placa: string;
  left_stock_at: string | null;
}

async function linhasNaTabela(): Promise<LinhaTabela[]> {
  const res = await fetchComTimeout(
    `${SUPABASE_URL}/rest/v1/${TABELA}?select=placa,left_stock_at`,
    { headers: cabecalhosSupabase() },
  );
  if (!res.ok) return [];
  const linhas = (await res.json()) as LinhaTabela[];
  return linhas.filter((l) => l.placa);
}

/** Lista para filtro `in.(...)` do PostgREST — placas já validadas. */
function listaPlacas(placas: string[]): string {
  return placas.map((p) => `"${p}"`).join(',');
}

export interface ResumoSync {
  matched: number;
  needsReview: number;
  unmatched: number;
  /**
   * Casamentos em que o id do catálogo é IGUAL ao id do feed da Altimus. Se
   * este número for igual a `matched`, o catálogo usa o mesmo número e todo o
   * mapeamento é desnecessário.
   */
  jaIguais: number;
  /** Saíram do feed nesta rodada (vendidos): linha mantida para o Purchase. */
  marcadosForaDeEstoque: number;
  /** Passaram da janela de retenção e foram removidos de vez. */
  purgados: number;
  results: ResultadoMatch[];
}

/**
 * Casa o estoque com o catálogo e grava o mapeamento.
 *
 * Recebe os veículos prontos (o chamador usa o `getVehicles()` do catálogo)
 * para não duplicar o parser do feed nem criar ciclo de import.
 */
export async function syncCatalogMapping(veiculos: VeiculoParaSync[]): Promise<ResumoSync> {
  if (!CATALOG_TOKEN) throw new Error('META_CATALOG_ACCESS_TOKEN não configurado');
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado');

  const comPlaca = veiculos.filter((v) => placaValida(v.placa));
  if (comPlaca.length === 0) {
    throw new Error('nenhum veículo com placa válida no feed — sincronização abortada');
  }

  const produtos = await lerCatalogoMeta();
  const resultados = casarVeiculos(comPlaca, produtos);

  const linhas = resultados.map((r) => ({
    placa: r.placa.toUpperCase(),
    altimus_id: r.altimusId,
    meta_content_id: r.metaContentId,
    matched_name: r.matchedName,
    match_confidence: r.confidence,
    needs_review: r.needsReview,
    synced_at: new Date().toISOString(),
    // Está no feed agora: se tinha saído e voltou, limpa a marca de saída.
    left_stock_at: null,
  }));

  const resUpsert = await fetchComTimeout(
    `${SUPABASE_URL}/rest/v1/${TABELA}?on_conflict=placa`,
    {
      method: 'POST',
      headers: cabecalhosSupabase({
        Prefer: 'return=minimal,resolution=merge-duplicates',
      }),
      body: JSON.stringify(linhas),
    },
  );
  if (!resUpsert.ok) {
    const detalhe = await resUpsert.text().catch(() => '');
    throw new Error(`gravação falhou (${resUpsert.status}): ${detalhe.slice(0, 300)}`);
  }

  // Veículo vendido sai do feed, mas a linha dele fica: a venda só é confirmada
  // no CRM depois, e sem a linha o Purchase perderia o content_id justamente no
  // evento que mais importa. Aqui só marca a saída; a remoção vem depois da
  // janela de retenção.
  //
  // A marcação é o passo perigoso: se o feed vier pela metade (a Altimus
  // responde 200 com XML truncado de vez em quando), marcar "tudo que não veio"
  // tiraria o estoque inteiro de circulação. Por isso ela é abortada quando
  // pegaria mais da metade das linhas — a rodada seguinte marca.
  let marcadosForaDeEstoque = 0;
  let purgados = 0;
  const atuais = new Set(linhas.map((l) => l.placa));
  const existentes = await linhasNaTabela();
  const sumiram = existentes
    .filter((l) => !atuais.has(l.placa.toUpperCase()) && !l.left_stock_at)
    .map((l) => l.placa)
    .filter(placaValida);

  if (sumiram.length > 0 && sumiram.length > existentes.length * 0.5) {
    console.warn(
      `[catalog-sync] marcação de saída abortada: ${sumiram.length} de ${existentes.length} placas sumiriam de uma vez — o feed provavelmente veio incompleto`,
    );
  } else if (sumiram.length > 0) {
    const resSaida = await fetchComTimeout(
      `${SUPABASE_URL}/rest/v1/${TABELA}?placa=in.(${encodeURIComponent(listaPlacas(sumiram))})`,
      {
        method: 'PATCH',
        headers: cabecalhosSupabase({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ left_stock_at: new Date().toISOString() }),
      },
    );
    if (resSaida.ok) marcadosForaDeEstoque = sumiram.length;
    else console.warn(`[catalog-sync] marcação de saída non-ok (${resSaida.status})`);
  }

  // Passada a retenção, a linha não atribui mais nada e só ocupa espaço.
  const limite = new Date(
    Date.now() - RETENCAO_APOS_SAIDA_DIAS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const vencidos = existentes.filter((l) => l.left_stock_at && l.left_stock_at < limite).length;
  if (vencidos > 0) {
    const resPurga = await fetchComTimeout(
      `${SUPABASE_URL}/rest/v1/${TABELA}?left_stock_at=lt.${encodeURIComponent(limite)}`,
      { method: 'DELETE', headers: cabecalhosSupabase({ Prefer: 'return=minimal' }) },
    );
    if (resPurga.ok) purgados = vencidos;
    else console.warn(`[catalog-sync] purga non-ok (${resPurga.status})`);
  }

  // O catálogo lê o mapeamento pelo cache; sem isto, a rodada nova só
  // apareceria no site até 10 minutos depois.
  mapaCache = null;

  const needsReview = resultados.filter((r) => r.needsReview).length;
  const unmatched = resultados.filter((r) => r.confidence === 'unmatched').length;
  // Responde de uma vez a pergunta que originou este módulo: o catálogo usa o
  // mesmo número do feed? Se todos baterem, o mapeamento é redundante e o site
  // já estava mandando o id certo — o 0% tem outra causa.
  const jaIguais = resultados.filter(
    (r) => r.metaContentId && r.metaContentId === r.altimusId,
  ).length;

  if (needsReview > 0 || unmatched > 0) {
    console.warn(
      `[catalog-sync] ${unmatched} sem correspondência, ${needsReview} para revisão:`,
      resultados
        .filter((r) => r.needsReview || r.confidence === 'unmatched')
        .map((r) => `${r.placa} (${r.altimusId}, ${r.confidence})`)
        .join(', '),
    );
  }

  return {
    matched: resultados.filter((r) => r.confidence === 'exact').length,
    needsReview,
    unmatched,
    jaIguais,
    marcadosForaDeEstoque,
    purgados,
    results: resultados,
  };
}
