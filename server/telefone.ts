// ---------------------------------------------------------------------------
// Normalização de telefone — fonte única.
//
// Havia três implementações espalhadas (proxy de leads, score e Meta CAPI) e
// duas delas cortavam o "55" inicial sem olhar o tamanho. O efeito era silencioso
// e caro: um cliente com DDD 55 (Santa Maria e região, no RS) virava
// "999887766" — nove dígitos — e era marcado como TELEFONE INVÁLIDO, indo direto
// para o descarte sem ninguém ligar para ele.
//
// Regra: o 55 só é código de país quando sobra um número nacional plausível
// depois de tirá-lo. Um número de 10 ou 11 dígitos já é nacional.
// ---------------------------------------------------------------------------

/** Dígitos do número nacional (DDD + assinante), sem o código do país. */
export function digitosNacionais(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) return d.slice(2);
  return d;
}

/** DDD de dois dígitos, ou string vazia se o número não for utilizável. */
export function dddDe(phone: string): string {
  const d = digitosNacionais(phone);
  return d.length >= 10 ? d.slice(0, 2) : '';
}

/**
 * Valida o telefone brasileiro. É o único critério de descarte de lead: sem um
 * número que disque, o consultor perderia o tempo dele na fila.
 */
export function telefoneValido(phone: string): boolean {
  const d = digitosNacionais(phone);
  if (d.length < 10 || d.length > 11) return false;

  // DDD válido: 11 a 99, sem zero em nenhuma das casas.
  if (!/^[1-9][1-9]$/.test(d.slice(0, 2))) return false;

  // Celular (11 dígitos) sempre começa com 9 depois do DDD.
  if (d.length === 11 && d[2] !== '9') return false;

  // Sequência repetida (99999999999, 11111111111) é preenchimento falso.
  if (/^(\d)\1+$/.test(d.slice(2))) return false;

  return true;
}

/** E.164 sem o "+", formato exigido pela Meta: 5547999887766. */
export function paraE164(phone: string): string {
  const d = digitosNacionais(phone);
  return d ? `55${d}` : '';
}
