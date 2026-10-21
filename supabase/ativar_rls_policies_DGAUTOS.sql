-- ==============================================================================
-- DG AUTOMÓVEIS - ATIVAÇÃO DE RLS COM POLICIES E BUCKET DE FOTOS NO SUPABASE
-- Execute este script no SQL Editor do Supabase para ativar RLS com policies
-- ==============================================================================

-- 1. CRIAÇÃO DO BUCKET PÚBLICO DE FOTOS DE VEÍCULOS NO SUPABASE STORAGE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'veiculos', 
    'veiculos', 
    true, 
    15728640, -- 15MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. POLÍTICAS DE RLS PARA O STORAGE (BUCKET 'veiculos')
DROP POLICY IF EXISTS "Fotos veiculos leitura publica" ON storage.objects;
CREATE POLICY "Fotos veiculos leitura publica" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'veiculos');

DROP POLICY IF EXISTS "Fotos veiculos upload permitida" ON storage.objects;
CREATE POLICY "Fotos veiculos upload permitida" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'veiculos');

DROP POLICY IF EXISTS "Fotos veiculos update permitida" ON storage.objects;
CREATE POLICY "Fotos veiculos update permitida" ON storage.objects
    FOR UPDATE TO anon, authenticated
    USING (bucket_id = 'veiculos');

DROP POLICY IF EXISTS "Fotos veiculos delete permitida" ON storage.objects;
CREATE POLICY "Fotos veiculos delete permitida" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = 'veiculos');

-- ==============================================================================
-- 3. ATIVAÇÃO DE RLS NAS TABELAS *_DGAUTOS
-- ==============================================================================
ALTER TABLE IF EXISTS "config_loja_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "usuarios_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_fotos_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_documentos_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_pendencias_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_reservas_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "veiculos_opcionais_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "clientes_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "oportunidades_crm_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "negociacoes_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "negociacoes_pagamentos_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "contratos_modelos_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "contratos_gerados_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "financeiro_DGAUTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "auditoria_logs_DGAUTOS" ENABLE ROW LEVEL SECURITY;

-- Garante concessões base de schema para os papéis anon e authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ==============================================================================
-- 4. POLICIES PARA AS TABELAS *_DGAUTOS
-- ==============================================================================

-- 4.1. Config Loja
DROP POLICY IF EXISTS "p_config_loja_dgautos" ON "config_loja_DGAUTOS";
CREATE POLICY "p_config_loja_dgautos" ON "config_loja_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.2. Usuários
DROP POLICY IF EXISTS "p_usuarios_dgautos" ON "usuarios_DGAUTOS";
CREATE POLICY "p_usuarios_dgautos" ON "usuarios_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.3. Veículos (Estoque)
DROP POLICY IF EXISTS "p_veiculos_dgautos" ON "veiculos_DGAUTOS";
CREATE POLICY "p_veiculos_dgautos" ON "veiculos_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.4. Fotos dos Veículos
DROP POLICY IF EXISTS "p_veiculos_fotos_dgautos" ON "veiculos_fotos_DGAUTOS";
CREATE POLICY "p_veiculos_fotos_dgautos" ON "veiculos_fotos_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.5. Documentos dos Veículos
DROP POLICY IF EXISTS "p_veiculos_documentos_dgautos" ON "veiculos_documentos_DGAUTOS";
CREATE POLICY "p_veiculos_documentos_dgautos" ON "veiculos_documentos_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.6. Pendências dos Veículos
DROP POLICY IF EXISTS "p_veiculos_pendencias_dgautos" ON "veiculos_pendencias_DGAUTOS";
CREATE POLICY "p_veiculos_pendencias_dgautos" ON "veiculos_pendencias_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.7. Reservas
DROP POLICY IF EXISTS "p_veiculos_reservas_dgautos" ON "veiculos_reservas_DGAUTOS";
CREATE POLICY "p_veiculos_reservas_dgautos" ON "veiculos_reservas_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.8. Opcionais
DROP POLICY IF EXISTS "p_veiculos_opcionais_dgautos" ON "veiculos_opcionais_DGAUTOS";
CREATE POLICY "p_veiculos_opcionais_dgautos" ON "veiculos_opcionais_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.9. Clientes e Fornecedores
DROP POLICY IF EXISTS "p_clientes_dgautos" ON "clientes_DGAUTOS";
CREATE POLICY "p_clientes_dgautos" ON "clientes_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.10. CRM / Oportunidades (Recebe leads do site e gerencia no sistema)
DROP POLICY IF EXISTS "p_oportunidades_crm_dgautos" ON "oportunidades_crm_DGAUTOS";
CREATE POLICY "p_oportunidades_crm_dgautos" ON "oportunidades_crm_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.11. Negociações / Vendas
DROP POLICY IF EXISTS "p_negociacoes_dgautos" ON "negociacoes_DGAUTOS";
CREATE POLICY "p_negociacoes_dgautos" ON "negociacoes_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.12. Pagamentos de Negociações
DROP POLICY IF EXISTS "p_negociacoes_pagamentos_dgautos" ON "negociacoes_pagamentos_DGAUTOS";
CREATE POLICY "p_negociacoes_pagamentos_dgautos" ON "negociacoes_pagamentos_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.13. Modelos de Contratos
DROP POLICY IF EXISTS "p_contratos_modelos_dgautos" ON "contratos_modelos_DGAUTOS";
CREATE POLICY "p_contratos_modelos_dgautos" ON "contratos_modelos_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.14. Contratos Gerados
DROP POLICY IF EXISTS "p_contratos_gerados_dgautos" ON "contratos_gerados_DGAUTOS";
CREATE POLICY "p_contratos_gerados_dgautos" ON "contratos_gerados_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.15. Financeiro
DROP POLICY IF EXISTS "p_financeiro_dgautos" ON "financeiro_DGAUTOS";
CREATE POLICY "p_financeiro_dgautos" ON "financeiro_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4.16. Auditoria
DROP POLICY IF EXISTS "p_auditoria_logs_dgautos" ON "auditoria_logs_DGAUTOS";
CREATE POLICY "p_auditoria_logs_dgautos" ON "auditoria_logs_DGAUTOS"
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);
