import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';

const WEBHOOK_LEAD = '/api/bolao/lead';
const WEBHOOK_FINALIZAR = '/api/bolao/finalizar';
const COLLECTION_NAME = 'bolao_palpites_manos';

// Current game opponent. Used to build the palpite label AND to scope the
// dedup/lookup to the active game, so customers who played a previous round
// (e.g. Marrocos) are NOT blocked from betting on the new one. Change this
// single constant when the next game starts.
const CURRENT_OPPONENT = 'Japão';

/**
 * Normalize a Brazilian phone into a canonical digits-only value used for
 * storage/display. Strips non-digits and a leading 55 country code when it is
 * clearly a prefix (12-13 digit number), preserving legitimate DDD 55 numbers.
 */
function normalizePhone(phone: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Subscriber suffix used to deduplicate palpites. We match on the last 8 digits
 * (the line number, after country code, DDD and the leading mobile "9") so the
 * SAME person is recognised even when the number is typed with a different DDD,
 * with/without the 55 country code, or with/without the 9th digit. Used with a
 * trailing LIKE so it also catches rows saved before normalization.
 */
function phoneSuffix(phone: string): string {
  return (phone || '').replace(/\D/g, '').slice(-8);
}

export interface Palpite {
  id?: number;
  protocolo?: string;
  nome: string;
  telefone: string;
  palpite: string;
  placar_brasil: number;
  placar_adversario: number;
  horario_brasil: string;
  source: string;
  created_at?: string;
}

/**
 * Step 1: Register lead via n8n webhook proxy
 */
export async function registerLead(nome: string, whatsapp: string): Promise<void> {
  const response = await fetch(WEBHOOK_LEAD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome,
      whatsapp,
      source: 'Bolão DG Automóveis',
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Falha ao registrar lead. Tente novamente.');
  }
}

const WEBHOOK_VERIFY = '/api/bolao/verify';

/**
 * Step 2: Verify the WhatsApp code against the server-side OTP.
 * Returns true only when the code matches the one delivered via WhatsApp.
 */
export async function verifyCode(whatsapp: string, codigo: string): Promise<boolean> {
  try {
    const response = await fetch(WEBHOOK_VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp, codigo }),
    });
    const data = await response.json().catch(() => ({ valid: false }));
    return response.ok && data?.valid === true;
  } catch (err) {
    console.error('Verify code error:', err);
    return false;
  }
}

const WEBHOOK_PALPITE = '/api/bolao/palpite';

/**
 * Step 3: Save palpite to Supabase (primary) and send to n8n webhook proxy
 */
export async function savePalpite(
  nome: string,
  whatsapp: string,
  placar_brasil: number,
  placar_haiti: number
): Promise<string> {
  // Format current time in BRT (UTC-3)
  const now = new Date();
  const horarioBrasil = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const palpiteFormatado = `Brasil ${placar_brasil} x ${placar_haiti} ${CURRENT_OPPONENT}`;
  const telefone = normalizePhone(whatsapp);

  // Generate a premium ticket protocol
  const protocolo = 'MANOS-' + Math.floor(100000 + Math.random() * 900000);

  // 1. Save to Supabase (Primary Database).
  // Idempotent by phone: if this number already has a palpite, update it instead
  // of inserting a new row. This prevents duplicate entries on the mural.
  try {
    const { data: existing } = await supabase
      .from('bolaomanos2026')
      .select('id')
      .like('telefone', `%${phoneSuffix(whatsapp)}`)
      .like('palpite', `%${CURRENT_OPPONENT}%`)
      .not('protocolo', 'like', 'RESULTADO%')
      .not('protocolo', 'eq', 'EXCLUIDO')
      .limit(1);

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('bolaomanos2026')
        .update({
          nome,
          palpite: palpiteFormatado,
          placar_brasil,
          placar_adversario: placar_haiti,
          horario_brasil: now.toISOString(),
        })
        .eq('id', existing[0].id);

      if (error) {
        console.warn('Supabase update returned error (check RLS policies):', error);
      }
    } else {
      const { error } = await supabase
        .from('bolaomanos2026')
        .insert({
          protocolo,
          nome,
          telefone,
          palpite: palpiteFormatado,
          placar_brasil,
          placar_adversario: placar_haiti,
          horario_brasil: now.toISOString(),
          source: 'Bolão DG Automóveis - Copa 2026',
          created_at: now.toISOString()
        });

      if (error) {
        console.warn('Supabase insert returned error (check RLS policies):', error);
      }
    }
  } catch (err) {
    console.error('Supabase save failed:', err);
  }

  // 2. Send to webhook via proxy (secondary — n8n triggers WhatsApp confirmation, etc.)
  try {
    const response = await fetch(WEBHOOK_PALPITE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        telefone: whatsapp,
        palpite: palpiteFormatado,
        placar_brasil,
        placar_haiti,
        horario_brasil: horarioBrasil,
        protocolo,
        source: 'Bolão DG Automóveis - Copa 2026',
      }),
    });

    if (!response.ok) {
      console.warn('Webhook responded with status:', response.status);
    }
  } catch (err) {
    console.error('Webhook palpite error:', err);
    // Don't throw for webhook so it doesn't block the frontend success screen
  }

  // 3. Save to Firestore as backup (optional — legacy)
  try {
    await addDoc(collection(db, COLLECTION_NAME), {
      nome,
      whatsapp,
      placar_brasil,
      placar_haiti,
      palpite: palpiteFormatado,
      horario_brasil: horarioBrasil,
      protocolo,
      status: 'ativo',
      source: 'Bolão DG Automóveis - Copa 2026',
      created_at: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Backup Firestore save failed:', error);
  }

  return protocolo;
}

/**
 * Fetch a user's palpite by phone number from Supabase
 */
export async function getPalpiteByPhone(phone: string): Promise<Palpite | null> {
  try {
    const { data, error } = await supabase
      .from('bolaomanos2026')
      .select('*')
      .like('telefone', `%${phoneSuffix(phone)}`)
      .like('palpite', `%${CURRENT_OPPONENT}%`)
      .not('protocolo', 'like', 'RESULTADO%')
      .not('protocolo', 'eq', 'EXCLUIDO')
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? (data[0] as Palpite) : null;
  } catch (error) {
    console.error('Error fetching palpite by phone from Supabase:', error);
    return null;
  }
}

/**
 * Update a user's palpite in Supabase and notify the webhook proxy
 */
export async function updatePalpite(
  nome: string,
  whatsapp: string,
  placar_brasil: number,
  placar_haiti: number
): Promise<string> {
  const now = new Date();
  const horarioBrasil = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const palpiteFormatado = `Brasil ${placar_brasil} x ${placar_haiti} ${CURRENT_OPPONENT}`;

  // 1. Update in Supabase (Primary)
  try {
    const { error } = await supabase
      .from('bolaomanos2026')
      .update({
        nome,
        palpite: palpiteFormatado,
        placar_brasil,
        placar_adversario: placar_haiti,
        horario_brasil: now.toISOString(),
      })
      .like('telefone', `%${phoneSuffix(whatsapp)}`)
      .not('protocolo', 'like', 'RESULTADO%')
      .not('protocolo', 'eq', 'EXCLUIDO');

    if (error) throw error;
  } catch (err) {
    console.error('Supabase update failed:', err);
    throw new Error('Falha ao atualizar palpite no Supabase. Tente novamente.');
  }

  // 2. Send webhook notification with action: "update"
  try {
    const response = await fetch(WEBHOOK_PALPITE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        nome,
        telefone: whatsapp,
        palpite: palpiteFormatado,
        placar_brasil,
        placar_haiti,
        horario_brasil: horarioBrasil,
        source: 'Bolão DG Automóveis - Copa 2026',
      }),
    });

    if (!response.ok) {
      console.warn('Webhook responded with status:', response.status);
    }
  } catch (err) {
    console.error('Webhook update notify error:', err);
  }

  return 'updated';
}

/**
 * Fetch all palpites from Supabase
 */
export async function fetchPalpites(): Promise<Palpite[]> {
  try {
    const { data, error } = await supabase
      .from('bolaomanos2026')
      .select('*')
      .not('protocolo', 'eq', 'EXCLUIDO')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Palpite[];
  } catch (error) {
    console.error('Error fetching palpites from Supabase:', error);
    return [];
  }
}

/**
 * Admin: Finalize game with final score
 */
export async function finalizarJogo(
  placar_brasil: number,
  placar_haiti: number
): Promise<void> {
  // 1. Send webhook notification
  try {
    const response = await fetch(WEBHOOK_FINALIZAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placar_brasil,
        placar_haiti,
        status: 'finalizado',
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn('Webhook responded with status:', response.status);
    }
  } catch (err) {
    console.error('Webhook finalizar error:', err);
  }

  // 2. Insert or update the result in Supabase so the Transparency mural knows it
  try {
    const palpiteFormatado = `Brasil ${placar_brasil} x ${placar_haiti} ${CURRENT_OPPONENT}`;
    // Protocolo único por jogo, para que cada jogo tenha sua própria linha de
    // resultado sem colidir na constraint UNIQUE(protocolo) (ex.: RESULTADO-HAITI).
    const resultadoProtocolo = `RESULTADO-${CURRENT_OPPONENT.toUpperCase()}`;

    // Tenta primeiro ATUALIZAR para não esbarrar no RLS de exclusão (soft update)
    const { data: updData, error: updError } = await supabase
      .from('bolaomanos2026')
      .update({
        placar_brasil,
        placar_adversario: placar_haiti,
        palpite: palpiteFormatado,
        horario_brasil: new Date().toISOString()
      })
      .eq('protocolo', resultadoProtocolo)
      .select();

    // Se não atualizou nada (não existia), fazemos o INSERT
    if (!updData || updData.length === 0) {
      const { error: insError } = await supabase
        .from('bolaomanos2026')
        .insert({
          protocolo: resultadoProtocolo,
          nome: 'Resultado Oficial',
          telefone: '00000000000',
          palpite: palpiteFormatado,
          placar_brasil,
          placar_adversario: placar_haiti,
          horario_brasil: new Date().toISOString(),
          source: 'Bolão DG Automóveis - Copa 2026', // Mantém a source igual p/ não falhar no RLS
          created_at: new Date().toISOString() // Adicionado created_at
        });

      if (insError) throw insError;
    }
  } catch (err) {
    console.error('Failed to save official result to Supabase:', err);
    throw new Error('Falha ao salvar resultado no Supabase.');
  }
}

/**
 * Admin: Excluir um palpite
 */
export async function deletePalpite(id: any, telefone: string, palpiteStr: string): Promise<void> {
  try {
    const suffix = phoneSuffix(telefone);
    
    // 1. Tenta deletar fisicamente pelo ID
    const { data: delData, error: delError } = await supabase
      .from('bolaomanos2026')
      .delete()
      .eq('id', id)
      .select();

    if (!delError && delData && delData.length > 0) return;

    // 2. Se falhou fisicamente (ex: bloqueio de RLS no DELETE), tenta Soft Delete via UPDATE
    const { data: updData, error: updError } = await supabase
      .from('bolaomanos2026')
      .update({ protocolo: 'EXCLUIDO' })
      .eq('id', id)
      .like('telefone', `%${suffix}%`)
      .select();

    if (updError) throw updError;

    // 3. Fallback agressivo: se o ID não bater (ex: divergência de tipo no JS), atualiza via telefone e palpite string
    if (!updData || updData.length === 0) {
      const { error: fbError } = await supabase
        .from('bolaomanos2026')
        .update({ protocolo: 'EXCLUIDO' })
        .like('telefone', `%${suffix}%`)
        .eq('palpite', palpiteStr)
        .not('protocolo', 'like', 'RESULTADO%');
        
      if (fbError) throw fbError;
    }
  } catch (err) {
    console.error('Failed to delete palpite from Supabase:', err);
    throw new Error('Falha ao excluir o palpite.');
  }
}
