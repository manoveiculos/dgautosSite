// ---------------------------------------------------------------------------
// Identificador anônimo do visitante (`external_id` da Meta).
//
// É o terceiro sinal de correspondência mais forte depois de _fbp/_fbc, e o
// único que atravessa o tempo: o mesmo id acompanha a pessoa da primeira visita
// até a venda ser confirmada no CRM, semanas depois, quando não existe mais
// navegador nenhum na história para gerar cookie.
//
// Cookie de primeira parte, não localStorage, por um motivo prático: o Express
// precisa ler esse valor para montar o evento do Conversions API. O que está em
// localStorage só chega ao servidor se cada chamada o copiar no corpo — mais um
// ponto de falha, e o `Purchase` (que sai do CRM) não teria como recuperá-lo.
//
// Sem HttpOnly de propósito: o pixel no navegador também lê e escreve este
// valor. Não é segredo — é um UUID sem significado fora da nossa medição.
// ---------------------------------------------------------------------------

const COOKIE = 'manos_vid';
/** Dois anos: a janela de atribuição da Meta é bem menor, mas o CRM é lento. */
const VALIDADE_S = 63072000;

function novoId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

function lerCookie(nome: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${nome}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Id do visitante, criado na primeira visita e reaproveitado depois.
 *
 * O index.html e as páginas SSR do catálogo já criam este cookie antes do pixel
 * inicializar, para o `external_id` valer desde o primeiro PageView. Esta função
 * é a rede de segurança para qualquer caminho que não passe por lá.
 */
export function idDoVisitante(): string {
  const existente = lerCookie(COOKIE);
  if (existente) return existente;

  const id = novoId();
  try {
    const seguro = location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(id)};Max-Age=${VALIDADE_S};Path=/;SameSite=Lax${seguro}`;
  } catch {
    /* sem cookie o id vira efêmero, o que ainda é melhor que nenhum */
  }
  return id;
}

/** Telefone no formato que a Meta espera: só dígitos, com DDI. */
export function telefoneParaMeta(telefone: string): string {
  const digitos = (telefone || '').replace(/\D/g, '');
  if (!digitos) return '';
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}
