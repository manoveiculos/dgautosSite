import { createClient } from '@supabase/supabase-js';

// Typecast import.meta to any to prevent TypeScript compile errors for environments without vite/client types
const metaEnv = (import.meta as any).env || {};

// Fallback directly to the credentials provided by the user for robust connectivity
const supabaseUrl = 
  metaEnv.VITE_SUPABASE_URL || 
  metaEnv.NEXT_PUBLIC_SUPABASE_URL || 
  'https://jkblxdxnbmciicakusnl.supabase.co';

const supabaseKey = 
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || 
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  'sb_publishable_a_LZCcUT50c9-2JspQf1aQ_-khIilRb';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Palpite {
  id: number;
  protocolo: string;
  nome: string;
  telefone: string;
  palpite: string;
  placar_brasil: number;
  placar_adversario: number;
  horario_brasil: string;
  source: string;
  created_at: string;
}
