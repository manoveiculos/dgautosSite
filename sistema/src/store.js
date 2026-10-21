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

    if (!error && Array.isArray(data) && data.length > 0) {
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
  if (Array.isArray(emCache) && emCache.length > 0) return emCache;
  salvarCache('veiculos', VEICULOS_SHOWROOM_DEMO);
  return VEICULOS_SHOWROOM_DEMO;
}

export async function saveVeiculo(v) {
  const listaAtual = await getVeiculos();
  const id = v.id || Date.now();
  const novoVeiculo = {
    ...v,
    id,
    preco: Number(v.preco || 0),
    custo: Number(v.custo || 0),
    despesas_veiculo: Number(v.despesas_veiculo || 0),
    foto: v.foto || (Array.isArray(v.fotos) ? v.fotos[0] : ''),
    fotos: Array.isArray(v.fotos) ? v.fotos : (v.foto ? [v.foto] : []),
    publicar_site: v.publicar_site !== false,
  };

  // Salva no Supabase
  try {
    await supabase.from('veiculos_DGAUTOS').upsert({
      id: typeof id === 'number' && id < 1000000000 ? id : undefined,
      marca: novoVeiculo.marca,
      modelo: novoVeiculo.modelo,
      modelo_complemento: novoVeiculo.modelo_complemento || '',
      ano: novoVeiculo.ano || '2023/2024',
      km: Number(novoVeiculo.km) || 0,
      cor: novoVeiculo.cor || 'Branco',
      combustivel: novoVeiculo.combustivel || 'Flex',
      cambio: novoVeiculo.cambio || 'Automático',
      placa: (novoVeiculo.placa || '').toUpperCase(),
      chassi: (novoVeiculo.chassi || '').toUpperCase(),
      renavam: novoVeiculo.renavam || '',
      custo: novoVeiculo.custo,
      despesas_veiculo: novoVeiculo.despesas_veiculo,
      preco: novoVeiculo.preco,
      status: novoVeiculo.status || 'disponivel',
      publicar_site: novoVeiculo.publicar_site,
      destaque_site: !!novoVeiculo.destaque_site,
      foto_capa: novoVeiculo.foto,
      dados_altimus: novoVeiculo
    });
  } catch (err) {
    console.warn('Supabase saveVeiculo fallback:', err);
  }

  const idx = listaAtual.findIndex((x) => x.id === v.id);
  let atualizada = [];
  if (idx >= 0) {
    atualizada = [...listaAtual];
    atualizada[idx] = novoVeiculo;
  } else {
    atualizada = [novoVeiculo, ...listaAtual];
  }
  salvarCache('veiculos', atualizada);
  return atualizada;
}

export async function deleteVeiculo(id) {
  try {
    await supabase.from('veiculos_DGAUTOS').delete().eq('id', id);
  } catch {}
  const lista = (await getVeiculos()).filter((v) => v.id !== id);
  salvarCache('veiculos', lista);
  return lista;
}

// ==============================================================================
// 3. CLIENTES & FORNECEDORES
// ==============================================================================
const CLIENTES_PADRAO = [
  { id: 1, nome: 'Cliente Balcão / Não Identificado', tipo_pessoa: 'PF', papel: 'cliente', cidade: 'Balneário Camboriú', uf: 'SC' },
  { id: 2, nome: 'Douglas Silveira', tipo_pessoa: 'PF', papel: 'ambos', cpf_cnpj: '123.456.789-00', telefone: '(47) 99999-1111', cidade: 'Itajaí', uf: 'SC' },
  { id: 3, nome: 'Manoel Carros Ltda', tipo_pessoa: 'PJ', papel: 'fornecedor', cpf_cnpj: '98.765.432/0001-99', telefone: '(47) 3333-2222', cidade: 'Balneário Camboriú', uf: 'SC' }
];

export async function getClientes() {
  if (IS_LOCAL) {
    try {
      const cs = await api('/clientes');
      if (Array.isArray(cs)) return cs;
    } catch {}
  }

  try {
    const { data, error } = await supabase.from('clientes_DGAUTOS').select('*').order('nome');
    if (!error && Array.isArray(data) && data.length > 0) {
      salvarCache('clientes', data);
      return data;
    }
  } catch (err) {
    console.warn('Supabase getClientes:', err);
  }

  const emCache = lerCache('clientes', null);
  if (Array.isArray(emCache) && emCache.length > 0) return emCache;
  salvarCache('clientes', CLIENTES_PADRAO);
  return CLIENTES_PADRAO;
}

export async function saveCliente(c) {
  const lista = await getClientes();
  const id = c.id || Date.now();
  const novoCliente = { ...c, id };

  try {
    await supabase.from('clientes_DGAUTOS').upsert({
      id: typeof id === 'number' && id < 1000000000 ? id : undefined,
      nome: novoCliente.nome,
      tipo_pessoa: novoCliente.tipo_pessoa || 'PF',
      papel: novoCliente.papel || 'cliente',
      cpf_cnpj: novoCliente.cpf_cnpj || '',
      telefone: novoCliente.telefone || '',
      whatsapp: novoCliente.whatsapp || '',
      email: novoCliente.email || '',
      cidade: novoCliente.cidade || 'Balneário Camboriú',
      uf: novoCliente.uf || 'SC'
    });
  } catch {}

  const idx = lista.findIndex((x) => x.id === c.id);
  const atualizada = idx >= 0 ? lista.map((x) => (x.id === c.id ? novoCliente : x)) : [novoCliente, ...lista];
  salvarCache('clientes', atualizada);
  return atualizada;
}

export async function deleteCliente(id) {
  try {
    await supabase.from('clientes_DGAUTOS').delete().eq('id', id);
  } catch {}
  const lista = (await getClientes()).filter((c) => c.id !== id);
  salvarCache('clientes', lista);
  return lista;
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
    if (!error && Array.isArray(data) && data.length > 0) {
      salvarCache('crm', data);
      return data;
    }
  } catch {}

  const emCache = lerCache('crm', null);
  if (Array.isArray(emCache) && emCache.length > 0) return emCache;
  salvarCache('crm', CRM_PADRAO);
  return CRM_PADRAO;
}

export async function saveOportunidade(o) {
  const lista = await getOportunidades();
  const id = o.id || Date.now();
  const novaOp = { ...o, id };

  try {
    await supabase.from('oportunidades_crm_DGAUTOS').upsert({
      id: typeof id === 'number' && id < 1000000000 ? id : undefined,
      nome_lead: novaOp.nome_lead,
      telefone: novaOp.telefone,
      email: novaOp.email,
      origem: novaOp.origem || 'WHATSAPP',
      estagio: novaOp.estagio || 'pendente',
      veiculo_interesse: novaOp.veiculo_interesse,
      troca_veiculo: novaOp.troca_veiculo,
      valor_proposta: Number(novaOp.valor_proposta) || 0
    });
  } catch {}

  const idx = lista.findIndex((x) => x.id === o.id);
  const atualizada = idx >= 0 ? lista.map((x) => (x.id === o.id ? novaOp : x)) : [novaOp, ...lista];
  salvarCache('crm', atualizada);
  return atualizada;
}

export async function moveOportunidadeEstagio(id, estagio, motivo_conclusao) {
  const lista = await getOportunidades();
  const atualizada = lista.map((o) => (o.id === id ? { ...o, estagio, motivo_conclusao } : o));
  salvarCache('crm', atualizada);
  try {
    await supabase.from('oportunidades_crm_DGAUTOS').update({ estagio, motivo_conclusao }).eq('id', id);
  } catch {}
  return atualizada;
}

export async function deleteOportunidade(id) {
  try {
    await supabase.from('oportunidades_crm_DGAUTOS').delete().eq('id', id);
  } catch {}
  const lista = (await getOportunidades()).filter((o) => o.id !== id);
  salvarCache('crm', lista);
  return lista;
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
    if (!error && Array.isArray(data) && data.length > 0) {
      salvarCache('negociacoes', data);
      return data;
    }
  } catch {}

  const emCache = lerCache('negociacoes', null);
  if (Array.isArray(emCache)) return emCache;
  return [];
}

export async function saveNegociacao(n) {
  const lista = await getNegociacoes();
  const id = n.id || Date.now();
  const novaNeg = { ...n, id, valor_veiculo: Number(n.valor_veiculo || 0), desconto: Number(n.desconto || 0) };

  try {
    await supabase.from('negociacoes_DGAUTOS').upsert({
      id: typeof id === 'number' && id < 1000000000 ? id : undefined,
      tipo: novaNeg.tipo || 'venda',
      status: novaNeg.status || 'aberta',
      valor_veiculo: novaNeg.valor_veiculo,
      desconto: novaNeg.desconto,
      observacoes: novaNeg.observacoes || ''
    });
  } catch {}

  const idx = lista.findIndex((x) => x.id === n.id);
  const atualizada = idx >= 0 ? lista.map((x) => (x.id === n.id ? novaNeg : x)) : [novaNeg, ...lista];
  salvarCache('negociacoes', atualizada);
  return atualizada;
}

export async function concluirNegociacao(id) {
  const lista = await getNegociacoes();
  const atualizada = lista.map((n) => (n.id === id ? { ...n, status: 'concluida' } : n));
  salvarCache('negociacoes', atualizada);
  try {
    await supabase.from('negociacoes_DGAUTOS').update({ status: 'concluida' }).eq('id', id);
  } catch {}
  return atualizada;
}

export async function deleteNegociacao(id) {
  try {
    await supabase.from('negociacoes_DGAUTOS').delete().eq('id', id);
  } catch {}
  const lista = (await getNegociacoes()).filter((n) => n.id !== id);
  salvarCache('negociacoes', lista);
  return lista;
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
    if (!error && Array.isArray(data) && data.length > 0) {
      salvarCache('financeiro', data);
      return data;
    }
  } catch {}

  const emCache = lerCache('financeiro', null);
  if (Array.isArray(emCache)) return emCache;
  return [];
}

export async function saveFinanceiro(f) {
  const lista = await getFinanceiro();
  const id = f.id || Date.now();
  const novoFin = { ...f, id, valor: Number(f.valor || 0) };

  try {
    await supabase.from('financeiro_DGAUTOS').upsert({
      id: typeof id === 'number' && id < 1000000000 ? id : undefined,
      tipo: novoFin.tipo || 'despesa',
      categoria: novoFin.categoria || 'Outros',
      descricao: novoFin.descricao,
      valor: novoFin.valor,
      vencimento: novoFin.vencimento || new Date().toISOString().slice(0, 10),
      status: novoFin.status || 'pendente'
    });
  } catch {}

  const idx = lista.findIndex((x) => x.id === f.id);
  const atualizada = idx >= 0 ? lista.map((x) => (x.id === f.id ? novoFin : x)) : [novoFin, ...lista];
  salvarCache('financeiro', atualizada);
  return atualizada;
}

export async function baixarFinanceiro(id) {
  const lista = await getFinanceiro();
  const atualizada = lista.map((f) => (f.id === id ? { ...f, status: 'pago', pagamento_data: new Date().toISOString().slice(0, 10) } : f));
  salvarCache('financeiro', atualizada);
  try {
    await supabase.from('financeiro_DGAUTOS').update({ status: 'pago', pagamento_data: new Date().toISOString().slice(0, 10) }).eq('id', id);
  } catch {}
  return atualizada;
}

export async function deleteFinanceiro(id) {
  try {
    await supabase.from('financeiro_DGAUTOS').delete().eq('id', id);
  } catch {}
  const lista = (await getFinanceiro()).filter((f) => f.id !== id);
  salvarCache('financeiro', lista);
  return lista;
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
