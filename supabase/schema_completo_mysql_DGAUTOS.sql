-- ==============================================================================
-- DG AUTOMÓVEIS - SCHEMA COMPLETO DE BANCO DE DADOS (MYSQL / MARIADB)
-- TODAS AS TABELAS CRIADAS COM SUFIXO _DGAUTOS
-- Compatível com: MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+, cPanel, AWS RDS MySQL
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. TABELA DE USUÁRIOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil ENUM('admin', 'gerente', 'vendedor', 'financeiro') NOT NULL DEFAULT 'vendedor',
    telefone VARCHAR(30),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. TABELA DE CONFIGURAÇÃO DA LOJA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config_loja_DGAUTOS (
    id INT PRIMARY KEY,
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
    termo_garantia_padrao TEXT,
    chave_pix VARCHAR(100),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. TABELA DE CLIENTES E FORNECEDORES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo_pessoa ENUM('PF', 'PJ') NOT NULL DEFAULT 'PF',
    papel ENUM('cliente', 'fornecedor', 'ambos') NOT NULL DEFAULT 'cliente',
    nome VARCHAR(180) NOT NULL,
    cpf_cnpj VARCHAR(30),
    rg_ie VARCHAR(30),
    data_nascimento DATE NULL,
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
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clientes_nome (nome),
    INDEX idx_clientes_cpf (cpf_cnpj)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. TABELA CENTRAL DE VEÍCULOS DO ESTOQUE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_interno VARCHAR(50),
    marca VARCHAR(80) NOT NULL,
    modelo VARCHAR(120) NOT NULL,
    modelo_complemento VARCHAR(120),
    ano VARCHAR(20) NOT NULL,
    ano_fabricacao INT,
    ano_modelo INT,
    km INT NOT NULL DEFAULT 0,
    cor VARCHAR(50) DEFAULT 'Branco',
    cor_interna VARCHAR(50),
    combustivel VARCHAR(40) DEFAULT 'Flex',
    cambio VARCHAR(50) DEFAULT 'Automático',
    portas INT DEFAULT 4,
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
    propriedade ENUM('PROPRIO', 'SOCIEDADE', 'TERCEIRO_CONSIGNADO', 'TERCEIRO_DEMONSTRACAO', 'TERCEIRO_FINANCIAMENTO') NOT NULL DEFAULT 'PROPRIO',
    status ENUM('disponivel', 'reservado', 'vendido', 'em_preparacao', 'cancelado') NOT NULL DEFAULT 'disponivel',
    situacao_patio VARCHAR(100) DEFAULT 'Pronto para venda (Showroom)',
    localizacao_patio VARCHAR(100) DEFAULT 'Showroom Principal',
    repasse BOOLEAN DEFAULT FALSE,
    garantia_fabrica VARCHAR(60) DEFAULT 'Não',
    
    -- Valores
    custo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    despesas_veiculo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    preco DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    valor_minimo DECIMAL(12,2) DEFAULT 0.00,
    valor_troca DECIMAL(12,2) DEFAULT 0.00,
    fipe DECIMAL(12,2) DEFAULT 0.00,
    valor_fipe_anterior DECIMAL(12,2) DEFAULT 0.00,
    codigo_fipe VARCHAR(30),
    
    -- Integração Site DG
    foto_capa MEDIUMTEXT,
    publicar_site BOOLEAN NOT NULL DEFAULT TRUE,
    destaque_site BOOLEAN NOT NULL DEFAULT FALSE,
    valor_site DECIMAL(12,2) DEFAULT 0.00,
    observacao_site VARCHAR(255),
    url_video VARCHAR(255),
    
    -- Observações
    observacao_anuncio TEXT,
    observacao_internet TEXT,
    observacao_interna TEXT,
    observacao_contrato TEXT,
    
    -- Fiscal
    cfop_entrada VARCHAR(20),
    cfop_saida VARCHAR(20),
    valor_nf_compra DECIMAL(12,2) DEFAULT 0.00,
    valor_nf_venda DECIMAL(12,2) DEFAULT 0.00,
    
    -- Chaves Estrangeiras
    cliente_origem_id BIGINT NULL,
    cliente_comprador_id BIGINT NULL,
    vendedor_responsavel_id BIGINT NULL,
    
    dados_altimus JSON NULL,
    
    data_entrada DATE NOT NULL,
    data_venda DATE NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_veic_status (status),
    INDEX idx_veic_publicar (publicar_site),
    INDEX idx_veic_placa (placa),
    INDEX idx_veic_marca_modelo (marca, modelo),
    CONSTRAINT fk_veic_cliente_origem FOREIGN KEY (cliente_origem_id) REFERENCES clientes_DGAUTOS(id) ON DELETE SET NULL,
    CONSTRAINT fk_veic_cliente_comprador FOREIGN KEY (cliente_comprador_id) REFERENCES clientes_DGAUTOS(id) ON DELETE SET NULL,
    CONSTRAINT fk_veic_vendedor FOREIGN KEY (vendedor_responsavel_id) REFERENCES usuarios_DGAUTOS(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. TABELA DE FOTOS DO VEÍCULO (DRAG & DROP)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos_fotos_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id BIGINT NOT NULL,
    url_foto LONGTEXT NOT NULL,
    ordem INT NOT NULL DEFAULT 1,
    is_capa BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fotos_veiculo_ordem (veiculo_id, ordem),
    CONSTRAINT fk_fotos_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. TABELA DE DOCUMENTOS DO VEÍCULO (PDF E IMAGEM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos_documentos_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id BIGINT NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    numero VARCHAR(80),
    nome_arquivo VARCHAR(255),
    tipo_arquivo ENUM('pdf', 'imagem') NOT NULL DEFAULT 'pdf',
    arquivo_dados LONGTEXT NOT NULL,
    tamanho_kb DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'Validado',
    data_anexo DATE NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_docs_veiculo (veiculo_id),
    CONSTRAINT fk_docs_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. TABELA DE PENDÊNCIAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos_pendencias_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id BIGINT NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
    concluida BOOLEAN NOT NULL DEFAULT FALSE,
    concluida_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pend_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. TABELA DE RESERVAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos_reservas_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id BIGINT NOT NULL,
    cliente_nome VARCHAR(150) NOT NULL,
    funcionario_nome VARCHAR(150),
    data_limite DATE NOT NULL,
    valor_sinal DECIMAL(12,2) DEFAULT 0.00,
    observacao TEXT,
    status ENUM('Pendente', 'Histórico (Baixada)', 'Cancelada') NOT NULL DEFAULT 'Pendente',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservas_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. TABELA DE OPCIONAIS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos_opcionais_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id BIGINT NOT NULL,
    nome_opcional VARCHAR(120) NOT NULL,
    tipo ENUM('opcional', 'destaque') DEFAULT 'opcional',
    INDEX idx_opc_veiculo (veiculo_id),
    CONSTRAINT fk_opc_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. TABELA DE OPORTUNIDADES DO CRM / LEADS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oportunidades_crm_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome_lead VARCHAR(150) NOT NULL,
    telefone VARCHAR(30),
    email VARCHAR(150),
    cliente_id BIGINT NULL,
    vendedor_id BIGINT NULL,
    veiculo_id BIGINT NULL,
    veiculo_interesse VARCHAR(200),
    troca_veiculo VARCHAR(200),
    valor_proposta DECIMAL(12,2) DEFAULT 0.00,
    origem ENUM('SITE', 'WHATSAPP', 'INSTAGRAM', 'LOJA', 'OLX', 'CHAVES_NA_MAO', 'WEBMOTORS', 'ICARROS') NOT NULL DEFAULT 'SITE',
    estagio ENUM('pendente', 'em_atendimento', 'proposta', 'fechado', 'perdido') NOT NULL DEFAULT 'pendente',
    etiquetas JSON NULL,
    proxima_acao_tipo VARCHAR(50) DEFAULT 'Contato',
    proxima_acao_data DATE NULL,
    motivo_conclusao TEXT,
    historico JSON NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_crm_estagio (estagio),
    CONSTRAINT fk_crm_cliente FOREIGN KEY (cliente_id) REFERENCES clientes_DGAUTOS(id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios_DGAUTOS(id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 11. TABELA DE NEGOCIAÇÕES / CONTRATOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS negociacoes_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('venda', 'troca', 'compra', 'consignacao') NOT NULL DEFAULT 'venda',
    status ENUM('aberta', 'conferencia', 'concluida', 'cancelada') NOT NULL DEFAULT 'aberta',
    cliente_id BIGINT NOT NULL,
    vendedor_id BIGINT NULL,
    veiculo_id BIGINT NOT NULL,
    canal_venda VARCHAR(50) DEFAULT 'LOJA',
    
    valor_veiculo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    desconto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    valor_liquido DECIMAL(12,2) AS (valor_veiculo - desconto) STORED,
    
    troca_marca VARCHAR(80),
    troca_modelo VARCHAR(120),
    troca_ano VARCHAR(20),
    troca_placa VARCHAR(10),
    troca_km INT DEFAULT 0,
    troca_cor VARCHAR(50),
    troca_valor DECIMAL(12,2) DEFAULT 0.00,
    
    comissao_vendedor DECIMAL(12,2) DEFAULT 0.00,
    observacoes TEXT,
    motivo_cancelamento TEXT,
    cancelado_por_usuario_id BIGINT NULL,
    
    data_negociacao DATE NOT NULL,
    data_fechamento DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_neg_tipo (tipo),
    INDEX idx_neg_status (status),
    CONSTRAINT fk_neg_cliente FOREIGN KEY (cliente_id) REFERENCES clientes_DGAUTOS(id) ON DELETE RESTRICT,
    CONSTRAINT fk_neg_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios_DGAUTOS(id) ON DELETE SET NULL,
    CONSTRAINT fk_neg_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 12. TABELA DE PAGAMENTOS DA NEGOCIAÇÃO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS negociacoes_pagamentos_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    negociacao_id BIGINT NOT NULL,
    forma VARCHAR(60) NOT NULL,
    financeira VARCHAR(100),
    valor DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    vencimento DATE NULL,
    status VARCHAR(30) DEFAULT 'pago',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pag_negociacao (negociacao_id),
    CONSTRAINT fk_pag_negociacao FOREIGN KEY (negociacao_id) REFERENCES negociacoes_DGAUTOS(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 13. TABELA DE MODELOS CONTRATUAIS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos_modelos_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    titulo VARCHAR(150) NOT NULL,
    tipo_operacao VARCHAR(30) NOT NULL,
    descricao TEXT,
    conteudo_minuta LONGTEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 14. TABELA DE CONTRATOS GERADOS & LGPD
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos_gerados_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    negociacao_id BIGINT NOT NULL,
    veiculo_id BIGINT NOT NULL,
    cliente_id BIGINT NOT NULL,
    modelo_codigo VARCHAR(50) NOT NULL,
    texto_integral LONGTEXT NOT NULL,
    autorizacao_lgpd_imagem BOOLEAN DEFAULT TRUE,
    hodometro_comprado INT,
    hodometro_troca INT,
    status ENUM('emitido', 'assinado', 'distratado') NOT NULL DEFAULT 'emitido',
    data_emissao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cg_negociacao FOREIGN KEY (negociacao_id) REFERENCES negociacoes_DGAUTOS(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cg_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cg_cliente FOREIGN KEY (cliente_id) REFERENCES clientes_DGAUTOS(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 15. TABELA FINANCEIRA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financeiro_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('receita', 'despesa') NOT NULL,
    categoria VARCHAR(80) NOT NULL DEFAULT 'Outros',
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    vencimento DATE NOT NULL,
    pagamento_data DATE NULL,
    status ENUM('pendente', 'pago', 'cancelado') NOT NULL DEFAULT 'pendente',
    forma_pagamento VARCHAR(60) DEFAULT 'Pix / TED',
    conta_bancaria VARCHAR(80) DEFAULT 'Conta Principal',
    veiculo_id BIGINT NULL,
    cliente_id BIGINT NULL,
    negociacao_id BIGINT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fin_tipo_status (tipo, status),
    INDEX idx_fin_veiculo (veiculo_id),
    CONSTRAINT fk_fin_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos_DGAUTOS(id) ON DELETE SET NULL,
    CONSTRAINT fk_fin_cliente FOREIGN KEY (cliente_id) REFERENCES clientes_DGAUTOS(id) ON DELETE SET NULL,
    CONSTRAINT fk_fin_negociacao FOREIGN KEY (negociacao_id) REFERENCES negociacoes_DGAUTOS(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 16. TABELA DE AUDITORIA (LOGS DE SEGURANÇA E ADMIN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria_logs_DGAUTOS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NULL,
    acao VARCHAR(80) NOT NULL,
    tabela_afetada VARCHAR(80) NOT NULL,
    registro_id BIGINT NULL,
    detalhes JSON NULL,
    ip_origem VARCHAR(50),
    data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_tabela (tabela_afetada, registro_id),
    CONSTRAINT fk_audit_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios_DGAUTOS(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Carga inicial de configuração
INSERT INTO config_loja_DGAUTOS (
    id, razao_social, nome_fantasia, cnpj, telefone, whatsapp, email, site_url, cidade, uf, token_feed_site
) VALUES (
    1, 'DG Automóveis Comércio de Veículos Ltda', 'DG Automóveis', '12.345.678/0001-90', 
    '(47) 3333-4444', '(47) 99999-8888', 'contato@dgautomoveis.com.br', 'https://dgautomoveis.com.br', 
    'Balneário Camboriú', 'SC', '20706bbe-4a09-4a03-8e2a-1f47e73d7a14'
) ON DUPLICATE KEY UPDATE nome_fantasia = VALUES(nome_fantasia);
