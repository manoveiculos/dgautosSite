// ---------------------------------------------------------------------------
// OpenAI Ads Conversions API (envio server-side).
//
// Par do pixel oaiq, pelo mesmo motivo do Meta CAPI: bloqueador, iOS e aba
// fechada cedo derrubam uma fatia dos eventos de navegador, e a plataforma
// otimiza com um retrato incompleto de quem converte.
//
// A deduplicação é por `id`: aqui ele é o MESMO event_id gerado no pixel
// (src/lib/tracking.ts) e devolvido no payload do lead. Com ele a OpenAI
// entende que navegador e servidor descrevem a mesma conversão e conta uma vez
// só. Sem ele, a conversão dobra.
//
// Configuração: OPENAI_ADS_API_KEY no ambiente do servidor (Ads Manager ->
// Conversões -> Criar chave de conversão). Sem chave, o envio é ignorado em
// silêncio — o funil nunca quebra por causa de mensuração.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';
import { paraE164 } from './telefone';

// Sem default embutido: um id errado manda conversao para a conta de outro.
const PIXEL_ID = process.env.OPENAI_ADS_PIXEL_ID || '';
const API_KEY = process.env.OPENAI_ADS_API_KEY || '';
const ENDPOINT = 'https://bzr.openai.com/v1/events';

/** A especificação pede hex minúsculo de 64 caracteres. */
function sha256(valor: string): string {
  return createHash('sha256').update(valor.trim().toLowerCase()).digest('hex');
}

/**
 * `source_url` aceita só origem + caminho — query e fragmento são recusados.
 * Normalizar aqui evita mandar a URL com utm_* e o evento ser rejeitado.
 */
function urlLimpa(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return 'https://manosveiculoscompra.com/';
  }
}

/** Itens do evento, quando ele descreve conteúdo (veículo visto/escolhido). */
export interface ItemOpenAiAds {
  id: string;
  name?: string;
  content_type?: string;
  quantity?: number;
  amount?: number;
}

export interface EventoOpenAiAds {
  /** Evento padrão da OpenAI; 'custom' exige `customEventName`. */
  eventName: 'lead_created' | 'contents_viewed' | 'items_added' | 'custom';
  /** Mesmo id do pixel — é o que deduplica navegador e servidor. */
  eventId: string;
  customEventName?: string;
  phone?: string;
  city?: string;
  clientIp?: string;
  userAgent?: string;
  /** Identificador de clique do anúncio. Repassado cru, como manda a spec. */
  oppref?: string | null;
  value?: number;
  currency?: string;
  sourceUrl?: string;
  contents?: ItemOpenAiAds[];
}

// Cada evento padrão exige a forma de `data` correspondente — mandar a errada
// faz o evento ser recusado.
const FORMA_DE_DADOS: Record<EventoOpenAiAds['eventName'], string> = {
  lead_created: 'customer_action',
  contents_viewed: 'contents',
  items_added: 'contents',
  custom: 'custom',
};

/** Precisa dos dois: chave sem pixel (ou o contrario) nao envia nada. */
export function openAiAdsConfigurado(): boolean {
  return Boolean(API_KEY && PIXEL_ID);
}

/**
 * Envia o evento. Nunca lança: falha de mensuração não pode derrubar a entrega
 * do lead ao consultor.
 */
export async function enviarEventoOpenAiAds(evento: EventoOpenAiAds): Promise<boolean> {
  if (!API_KEY || !PIXEL_ID) return false;

  try {
    const user: Record<string, unknown> = {};

    // A API tem campo para e-mail e para id externo, mas NÃO para telefone — e
    // o funil captura telefone, não e-mail. O telefone normalizado em E.164 é o
    // identificador estável que a loja tem da pessoa, então entra como
    // external_id, com hash. Nada em claro sai daqui.
    const telefone = paraE164(evento.phone || '');
    if (telefone) user.external_id_sha256 = sha256(telefone);

    // Ao contrário da Meta, cidade e país vão em texto puro nesta API.
    if (evento.city) user.city = evento.city;
    user.country = 'BR';
    if (evento.clientIp) user.ip_address = evento.clientIp;
    if (evento.userAgent) user.user_agent = evento.userAgent;

    const data: Record<string, unknown> = {
      type: FORMA_DE_DADOS[evento.eventName],
      amount: Math.round(evento.value ?? 0),
      currency: evento.currency || 'BRL',
    };
    if (evento.contents?.length) data.contents = evento.contents;

    const item: Record<string, unknown> = {
      id: evento.eventId,
      type: evento.eventName,
      timestamp_ms: Date.now(),
      source_url: urlLimpa(evento.sourceUrl || 'https://manosveiculoscompra.com/'),
      action_source: 'web',
      data,
      user,
    };
    // No CAPI o `custom_event_name` fica no NÍVEL DO EVENTO, irmão de `type` —
    // é assim que o próprio painel gera o curl. (No pixel é diferente: lá ele
    // vai no objeto de opções, o 4º argumento do oaiq.) Trocar de lugar não dá
    // erro: o evento chega como "custom" sem nome e some do relatório.
    if (evento.eventName === 'custom' && evento.customEventName) {
      item.custom_event_name = evento.customEventName;
    }
    if (evento.oppref) item.oppref = evento.oppref;

    // validate_only fica false: com true a OpenAI valida e descarta o evento.
    const corpo = JSON.stringify({ validate_only: false, events: [item] });

    // Uma retentativa, só para falha temporária (5xx, 429 ou rede). Erro 4xx é
    // payload errado: repetir daria o mesmo resultado e só atrasaria a resposta.
    // A janela de 7 dias do timestamp_ms cobre com folga esta espera.
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const res = await fetch(`${ENDPOINT}?pid=${encodeURIComponent(PIXEL_ID)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: corpo,
        });

        if (res.ok) return true;

        const temporario = res.status >= 500 || res.status === 429;
        const detalhe = await res.text().catch(() => '');
        console.warn(
          `OpenAI Ads CAPI respondeu ${res.status} (tentativa ${tentativa}): ${detalhe.slice(0, 300)}`,
        );
        if (!temporario || tentativa === 2) return false;
      } catch (err) {
        console.warn(`OpenAI Ads CAPI falhou na rede (tentativa ${tentativa}):`, err);
        if (tentativa === 2) return false;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  } catch (err) {
    console.error('OpenAI Ads CAPI falhou:', err);
    return false;
  }
}
