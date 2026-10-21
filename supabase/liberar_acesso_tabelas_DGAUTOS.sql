-- ==============================================================================
-- DG AUTOMÓVEIS - LIBERAÇÃO DE ACESSO TOTAL NO SUPABASE (RLS DISABLE)
-- Execute este script no SQL Editor do Supabase para que o sistema em produção
-- possa ler, inserir, atualizar e excluir normalmente sem erro 42501.
-- ==============================================================================

ALTER TABLE IF EXISTS "config_loja_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "usuarios_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_fotos_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_documentos_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_pendencias_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_reservas_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_opcionais_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "clientes_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "oportunidades_crm_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "negociacoes_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "negociacoes_pagamentos_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "contratos_modelos_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "contratos_gerados_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "financeiro_DGAUTOS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "auditoria_logs_DGAUTOS" DISABLE ROW LEVEL SECURITY;

-- Garante que o usuário anônimo (chave pública da Vercel) tenha todas as permissões
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Insere os dados padrão da loja se ainda não existirem
INSERT INTO "config_loja_DGAUTOS" (
    id, razao_social, nome_fantasia, cnpj, telefone, whatsapp, email, site_url, cidade, uf, token_feed_site
) VALUES (
    1, 
    'DG Automóveis Comércio de Veículos Ltda', 
    'DG Automóveis', 
    '12.345.678/0001-90', 
    '(47) 3333-4444', 
    '(47) 99999-8888', 
    'contato@dgautomoveis.com.br', 
    'https://dgautomoveis.com.br', 
    'Balneário Camboriú', 
    'SC', 
    '20706bbe-4a09-4a03-8e2a-1f47e73d7a14'
) ON CONFLICT (id) DO NOTHING;

-- Insere o usuário administrador padrão
INSERT INTO "usuarios_DGAUTOS" (
    nome, email, senha_hash, perfil, telefone, ativo
) VALUES (
    'Administrador DG',
    'admin@dgautomoveis.com.br',
    'admin123',
    'admin',
    '(47) 99999-8888',
    TRUE
) ON CONFLICT (email) DO NOTHING;
