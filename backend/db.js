// Banco SQLite (módulo nativo do Node 22). Em produção, trocar por PostgreSQL.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

import fs from 'node:fs';
import path from 'node:path';

function resolverCaminhoBanco() {
  const opcoes = [
    path.join(process.cwd(), 'backend', 'motriz.db'),
    path.join(process.cwd(), 'motriz.db'),
    fileURLToPath(new URL('./motriz.db', import.meta.url))
  ];
  for (const p of opcoes) {
    if (fs.existsSync(p) && fs.statSync(p).size > 100000) return p;
  }
  return opcoes[0];
}

export const db = new DatabaseSync(resolverCaminhoBanco());

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'vendedor' -- admin | gerente | vendedor | financeiro
  );

  CREATE TABLE IF NOT EXISTS veiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marca TEXT NOT NULL, modelo TEXT NOT NULL, ano TEXT, km INTEGER DEFAULT 0,
    cor TEXT, combustivel TEXT, cambio TEXT, placa TEXT, chassi TEXT, renavam TEXT,
    opcionais TEXT, custo REAL DEFAULT 0, preco REAL DEFAULT 0, fipe REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'disponivel', foto TEXT,
    entrada TEXT NOT NULL DEFAULT (date('now')), venda TEXT,
    dados_altimus TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_pessoa TEXT NOT NULL DEFAULT 'PF', -- PF | PJ
    papel TEXT NOT NULL DEFAULT 'cliente', -- cliente | fornecedor | ambos
    nome TEXT NOT NULL,
    cpf_cnpj TEXT,
    rg_ie TEXT,
    data_nasc TEXT,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    cep TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT DEFAULT 'SC',
    origem TEXT DEFAULT 'MANUAL',
    observacoes TEXT,
    criado_em TEXT NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS oportunidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_lead TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    cliente_id INTEGER,
    vendedor_id INTEGER,
    veiculo_id INTEGER,
    veiculo_interesse TEXT,
    troca_veiculo TEXT,
    valor_proposta REAL DEFAULT 0,
    origem TEXT NOT NULL DEFAULT 'WHATSAPP',
    estagio TEXT NOT NULL DEFAULT 'pendente',
    etiquetas TEXT DEFAULT '[]',
    proxima_acao_tipo TEXT DEFAULT 'Contato',
    proxima_acao_data TEXT,
    motivo_conclusao TEXT,
    historico TEXT DEFAULT '[]',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS negociacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL DEFAULT 'venda',
    status TEXT NOT NULL DEFAULT 'aberta',
    cliente_id INTEGER,
    vendedor_id INTEGER,
    canal_venda TEXT DEFAULT 'LOJA',
    veiculo_id INTEGER,
    valor_veiculo REAL DEFAULT 0,
    desconto REAL DEFAULT 0,
    troca_marca TEXT,
    troca_modelo TEXT,
    troca_ano TEXT,
    troca_placa TEXT,
    troca_km INTEGER DEFAULT 0,
    troca_cor TEXT,
    troca_valor REAL DEFAULT 0,
    pagamentos TEXT DEFAULT '[]',
    comissao_vendedor REAL DEFAULT 0,
    observacoes TEXT,
    data_negociacao TEXT NOT NULL DEFAULT (date('now')),
    data_fechamento TEXT
  );

  CREATE TABLE IF NOT EXISTS financeiro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL DEFAULT 'despesa',
    categoria TEXT NOT NULL DEFAULT 'Outros',
    descricao TEXT NOT NULL,
    valor REAL NOT NULL DEFAULT 0,
    vencimento TEXT NOT NULL DEFAULT (date('now')),
    pagamento_data TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    forma_pagamento TEXT DEFAULT 'Pix / TED',
    conta_bancaria TEXT DEFAULT 'Conta Principal',
    veiculo_id INTEGER,
    cliente_id INTEGER,
    negociacao_id INTEGER,
    criado_em TEXT NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS config_loja (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    razao_social TEXT DEFAULT 'Motriz Multimarcas Comércio de Veículos Ltda',
    nome_fantasia TEXT DEFAULT 'Motriz Multimarcas',
    cnpj TEXT DEFAULT '12.345.678/0001-90',
    telefone TEXT DEFAULT '(47) 3333-4444',
    whatsapp TEXT DEFAULT '(47) 99999-8888',
    email TEXT DEFAULT 'contato@motriz.com.br',
    endereco TEXT DEFAULT 'Av. Brasil, 1500 - Centro',
    cidade TEXT DEFAULT 'Balneário Camboriú',
    uf TEXT DEFAULT 'SC',
    cep TEXT DEFAULT '88330-000',
    termos_garantia TEXT DEFAULT 'Garantia legal de 90 (noventa) dias para motor e câmbio, conforme Art. 26 do Código de Defesa do Consumidor, contados a partir da data de entrega do veículo.'
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER, acao TEXT, tabela TEXT, registro_id INTEGER,
    data TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try { db.exec('ALTER TABLE veiculos ADD COLUMN fipe REAL DEFAULT 0'); } catch {}
try { db.exec("ALTER TABLE veiculos ADD COLUMN dados_altimus TEXT DEFAULT '{}'"); } catch {}
try { db.exec("ALTER TABLE config_loja ADD COLUMN token_feed_site TEXT DEFAULT '20706bbe-4a09-4a03-8e2a-1f47e73d7a14'"); } catch {}
try { db.exec("ALTER TABLE config_loja ADD COLUMN url_site TEXT DEFAULT 'https://dgautomoveis.com.br'"); } catch {}
try { db.exec("ALTER TABLE config_loja ADD COLUMN auto_publicar_site INTEGER DEFAULT 1"); } catch {}

// Popula dados_altimus ricos nos veículos existentes que ainda estiverem vazios
const veicsSemDetalhes = db.prepare("SELECT * FROM veiculos WHERE dados_altimus IS NULL OR dados_altimus = '{}'").all();
if (veicsSemDetalhes.length > 0) {
  const upd = db.prepare('UPDATE veiculos SET fipe = CASE WHEN fipe > 0 THEN fipe ELSE ? END, chassi = COALESCE(chassi, ?), renavam = COALESCE(renavam, ?), dados_altimus = ? WHERE id = ?');
  veicsSemDetalhes.forEach((v, idx) => {
    const [anoFab, anoMod] = String(v.ano || '2022/2023').split('/');
    const fipeSugerida = v.fipe > 0 ? v.fipe : Math.round(Number(v.preco || 100000) * 1.02);
    const chassiPadrao = v.chassi || `9BWZZZ377VT00${1100 + v.id}`;
    const renavamPadrao = v.renavam || `01284950${100 + v.id}`;
    const extras = {
      codigo_interno: `V-${100 + v.id}`,
      estado_conservacao: 'USADO',
      propriedade: v.status === 'consignado' ? 'TERCEIRO_CONSIGNADO' : 'PROPRIO',
      repasse: false,
      garantia_fabrica: idx === 3 ? 'Sim (até 2027)' : 'Não',
      modelo_complemento: v.modelo.split(' ').slice(1).join(' ') || 'Completo',
      ano_fabricacao: anoFab || '2022',
      ano_modelo: anoMod || anoFab || '2023',
      cor_interna: 'Preto (Couro)',
      portas: 4,
      potencia: '177',
      cilindradas: '2000',
      direcao: 'Elétrica',
      categoria_veiculo: 'Carro / SUV / Utilitário',
      numero_motor: `MTR${202600 + v.id}`,
      crv: `CRV-${99810 + v.id}`,
      cidade_emplacamento: 'Balneário Camboriú - SC',
      ipva_exercicio: '2026',
      licenciamento_exercicio: '2026',
      dpvat_exercicio: '2026',
      situacao_patio: v.status === 'vendido' ? 'Entregue ao cliente' : 'Pronto para venda (Showroom)',
      localizacao_patio: v.status === 'vendido' ? 'Fora do pátio' : 'Showroom Principal',
      codigo_fipe: `00${2110 + v.id}-${idx + 1}`,
      valor_fipe_anterior: Math.round(fipeSugerida * 1.008),
      valor_minimo: Math.round(Number(v.preco || 0) * 0.97),
      valor_troca: Math.round(Number(v.preco || 0) * 1.03),
      valor_site: Number(v.preco || 0),
      km_entrada: Number(v.km || 0),
      km_saida: v.status === 'vendido' ? Number(v.km || 0) + 15 : '',
      cliente_entrada_id: v.status === 'consignado' ? 3 : 1,
      proprietario_atual_id: v.status === 'consignado' ? 3 : '',
      cliente_saida_id: v.status === 'vendido' ? 5 : '',
      observacao_interna: 'Veículo periciado com laudo cautelar 100% aprovado. Chave reserva no cofre #0' + v.id,
      observacao_anuncio: `${v.marca} ${v.modelo} ${v.ano}, câmbio ${v.cambio}, impecável, pneus novos e revisado com garantia.`,
      observacao_internet: `${v.marca} ${v.modelo} (${v.ano}) com apenas ${Number(v.km || 0).toLocaleString('pt-BR')} km! Laudo cautelar aprovado, manual e chave reserva. Aceitamos seu usado na troca com a melhor avaliação da região e financiamos em até 60x!`,
      observacao_contrato: 'Veículo entregue revisado, com garantia legal de 90 dias para motor e câmbio.',
      observacao_financiamento: 'Elegível para tabela retorno zero ou taxas especiais Santander / Itaú / Safra.',
      itens_opcionais: [
        'Airbag', 'Ar Condicionado', 'Ar Digital', 'Alarme', 'Bancos de Couro',
        'Câmera de Ré', 'Central Multimídia', 'Chave Presencial', 'Computador de bordo',
        'Conexão USB', 'Interface Bluetooth', 'Rodas de liga leve', 'Sensor de ré',
        'Trava elétrica', 'Vidro elétrico', 'Volante multifuncional'
      ],
      itens_destaques: ['Único dono', 'IPVA Pago', 'Manual do Proprietário', 'Chave Reserva', 'Veículo quitado', 'Laudo Cautelar Aprovado'],
      pendencias: [
        { id: 1, titulo: 'Laudo Cautelar / Vistoria ECV', obrigatoria: true, concluida: true, data: v.entrada },
        { id: 2, titulo: 'Chave Reserva e Manual no Cofre', obrigatoria: false, concluida: true, data: v.entrada },
        { id: 3, titulo: 'Reconhecimento de Firma / ATPV-e', obrigatoria: true, concluida: v.status === 'vendido', data: v.entrada }
      ],
      reservas: v.status === 'reservado' ? [
        { id: 1, funcionario: 'Carlos Mendes (Vendas)', cliente: 'Fernanda Duarte Silva', data_limite: '2026-10-23', observacao: 'Sinal de R$ 2.000 via Pix aguardando aprovação final Santander.', status: 'Pendente' }
      ] : [],
      investidores: [
        { id: 1, nome: 'Motriz Multimarcas (Loja)', percentual: 100 }
      ],
      documentos_anexos: [
        { id: 1, tipo: 'CRLV Digital 2026', numero: renavamPadrao, status: 'Validado', data: v.entrada },
        { id: 2, tipo: 'Laudo Cautelar SuperVisão', numero: `LC-${8820 + v.id}`, status: 'Aprovado sem restrições', data: v.entrada }
      ],
      fotos: v.foto ? [v.foto] : [],
      url_video: '',
      cfop_entrada: '1102 - Compra para comercialização',
      cfop_saida: '5102 - Venda de mercadoria adquirida',
      liberar_nf_compra: true,
      valor_nf_compra: Number(v.custo || 0),
      liberar_nf_venda: v.status === 'vendido',
      valor_nf_venda: Number(v.preco || 0),
    };
    upd.run(fipeSugerida, chassiPadrao, renavamPadrao, JSON.stringify(extras), v.id);
  });
}

// ---------- Dados Iniciais ----------
if (!db.prepare('SELECT COUNT(*) n FROM config_loja').get().n) {
  db.prepare('INSERT INTO config_loja (id) VALUES (1)').run();
}

if (!db.prepare('SELECT COUNT(*) n FROM usuarios').get().n) {
  const insU = db.prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)');
  insU.run('Administrador', 'admin@motriz.com', bcrypt.hashSync('admin123', 10), 'admin');
  insU.run('Alexandre Gorges', 'alexandre@motriz.com', bcrypt.hashSync('admin123', 10), 'gerente');
  insU.run('Carlos Mendes (Vendas)', 'carlos@motriz.com', bcrypt.hashSync('admin123', 10), 'vendedor');
}

export const audit = (usuarioId, acao, tabela, registroId) =>
  db.prepare('INSERT INTO auditoria (usuario_id, acao, tabela, registro_id) VALUES (?,?,?,?)').run(usuarioId, acao, tabela, registroId);
