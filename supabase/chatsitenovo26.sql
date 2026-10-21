-- SQL Schema for Supabase Table: chatsitenovo26
-- Creates table to persist AI Consultor Manos chat sessions and real-time message logs

CREATE TABLE IF NOT EXISTS chatsitenovo26 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  nome TEXT,
  telefone TEXT,
  mensagem_usuario TEXT,
  resposta_ia TEXT,
  veiculos_recomendados JSONB DEFAULT '[]'::jsonb,
  veiculo_selecionado JSONB DEFAULT '{}'::jsonb,
  resumo_lead TEXT,
  transcricao_completa JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'em_andamento',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) and allow public insert/update for chat persistence
ALTER TABLE chatsitenovo26 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir insercao publica no chatsitenovo26"
  ON chatsitenovo26 FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir selecao publica no chatsitenovo26"
  ON chatsitenovo26 FOR SELECT
  USING (true);

CREATE POLICY "Permitir atualizacao publica no chatsitenovo26"
  ON chatsitenovo26 FOR UPDATE
  USING (true);
