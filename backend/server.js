import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, audit } from './db.js';

const SECRET = process.env.JWT_SECRET || 'troque-este-segredo-em-producao';
const PORT = process.env.PORT || 3333;
const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body || {};
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(String(email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(String(senha || ''), u.senha_hash)) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  const user = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '12h' }), user });
});

function auth(req, res, next) {
  try {
    req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
  }
}
const perfil = (...perfis) => (req, res, next) =>
  perfis.includes(req.user.perfil) ? next() : res.status(403).json({ erro: 'Sem permissão.' });

app.get('/api/auth/me', auth, (req, res) => res.json(req.user));

const parseJsonObj = (s, fb = {}) => {
  try { return typeof s === 'string' ? JSON.parse(s) : (s && typeof s === 'object' ? s : fb); } catch { return fb; }
};
const parseJsonSafe = (s, fb = []) => {
  try { return typeof s === 'string' ? JSON.parse(s) : (Array.isArray(s) ? s : fb); } catch { return fb; }
};

// ---------- Veículos (9 Abas de Gestão Completa) ----------
const CAMPOS_VEIC = ['marca', 'modelo', 'ano', 'km', 'cor', 'combustivel', 'cambio', 'placa', 'chassi', 'renavam', 'opcionais', 'custo', 'preco', 'fipe', 'status', 'foto', 'entrada', 'venda', 'dados_altimus'];

const extrairDadosExtras = (b) => {
  const base = parseJsonObj(b.dados_altimus, {});
  const chavesExtras = [
    'codigo_interno', 'estado_conservacao', 'propriedade', 'repasse', 'garantia_fabrica',
    'modelo_complemento', 'ano_fabricacao', 'ano_modelo', 'cor_interna', 'portas',
    'potencia', 'cilindradas', 'direcao', 'categoria_veiculo', 'numero_motor', 'crv',
    'cidade_emplacamento', 'ipva_exercicio', 'licenciamento_exercicio', 'dpvat_exercicio',
    'situacao_patio', 'localizacao_patio', 'codigo_fipe', 'valor_fipe_anterior',
    'valor_minimo', 'valor_troca', 'valor_site', 'km_entrada', 'km_saida',
    'cliente_entrada_id', 'proprietario_atual_id', 'cliente_saida_id',
    'observacao_interna', 'observacao_anuncio', 'observacao_internet',
    'observacao_contrato', 'observacao_financiamento',
    'itens_opcionais', 'itens_destaques', 'pendencias', 'reservas',
    'investidores', 'documentos_anexos', 'fotos', 'url_video',
    'cfop_entrada', 'cfop_saida', 'liberar_nf_compra', 'valor_nf_compra',
    'liberar_nf_venda', 'valor_nf_venda',
    'publicar_site', 'destaque_site', 'observacao_site', 'url_anuncio_site'
  ];
  const merged = { ...base };
  chavesExtras.forEach((k) => {
    if (b[k] !== undefined) merged[k] = b[k];
  });
  return JSON.stringify(merged);
};

const pickVeic = (b) => {
  const ano = b.ano || (b.ano_fabricacao && b.ano_modelo ? `${b.ano_fabricacao}/${b.ano_modelo}` : '2023/2024');
  const fotosArr = Array.isArray(b.fotos) ? b.fotos : [];
  const fotoCapa = b.foto || fotosArr[0] || '';
  const opcionaisStr = Array.isArray(b.itens_opcionais) && b.itens_opcionais.length
    ? b.itens_opcionais.join(', ')
    : (b.opcionais ?? '');
  return [
    b.marca ?? '',
    b.modelo ?? '',
    ano,
    Number(b.km ?? b.km_entrada) || 0,
    b.cor ?? '',
    b.combustivel ?? 'Flex',
    b.cambio ?? 'Automático',
    (b.placa ?? '').toUpperCase(),
    (b.chassi ?? '').toUpperCase(),
    b.renavam ?? '',
    opcionaisStr,
    Number(b.custo) || 0,
    Number(b.preco) || 0,
    Number(b.fipe) || 0,
    b.status || 'disponivel',
    fotoCapa,
    b.entrada || new Date().toISOString().slice(0, 10),
    b.venda ?? null,
    extrairDadosExtras(b),
  ];
};

const listaVeiculos = () => {
  const rows = db.prepare(`
    SELECT v.*,
      COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.veiculo_id = v.id AND f.tipo = 'despesa'), 0) AS despesas_veiculo,
      COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.veiculo_id = v.id AND f.tipo = 'receita'), 0) AS receitas_veiculo
    FROM veiculos v
    ORDER BY v.id DESC
  `).all();

  const despPorVeic = db.prepare('SELECT * FROM financeiro WHERE veiculo_id IS NOT NULL ORDER BY vencimento DESC, id DESC').all();

  return rows.map((r) => {
    const extras = parseJsonObj(r.dados_altimus, {});
    return {
      ...extras,
      ...r,
      lancamentos_veiculo: despPorVeic.filter((d) => d.veiculo_id === r.id),
    };
  });
};

// ============================================================================
// FORMATADORES E ROTAS PÚBLICAS DE ESTOQUE (COMPATIBILIDADE 100% COM SITE DG)
// ============================================================================

function formatarVeiculoParaJsonFeed(v, loja = {}) {
  const [anoFabStr, anoModStr] = String(v.ano || '2023/2024').split('/');
  const anoFabricacao = Number(v.ano_fabricacao || anoFabStr) || new Date().getFullYear();
  const anoModelo = Number(v.ano_modelo || anoModStr) || anoFabricacao;

  // Fotos (array)
  let fotos = [];
  if (Array.isArray(v.fotos) && v.fotos.length > 0) {
    fotos = v.fotos;
  } else if (v.foto) {
    fotos = [v.foto];
  }

  // Opcionais (array)
  let opcionais = [];
  if (Array.isArray(v.itens_opcionais) && v.itens_opcionais.length > 0) {
    opcionais = v.itens_opcionais;
  } else if (v.opcionais) {
    opcionais = String(v.opcionais).split(',').map((s) => s.trim()).filter(Boolean);
  }

  const precoVenda = Number(v.valor_site > 0 ? v.valor_site : (v.preco || 0));
  const descVersao = v.modelo_complemento || v.versao || '';
  const descCompleta = v.observacao_anuncio || `${v.marca} ${v.modelo} ${descVersao} ${v.ano} ${v.cambio}`.trim();

  return {
    id: v.id,
    anoFabricacao,
    anoModelo,
    km: Number(v.km || 0),
    portas: Number(v.portas || 4),
    valorVenda: precoVenda,
    dataEntradaEstoque: v.entrada ? `${v.entrada} 12:00:00` : new Date().toISOString(),
    dataAtualizacao: new Date().toISOString(),
    filialApelido: loja.nome_fantasia || 'DG Automóveis',
    tipo: v.categoria_veiculo || 'Carro/Camioneta',
    marca: v.marca,
    modelo: v.modelo,
    versao: descVersao,
    cidade: loja.cidade || 'Rio do Sul',
    cor: v.cor || 'Branco',
    combustivel: v.combustivel || 'Flex',
    motor: v.numero_motor || '',
    observacao: v.observacao_internet || v.observacao_site || v.observacao_anuncio || descCompleta,
    placa: (v.placa || '').toUpperCase(),
    potencia: String(v.potencia || ''),
    cilindrada: String(v.cilindradas || ''),
    cambio: v.cambio || 'Automático',
    categoria: null,
    opcionais,
    fotos,
    informacoesAdicionais: {
      valor_promocional: null
    },
    destaque: v.destaque_site ? 1 : 0,
    chassi: (v.chassi || '').toUpperCase(),
    codigoFipe: v.codigo_fipe || '',
    valorFipe: Number(v.fipe || 0)
  };
}

function formatarVeiculoParaXmlFeed(v, loja = {}) {
  const json = formatarVeiculoParaJsonFeed(v, loja);
  const escapeXml = (str) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const desc = `${v.marca} ${v.modelo} ${v.modelo_complemento || ''} - ${v.cor} - ${v.ano}`.trim();

  return `  <veiculo>
    <id>${json.id}</id>
    <loja>${escapeXml(loja.nome_fantasia || 'DG Automóveis')}</loja>
    <tipo>1</tipo>
    <marca>${escapeXml(v.marca)}</marca>
    <modelo>${escapeXml(v.modelo)}</modelo>
    <versao>${escapeXml(json.versao)}</versao>
    <valor>${json.valorVenda.toFixed(1)}</valor>
    <ano>${json.anoModelo}</ano>
    <descricao>${escapeXml(desc)}</descricao>
    <km>${json.km}</km>
    <cor>${escapeXml(json.cor)}</cor>
    <combustivel>${escapeXml(json.combustivel)}</combustivel>
    <cambio>${escapeXml(json.cambio)}</cambio>
    <placa>${escapeXml(json.placa)}</placa>
    <chassi>${escapeXml(json.chassi)}</chassi>
    <opcionais>
${json.opcionais.map((op) => `      <opcional>${escapeXml(op)}</opcional>`).join('\n')}
    </opcionais>
    <fotos>
${json.fotos.map((ft) => `      <foto>${escapeXml(ft)}</foto>\n      <imagem>${escapeXml(ft)}</imagem>`).join('\n')}
    </fotos>
    <observacao>${escapeXml(json.observacao)}</observacao>
  </veiculo>`;
}

// 1. ROTA PÚBLICA JSON (Mesma estrutura e parâmetros de estoquejson?estoque=TOKEN)
app.get(['/api/estoquejson', '/api/public/estoquejson'], (req, res) => {
  const token = req.query.estoque || req.query.token;
  const loja = db.prepare('SELECT * FROM config_loja WHERE id=1').get() || {};

  if (token && loja.token_feed_site && token !== loja.token_feed_site) {
    return res.status(403).json({ erro: 'Token de estoque inválido.' });
  }

  const veics = listaVeiculos().filter((v) => {
    return v.status !== 'vendido' && v.publicar_site !== false;
  });

  const payload = {
    veiculos: veics.map((v) => formatarVeiculoParaJsonFeed(v, loja))
  };

  res.set('Access-Control-Allow-Origin', '*');
  res.json(payload);
});

// 2. ROTA PÚBLICA XML (Mesma estrutura do feed XML para portais e site DG)
app.get(['/api/estoquexml', '/api/public/estoquexml'], (req, res) => {
  const token = req.query.estoque || req.query.token;
  const loja = db.prepare('SELECT * FROM config_loja WHERE id=1').get() || {};

  if (token && loja.token_feed_site && token !== loja.token_feed_site) {
    return res.status(403).send('<?xml version="1.0" encoding="UTF-8"?><erro>Token inválido</erro>');
  }

  const veics = listaVeiculos().filter((v) => v.status !== 'vendido' && v.publicar_site !== false);
  const xmlItems = veics.map((v) => formatarVeiculoParaXmlFeed(v, loja)).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<estoque>\n${xmlItems}\n</estoque>`;

  res.set('Content-Type', 'text/xml; charset=utf-8');
  res.set('Access-Control-Allow-Origin', '*');
  res.send(xml);
});

// 3. RECEPTOR DE LEADS DO SITE (INBOUND WEBHOOK DO SITE DG -> CRM MOTRIZ)
app.post(['/api/public/leads', '/api/leads/site'], (req, res) => {
  const b = req.body || {};
  const nome = b.name || b.nome || b.nome_lead;
  const telefone = b.phone || b.telefone || b.whatsapp;

  if (!nome || !telefone) {
    return res.status(400).json({ ok: false, erro: 'Nome e telefone/whatsapp são obrigatórios.' });
  }

  const leadType = b.lead_type || b.tipo_interesse || 'Compra';
  const veicId = b.veiculo_id ? Number(b.veiculo_id) : null;
  const veicInteresse = b.veiculo_interesse || b.title || b.description || '';
  const detalhes = b.details || {};
  const valorProposta = Number(detalhes.valor_proposta || b.valor_proposta || 0);

  const historicoInicial = [
    {
      data: new Date().toISOString().slice(0, 16).replace('T', ' '),
      autor: 'Site DG Automóveis (Web)',
      tipo: 'Lead Capturado',
      texto: `Lead recebido automaticamente do site para: ${leadType}${veicInteresse ? ` — ${veicInteresse}` : ''}.`
    }
  ];

  const etiquetas = ['LEAD_SITE', 'DG_AUTOMOVEIS'];
  if (leadType) etiquetas.push(String(leadType).toUpperCase());

  const vendedor = db.prepare("SELECT id FROM usuarios WHERE perfil='vendedor' ORDER BY id LIMIT 1").get() || { id: 1 };

  const r = db.prepare(`
    INSERT INTO oportunidades (
      nome_lead, telefone, email, vendedor_id, veiculo_id, veiculo_interesse,
      valor_proposta, origem, estagio, etiquetas, historico, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    nome,
    telefone,
    b.email || detalhes.email || null,
    vendedor.id,
    veicId,
    veicInteresse,
    valorProposta,
    'SITE_DG',
    'pendente',
    JSON.stringify(etiquetas),
    JSON.stringify(historicoInicial)
  );

  res.set('Access-Control-Allow-Origin', '*');
  res.status(201).json({
    ok: true,
    lead_id: Number(r.lastInsertRowid),
    mensagem: 'Lead registrado com sucesso no CRM Motriz!'
  });
});

// 4. GESTÃO E DIAGNÓSTICO DA INTEGRAÇÃO DO SITE
app.get('/api/integracao/site', auth, (req, res) => {
  const loja = db.prepare('SELECT * FROM config_loja WHERE id=1').get() || {};
  const veics = listaVeiculos();
  const total = veics.length;
  const publicados = veics.filter((v) => v.status !== 'vendido' && v.publicar_site !== false).length;
  const destaques = veics.filter((v) => v.destaque_site).length;
  const leadsSite = db.prepare("SELECT COUNT(*) AS total FROM oportunidades WHERE origem='SITE_DG' OR etiquetas LIKE '%LEAD_SITE%'").get()?.total || 0;

  const token = loja.token_feed_site || '20706bbe-4a09-4a03-8e2a-1f47e73d7a14';
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || `localhost:${PORT}`;
  const baseUrl = `${proto}://${host}`;

  res.json({
    token,
    url_site: loja.url_site || 'https://dgautomoveis.com.br',
    auto_publicar_site: loja.auto_publicar_site !== 0,
    feed_json_url: `${baseUrl}/api/estoquejson?estoque=${token}`,
    feed_xml_url: `${baseUrl}/api/estoquexml?estoque=${token}`,
    webhook_leads_url: `${baseUrl}/api/public/leads?token=${token}`,
    total_veiculos: total,
    publicados_site: publicados,
    destaques_site: destaques,
    leads_site_total: leadsSite,
    diretorio_site_local: 'D:\\Site douglas'
  });
});

app.put('/api/integracao/site', auth, perfil('admin', 'gerente'), (req, res) => {
  const { token, url_site, auto_publicar_site } = req.body || {};
  db.prepare(`
    UPDATE config_loja
    SET token_feed_site = COALESCE(?, token_feed_site),
        url_site = COALESCE(?, url_site),
        auto_publicar_site = COALESCE(?, auto_publicar_site)
    WHERE id=1
  `).run(token, url_site, auto_publicar_site ? 1 : 0);

  audit(req.user.id, 'configurar_integracao_site', 'config_loja', 1);
  const loja = db.prepare('SELECT * FROM config_loja WHERE id=1').get() || {};
  res.json(loja);
});

app.post('/api/integracao/site/regerar-token', auth, perfil('admin'), (req, res) => {
  const novoToken = crypto.randomUUID ? crypto.randomUUID() : `token_${Date.now()}`;
  db.prepare('UPDATE config_loja SET token_feed_site=? WHERE id=1').run(novoToken);
  audit(req.user.id, 'regerar_token_site', 'config_loja', 1);
  res.json({ token: novoToken });
});

app.get('/api/veiculos', auth, (req, res) => res.json(listaVeiculos()));

app.post('/api/veiculos', auth, (req, res) => {
  if (!req.body?.marca || !req.body?.modelo) return res.status(400).json({ erro: 'Marca e modelo são obrigatórios.' });
  const r = db.prepare(`INSERT INTO veiculos (${CAMPOS_VEIC.join(',')}) VALUES (${CAMPOS_VEIC.map(() => '?').join(',')})`).run(...pickVeic(req.body));
  audit(req.user.id, 'criar', 'veiculos', Number(r.lastInsertRowid));
  res.status(201).json(listaVeiculos());
});

app.put('/api/veiculos/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE veiculos SET ${CAMPOS_VEIC.map((c) => `${c}=?`).join(',')} WHERE id=?`).run(...pickVeic(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: 'Veículo não encontrado.' });
  audit(req.user.id, 'editar', 'veiculos', id);
  res.json(listaVeiculos());
});

app.delete('/api/veiculos/:id', auth, perfil('admin', 'gerente'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM veiculos WHERE id=?').run(id);
  audit(req.user.id, 'excluir', 'veiculos', id);
  res.json(listaVeiculos());
});

// ---------- Clientes & Fornecedores ----------
const CAMPOS_CLI = ['tipo_pessoa', 'papel', 'nome', 'cpf_cnpj', 'rg_ie', 'data_nasc', 'telefone', 'whatsapp', 'email', 'cep', 'endereco', 'cidade', 'uf', 'origem', 'observacoes'];
const pickCli = (b) => CAMPOS_CLI.map((c) => b[c] ?? null);
const listaClientes = () => db.prepare('SELECT * FROM clientes ORDER BY id DESC').all();

app.get('/api/clientes', auth, (req, res) => res.json(listaClientes()));

app.post('/api/clientes', auth, (req, res) => {
  if (!req.body?.nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  const r = db.prepare(`INSERT INTO clientes (${CAMPOS_CLI.join(',')}) VALUES (${CAMPOS_CLI.map(() => '?').join(',')})`).run(...pickCli(req.body));
  audit(req.user.id, 'criar', 'clientes', Number(r.lastInsertRowid));
  res.status(201).json(listaClientes());
});

app.put('/api/clientes/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE clientes SET ${CAMPOS_CLI.map((c) => `${c}=?`).join(',')} WHERE id=?`).run(...pickCli(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: 'Cliente não encontrado.' });
  audit(req.user.id, 'editar', 'clientes', id);
  res.json(listaClientes());
});

app.delete('/api/clientes/:id', auth, perfil('admin', 'gerente'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM clientes WHERE id=?').run(id);
  audit(req.user.id, 'excluir', 'clientes', id);
  res.json(listaClientes());
});

// ---------- CRM / Oportunidades ----------
const CAMPOS_OP = [
  'nome_lead', 'telefone', 'email', 'cliente_id', 'vendedor_id', 'veiculo_id',
  'veiculo_interesse', 'troca_veiculo', 'valor_proposta', 'origem', 'estagio',
  'etiquetas', 'proxima_acao_tipo', 'proxima_acao_data', 'motivo_conclusao', 'historico'
];
const pickOp = (b) => CAMPOS_OP.map((c) => {
  if (['etiquetas', 'historico'].includes(c)) return JSON.stringify(parseJsonSafe(b[c], []));
  if (['cliente_id', 'vendedor_id', 'veiculo_id'].includes(c)) return b[c] ? Number(b[c]) : null;
  if (c === 'valor_proposta') return Number(b[c]) || 0;
  return b[c] ?? null;
});

const listaOportunidades = () =>
  db.prepare(`
    SELECT o.*,
      u.nome AS vendedor_nome,
      v.marca AS veic_marca, v.modelo AS veic_modelo, v.ano AS veic_ano, v.preco AS veic_preco, v.placa AS veic_placa
    FROM oportunidades o
    LEFT JOIN usuarios u ON u.id = o.vendedor_id
    LEFT JOIN veiculos v ON v.id = o.veiculo_id
    ORDER BY o.id DESC
  `).all().map((o) => ({
    ...o,
    etiquetas: parseJsonSafe(o.etiquetas, []),
    historico: parseJsonSafe(o.historico, []),
  }));

app.get('/api/oportunidades', auth, (req, res) => res.json(listaOportunidades()));

app.post('/api/oportunidades', auth, (req, res) => {
  if (!req.body?.nome_lead) return res.status(400).json({ erro: 'Nome do lead é obrigatório.' });
  const body = {
    ...req.body,
    vendedor_id: req.body.vendedor_id || req.user.id,
    estagio: req.body.estagio || 'pendente',
    origem: req.body.origem || 'WHATSAPP',
  };
  const r = db.prepare(`INSERT INTO oportunidades (${CAMPOS_OP.join(',')}) VALUES (${CAMPOS_OP.map(() => '?').join(',')})`).run(...pickOp(body));
  audit(req.user.id, 'criar', 'oportunidades', Number(r.lastInsertRowid));
  res.status(201).json(listaOportunidades());
});

app.put('/api/oportunidades/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE oportunidades SET ${CAMPOS_OP.map((c) => `${c}=?`).join(',')} WHERE id=?`).run(...pickOp(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: 'Oportunidade não encontrada.' });
  audit(req.user.id, 'editar', 'oportunidades', id);
  res.json(listaOportunidades());
});

app.patch('/api/oportunidades/:id/estagio', auth, (req, res) => {
  const id = Number(req.params.id);
  const { estagio, motivo_conclusao } = req.body || {};
  const atual = db.prepare('SELECT * FROM oportunidades WHERE id=?').get(id);
  if (!atual) return res.status(404).json({ erro: 'Oportunidade não encontrada.' });
  const hist = parseJsonSafe(atual.historico, []);
  hist.unshift({
    data: new Date().toISOString().slice(0, 16).replace('T', ' '),
    autor: req.user.nome,
    tipo: 'Estágio',
    texto: `Movido para "${estagio}"${motivo_conclusao ? ` (Motivo: ${motivo_conclusao})` : ''}.`
  });
  db.prepare('UPDATE oportunidades SET estagio=?, motivo_conclusao=?, historico=? WHERE id=?')
    .run(estagio, motivo_conclusao ?? atual.motivo_conclusao, JSON.stringify(hist), id);
  audit(req.user.id, 'mover_estagio', 'oportunidades', id);
  res.json(listaOportunidades());
});

app.delete('/api/oportunidades/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM oportunidades WHERE id=?').run(id);
  audit(req.user.id, 'excluir', 'oportunidades', id);
  res.json(listaOportunidades());
});

// ---------- Negociações ----------
const CAMPOS_NEG = [
  'tipo', 'status', 'cliente_id', 'vendedor_id', 'canal_venda', 'veiculo_id',
  'valor_veiculo', 'desconto', 'troca_marca', 'troca_modelo', 'troca_ano',
  'troca_placa', 'troca_km', 'troca_cor', 'troca_valor', 'pagamentos',
  'comissao_vendedor', 'observacoes', 'data_negociacao', 'data_fechamento'
];
const pickNeg = (b) => CAMPOS_NEG.map((c) => {
  if (c === 'pagamentos') return JSON.stringify(parseJsonSafe(b.pagamentos, []));
  if (['cliente_id', 'vendedor_id', 'veiculo_id'].includes(c)) return b[c] ? Number(b[c]) : null;
  if (['valor_veiculo', 'desconto', 'troca_km', 'troca_valor', 'comissao_vendedor'].includes(c)) return Number(b[c]) || 0;
  if (c === 'data_negociacao') return b[c] || new Date().toISOString().slice(0, 10);
  return b[c] ?? null;
});

const listaNegociacoes = () =>
  db.prepare(`
    SELECT n.*,
      c.nome AS cliente_nome, c.cpf_cnpj AS cliente_cpf_cnpj, c.telefone AS cliente_telefone, c.endereco AS cliente_endereco, c.cidade AS cliente_cidade, c.uf AS cliente_uf,
      u.nome AS vendedor_nome,
      v.marca AS veic_marca, v.modelo AS veic_modelo, v.ano AS veic_ano, v.placa AS veic_placa, v.chassi AS veic_chassi, v.renavam AS veic_renavam, v.cor AS veic_cor, v.km AS veic_km, v.custo AS veic_custo
    FROM negociacoes n
    LEFT JOIN clientes c ON c.id = n.cliente_id
    LEFT JOIN usuarios u ON u.id = n.vendedor_id
    LEFT JOIN veiculos v ON v.id = n.veiculo_id
    ORDER BY n.id DESC
  `).all().map((n) => ({
    ...n,
    pagamentos: parseJsonSafe(n.pagamentos, []),
  }));

app.get('/api/negociacoes', auth, (req, res) => res.json(listaNegociacoes()));

app.post('/api/negociacoes', auth, (req, res) => {
  const body = { ...req.body, vendedor_id: req.body.vendedor_id || req.user.id };
  const r = db.prepare(`INSERT INTO negociacoes (${CAMPOS_NEG.join(',')}) VALUES (${CAMPOS_NEG.map(() => '?').join(',')})`).run(...pickNeg(body));
  const negId = Number(r.lastInsertRowid);
  if (body.veiculo_id && body.status === 'conferencia') {
    db.prepare("UPDATE veiculos SET status='reservado' WHERE id=? AND status='disponivel'").run(Number(body.veiculo_id));
  }
  audit(req.user.id, 'criar', 'negociacoes', negId);
  res.status(201).json(listaNegociacoes());
});

app.put('/api/negociacoes/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE negociacoes SET ${CAMPOS_NEG.map((c) => `${c}=?`).join(',')} WHERE id=?`).run(...pickNeg(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: 'Negociação não encontrada.' });
  audit(req.user.id, 'editar', 'negociacoes', id);
  res.json(listaNegociacoes());
});

app.post('/api/negociacoes/:id/concluir', auth, (req, res) => {
  const id = Number(req.params.id);
  const neg = db.prepare('SELECT * FROM negociacoes WHERE id=?').get(id);
  if (!neg) return res.status(404).json({ erro: 'Negociação não encontrada.' });
  if (neg.status === 'concluida') return res.status(400).json({ erro: 'Negociação já está concluída.' });

  const hoje = new Date().toISOString().slice(0, 10);
  db.prepare("UPDATE negociacoes SET status='concluida', data_fechamento=? WHERE id=?").run(hoje, id);

  let veicLabel = `Negociação #${id}`;
  if (neg.veiculo_id) {
    const v = db.prepare('SELECT * FROM veiculos WHERE id=?').get(neg.veiculo_id);
    if (v) {
      veicLabel = `${v.marca} ${v.modelo} (${v.placa || 's/ placa'})`;
      const novoStatus = neg.tipo === 'compra' ? 'disponivel' : 'vendido';
      db.prepare('UPDATE veiculos SET status=?, venda=? WHERE id=?').run(novoStatus, novoStatus === 'vendido' ? hoje : null, v.id);
    }
  }

  if (neg.troca_marca && neg.troca_modelo && Number(neg.troca_valor) > 0) {
    const precoSugerido = Math.round(Number(neg.troca_valor) * 1.16);
    db.prepare(`INSERT INTO veiculos (marca, modelo, ano, km, cor, combustivel, cambio, placa, custo, preco, status, entrada)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        neg.troca_marca, neg.troca_modelo, neg.troca_ano || '2020/2020', Number(neg.troca_km) || 0,
        neg.troca_cor || 'Prata', 'Flex', 'Automático', (neg.troca_placa || '').toUpperCase(),
        Number(neg.troca_valor), precoSugerido, 'disponivel', hoje
      );
  }

  const pags = parseJsonSafe(neg.pagamentos, []);
  const insFin = db.prepare(`INSERT INTO financeiro
    (tipo, categoria, descricao, valor, vencimento, pagamento_data, status, forma_pagamento, conta_bancaria, veiculo_id, cliente_id, negociacao_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  pags.forEach((p) => {
    if (!p.valor || Number(p.valor) <= 0 || String(p.forma).toLowerCase().includes('troca')) return;
    const isReceita = neg.tipo !== 'compra';
    insFin.run(
      isReceita ? 'receita' : 'despesa',
      isReceita ? 'Venda de Veículo' : 'Compra de Veículo',
      `${p.forma}${p.financeira ? ` (${p.financeira})` : ''} — ${veicLabel}`,
      Number(p.valor),
      hoje,
      hoje,
      'pago',
      p.forma,
      'Conta Principal',
      neg.veiculo_id,
      neg.cliente_id,
      id
    );
  });

  if (Number(neg.comissao_vendedor) > 0) {
    insFin.run(
      'despesa',
      'Comissão',
      `Comissão venda — ${veicLabel}`,
      Number(neg.comissao_vendedor),
      hoje,
      null,
      'pendente',
      'Pix / TED',
      'Conta Principal',
      neg.veiculo_id,
      null,
      id
    );
  }

  audit(req.user.id, 'concluir_negociacao', 'negociacoes', id);
  res.json(listaNegociacoes());
});

app.delete('/api/negociacoes/:id', auth, perfil('admin', 'gerente'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM negociacoes WHERE id=?').run(id);
  audit(req.user.id, 'excluir', 'negociacoes', id);
  res.json(listaNegociacoes());
});

// ---------- Financeiro ----------
const CAMPOS_FIN = ['tipo', 'categoria', 'descricao', 'valor', 'vencimento', 'pagamento_data', 'status', 'forma_pagamento', 'conta_bancaria', 'veiculo_id', 'cliente_id', 'negociacao_id'];
const pickFin = (b) => CAMPOS_FIN.map((c) => {
  if (c === 'valor') return Number(b[c]) || 0;
  if (['veiculo_id', 'cliente_id', 'negociacao_id'].includes(c)) return b[c] ? Number(b[c]) : null;
  return b[c] ?? null;
});

const listaFinanceiro = () =>
  db.prepare(`
    SELECT f.*,
      v.marca AS veic_marca, v.modelo AS veic_modelo, v.placa AS veic_placa,
      c.nome AS cliente_nome
    FROM financeiro f
    LEFT JOIN veiculos v ON v.id = f.veiculo_id
    LEFT JOIN clientes c ON c.id = f.cliente_id
    ORDER BY f.vencimento DESC, f.id DESC
  `).all();

app.get('/api/financeiro', auth, (req, res) => res.json(listaFinanceiro()));

app.post('/api/financeiro', auth, (req, res) => {
  if (!req.body?.descricao) return res.status(400).json({ erro: 'Descrição é obrigatória.' });
  const r = db.prepare(`INSERT INTO financeiro (${CAMPOS_FIN.join(',')}) VALUES (${CAMPOS_FIN.map(() => '?').join(',')})`).run(...pickFin(req.body));
  audit(req.user.id, 'criar', 'financeiro', Number(r.lastInsertRowid));
  res.status(201).json(listaFinanceiro());
});

app.put('/api/financeiro/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE financeiro SET ${CAMPOS_FIN.map((c) => `${c}=?`).join(',')} WHERE id=?`).run(...pickFin(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: 'Título não encontrado.' });
  audit(req.user.id, 'editar', 'financeiro', id);
  res.json(listaFinanceiro());
});

app.patch('/api/financeiro/:id/baixar', auth, (req, res) => {
  const id = Number(req.params.id);
  const hoje = new Date().toISOString().slice(0, 10);
  db.prepare("UPDATE financeiro SET status='pago', pagamento_data=? WHERE id=?").run(hoje, id);
  audit(req.user.id, 'baixar_titulo', 'financeiro', id);
  res.json(listaFinanceiro());
});

app.delete('/api/financeiro/:id', auth, perfil('admin', 'gerente', 'financeiro'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM financeiro WHERE id=?').run(id);
  audit(req.user.id, 'excluir', 'financeiro', id);
  res.json(listaFinanceiro());
});

// ---------- Configurações, Usuários e Auditoria ----------
app.get('/api/config', auth, (req, res) => {
  const loja = db.prepare('SELECT * FROM config_loja WHERE id=1').get();
  const usuarios = db.prepare('SELECT id, nome, email, perfil FROM usuarios ORDER BY id').all();
  const auditoria = db.prepare(`
    SELECT a.*, u.nome AS usuario_nome
    FROM auditoria a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    ORDER BY a.id DESC LIMIT 60
  `).all();
  res.json({ loja, usuarios, auditoria });
});

app.put('/api/config/loja', auth, perfil('admin', 'gerente'), (req, res) => {
  const b = req.body || {};
  db.prepare(`
    UPDATE config_loja
    SET razao_social=?, nome_fantasia=?, cnpj=?, telefone=?, whatsapp=?, email=?, endereco=?, cidade=?, uf=?, cep=?, termos_garantia=?
    WHERE id=1
  `).run(b.razao_social, b.nome_fantasia, b.cnpj, b.telefone, b.whatsapp, b.email, b.endereco, b.cidade, b.uf, b.cep, b.termos_garantia);
  audit(req.user.id, 'editar', 'config_loja', 1);
  res.json(db.prepare('SELECT * FROM config_loja WHERE id=1').get());
});

app.post('/api/usuarios', auth, perfil('admin', 'gerente'), (req, res) => {
  const { nome, email, senha, perfil: p } = req.body || {};
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  try {
    const r = db.prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)')
      .run(nome, String(email).toLowerCase(), bcrypt.hashSync(String(senha), 10), p || 'vendedor');
    audit(req.user.id, 'criar', 'usuarios', Number(r.lastInsertRowid));
    res.status(201).json(db.prepare('SELECT id, nome, email, perfil FROM usuarios ORDER BY id').all());
  } catch {
    res.status(400).json({ erro: 'E-mail já cadastrado.' });
  }
});

app.delete('/api/usuarios/:id', auth, perfil('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ erro: 'Você não pode excluir seu próprio usuário.' });
  db.prepare('DELETE FROM usuarios WHERE id=?').run(id);
  audit(req.user.id, 'excluir', 'usuarios', id);
  res.json(db.prepare('SELECT id, nome, email, perfil FROM usuarios ORDER BY id').all());
});

export default app;
export { app };

if (process.env.STANDALONE_MOTRIZ === 'true') {
  app.listen(PORT, () => console.log(`Motriz API em http://localhost:${PORT}`));
}
