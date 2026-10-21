// ---------------------------------------------------------------------------
// Meta Conversions API (envio server-side).
//
// Todos os eventos saíam só do navegador. Entre iOS/ATT e bloqueadores, uma
// fatia relevante nunca chegava — e a Meta otimizava com um retrato incompleto
// de quem converte.
//
// O `event_id` é o mesmo gerado no pixel (src/lib/tracking.ts) e enviado no
// payload do lead: com ele a Meta reconhece que pixel e servidor descrevem a
// MESMA conversão e conta uma só vez. Sem ele, a conversão dobraria.
//
// Configuração: defina META_CAPI_TOKEN no ambiente do servidor (token de acesso
// do Gerenciador de Eventos). Sem token, o envio é ignorado em silêncio — o
// funil nunca quebra por causa de mensuração.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';
import { paraE164 } from './telefone';

/**
 * Dataset usado quando nada é configurado. O funil (index.html) repete este
 * valor por necessidade — lá não há import — e o health compara os dois para
 * avisar se saírem do lugar.
 */
export const PIXEL_PADRAO = '3253946971444443';
/** Dataset em uso pelo servidor: Conversions API e páginas SSR do catálogo. */
export const PIXEL_ID = process.env.META_PIXEL_ID || PIXEL_PADRAO;
const CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';
const API_VERSION = 'v21.0';
// Código de teste do Gerenciador de Eventos; deixe vazio em produção.
const TEST_CODE = process.env.META_TEST_EVENT_CODE || '';

/** A Meta exige SHA-256 em minúsculas para todo dado pessoal. */
function hash(valor: string): string {
  return createHash('sha256').update(valor.trim().toLowerCase()).digest('hex');
}

export interface EventoCapi {
  eventName: 'Lead' | 'QualifiedLead' | 'ViewContent' | 'AddToCart' | 'Contact' | 'Purchase';
  /** Mesmo id do pixel — sem isto a Meta conta a conversão duas vezes. */
  eventId: string;
  phone?: string;
  firstName?: string;
  city?: string;
  /** IP e user-agent do visitante melhoram a taxa de correspondência. */
  clientIp?: string;
  userAgent?: string;
  /** Cookies do navegador, quando o cliente os enviar. */
  fbp?: string;
  fbc?: string;
  /**
   * Id anônimo do visitante (cookie manos_vid). O pixel manda o mesmo valor no
   * advanced matching, então os dois lados casam na mesma pessoa — e o CRM
   * guarda esse id para o Purchase, quando o navegador já não existe mais.
   */
  externalId?: string;
  /** E-mail, quando a pessoa informou. Hasheado aqui, nunca enviado em claro. */
  email?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  sourceUrl?: string;
  /**
   * `system_generated` para evento que não aconteceu numa página — a venda
   * confirmada no CRM é o caso. O padrão é `website`.
   */
  actionSource?: 'website' | 'system_generated';
}

export function capiConfigurado(): boolean {
  return Boolean(CAPI_TOKEN);
}

/**
 * Envia o evento. Nunca lança: falha de mensuração não pode derrubar a entrega
 * do lead ao consultor.
 */
export async function enviarEventoCapi(evento: EventoCapi): Promise<boolean> {
  if (!CAPI_TOKEN) return false;

  try {
    const userData: Record<string, unknown> = {};

    const telefone = paraE164(evento.phone || '');
    if (telefone) userData.ph = [hash(telefone)];
    if (evento.firstName) userData.fn = [hash(evento.firstName.split(' ')[0])];
    if (evento.email) userData.em = [hash(evento.email)];
    // O pixel hasheia o advanced matching do mesmo jeito (sha256 do valor em
    // minúsculas), então servidor e navegador chegam ao mesmo hash.
    if (evento.externalId) userData.external_id = [hash(evento.externalId)];
    if (evento.city) userData.ct = [hash(evento.city.replace(/\s/g, ''))];
    if (evento.clientIp) userData.client_ip_address = evento.clientIp;
    if (evento.userAgent) userData.client_user_agent = evento.userAgent;
    if (evento.fbp) userData.fbp = evento.fbp;
    if (evento.fbc) userData.fbc = evento.fbc;
    userData.country = [hash('br')];

    const customData: Record<string, unknown> = {
      currency: evento.currency || 'BRL',
      value: evento.value ?? 0,
    };
    if (evento.contentIds?.length) {
      customData.content_ids = evento.contentIds;
      customData.content_type = 'product';
      // Evento de catálogo quer os dois: `content_ids` casa o produto e
      // `contents` carrega a quantidade. Só com o primeiro, o Gerenciador de
      // Comércio aceita o evento mas não fecha a atribuição por produto.
      customData.contents = evento.contentIds.map((id) => ({ id, quantity: 1 }));
    }
    if (evento.contentName) customData.content_name = evento.contentName;

    const body: Record<string, unknown> = {
      data: [
        {
          event_name: evento.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: evento.eventId,
          action_source: evento.actionSource || 'website',
          event_source_url: evento.sourceUrl || 'https://manosveiculoscompra.com/',
          user_data: userData,
          custom_data: customData,
        },
      ],
    };
    if (TEST_CODE) body.test_event_code = TEST_CODE;

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(CAPI_TOKEN)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      console.warn(`Meta CAPI respondeu ${res.status}: ${detalhe.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Meta CAPI falhou:', err);
    return false;
  }
}
