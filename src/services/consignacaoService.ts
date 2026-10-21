// Consignação de Veículos — serviço de integração de API
import { getAttribution } from '../lib/attribution';

const SOURCE = 'Consignação - DG Automóveis';

function envelope() {
  return { source: SOURCE, atribuicao: getAttribution(), timestamp: new Date().toISOString() };
}

export interface LeadConsignacao {
  lead_id: string;
  nome: string;
  telefone: string;
  cidade: string;
}

export async function registrarLeadConsignacao(lead: LeadConsignacao): Promise<void> {
  try {
    await fetch('/api/vendas/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, lead_type: 'Consignacao', ...envelope() }),
    });
  } catch (err) {
    console.error('registrarLeadConsignacao error:', err);
  }
}

export async function enviarConsignacao(payload: Record<string, unknown>): Promise<void> {
  // 1. Dispara envio direto para o Webhook de Consignação do n8n
  try {
    await fetch('https://n8n.drivvoo.com/webhook/consignaãodgautos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'lead_consignacao_completo',
        enviadoEm: new Date().toISOString(),
        ...payload,
        ...envelope(),
      }),
    });
  } catch (err) {
    console.warn('Erro ao enviar webhook n8n de consignação:', err);
  }

  // 2. Dispara registro no servidor interno para scoring e CAPI Meta
  try {
    await fetch('/api/vendas/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, lead_type: 'Consignacao', ...envelope() }),
    });
  } catch (err) {
    console.error('enviarConsignacao internal error:', err);
  }
}
