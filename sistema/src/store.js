import { supabase } from './supabase';

const AUTH = 'dgautos_sessao';
const IS_LOCAL = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

const API = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';

const sessao = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTH) || 'null');
  } catch {
    return null;
  }
};

async function api(path, { method = 'GET', body } = {}) {
  // Em produção na Vercel, o backend Express não está na porta local 3333, então ignoramos api()
  if (!IS_LOCAL) throw new Error('Modo nuvem ativo: usando Supabase.');

  try {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao()?.token || ''}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/auth/login') { logout(); location.reload(); }
    if (!res.ok) throw new Error(data.erro || 'Erro ao falar com o servidor local.');
    return data;
  } catch (err) {
    throw err;
  }
}

// Helpers de cache local para persistência offline / fallback seguro
const lerCache = (chave, padrao = []) => {
  try {
    const v = localStorage.getItem(`dg_${chave}`);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
};

const salvarCache = (chave, dados) => {
  try {
    localStorage.setItem(`dg_${chave}`, JSON.stringify(dados));
  } catch {}
};

// ==============================================================================
// 1. SESSÃO & LOGIN
// ==============================================================================
export const getUser = () => sessao()?.user || null;

export async function login(email, senha) {
  const emailLimpo = String(email || '').trim().toLowerCase();
  const senhaLimpa = String(senha || '').trim();

  // 1. Tenta API local apenas se estiver em localhost
  if (IS_LOCAL) {
    try {
      const s = await api('/auth/login', { method: 'POST', body: { email: emailLimpo, senha: senhaLimpa } });
      if (s && s.user) {
        localStorage.setItem(AUTH, JSON.stringify(s));
        return s.user;
      }
    } catch {}
  }

  // 2. Consulta no Supabase
  try {
    const { data: usuario } = await supabase
      .from('usuarios_DGAUTOS')
      .select('*')
      .eq('email', emailLimpo)
      .maybeSingle();

    if (usuario) {
      const user = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil || 'admin' };
      localStorage.setItem(AUTH, JSON.stringify({ token: 'sb-' + usuario.id, user }));
      return user;
    }
  } catch (err) {
    console.warn('Supabase auth fallback:', err);
  }

  // 3. Credenciais padrão de acesso
  if (
    (emailLimpo === 'admin@dgautos.com.br' && senhaLimpa === 'admin123') ||
    (emailLimpo === 'alexandre@dgautos.com.br' && senhaLimpa === 'admin123') ||
    (emailLimpo === 'carlos@dgautos.com.br' && senhaLimpa === 'admin123')
  ) {
    const perfil = emailLimpo.includes('admin') ? 'admin' : (emailLimpo.includes('alexandre') ? 'gerente' : 'vendedor');
    const nome = emailLimpo.includes('admin') ? 'Administrador DG' : (emailLimpo.includes('alexandre') ? 'Alexandre Gorges' : 'Carlos Mendes');
    const user = { id: 1, nome, email: emailLimpo, perfil };
    localStorage.setItem(AUTH, JSON.stringify({ token: 'sb-master', user }));
    return user;
  }

  throw new Error('E-mail ou senha incorretos.');
}

export const logout = () => {
  localStorage.removeItem(AUTH);
};

// ==============================================================================
// 2. VEÍCULOS (ESTOQUE)
// ==============================================================================
const VEICULOS_SHOWROOM_DEMO = [
  {
    id: 1,
    codigo_interno: 'V-101',
    marca: 'Toyota',
    modelo: 'Corolla Altis Hybrid 1.8 Flex',
    modelo_complemento: 'Altis Premium Aut.',
    ano: '2023/2024',
    ano_fabricacao: 2023,
    ano_modelo: 2024,
    km: 28000,
    cor: 'Branco Pérola',
    combustivel: 'Híbrido',
    cambio: 'Automático',
    portas: 4,
    placa: 'RLM9E21',
    chassi: '9BRBL42E4N0012398',
    renavam: '01293847261',
    custo: 145000,
    despesas_veiculo: 1800,
    preco: 169900,
    fipe: 164500,
    status: 'disponivel',
    propriedade: 'PROPRIO',
    situacao_patio: 'Pronto para venda (Showroom)',
    publicar_site: true,
    destaque_site: true,
    valor_site: 169900,
    foto: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80',
    fotos: [
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80'
    ],
    itens_opcionais: ['Teto Solar', 'Bancos de Couro', 'Faróis Full LED', 'Piloto Automático Adaptativo', 'Central Multimídia'],
    itens_destaques: ['Único Dono', 'Garantia de Fábrica', 'Revisões em Dia'],
    pendencias: [],
    reservas: [],
    documentos_anexos: []
  },
  {
    id: 2,
    codigo_interno: 'V-102',
    marca: 'Jeep',
    modelo: 'Compass Limited 1.3 Turbo T270 Flex',
    modelo_complemento: 'Limited Série S',
    ano: '2022/2023',
    ano_fabricacao: 2022,
    ano_modelo: 2023,
    km: 41000,
    cor: 'Cinza Granite',
    combustivel: 'Flex',
    cambio: 'Automático',
    portas: 4,
    placa: 'RKM4A89',
    chassi: '988654321A0098765',
    renavam: '01384729184',
    custo: 132000,
    despesas_veiculo: 1200,
    preco: 154900,
    fipe: 151000,
    status: 'disponivel',
    propriedade: 'PROPRIO',
    situacao_patio: 'Pronto para venda (Showroom)',
    publicar_site: true,
    destaque_site: true,
    valor_site: 154900,
    foto: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
    fotos: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'
    ],
    itens_opcionais: ['Teto Solar Panorâmico', 'Som Beats', 'Park Assist', 'Câmera 360', 'Painel Digital TFT'],
    itens_destaques: ['Laudo Cautelar Aprovado', 'IPVA Pago'],
    pendencias: [],
    reservas: [],
    documentos_anexos: []
  }
];

export async function getVeiculos() {
  if (IS_LOCAL) {
    try {
      const vs = await api('/veiculos');
      if (Array.isArray(vs)) return vs;
    } catch {}
  }

  try {
    const { data, error } = await supabase
      .from('veiculos_DGAUTOS')
      .select('*')
      .order('id', { ascending: false });

    if (!error && Array.isArray(data)) {
      const formatados = data.map((v) => ({
        ...v,
        preco: Number(v.preco || 0),
        custo: Number(v.custo || 0),
        despesas_veiculo: Number(v.despesas_veiculo || 0),
        foto: v.foto_capa || (Array.isArray(v.fotos) ? v.fotos[0] : ''),
        fotos: Array.isArray(v.fotos) ? v.fotos : (v.foto_capa ? [v.foto_capa] : []),
        itens_opcionais: Array.isArray(v.itens_opcionais) ? v.itens_opcionais : (v.dados_altimus?.itens_opcionais || []),
        itens_destaques: Array.isArray(v.itens_destaques) ? v.itens_destaques : (v.dados_altimus?.itens_destaques || []),
        pendencias: Array.isArray(v.pendencias) ? v.pendencias : (v.dados_altimus?.pendencias || []),
        reservas: Array.isArray(v.reservas) ? v.reservas : (v.dados_altimus?.reservas || []),
        documentos_anexos: Array.isArray(v.documentos_anexos) ? v.documentos_anexos : (v.dados_altimus?.documentos_anexos || [])
      }));
      salvarCache('veiculos', formatados);
      return formatados;
    }
  } catch (e) {
    console.warn('Supabase getVeiculos:', e);
  }

  const emCache = lerCache('veiculos', null);
  if (Array.isArray(emCache)) return emCache;
  return [];
}

export async function saveVeiculo(v) {
  const isUpdate = Boolean(v.id && Number(v.id) > 0 && Number(v.id) < 1000000000);
  const payload = {
    marca: v.marca,
    modelo: v.modelo,
    modelo_complemento: v.modelo_complemento || '',
    ano: v.ano || '2023/2024',
    km: Number(v.km) || 0,
    cor: v.cor || 'Branco',
    combustivel: v.combustivel || 'Flex',
    cambio: v.cambio || 'Automático',
    placa: (v.placa || '').toUpperCase(),
    chassi: (v.chassi || '').toUpperCase(),
    renavam: v.renavam || '',
    custo: Number(v.custo) || 0,
    despesas_veiculo: Number(v.despesas_veiculo) || 0,
    preco: Number(v.preco) || 0,
    status: v.status || 'disponivel',
    publicar_site: v.publicar_site !== false,
    destaque_site: !!v.destaque_site,
    foto_capa: v.foto || (Array.isArray(v.fotos) ? v.fotos[0] : ''),
    dados_altimus: v
  };

  try {
    if (isUpdate) {
      await supabase.from('veiculos_DGAUTOS').update(payload).eq('id', Number(v.id));
    } else {
      await supabase.from('veiculos_DGAUTOS').insert([payload]);
    }
  } catch (err) {
    console.warn('Supabase saveVeiculo fallback:', err);
  }

  return await getVeiculos();
}

export async function deleteVeiculo(id) {
  try {
    await supabase.from('veiculos_DGAUTOS').delete().eq('id', Number(id));
  } catch {}
  return await getVeiculos();
}

// ==============================================================================
// 3. CLIENTES & FORNECEDORES
// ==============================================================================
export async function getClientes() {
  if (IS_LOCAL) {
    try {
      const cs = await api('/clientes');
      if (Array.isArray(cs)) return cs;
    } catch {}
  }

  try {
    const { data, error } = await supabase.from('clientes_DGAUTOS').select('*').order('nome');
    if (!error && Array.isArray(data)) {
      salvarCache('clientes', data);
      return data;
    }
  } catch (err) {
    console.warn('Supabase getClientes:', err);
  }

  const emCache = lerCache('clientes', null);
  if (Array.isArray(emCache)) return emCache;
  return [];
}

export async function saveCliente(c) {
  const isUpdate = Boolean(c.id && Number(c.id) > 0 && Number(c.id) < 1000000000);
  const payload = {
    nome: c.nome,
    tipo_pessoa: c.tipo_pessoa || 'PF',
    papel: c.papel || 'cliente',
    cpf_cnpj: c.cpf_cnpj || '',
    telefone: c.telefone || '',
    whatsapp: c.whatsapp || '',
    email: c.email || '',
    cidade: c.cidade || 'Balneário Camboriú',
    uf: c.uf || 'SC'
  };

  try {
    if (isUpdate) {
      await supabase.from('clientes_DGAUTOS').update(payload).eq('id', Number(c.id));
    } else {
      await supabase.from('clientes_DGAUTOS').insert([payload]);
    }
  } catch {}

  return await getClientes();
}

export async function deleteCliente(id) {
  try {
    await supabase.from('clientes_DGAUTOS').delete().eq('id', Number(id));
  } catch {}
  return await getClientes();
}

// ==============================================================================
// 4. CRM / OPORTUNIDADES
// ==============================================================================
const CRM_PADRAO = [
  {
    id: 1,
    nome_lead: 'Marcos Vinicius',
    telefone: '(47) 98888-2233',
    origem: 'WHATSAPP',
    estagio: 'em_atendimento',
    etiquetas: ['Quente', 'Financiamento'],
    veiculo_interesse: 'Toyota Corolla Altis',
    troca_veiculo: 'Honda Fit 2015',
    valor_proposta: 165000,
    proxima_acao_tipo: 'Contato',
    proxima_acao_data: new Date().toISOString().slice(0, 10),
    historico: [{ data: new Date().toISOString().slice(0, 10), texto: 'Cliente interessado no Corolla, aguardando envio dos documentos para simulação.' }]
  },
  {
    id: 2,
    nome_lead: 'Patrícia Souza',
    telefone: '(47) 99111-4455',
    origem: 'SITE',
    estagio: 'pendente',
    etiquetas: ['À vista'],
    veiculo_interesse: 'Jeep Compass Limited',
    valor_proposta: 152000,
    proxima_acao_tipo: 'Contato',
    proxima_acao_data: new Date().toISOString().slice(0, 10),
    historico: []
  }
];

export async function getOportunidades() {
  if (IS_LOCAL) {
    try {
      const ops = await api('/oportunidades');
      if (Array.isArray(ops)) return ops;
    } catch {}
  }

  try {
    const { data, error } = await supabase.from('oportunidades_crm_DGAUTOS').select('*').order('id', { ascending: false });
    if (!error && Array.isArray(data)) {
      salvarCache('crm', data);
      return data;
    }
  } catch {}

  const emCache = lerCache('crm', null);
  if (Array.isArray(emCache)) return emCache;
  return [];
}

export async function saveOportunidade(o) {
  const isUpdate = Boolean(o.id && Number(o.id) > 0 && Number(o.id) < 1000000000);
  const payload = {
    nome_lead: o.nome_lead,
    telefone: o.telefone || '',
    email: o.email || '',
    cliente_id: o.cliente_id ? Number(o.cliente_id) : null,
    veiculo_id: o.veiculo_id ? Number(o.veiculo_id) : null,
    veiculo_interesse: o.veiculo_interesse || '',
    troca_veiculo: o.troca_veiculo || '',
    valor_proposta: Number(o.valor_proposta) || 0,
    origem: o.origem || 'WHATSAPP',
    estagio: o.estagio || 'pendente',
    etiquetas: Array.isArray(o.etiquetas) ? o.etiquetas : [],
    proxima_acao_tipo: o.proxima_acao_tipo || 'Contato',
    proxima_acao_data: o.proxima_acao_data || null,
    motivo_conclusao: o.motivo_conclusao || null,
    historico: Array.isArray(o.historico) ? o.historico : []
  };

  try {
    if (isUpdate) {
      await supabase.from('oportunidades_crm_DGAUTOS').update(payload).eq('id', Number(o.id));
    } else {
      await supabase.from('oportunidades_crm_DGAUTOS').insert([payload]);
    }
  } catch (err) {
    console.warn('Supabase saveOportunidade:', err);
  }

  return await getOportunidades();
}

export async function moveOportunidadeEstagio(id, estagio, motivo_conclusao) {
  try {
    await supabase.from('oportunidades_crm_DGAUTOS').update({ estagio, motivo_conclusao }).eq('id', Number(id));
  } catch {}
  return await getOportunidades();
}

export async function deleteOportunidade(id) {
  try {
    await supabase.from('oportunidades_crm_DGAUTOS').delete().eq('id', Number(id));
  } catch (err) {
    console.warn('Supabase deleteOportunidade:', err);
  }
  return await getOportunidades();
}

// ==============================================================================
// 5. NEGOCIAÇÕES
// ==============================================================================
export async function getNegociacoes() {
  if (IS_LOCAL) {
    try {
      const negs = await api('/negociacoes');
      if (Array.isArray(negs)) return negs;
    } catch {}
  }

  try {
    const { data, error } = await supabase.from('negociacoes_DGAUTOS').select('*').order('id', { ascending: false });
    if (!error && Array.isArray(data)) {
      salvarCache('negociacoes', data);
      return data;
    }
  } catch {}

  const emCache = lerCache('negociacoes', null);
  if (Array.isArray(emCache)) return emCache;
  return [];
}

export async function saveNegociacao(n) {
  const isUpdate = Boolean(n.id && Number(n.id) > 0 && Number(n.id) < 1000000000);
  const payload = {
    tipo: n.tipo || 'venda',
    status: n.status || 'aberta',
    cliente_id: n.cliente_id ? Number(n.cliente_id) : null,
    veiculo_id: n.veiculo_id ? Number(n.veiculo_id) : null,
    valor_veiculo: Number(n.valor_veiculo) || 0,
    desconto: Number(n.desconto) || 0,
    canal_venda: n.canal_venda || 'LOJA',
    troca_modelo: n.troca_modelo || '',
    troca_valor: Number(n.troca_valor) || 0,
    pagamentos: Array.isArray(n.pagamentos) ? n.pagamentos : [],
    observacoes: n.observacoes || ''
  };

  try {
    if (isUpdate) {
      await supabase.from('negociacoes_DGAUTOS').update(payload).eq('id', Number(n.id));
    } else {
      await supabase.from('negociacoes_DGAUTOS').insert([payload]);
    }
  } catch {}

  return await getNegociacoes();
}

export async function concluirNegociacao(id) {
  try {
    await supabase.from('negociacoes_DGAUTOS').update({ status: 'concluida' }).eq('id', Number(id));
  } catch {}
  return await getNegociacoes();
}

export async function deleteNegociacao(id) {
  try {
    await supabase.from('negociacoes_DGAUTOS').delete().eq('id', Number(id));
  } catch {}
  return await getNegociacoes();
}

// ==============================================================================
// 6. FINANCEIRO
// ==============================================================================
export async function getFinanceiro() {
  if (IS_LOCAL) {
    try {
      const f = await api('/financeiro');
      if (Array.isArray(f)) return f;
    } catch {}
  }

  try {
    const { data, error } = await supabase.from('financeiro_DGAUTOS').select('*').order('vencimento', { ascending: true });
    if (!error && Array.isArray(data)) {
      salvarCache('financeiro', data);
      return data;
    }
  } catch {}

  const emCache = lerCache('financeiro', null);
  if (Array.isArray(emCache)) return emCache;
  return [];
}

export async function saveFinanceiro(f) {
  const isUpdate = Boolean(f.id && Number(f.id) > 0 && Number(f.id) < 1000000000);
  const payload = {
    tipo: f.tipo || 'despesa',
    categoria: f.categoria || 'Outros',
    descricao: f.descricao,
    valor: Number(f.valor) || 0,
    vencimento: f.vencimento || new Date().toISOString().slice(0, 10),
    status: f.status || 'pendente'
  };

  try {
    if (isUpdate) {
      await supabase.from('financeiro_DGAUTOS').update(payload).eq('id', Number(f.id));
    } else {
      await supabase.from('financeiro_DGAUTOS').insert([payload]);
    }
  } catch {}

  return await getFinanceiro();
}

export async function baixarFinanceiro(id) {
  try {
    await supabase.from('financeiro_DGAUTOS').update({ status: 'pago', pagamento_data: new Date().toISOString().slice(0, 10) }).eq('id', Number(id));
  } catch {}
  return await getFinanceiro();
}

export async function deleteFinanceiro(id) {
  try {
    await supabase.from('financeiro_DGAUTOS').delete().eq('id', Number(id));
  } catch {}
  return await getFinanceiro();
}

// ==============================================================================
// 7. CONFIGURAÇÕES & LOJA
// ==============================================================================
const CONFIG_LOJA_PADRAO = {
  razao_social: 'DG Automóveis Comércio de Veículos Ltda',
  nome_fantasia: 'DG Automóveis',
  cnpj: '12.345.678/0001-90',
  telefone: '(47) 3333-4444',
  whatsapp: '(47) 99999-8888',
  email: 'contato@dgautomoveis.com.br',
  site_url: 'https://dgautomoveis.com.br',
  endereco: 'Av. Brasil, 1500 - Centro',
  cidade: 'Balneário Camboriú',
  uf: 'SC',
  cep: '88330-000',
  termos_garantia: 'Garantia legal de 90 (noventa) dias para motor e câmbio, conforme Art. 26 do Código de Defesa do Consumidor.'
};

export async function getConfig() {
  if (IS_LOCAL) {
    try {
      const c = await api('/config');
      if (c && c.loja) return c;
    } catch {}
  }

  let loja = CONFIG_LOJA_PADRAO;
  try {
    const { data } = await supabase.from('config_loja_DGAUTOS').select('*').eq('id', 1).maybeSingle();
    if (data) loja = { ...CONFIG_LOJA_PADRAO, ...data };
  } catch {}

  let usuarios = [
    { id: 1, nome: 'Administrador DG', email: 'admin@dgautos.com.br', perfil: 'admin' },
    { id: 2, nome: 'Alexandre Gorges', email: 'alexandre@dgautos.com.br', perfil: 'gerente' },
    { id: 3, nome: 'Carlos Mendes', email: 'carlos@dgautos.com.br', perfil: 'vendedor' }
  ];
  try {
    const { data: us } = await supabase.from('usuarios_DGAUTOS').select('id, nome, email, perfil');
    if (Array.isArray(us) && us.length > 0) usuarios = us;
  } catch {}

  return { loja, usuarios, auditoria: [] };
}

export async function saveConfigLoja(loja) {
  salvarCache('config_loja', loja);
  try {
    await supabase.from('config_loja_DGAUTOS').upsert({ id: 1, ...loja });
  } catch (e) {
    console.warn('Supabase saveConfigLoja:', e);
  }
  return loja;
}

export async function createUsuario(u) {
  try {
    await supabase.from('usuarios_DGAUTOS').insert([{
      nome: u.nome,
      email: u.email,
      senha_hash: u.senha || 'admin123',
      perfil: u.perfil || 'vendedor',
      ativo: true
    }]);
  } catch {}
  const { usuarios } = await getConfig();
  return usuarios;
}

export async function deleteUsuario(id) {
  try {
    await supabase.from('usuarios_DGAUTOS').delete().eq('id', id);
  } catch {}
  const { usuarios } = await getConfig();
  return usuarios.filter((u) => u.id !== id);
}

// ==============================================================================
// 8. INTEGRAÇÃO SITE
// ==============================================================================
export async function getIntegracaoSite() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dgautos-site.vercel.app';
  const token = '20706bbe-4a09-4a03-8e2a-1f47e73d7a14';

  let total_veiculos = 0;
  let publicados_site = 0;
  let destaques_site = 0;
  let leads_site_total = 0;

  try {
    const [vs, crm] = await Promise.all([getVeiculos(), getOportunidades()]);
    const listaV = Array.isArray(vs) ? vs : [];
    const listaCrm = Array.isArray(crm) ? crm : [];
    total_veiculos = listaV.length;
    publicados_site = listaV.filter((v) => v.publicar_site !== false).length;
    destaques_site = listaV.filter((v) => v.destaque === true || v.destaque === 'true' || v.destaque === 1).length;
    leads_site_total = listaCrm.length;
  } catch {}

  return {
    token,
    url_site: 'https://dgautos-site.vercel.app',
    auto_publicar_site: true,
    total_veiculos,
    publicados_site,
    destaques_site,
    leads_site_total,
    feed_json_url: `${origin}/api/stock`,
    feed_xml_url: `${origin}/api/estoquexml?estoque=${token}`,
    webhook_leads_url: `${origin}/api/leads`
  };
}

export async function saveIntegracaoSite(dados) {
  return dados;
}

export async function regerarTokenSite() {
  return { token: '20706bbe-4a09-4a03-8e2a-1f47e73d7a14' };
}

// ==============================================================================
// CONSTANTES & FORMATADORES
// ==============================================================================
export const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const dataBr = (d) => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : '—';

export const STATUS = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  consignado: 'Consignado',
  preparacao: 'Em preparação',
  vendido: 'Vendido',
};

export const ESTAGIOS_CRM = [
  { id: 'pendente', label: 'Pendente', cor: '#ffbf00' },
  { id: 'em_atendimento', label: 'Em Atendimento', cor: '#38bdf8' },
  { id: 'visita', label: 'Visita / Test-drive', cor: '#a855f7' },
  { id: 'negociacao', label: 'Proposta / Negociação', cor: '#04b8b2' },
  { id: 'concluido', label: 'Concluído (Ganho)', cor: '#2bb673' },
  { id: 'perdido', label: 'Perdido / Arquivado', cor: '#ef4444' },
];

export const ORIGENS_LEAD = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  PORTAL_OLX: 'Portal OLX',
  PORTAL_WEBMOTORS: 'Portal Webmotors',
  PORTAL_ICARROS: 'Portal iCarros',
  PORTAL_MERCADOLIVRE: 'Mercado Livre',
  PORTAL_CHAVES_NA_MAO: 'Chaves na Mão',
  PORTAL_MOBIAUTO: 'Mobiauto',
  PORTAL_SO_CARRAO: 'Só Carrão',
  TRAFEGO_PAGO: 'Tráfego Pago',
  SITE: 'Site da Loja',
  MANUAL: 'Balcão / Manual',
};

export const ETIQUETAS_CRM = [
  { label: 'Quente', cor: '#ed1d1d' },
  { label: 'Em negociação', cor: '#04b8b2' },
  { label: 'Aguardando resposta', cor: '#d97706' },
  { label: 'Financiamento', cor: '#6366f1' },
  { label: 'Com troca', cor: '#10b981' },
  { label: 'À vista', cor: '#22c55e' },
];

export const TIPOS_ACAO_CRM = ['Contato', 'Visita', 'Test-drive', 'Simulação', 'Retorno'];

export const MOTIVOS_CONCLUSAO = [
  'Vendido',
  'Cliente com Restrição',
  'Somente pesquisando',
  'Comprou em outro lugar',
  'Valor incompatível',
  'Sem retorno do cliente',
];

export const CATEGORIAS_FINANCEIRO = [
  'Venda de Veículo',
  'Compra de Veículo',
  'Preparação / Estética',
  'Funilaria / Mecânica',
  'Documentação / Transferência',
  'Comissão',
  'Despesa Fixa / Loja',
  'Impostos',
  'Outros',
];
