// Atribuição de mídia paga.
//
// O tráfego entra por Meta, Google, TikTok, busca orgânica e motores de IA ao
// mesmo tempo. Sem gravar de onde o clique veio, o consultor não consegue
// priorizar e nenhuma plataforma consegue otimizar. Este módulo lê os
// parâmetros no primeiro carregamento e devolve o mesmo objeto para todo lead
// gerado na sessão — inclusive os leads parciais.
//
// Duas camadas de persistência, de propósito:
//   - first touch  (localStorage)   -> qual anúncio trouxe a pessoa a primeira vez
//   - last touch   (sessionStorage) -> qual clique originou ESTA visita
// A plataforma de anúncio otimiza pelo last touch; a leitura de negócio costuma
// querer o first touch. Mandamos os dois.

const FIRST_TOUCH_KEY = 'manos_attr_first_v1';
const LAST_TOUCH_KEY = 'manos_attr_last_v1';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
] as const;

// Identificadores de clique de cada plataforma. gclid/gbraid/wbraid = Google,
// fbclid = Meta, ttclid = TikTok, msclkid = Microsoft, twclid = X,
// oppref = OpenAI Ads (anúncios no ChatGPT).
//
// O oppref é OPACO: a especificação da OpenAI manda repassar o valor cru, sem
// decodificar nem parsear. Ele é o que liga a conversão server-side ao clique
// no anúncio — sem ele, a campanha do ChatGPT não recebe crédito.
const CLICK_ID_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'ttclid',
  'msclkid',
  'twclid',
  'li_fat_id',
  'oppref',
] as const;

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  ttclid?: string;
  msclkid?: string;
  twclid?: string;
  li_fat_id?: string;
  oppref?: string;
  /** Canal inferido quando não há utm_source — ex.: "google_organico", "chatgpt". */
  canal: string;
  referrer: string | null;
  landing_page: string;
  captured_at: string;
}

function safeGet(store: Storage | undefined, key: string): Attribution | null {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

function safeSet(store: Storage | undefined, key: string, value: Attribution): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado / storage cheio — seguimos sem persistir */
  }
}

/**
 * Deriva o canal quando a URL não traz utm_source. Cobre o tráfego que chega
 * por busca e por motores de IA, que é onde o catálogo SSR (/estoque) atua.
 */
function inferChannel(params: URLSearchParams, referrer: string | null): string {
  if (params.get('utm_source')) return params.get('utm_source')!;
  if (params.get('gclid') || params.get('gbraid') || params.get('wbraid')) return 'google_ads';
  if (params.get('fbclid')) return 'meta_ads';
  if (params.get('ttclid')) return 'tiktok_ads';
  if (params.get('msclkid')) return 'bing_ads';
  if (params.get('oppref')) return 'openai_ads';

  if (!referrer) return 'direto';

  let host = '';
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'direto';
  }

  if (host.includes('chatgpt.com') || host.includes('openai.com')) return 'chatgpt';
  if (host.includes('perplexity.ai')) return 'perplexity';
  if (host.includes('claude.ai') || host.includes('anthropic.com')) return 'claude';
  if (host.includes('gemini.google') || host.includes('bard.google')) return 'gemini';
  if (host.includes('google.')) return 'google_organico';
  if (host.includes('bing.com')) return 'bing_organico';
  if (host.includes('instagram.com')) return 'instagram_organico';
  if (host.includes('facebook.com') || host.includes('fb.com')) return 'facebook_organico';
  if (host.includes('tiktok.com')) return 'tiktok_organico';
  if (host.includes('youtube.com')) return 'youtube';
  if (host.includes('dgautomoveis.com.br')) return 'site_principal';
  if (host.includes('manosveiculoscompra.com')) return 'interno';

  return host;
}

function readFromUrl(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || null;

  const attr: Attribution = {
    canal: inferChannel(params, referrer),
    referrer,
    landing_page: window.location.pathname + window.location.search,
    captured_at: new Date().toISOString(),
  };

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) attr[key] = value.slice(0, 200);
  }
  for (const key of CLICK_ID_KEYS) {
    const value = params.get(key);
    if (value) attr[key] = value.slice(0, 400);
  }

  return attr;
}

/** True quando a URL atual carrega algum sinal de campanha (não só navegação interna). */
function hasCampaignSignal(attr: Attribution): boolean {
  return Boolean(
    attr.utm_source ||
      attr.gclid ||
      attr.gbraid ||
      attr.wbraid ||
      attr.fbclid ||
      attr.ttclid ||
      attr.msclkid ||
      attr.twclid ||
      attr.oppref,
  );
}

let cached: { first: Attribution | null; last: Attribution } | null = null;

/**
 * Chamar uma vez no boot da página, antes de qualquer captura de lead.
 * Idempotente: só sobrescreve o last touch quando a URL traz sinal novo de
 * campanha, para uma navegação interna não apagar a origem real da visita.
 */
export function initAttribution(): void {
  if (typeof window === 'undefined' || cached) return;

  const current = readFromUrl();
  const storedLast = safeGet(sessionStorage, LAST_TOUCH_KEY);
  const storedFirst = safeGet(localStorage, FIRST_TOUCH_KEY);

  // Navegação interna sem parâmetros não deve sobrescrever a origem da sessão.
  const last = !storedLast || hasCampaignSignal(current) ? current : storedLast;
  safeSet(sessionStorage, LAST_TOUCH_KEY, last);

  const first = storedFirst ?? last;
  if (!storedFirst) safeSet(localStorage, FIRST_TOUCH_KEY, first);

  cached = { first, last };
}

/**
 * Objeto pronto para anexar ao payload do lead. Achatado no last touch (o que
 * as plataformas usam) com o first touch aninhado para leitura de negócio.
 */
export function getAttribution(): Record<string, unknown> {
  if (!cached) initAttribution();
  if (!cached) return {};

  const { first, last } = cached;
  return {
    ...last,
    first_touch:
      first && first.captured_at !== last.captured_at
        ? { canal: first.canal, utm_source: first.utm_source, utm_campaign: first.utm_campaign, captured_at: first.captured_at }
        : null,
  };
}

/** Canal da visita atual — usado no score e nos eventos de conversão. */
export function getChannel(): string {
  if (!cached) initAttribution();
  return cached?.last.canal ?? 'direto';
}
