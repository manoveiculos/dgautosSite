import { useState, useEffect } from 'react';

export interface LeadContact {
  nome: string;
  telefone: string;
  cpf?: string;
  dataNascimento?: string;
  cidade?: string;
}

const STORAGE_KEY_PRIMARY = 'manos_client_contact_v1';
const STORAGE_KEY_LEGACY = 'manos_user_lead_v1';

export function getStoredLead(): LeadContact {
  try {
    // 1. Try primary localStorage
    const local = localStorage.getItem(STORAGE_KEY_PRIMARY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && (parsed.nome || parsed.telefone)) return parsed;
    }

    // 2. Try legacy sessionStorage
    const session = sessionStorage.getItem(STORAGE_KEY_LEGACY);
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed && (parsed.nome || parsed.telefone)) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao ler leadStore:', e);
  }
  return { nome: '', telefone: '', cpf: '', dataNascimento: '', cidade: '' };
}

export function saveStoredLead(partial: Partial<LeadContact>): LeadContact {
  const current = getStoredLead();
  const updated: LeadContact = {
    nome: partial.nome !== undefined ? partial.nome.trim() : (current.nome || ''),
    telefone: partial.telefone !== undefined ? partial.telefone.replace(/\D/g, '') : (current.telefone || ''),
    cpf: partial.cpf !== undefined ? partial.cpf : (current.cpf || ''),
    dataNascimento: partial.dataNascimento !== undefined ? partial.dataNascimento : (current.dataNascimento || ''),
    cidade: partial.cidade !== undefined ? partial.cidade.trim() : (current.cidade || ''),
  };

  try {
    const jsonStr = JSON.stringify(updated);
    localStorage.setItem(STORAGE_KEY_PRIMARY, jsonStr);
    sessionStorage.setItem(STORAGE_KEY_LEGACY, jsonStr);
    window.dispatchEvent(new CustomEvent('manos-lead-updated', { detail: updated }));
  } catch (e) {
    console.warn('Erro ao salvar leadStore:', e);
  }

  return updated;
}

export function useLeadContact() {
  const [lead, setLead] = useState<LeadContact>(getStoredLead);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<LeadContact>;
      if (customEvent.detail) {
        setLead(customEvent.detail);
      } else {
        setLead(getStoredLead());
      }
    };
    window.addEventListener('manos-lead-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('manos-lead-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updateLead = (partial: Partial<LeadContact>) => {
    const next = saveStoredLead(partial);
    setLead(next);
  };

  return { lead, updateLead };
}
