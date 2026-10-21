// Captura e entrega de leads do funil principal.
//
// Ordem de prioridade, de propósito:
//   1. POST /api/leads  -> o servidor entrega ao n8n. É o que chega no consultor.
//      Se isso falhar, a chamada falha e a UI oferece o plano B (WhatsApp).
//   2. Firestore        -> gravação secundária, best-effort. Pode falhar sem
//      levar o lead junto (era exatamente o contrário antes: o Firestore vinha
//      primeiro e derrubava o webhook quando quebrava).
//
// O webhook do n8n não é mais chamado do navegador — o token de rota e a
// entrega ficam no servidor, fora do alcance de bloqueadores e de rede ruim.

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getAttribution } from './attribution';
import { idDoVisitante } from './visitante';
import { identificarVisitante } from './tracking';

export type LeadTipo = 'Compra' | 'Venda' | 'Financiamento';

export interface LeadInput {
  /** Mesmo id no lead parcial e no completo, para o n8n atualizar em vez de duplicar. */
  lead_id: string;
  name: string;
  phone: string;
  lead_type: LeadTipo;
  /** "parcial" = só contato capturado; "completo" = qualificação inteira. */
  stage: 'parcial' | 'completo';
  /** Id do evento de conversão, para deduplicar pixel x Conversions API. */
  event_id?: string;
  details?: Record<string, unknown>;
}

/** Gera o id que amarra o lead parcial ao completo. */
export function novoLeadId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/** Remove `undefined` recursivamente — o Firestore rejeita esses campos. */
function sanitize<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.filter((v) => v !== undefined).map(sanitize) as unknown as T;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined) continue;
    out[key] = sanitize(value);
  }
  return out as T;
}

/**
 * Entrega o lead. Lança se a entrega ao servidor falhar, para a UI poder
 * oferecer o WhatsApp como saída em vez de fingir sucesso.
 */
import { supabase } from './supabase';

export async function createLead(input: LeadInput): Promise<string> {
  // O pixel passa a mandar nome/telefone no advanced matching a partir daqui, e
  // o external_id segue no payload para o CRM guardar: é ele que vai identificar
  // esta pessoa no evento de venda, semanas depois.
  identificarVisitante({ nome: input.name, telefone: input.phone });

  const payload = sanitize({
    ...input,
    status: 'new',
    source: 'Site DG Automóveis',
    atribuicao: getAttribution(),
    external_id: idDoVisitante(),
    timestamp: new Date().toISOString(),
  });

  // 1. Gravação direta no CRM DGAUTOS (Supabase)
  try {
    await supabase.from('oportunidades_crm_DGAUTOS').insert([{
      nome_lead: input.name,
      telefone: input.phone,
      email: (input.details as any)?.email || '',
      origem: 'SITE_OFICIAL',
      estagio: 'pendente',
      veiculo_interesse: (input.details as any)?.veiculo_interesse || input.lead_type || 'Interesse pelo Site',
      valor_proposta: Number((input.details as any)?.valor_proposta || 0),
      etiquetas: ['LEAD_SITE', 'Quente'],
      created_at: new Date().toISOString()
    }]);
  } catch (errSupabase) {
    console.warn('[leads] Gravação no Supabase CRM DGAUTOS falhou:', errSupabase);
  }

  // 2. Tenta entrega para webhook / API local se disponível
  try {
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}

  // 3. Gravação secundária Firestore (best-effort)
  void addDoc(collection(db, 'leads_manos_crm'), {
    ...payload,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }).catch((err) => console.error('[leads] Firestore (secundário) falhou:', err));

  return input.lead_id;
}

/**
 * Registra o contato assim que ele é digitado, ainda no início do funil.
 * Nunca lança: se falhar, o cliente segue respondendo o quiz normalmente e o
 * envio completo no fim tenta de novo. Antes desta função, quem abandonava no
 * meio do funil não deixava rastro nenhum.
 */
export async function registrarLeadParcial(input: Omit<LeadInput, 'stage'>): Promise<boolean> {
  try {
    await createLead({ ...input, stage: 'parcial' });
    return true;
  } catch (err) {
    console.error('[leads] lead parcial não entregue:', err);
    return false;
  }
}
