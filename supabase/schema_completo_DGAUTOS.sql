-- ==============================================================================
-- DG AUTOMÓVEIS - SCHEMA COMPLETO DE BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- TODAS AS TABELAS CRIADAS COM SUFIXO _DGAUTOS
-- ==============================================================================
-- INSTRUÇÃO DE EXECUÇÃO NO SUPABASE:
-- 1. No Supabase SQL Editor, aperte CTRL + A (para selecionar tudo).
-- 2. Clique no botão "Run" (ou pressione CTRL + ENTER).
-- ==============================================================================

-- 1. TABELA DE USUÁRIOS DO SISTEMA
CREATE TABLE IF NOT EXISTS "usuarios_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(30) NOT NULL DEFAULT 'vendedor' CHECK (perfil IN ('admin', 'gerente', 'vendedor', 'financeiro')),
    telefone VARCHAR(30),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email_dgautos ON "usuarios_DGAUTOS"(email);

-- 2. TABELA DE CONFIGURAÇÃO DA LOJA (DADOS CADASTRAIS E FISCAIS)
CREATE TABLE IF NOT EXISTS "config_loja_DGAUTOS" (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    razao_social VARCHAR(200) NOT NULL DEFAULT 'DG Automóveis Comércio de Veículos Ltda',
    nome_fantasia VARCHAR(150) NOT NULL DEFAULT 'DG Automóveis',
    cnpj VARCHAR(25) NOT NULL DEFAULT '00.000.000/0001-00',
    inscricao_estadual VARCHAR(30),
    telefone VARCHAR(30) DEFAULT '(47) 3333-0000',
    whatsapp VARCHAR(30) DEFAULT '(47) 99999-0000',
    email VARCHAR(150) DEFAULT 'contato@dgautomoveis.com.br',
    site_url VARCHAR(255) DEFAULT 'https://dgautomoveis.com.br',
    cep VARCHAR(15) DEFAULT '88330-000',
    endereco VARCHAR(200) DEFAULT 'Av. Brasil',
    numero VARCHAR(20) DEFAULT '1000',
    complemento VARCHAR(100),
    bairro VARCHAR(100) DEFAULT 'Centro',
    cidade VARCHAR(100) DEFAULT 'Balneário Camboriú',
    uf VARCHAR(2) DEFAULT 'SC',
    token_feed_site VARCHAR(100) DEFAULT '20706bbe-4a09-4a03-8e2a-1f47e73d7a14',
    auto_publicar_site BOOLEAN DEFAULT TRUE,
    termo_garantia_padrao TEXT DEFAULT 'Garantia legal de 90 (noventa) dias para motor e câmbio, conforme Art. 26 do CDC.',
    chave_pix VARCHAR(100),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE CLIENTES E FORNECEDORES
CREATE TABLE IF NOT EXISTS "clientes_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    tipo_pessoa VARCHAR(2) NOT NULL DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF', 'PJ')),
    papel VARCHAR(20) NOT NULL DEFAULT 'cliente' CHECK (papel IN ('cliente', 'fornecedor', 'ambos')),
    nome VARCHAR(180) NOT NULL,
    cpf_cnpj VARCHAR(30),
    rg_ie VARCHAR(30),
    data_nascimento DATE,
    telefone VARCHAR(30),
    whatsapp VARCHAR(30),
    email VARCHAR(150),
    cep VARCHAR(15),
    endereco VARCHAR(200),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100) DEFAULT 'Balneário Camboriú',
    uf VARCHAR(2) DEFAULT 'SC',
    origem VARCHAR(50) DEFAULT 'MANUAL',
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nome_dgautos ON "clientes_DGAUTOS"(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj_dgautos ON "clientes_DGAUTOS"(cpf_cnpj);

-- 4. TABELA CENTRAL DE VEÍCULOS (ESTOQUE COMPLETO - 10 ABAS)
CREATE TABLE IF NOT EXISTS "veiculos_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    codigo_interno VARCHAR(50),
    marca VARCHAR(80) NOT NULL,
    modelo VARCHAR(120) NOT NULL,
    modelo_complemento VARCHAR(120),
    ano VARCHAR(20) NOT NULL,
    ano_fabricacao INTEGER,
    ano_modelo INTEGER,
    km INTEGER NOT NULL DEFAULT 0,
    cor VARCHAR(50) DEFAULT 'Branco',
    cor_interna VARCHAR(50),
    combustivel VARCHAR(40) DEFAULT 'Flex',
    cambio VARCHAR(50) DEFAULT 'Automático',
    portas INTEGER DEFAULT 4,
    potencia VARCHAR(30),
    cilindradas VARCHAR(30),
    direcao VARCHAR(40) DEFAULT 'Elétrica',
    categoria_veiculo VARCHAR(60) DEFAULT 'Carro / SUV / Utilitário',
    placa VARCHAR(10),
    chassi VARCHAR(40),
    renavam VARCHAR(30),
    numero_motor VARCHAR(50),
    crv VARCHAR(50),
    cidade_emplacamento VARCHAR(100) DEFAULT 'Balneário Camboriú - SC',
    ipva_pago BOOLEAN DEFAULT TRUE,
    licenciamento_exercicio VARCHAR(10),
    
    -- Status & Pátio
    propriedade VARCHAR(40) NOT NULL DEFAULT 'PROPRIO' CHECK (propriedade IN ('PROPRIO', 'SOCIEDADE', 'TERCEIRO_CONSIGNADO', 'TERCEIRO_DEMONSTRACAO', 'TERCEIRO_FINANCIAMENTO')),
    status VARCHAR(30) NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'vendido', 'em_preparacao', 'cancelado')),
    situacao_patio VARCHAR(100) DEFAULT 'Pronto para venda (Showroom)',
    localizacao_patio VARCHAR(100) DEFAULT 'Showroom Principal',
    repasse BOOLEAN DEFAULT FALSE,
    garantia_fabrica VARCHAR(60) DEFAULT 'Não',
    
    -- Valores & FIPE
    custo NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    despesas_veiculo NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    preco NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    valor_minimo NUMERIC(12,2) DEFAULT 0.00,
    valor_troca NUMERIC(12,2) DEFAULT 0.00,
    fipe NUMERIC(12,2) DEFAULT 0.00,
    valor_fipe_anterior NUMERIC(12,2) DEFAULT 0.00,
    codigo_fipe VARCHAR(30),
    
    -- Integração com Site DG Automóveis
    foto_capa TEXT,
    publicar_site BOOLEAN NOT NULL DEFAULT TRUE,
    destaque_site BOOLEAN NOT NULL DEFAULT FALSE,
    valor_site NUMERIC(12,2) DEFAULT 0.00,
    observacao_site VARCHAR(255),
    url_video VARCHAR(255),
    
    -- Textos e Observações
    observacao_anuncio TEXT,
    observacao_internet TEXT,
    observacao_interna TEXT,
    observacao_contrato TEXT,
    
    -- Fiscal / NF-e
    cfop_entrada VARCHAR(20),
    cfop_saida VARCHAR(20),
    valor_nf_compra NUMERIC(12,2) DEFAULT 0.00,
    valor_nf_venda NUMERIC(12,2) DEFAULT 0.00,
    
    -- Relacionamentos
    cliente_origem_id BIGINT REFERENCES "clientes_DGAUTOS"(id) ON DELETE SET NULL,
    cliente_comprador_id BIGINT REFERENCES "clientes_DGAUTOS"(id) ON DELETE SET NULL,
    vendedor_responsavel_id BIGINT REFERENCES "usuarios_DGAUTOS"(id) ON DELETE SET NULL,
    
    dados_altimus JSONB DEFAULT '{}'::jsonb,
    
    data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
    data_venda DATE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_status_dgautos ON "veiculos_DGAUTOS"(status);
CREATE INDEX IF NOT EXISTS idx_veiculos_publicar_site_dgautos ON "veiculos_DGAUTOS"(publicar_site);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa_dgautos ON "veiculos_DGAUTOS"(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_marca_modelo_dgautos ON "veiculos_DGAUTOS"(marca, modelo);

-- 5. TABELA DE FOTOS (DRAG & DROP COM ORDEM DEFINIDA)
CREATE TABLE IF NOT EXISTS "veiculos_fotos_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    veiculo_id BIGINT NOT NULL REFERENCES "veiculos_DGAUTOS"(id) ON DELETE CASCADE,
    url_foto TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 1,
    is_capa BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fotos_veiculo_ordem_dgautos ON "veiculos_fotos_DGAUTOS"(veiculo_id, ordem);

-- 6. TABELA DE DOCUMENTOS DO CARRO (PDF E IMAGENS)
CREATE TABLE IF NOT EXISTS "veiculos_documentos_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    veiculo_id BIGINT NOT NULL REFERENCES "veiculos_DGAUTOS"(id) ON DELETE CASCADE,
    tipo VARCHAR(100) NOT NULL,
    numero VARCHAR(80),
    nome_arquivo VARCHAR(255),
    tipo_arquivo VARCHAR(30) NOT NULL DEFAULT 'pdf',
    arquivo_dados TEXT NOT NULL,
    tamanho_kb NUMERIC(10,2),
    status VARCHAR(50) DEFAULT 'Validado',
    data_anexo DATE NOT NULL DEFAULT CURRENT_DATE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_veiculo_dgautos ON "veiculos_documentos_DGAUTOS"(veiculo_id);

-- 7. TABELA DE PENDÊNCIAS
CREATE TABLE IF NOT EXISTS "veiculos_pendencias_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    veiculo_id BIGINT NOT NULL REFERENCES "veiculos_DGAUTOS"(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
    concluida BOOLEAN NOT NULL DEFAULT FALSE,
    concluida_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 8. TABELA DE RESERVAS
CREATE TABLE IF NOT EXISTS "veiculos_reservas_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    veiculo_id BIGINT NOT NULL REFERENCES "veiculos_DGAUTOS"(id) ON DELETE CASCADE,
    cliente_nome VARCHAR(150) NOT NULL,
    funcionario_nome VARCHAR(150),
    data_limite DATE NOT NULL,
    valor_sinal NUMERIC(12,2) DEFAULT 0.00,
    observacao TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Histórico (Baixada)', 'Cancelada')),
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 9. TABELA DE OPCIONAIS
CREATE TABLE IF NOT EXISTS "veiculos_opcionais_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    veiculo_id BIGINT NOT NULL REFERENCES "veiculos_DGAUTOS"(id) ON DELETE CASCADE,
    nome_opcional VARCHAR(120) NOT NULL,
    tipo VARCHAR(30) DEFAULT 'opcional'
);

-- 10. TABELA DE OPORTUNIDADES DO CRM / LEADS
CREATE TABLE IF NOT EXISTS "oportunidades_crm_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    nome_lead VARCHAR(150) NOT NULL,
    telefone VARCHAR(30),
    email VARCHAR(150),
    cliente_id BIGINT REFERENCES "clientes_DGAUTOS"(id) ON DELETE SET NULL,
    vendedor_id BIGINT REFERENCES "usuarios_DGAUTOS"(id) ON DELETE SET NULL,
    veiculo_id BIGINT REFERENCES "veiculos_DGAUTOS"(id) ON DELETE SET NULL,
    veiculo_interesse VARCHAR(200),
    troca_veiculo VARCHAR(200),
    valor_proposta NUMERIC(12,2) DEFAULT 0.00,
    origem VARCHAR(50) NOT NULL DEFAULT 'SITE' CHECK (origem IN ('SITE', 'WHATSAPP', 'INSTAGRAM', 'LOJA', 'OLX', 'CHAVES_NA_MAO', 'WEBMOTORS', 'ICARROS')),
    estagio VARCHAR(50) NOT NULL DEFAULT 'pendente' CHECK (estagio IN ('pendente', 'em_atendimento', 'proposta', 'fechado', 'perdido')),
    etiquetas JSONB DEFAULT '[]'::jsonb,
    proxima_acao_tipo VARCHAR(50) DEFAULT 'Contato',
    proxima_acao_data DATE,
    motivo_conclusao TEXT,
    historico JSONB DEFAULT '[]'::jsonb,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 11. TABELA DE NEGOCIAÇÕES / CONTRATOS (WIZARD DE 4 ETAPAS)
CREATE TABLE IF NOT EXISTS "negociacoes_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(30) NOT NULL DEFAULT 'venda' CHECK (tipo IN ('venda', 'troca', 'compra', 'consignacao')),
    status VARCHAR(30) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'conferencia', 'concluida', 'cancelada')),
    cliente_id BIGINT REFERENCES "clientes_DGAUTOS"(id) ON DELETE RESTRICT,
    vendedor_id BIGINT REFERENCES "usuarios_DGAUTOS"(id) ON DELETE SET NULL,
    veiculo_id BIGINT REFERENCES "veiculos_DGAUTOS"(id) ON DELETE RESTRICT,
    canal_venda VARCHAR(50) DEFAULT 'LOJA',
    
    valor_veiculo NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    desconto NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    valor_liquido NUMERIC(12,2) GENERATED ALWAYS AS (valor_veiculo - desconto) STORED,
    
    troca_marca VARCHAR(80),
    troca_modelo VARCHAR(120),
    troca_ano VARCHAR(20),
    troca_placa VARCHAR(10),
    troca_km INTEGER DEFAULT 0,
    troca_cor VARCHAR(50),
    troca_valor NUMERIC(12,2) DEFAULT 0.00,
    
    comissao_vendedor NUMERIC(12,2) DEFAULT 0.00,
    observacoes TEXT,
    motivo_cancelamento TEXT,
    cancelado_por_usuario_id BIGINT REFERENCES "usuarios_DGAUTOS"(id),
    
    data_negociacao DATE NOT NULL DEFAULT CURRENT_DATE,
    data_fechamento TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 12. TABELA DE FORMAS DE PAGAMENTO DA NEGOCIAÇÃO
CREATE TABLE IF NOT EXISTS "negociacoes_pagamentos_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    negociacao_id BIGINT NOT NULL REFERENCES "negociacoes_DGAUTOS"(id) ON DELETE CASCADE,
    forma VARCHAR(60) NOT NULL,
    financeira VARCHAR(100),
    valor NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    vencimento DATE DEFAULT CURRENT_DATE,
    status VARCHAR(30) DEFAULT 'pago',
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 13. TABELA DE MODELOS CONTRATUAIS
CREATE TABLE IF NOT EXISTS "contratos_modelos_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    titulo VARCHAR(150) NOT NULL,
    tipo_operacao VARCHAR(30) NOT NULL,
    descricao TEXT,
    conteudo_minuta TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 14. TABELA DE CONTRATOS GERADOS & LGPD
CREATE TABLE IF NOT EXISTS "contratos_gerados_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    negociacao_id BIGINT REFERENCES "negociacoes_DGAUTOS"(id) ON DELETE RESTRICT,
    veiculo_id BIGINT REFERENCES "veiculos_DGAUTOS"(id) ON DELETE RESTRICT,
    cliente_id BIGINT REFERENCES "clientes_DGAUTOS"(id) ON DELETE RESTRICT,
    modelo_codigo VARCHAR(50) REFERENCES "contratos_modelos_DGAUTOS"(codigo),
    texto_integral TEXT NOT NULL,
    autorizacao_lgpd_imagem BOOLEAN DEFAULT TRUE,
    hodometro_comprado INTEGER,
    hodometro_troca INTEGER,
    status VARCHAR(30) NOT NULL DEFAULT 'emitido' CHECK (status IN ('emitido', 'assinado', 'distratado')),
    data_emissao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 15. TABELA FINANCEIRA
CREATE TABLE IF NOT EXISTS "financeiro_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    categoria VARCHAR(80) NOT NULL DEFAULT 'Outros',
    descricao VARCHAR(255) NOT NULL,
    valor NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    vencimento DATE NOT NULL DEFAULT CURRENT_DATE,
    pagamento_data DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
    forma_pagamento VARCHAR(60) DEFAULT 'Pix / TED',
    conta_bancaria VARCHAR(80) DEFAULT 'Conta Principal',
    veiculo_id BIGINT REFERENCES "veiculos_DGAUTOS"(id) ON DELETE SET NULL,
    cliente_id BIGINT REFERENCES "clientes_DGAUTOS"(id) ON DELETE SET NULL,
    negociacao_id BIGINT REFERENCES "negociacoes_DGAUTOS"(id) ON DELETE SET NULL,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 16. TABELA DE AUDITORIA & SEGURANÇA
CREATE TABLE IF NOT EXISTS "auditoria_logs_DGAUTOS" (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES "usuarios_DGAUTOS"(id) ON DELETE SET NULL,
    acao VARCHAR(80) NOT NULL,
    tabela_afetada VARCHAR(80) NOT NULL,
    registro_id BIGINT,
    detalhes JSONB DEFAULT '{}'::jsonb,
    ip_origem VARCHAR(50),
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 17. VIEWS DE INTEGRAÇÃO COM O SITE DG AUTOMÓVEIS
CREATE OR REPLACE VIEW "view_estoque_site_DGAUTOS" AS
SELECT 
    v.id,
    v.codigo_interno,
    v.marca,
    v.modelo,
    v.modelo_complemento,
    v.ano,
    v.ano_fabricacao,
    v.ano_modelo,
    v.km,
    v.cor,
    v.combustivel,
    v.cambio,
    v.portas,
    v.placa,
    v.cidade_emplacamento,
    v.preco AS preco_loja,
    COALESCE(NULLIF(v.valor_site, 0), v.preco) AS preco_site,
    v.valor_troca,
    v.fipe,
    COALESCE(v.foto_capa, (
        SELECT url_foto FROM "veiculos_fotos_DGAUTOS" f 
        WHERE f.veiculo_id = v.id 
        ORDER BY f.ordem ASC, f.id ASC LIMIT 1
    )) AS foto_principal,
    (
        SELECT json_agg(json_build_object('url', f.url_foto, 'ordem', f.ordem, 'is_capa', f.is_capa) ORDER BY f.ordem ASC)
        FROM "veiculos_fotos_DGAUTOS" f
        WHERE f.veiculo_id = v.id
    ) AS galeria_fotos,
    (
        SELECT array_agg(o.nome_opcional)
        FROM "veiculos_opcionais_DGAUTOS" o
        WHERE o.veiculo_id = v.id
    ) AS opcionais,
    v.destaque_site,
    v.observacao_site,
    v.observacao_anuncio,
    v.observacao_internet,
    v.url_video,
    v.status,
    v.data_entrada,
    v.atualizado_em
FROM "veiculos_DGAUTOS" v
WHERE v.status = 'disponivel' 
  AND v.publicar_site = TRUE;

CREATE OR REPLACE VIEW "view_vitrine_home_DGAUTOS" AS
SELECT * FROM "view_estoque_site_DGAUTOS"
WHERE destaque_site = TRUE;

-- 18. CARGA INICIAL BÁSICA
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
