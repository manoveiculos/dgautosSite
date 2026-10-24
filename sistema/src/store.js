import { supabase } from './supabase';
import { salvarDocumentosCliente, obterDocumentosCliente, excluirDocumentosCliente } from './utils/docStorage';

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
    const { data: usuario, error: errUser } = await supabase
      .from('usuarios_DGAUTOS')
      .select('*')
      .eq('email', emailLimpo)
      .maybeSingle();

    if (!errUser && usuario) {
      if (usuario.ativo === false) {
        throw new Error('Usuário inativo. Entre em contato com a administração.');
      }
      if (usuario.senha_hash && usuario.senha_hash !== senhaLimpa) {
        throw new Error('E-mail ou senha incorretos.');
      }
      const user = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil || 'admin' };
      localStorage.setItem(AUTH, JSON.stringify({ token: 'sb-' + usuario.id, user }));
      return user;
    }
  } catch (err) {
    if (err.message && (err.message.includes('incorretos') || err.message.includes('inativo'))) {
      throw err;
    }
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

// Upload de foto para o Supabase Storage (bucket público 'veiculos')
export async function uploadFotoVeiculo(fileOrBase64, veiculoId, index = 0) {
  if (!fileOrBase64) return null;
  if (typeof fileOrBase64 === 'string' && (fileOrBase64.startsWith('http://') || fileOrBase64.startsWith('https://'))) {
    return fileOrBase64;
  }

  try {
    let blob;
    let extension = 'jpg';

    if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:')) {
      const match = fileOrBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        extension = mime.split('/')[1] || 'jpg';
        if (extension === 'jpeg') extension = 'jpg';
        const bstr = atob(match[2]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        return fileOrBase64;
      }
    } else if (typeof Blob !== 'undefined' && (fileOrBase64 instanceof Blob || fileOrBase64 instanceof File)) {
      blob = fileOrBase64;
      extension = (fileOrBase64.name?.split('.').pop() || 'jpg').toLowerCase();
    } else {
      return null;
    }

    const uniqueName = `veiculo_${veiculoId || 'novo'}_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
    const filePath = `fotos/${uniqueName}`;

    const { error: uploadError } = await supabase.storage
      .from('veiculos')
      .upload(filePath, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.warn('Upload bucket veiculos aviso (usando fallback base64):', uploadError);
      if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:')) return fileOrBase64;
      return await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    }

    const { data: urlData } = supabase.storage
      .from('veiculos')
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.warn('Erro ao fazer upload da foto:', err);
    return typeof fileOrBase64 === 'string' ? fileOrBase64 : null;
  }
}

export async function getVeiculos() {
  if (IS_LOCAL) {
    try {
      const vs = await api('/veiculos');
      if (Array.isArray(vs)) return vs;
    } catch {}
  }

  try {
    const [resVeic, resFotos] = await Promise.all([
      supabase.from('veiculos_DGAUTOS').select('*').order('id', { ascending: false }),
      supabase.from('veiculos_fotos_DGAUTOS').select('*').order('ordem', { ascending: true })
    ]);

    const { data, error } = resVeic;
    const fotosData = Array.isArray(resFotos.data) ? resFotos.data : [];

    if (!error && Array.isArray(data)) {
      const formatados = data.map((v) => {
        // Carrega fotos oficiais persistidas na tabela veiculos_fotos_DGAUTOS
        const fotosCarro = fotosData
          .filter((f) => Number(f.veiculo_id) === Number(v.id))
          .map((f) => f.url_foto);

        const altimusFotos = Array.isArray(v.dados_altimus?.fotos) ? v.dados_altimus.fotos : [];

        const listaFotos = fotosCarro.length > 0
          ? fotosCarro
          : (altimusFotos.length > 0 ? altimusFotos : (v.foto_capa ? [v.foto_capa] : []));

        const capa = (fotosCarro.length > 0
          ? (fotosData.find((f) => Number(f.veiculo_id) === Number(v.id) && f.is_capa)?.url_foto || fotosCarro[0])
          : null) || v.foto_capa || listaFotos[0] || '';

        return {
          ...v,
          preco: Number(v.preco || 0),
          custo: Number(v.custo || 0),
          despesas_veiculo: Number(v.despesas_veiculo || 0),
          foto: capa,
          foto_capa: capa,
          fotos: listaFotos,
          itens_opcionais: Array.isArray(v.itens_opcionais) ? v.itens_opcionais : (v.dados_altimus?.itens_opcionais || []),
          itens_destaques: Array.isArray(v.itens_destaques) ? v.itens_destaques : (v.dados_altimus?.itens_destaques || []),
          pendencias: Array.isArray(v.pendencias) ? v.pendencias : (v.dados_altimus?.pendencias || []),
          reservas: Array.isArray(v.reservas) ? v.reservas : (v.dados_altimus?.reservas || []),
          documentos_anexos: Array.isArray(v.documentos_anexos) ? v.documentos_anexos : (v.dados_altimus?.documentos_anexos || [])
        };
      });
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
  
  // 1. Processa cada foto: envia para Supabase Storage se for arquivo/base64
  const fotosBrutas = Array.isArray(v.fotos) ? v.fotos : (v.foto ? [v.foto] : []);
  const fotosUrls = [];

  for (let i = 0; i < fotosBrutas.length; i++) {
    const item = fotosBrutas[i];
    if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
      fotosUrls.push(item);
    } else {
      const subida = await uploadFotoVeiculo(item, v.id, i);
      if (subida) {
        fotosUrls.push(subida);
      } else if (typeof item === 'string' && item.startsWith('data:')) {
        fotosUrls.push(item);
      }
    }
  }

  const fotoCapaUrl = fotosUrls[0] || (typeof v.foto === 'string' && v.foto.startsWith('http') ? v.foto : '');

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
    foto_capa: fotoCapaUrl,
    dados_altimus: {
      ...v,
      fotos: fotosUrls,
      foto: fotoCapaUrl
    }
  };

  let veiculoId = v.id;
  try {
    if (isUpdate) {
      await supabase.from('veiculos_DGAUTOS').update(payload).eq('id', Number(v.id));
    } else {
      const { data: inserted } = await supabase.from('veiculos_DGAUTOS').insert([payload]).select();
      if (inserted && inserted[0]) {
        veiculoId = inserted[0].id;
      }
    }
  } catch (err) {
    console.warn('Supabase saveVeiculo fallback:', err);
  }

  // 2. Grava as URLs em veiculos_fotos_DGAUTOS (ordem + is_capa) e apaga as removidas
  if (veiculoId) {
    try {
      await supabase.from('veiculos_fotos_DGAUTOS').delete().eq('veiculo_id', Number(veiculoId));

      if (fotosUrls.length > 0) {
        const registrosFotos = fotosUrls.map((url, idx) => ({
          veiculo_id: Number(veiculoId),
          url_foto: url,
          ordem: idx + 1,
          is_capa: idx === 0
        }));
        await supabase.from('veiculos_fotos_DGAUTOS').insert(registrosFotos);
      }
    } catch (errFotos) {
      console.warn('Erro ao sincronizar veiculos_fotos_DGAUTOS:', errFotos);
    }
  }

  return await getVeiculos();
}

export async function deleteVeiculo(id) {
  try {
    await supabase.from('veiculos_fotos_DGAUTOS').delete().eq('veiculo_id', Number(id));
    await supabase.from('veiculos_DGAUTOS').delete().eq('id', Number(id));
  } catch {}
  return await getVeiculos();
}

// Helper para limpar observações e nunca permitir tags de sistema ou Base64 dentro do texto visível
export function limparObservacoes(obs) {
  if (!obs || typeof obs !== 'string') return '';
  return obs
    .replace(/\[CONTATOS_EXTRAS:[\s\S]*?\]/g, '')
    .replace(/\[DOCS:[\s\S]*?\]/g, '')
    .replace(/\[DOCS_META:[\s\S]*?\]/g, '')
    // Remove qualquer bloco de base64 acidentalmente colado ou residual (>50 chars contínuos)
    .replace(/[A-Za-z0-9+/=]{50,}/g, '')
    .trim();
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
      const dataComContatos = await Promise.all(data.map(async (cli) => {
        let contatos_adicionais = [];
        if (cli.observacoes && cli.observacoes.includes('[CONTATOS_EXTRAS:')) {
          try {
            const m = cli.observacoes.match(/\[CONTATOS_EXTRAS:([\s\S]*?)\]/);
            if (m && m[1]) contatos_adicionais = JSON.parse(m[1]);
          } catch {}
        }

        let documentos = [];
        // Tentar obter documentos via IndexedDB
        try {
          if (cli.id) {
            const docsId = await obterDocumentosCliente(cli.id);
            if (Array.isArray(docsId) && docsId.length > 0) documentos = docsId;
          }
          if ((!documentos || documentos.length === 0) && cli.cpf_cnpj) {
            const docsCpf = await obterDocumentosCliente(cli.cpf_cnpj.replace(/\D/g, ''));
            if (Array.isArray(docsCpf) && docsCpf.length > 0) documentos = docsCpf;
          }
        } catch {}

        // Fallback legado se ainda estava serializado no texto
        if ((!documentos || documentos.length === 0) && cli.observacoes && cli.observacoes.includes('[DOCS:')) {
          try {
            const md = cli.observacoes.match(/\[DOCS:([\s\S]*?)\]/);
            if (md && md[1]) {
              documentos = JSON.parse(md[1]);
              // Migra para IndexedDB
              if (cli.id) salvarDocumentosCliente(cli.id, documentos);
            }
          } catch {}
        }

        // LIMPAR OBSERVAÇÕES PARA NUNCA MAIS EXIBIR CÓDIGO OU BASE64 NA TELA!
        const observacoesLimpas = limparObservacoes(cli.observacoes);

        return { ...cli, observacoes: observacoesLimpas, contatos_adicionais, documentos };
      }));
      salvarCache('clientes', dataComContatos);
      return dataComContatos;
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

  // Limpa as observações de qualquer tag ou base64 residual
  let obsFinal = limparObservacoes(c.observacoes || '');

  if (Array.isArray(c.contatos_adicionais) && c.contatos_adicionais.length > 0) {
    const jsonContatos = JSON.stringify(c.contatos_adicionais);
    obsFinal = `${obsFinal}\n[CONTATOS_EXTRAS:${jsonContatos}]`.trim();
  }

  // Persistência robusta de Documentos Pessoais no IndexedDB + LocalStorage (NUNCA BASE64 NA OBSERVAÇÃO!)
  if (Array.isArray(c.documentos)) {
    try {
      if (c.id) await salvarDocumentosCliente(c.id, c.documentos);
      if (c.cpf_cnpj) await salvarDocumentosCliente(String(c.cpf_cnpj).replace(/\D/g, ''), c.documentos);
    } catch {}

    // Apenas metadados leves (sem imagem base64) para auditoria se necessário
    const metaLeve = c.documentos.map(({ nome, tamanho, tipo, data }) => ({ nome, tamanho, tipo, data }));
    if (metaLeve.length > 0) {
      obsFinal = `${obsFinal}\n[DOCS_META:${JSON.stringify(metaLeve)}]`.trim();
    }
  }

  const payload = {
    nome: c.nome,
    tipo_pessoa: c.tipo_pessoa || 'PF',
    papel: c.papel || 'cliente',
    cpf_cnpj: c.cpf_cnpj || '',
    rg_ie: c.rg_ie || '',
    telefone: c.telefone || '',
    whatsapp: c.whatsapp || c.telefone || '',
    email: c.email || '',
    cep: c.cep || '',
    endereco: c.endereco || '',
    numero: c.numero || '',
    complemento: c.complemento || '',
    bairro: c.bairro || '',
    cidade: c.cidade || 'Rio do Sul',
    uf: c.uf || 'SC',
    origem: c.origem || 'LOJA',
    observacoes: obsFinal
  };

  let savedItem = null;
  try {
    if (isUpdate) {
      const { data } = await supabase.from('clientes_DGAUTOS').update(payload).eq('id', Number(c.id)).select();
      if (data && data[0]) savedItem = data[0];
    } else {
      const { data } = await supabase.from('clientes_DGAUTOS').insert([payload]).select();
      if (data && data[0]) savedItem = data[0];
    }
  } catch (err) {
    console.warn('Supabase saveCliente:', err);
  }

  // Garante que o novo ID salvo também recebe os documentos no IndexedDB
  if (savedItem && Array.isArray(c.documentos) && c.documentos.length > 0) {
    try {
      await salvarDocumentosCliente(savedItem.id, c.documentos);
    } catch {}
  }

  const lista = await getClientes();
  if (savedItem) {
    lista.savedItem = savedItem;
  }
  return lista;
}

export async function deleteCliente(id, motivo = '', user = null) {
  try {
    await supabase.from('clientes_DGAUTOS').delete().eq('id', Number(id));
  } catch (err) {
    console.warn('Supabase deleteCliente:', err);
  }

  // Registra na trilha de auditoria
  try {
    const aud = lerCache('auditoria', []);
    aud.unshift({
      id: 'aud_' + Date.now(),
      data: new Date().toLocaleString('pt-BR'),
      usuario_nome: user?.nome || 'ADMINISTRADOR',
      usuario_id: user?.id || 1,
      acao: `EXCLUSÃO DE CADASTRO #${id} — MOTIVO: ${motivo || 'Motivo informado pelo admin'}`,
      tabela: 'clientes_DGAUTOS',
      registro_id: id
    });
    salvarCache('auditoria', aud);
  } catch {}

  try {
    await excluirDocumentosCliente(id);
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
  let list = [];
  if (IS_LOCAL) {
    try {
      const ops = await api('/oportunidades');
      if (Array.isArray(ops)) list = ops;
    } catch {}
  }

  if (list.length === 0) {
    try {
      const { data, error } = await supabase.from('oportunidades_crm_DGAUTOS').select('*').order('id', { ascending: false });
      if (!error && Array.isArray(data)) {
        list = data;
        salvarCache('crm', data);
      }
    } catch {}
  }

  if (list.length === 0) {
    const emCache = lerCache('crm', null);
    if (Array.isArray(emCache)) list = emCache;
  }

  return (Array.isArray(list) ? list : []).map((item) => ({
    ...item,
    estagio: normalizarEstagio(item.estagio),
  }));
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
    estagio: normalizarEstagio(o.estagio || 'pendente'),
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
    const [resNegs, resPags, cRes, vRes] = await Promise.all([
      supabase.from('negociacoes_DGAUTOS').select('*').order('id', { ascending: false }),
      supabase.from('negociacoes_pagamentos_DGAUTOS').select('*'),
      supabase.from('clientes_DGAUTOS').select('id, nome, cpf_cnpj, telefone, email, cep, endereco, cidade, uf'),
      supabase.from('veiculos_DGAUTOS').select('id, marca, modelo, ano, placa, cor, chassi, renavam, km, preco, custo')
    ]);

    const { data, error } = resNegs;
    const pagamentosData = Array.isArray(resPags.data) ? resPags.data : [];
    let clientesMap = {};
    let veiculosMap = {};
    if (Array.isArray(cRes.data)) cRes.data.forEach((c) => { clientesMap[c.id] = c; });
    if (Array.isArray(vRes.data)) vRes.data.forEach((v) => { veiculosMap[v.id] = v; });

    if (!error && Array.isArray(data)) {
      const formatados = data.map((n) => {
        const cli = clientesMap[n.cliente_id] || {};
        const veic = veiculosMap[n.veiculo_id] || {};
        const pags = pagamentosData.filter((p) => Number(p.negociacao_id) === Number(n.id));

        return {
          ...n,
          cliente_nome: n.cliente_nome || cli.nome || '',
          cliente_cpf_cnpj: n.cliente_cpf_cnpj || cli.cpf_cnpj || '',
          cliente_telefone: n.cliente_telefone || cli.telefone || '',
          cliente_email: n.cliente_email || cli.email || '',
          cliente_cep: n.cliente_cep || cli.cep || '',
          cliente_endereco: n.cliente_endereco || cli.endereco || '',
          cliente_cidade: n.cliente_cidade || cli.cidade || '',
          cliente_uf: n.cliente_uf || cli.uf || '',
          veic_marca: n.veic_marca || veic.marca || (n.tipo === 'compra' ? n.troca_marca : ''),
          veic_modelo: n.veic_modelo || veic.modelo || (n.tipo === 'compra' ? n.troca_modelo : ''),
          veic_ano: n.veic_ano || veic.ano || (n.tipo === 'compra' ? n.troca_ano : ''),
          veic_placa: n.veic_placa || veic.placa || (n.tipo === 'compra' ? n.troca_placa : ''),
          veic_cor: n.veic_cor || veic.cor || (n.tipo === 'compra' ? n.troca_cor : ''),
          veic_chassi: n.veic_chassi || veic.chassi || '',
          veic_renavam: n.veic_renavam || veic.renavam || '',
          veic_km: n.veic_km || veic.km || (n.tipo === 'compra' ? n.troca_km : 0),
          pagamentos: pags.length > 0 ? pags : (Array.isArray(n.pagamentos) ? n.pagamentos : [])
        };
      });

      salvarCache('negociacoes', formatados);
      return formatados;
    }
  } catch (err) {
    console.warn('Supabase getNegociacoes erro:', err);
  }

  const emCache = lerCache('negociacoes', null);
  if (Array.isArray(emCache)) return emCache;
  return [];
}

export async function saveNegociacao(n) {
  const isUpdate = Boolean(n.id && Number(n.id) > 0 && Number(n.id) < 1000000000);

  // 1. COMPRA PARA ESTOQUE: Criar ou atualizar veículo automaticamente no estoque (veiculos_DGAUTOS)
  let veiculoId = n.veiculo_id ? Number(n.veiculo_id) : null;
  const modeloAdquirido = n.troca_modelo || n.veic_modelo;
  const marcaAdquirida = n.troca_marca || n.veic_marca || 'Diversos';
  const placaAdquirida = (n.troca_placa || n.veic_placa || '').toUpperCase();
  const valorAdquirido = Number(n.valor_veiculo || n.troca_valor || 0);

  if (n.tipo === 'compra' && modeloAdquirido) {
    try {
      const veiculoPayload = {
        marca: marcaAdquirida,
        modelo: modeloAdquirido,
        ano: n.troca_ano || n.veic_ano || '2023/2024',
        placa: placaAdquirida,
        km: Number(n.troca_km || n.veic_km || 0),
        cor: n.troca_cor || n.veic_cor || 'Branco',
        chassi: n.troca_chassi || n.veic_chassi || null,
        renavam: n.troca_renavam || n.veic_renavam || null,
        cidade_emplacamento: n.troca_cidade || n.veic_cidade || null,
        fipe: Number(n.fipe || 0),
        valor_fipe_anterior: Number(n.valor_fipe_anterior || 0),
        codigo_fipe: n.codigo_fipe || null,
        custo: valorAdquirido,
        preco: valorAdquirido,
        status: 'disponivel',
        propriedade: 'PROPRIO',
        cliente_origem_id: n.cliente_id ? Number(n.cliente_id) : null,
        publicar_site: true,
        observacao_interna: `Veículo adquirido via Contrato de Compra #${n.id || 'Novo'} em ${new Date().toLocaleDateString('pt-BR')}`
      };

      if (veiculoId) {
        await supabase.from('veiculos_DGAUTOS').update(veiculoPayload).eq('id', veiculoId);
      } else {
        if (placaAdquirida) {
          const { data: existente } = await supabase.from('veiculos_DGAUTOS').select('id').eq('placa', placaAdquirida).limit(1);
          if (existente && existente[0]) {
            veiculoId = existente[0].id;
            await supabase.from('veiculos_DGAUTOS').update(veiculoPayload).eq('id', veiculoId);
          }
        }
        if (!veiculoId) {
          const { data: vInserido } = await supabase.from('veiculos_DGAUTOS').insert([veiculoPayload]).select();
          if (vInserido && vInserido[0]) {
            veiculoId = vInserido[0].id;
          }
        }
      }
    } catch (errVeic) {
      console.warn('Erro ao auto-cadastrar veículo da compra no estoque:', errVeic);
    }
  }

  const payload = {
    tipo: n.tipo || 'venda',
    status: n.status || 'aberta',
    cliente_id: n.cliente_id ? Number(n.cliente_id) : null,
    veiculo_id: veiculoId,
    valor_veiculo: Number(n.valor_veiculo) || 0,
    desconto: Number(n.desconto) || 0,
    canal_venda: n.canal_venda || 'LOJA',
    troca_marca: n.troca_marca || '',
    troca_modelo: n.troca_modelo || '',
    troca_ano: n.troca_ano || '',
    troca_placa: (n.troca_placa || '').toUpperCase(),
    troca_km: Number(n.troca_km) || 0,
    troca_cor: n.troca_cor || '',
    troca_valor: Number(n.troca_valor) || 0,
    comissao_vendedor: Number(n.comissao_vendedor) || 0,
    observacoes: n.observacoes || '',
    data_negociacao: n.data_negociacao || new Date().toISOString().slice(0, 10)
  };

  let savedNegId = n.id;
  try {
    if (isUpdate) {
      await supabase.from('negociacoes_DGAUTOS').update(payload).eq('id', Number(n.id));
    } else {
      const { data: ins } = await supabase.from('negociacoes_DGAUTOS').insert([payload]).select();
      if (ins && ins[0]) savedNegId = ins[0].id;
    }
  } catch (err) {
    console.warn('Supabase saveNegociacao error:', err);
  }

  // 2. Persistir pagamentos na tabela negociacoes_pagamentos_DGAUTOS
  if (savedNegId && Array.isArray(n.pagamentos) && n.pagamentos.length > 0) {
    try {
      await supabase.from('negociacoes_pagamentos_DGAUTOS').delete().eq('negociacao_id', Number(savedNegId));
      const pagsPayload = n.pagamentos.map((p) => ({
        negociacao_id: Number(savedNegId),
        forma: p.forma || 'Pix / TED',
        financeira: p.financeira || '',
        valor: Number(p.valor) || 0,
        status: p.status || 'pago'
      }));
      await supabase.from('negociacoes_pagamentos_DGAUTOS').insert(pagsPayload);
    } catch (errPags) {
      console.warn('Aviso ao sincronizar negociacoes_pagamentos_DGAUTOS:', errPags);
    }
  }

  return await getNegociacoes();
}

export async function concluirNegociacao(id) {
  try {
    const { data: negs } = await supabase.from('negociacoes_DGAUTOS').select('*').eq('id', Number(id));
    const neg = negs && negs[0] ? negs[0] : null;

    if (neg) {
      // 1. Se venda ou troca: baixa o veículo vendido no estoque
      if (['venda', 'troca'].includes(neg.tipo) && neg.veiculo_id) {
        await supabase.from('veiculos_DGAUTOS').update({
          status: 'vendido',
          cliente_comprador_id: neg.cliente_id,
          data_venda: new Date().toISOString().slice(0, 10)
        }).eq('id', Number(neg.veiculo_id));
      }

      // 2. Se troca: auto-insere o veículo de troca no estoque como disponível
      if (neg.tipo === 'troca' && neg.troca_modelo) {
        const placaTroca = (neg.troca_placa || '').toUpperCase();
        let existe = false;
        if (placaTroca) {
          const { data: achado } = await supabase.from('veiculos_DGAUTOS').select('id').eq('placa', placaTroca).limit(1);
          if (achado && achado.length) existe = true;
        }
        if (!existe) {
          await supabase.from('veiculos_DGAUTOS').insert([{
            marca: neg.troca_marca || 'Diversos',
            modelo: neg.troca_modelo,
            ano: neg.troca_ano || '2023/2024',
            placa: placaTroca,
            km: Number(neg.troca_km) || 0,
            cor: neg.troca_cor || 'Branco',
            custo: Number(neg.troca_valor) || 0,
            preco: Number(neg.troca_valor) || 0,
            status: 'disponivel',
            propriedade: 'PROPRIO',
            cliente_origem_id: neg.cliente_id,
            publicar_site: true,
            observacao_interna: `Entrada recebida na Troca da Negociação #${neg.id} em ${new Date().toLocaleDateString('pt-BR')}`
          }]);
        }
      }

      // 3. Se compra: garante que o veículo esteja no estoque disponível
      if (neg.tipo === 'compra') {
        const modeloComp = neg.troca_modelo || neg.veic_modelo;
        const placaComp = (neg.troca_placa || neg.veic_placa || '').toUpperCase();
        const valorComp = Number(neg.valor_veiculo || neg.troca_valor || 0);

        if (neg.veiculo_id) {
          await supabase.from('veiculos_DGAUTOS').update({
            status: 'disponivel',
            propriedade: 'PROPRIO',
            cliente_origem_id: neg.cliente_id
          }).eq('id', Number(neg.veiculo_id));
        } else if (modeloComp) {
          const { data: vCriado } = await supabase.from('veiculos_DGAUTOS').insert([{
            marca: neg.troca_marca || 'Diversos',
            modelo: modeloComp,
            ano: neg.troca_ano || '2023/2024',
            placa: placaComp,
            km: Number(neg.troca_km) || 0,
            cor: neg.troca_cor || 'Branco',
            custo: valorComp,
            preco: valorComp,
            status: 'disponivel',
            propriedade: 'PROPRIO',
            cliente_origem_id: neg.cliente_id,
            publicar_site: true,
            observacao_interna: `Veículo adquirido via Compra #${neg.id} em ${new Date().toLocaleDateString('pt-BR')}`
          }]).select();

          if (vCriado && vCriado[0]) {
            await supabase.from('negociacoes_DGAUTOS').update({ veiculo_id: vCriado[0].id }).eq('id', Number(id));
          }
        }
      }

      // 4. Se consignação: garante status disponível como terceiro consignado
      if (neg.tipo === 'consignacao' && neg.veiculo_id) {
        await supabase.from('veiculos_DGAUTOS').update({
          status: 'disponivel',
          propriedade: 'TERCEIRO_CONSIGNADO',
          cliente_origem_id: neg.cliente_id
        }).eq('id', Number(neg.veiculo_id));
      }

      // 5. Gera lançamento no Financeiro se houver valor
      const valorLiquido = Number(neg.valor_veiculo || 0) - Number(neg.desconto || 0);
      if (valorLiquido > 0) {
        try {
          const isVenda = ['venda', 'troca'].includes(neg.tipo);
          await supabase.from('financeiro_DGAUTOS').insert([{
            tipo: isVenda ? 'receita' : 'despesa',
            categoria: isVenda ? 'Venda de Veículo' : 'Compra de Estoque',
            descricao: `${isVenda ? 'Recebimento Venda' : 'Pagamento Compra'} Contrato #${neg.id} — ${neg.troca_modelo || ''}`,
            valor: valorLiquido,
            vencimento: new Date().toISOString().slice(0, 10),
            pagamento_data: new Date().toISOString().slice(0, 10),
            status: 'pago',
            forma_pagamento: 'Pix / TED',
            conta_bancaria: 'Conta Principal',
            veiculo_id: neg.veiculo_id || null,
            cliente_id: neg.cliente_id || null
          }]);
        } catch {}
      }
    }

    await supabase.from('negociacoes_DGAUTOS').update({
      status: 'concluida',
      data_fechamento: new Date().toISOString()
    }).eq('id', Number(id));
  } catch (err) {
    console.warn('Erro em concluirNegociacao:', err);
  }
  return await getNegociacoes();
}

export async function deleteNegociacao(id) {
  try {
    await supabase.from('negociacoes_DGAUTOS').delete().eq('id', Number(id));
  } catch {}
  return await getNegociacoes();
}

export async function saveContratoGerado(c) {
  try {
    const payload = {
      negociacao_id: c.negociacao_id ? Number(c.negociacao_id) : null,
      veiculo_id: c.veiculo_id ? Number(c.veiculo_id) : null,
      cliente_id: c.cliente_id ? Number(c.cliente_id) : null,
      modelo_codigo: c.modelo_codigo || 'venda_padrao',
      texto_integral: c.texto_integral || '',
      autorizacao_lgpd_imagem: c.autorizacao_lgpd_imagem !== false,
      hodometro_comprado: Number(c.hodometro_comprado) || 0,
      hodometro_troca: Number(c.hodometro_troca) || 0,
      status: c.status || 'emitido',
      data_emissao: new Date().toISOString()
    };
    const { data, error } = await supabase.from('contratos_gerados_DGAUTOS').insert([payload]).select();
    if (error) {
      console.warn('Erro ao salvar em contratos_gerados_DGAUTOS:', error);
      throw error;
    }
    return data?.[0] || null;
  } catch (err) {
    console.error('saveContratoGerado falhou:', err);
    throw err;
  }
}

export async function getContratosGerados(negociacaoId) {
  try {
    let q = supabase.from('contratos_gerados_DGAUTOS').select('*').order('id', { ascending: false });
    if (negociacaoId) q = q.eq('negociacao_id', Number(negociacaoId));
    const { data, error } = await q;
    if (!error && Array.isArray(data)) return data;
  } catch {}
  return [];
}

// ==============================================================================
// 6. FINANCEIRO & DRE & COMISSÕES
// ==============================================================================
export async function getFinanceiro() {
  let list = [];
  if (IS_LOCAL) {
    try {
      const f = await api('/financeiro');
      if (Array.isArray(f)) list = f;
    } catch {}
  }

  if (list.length === 0) {
    try {
      const [resFin, resVeic, resCli] = await Promise.all([
        supabase.from('financeiro_DGAUTOS').select('*').order('vencimento', { ascending: true }),
        supabase.from('veiculos_DGAUTOS').select('id, marca, modelo, ano, placa'),
        supabase.from('clientes_DGAUTOS').select('id, nome, telefone')
      ]);

      if (!resFin.error && Array.isArray(resFin.data)) {
        const vMap = {};
        const cMap = {};
        (resVeic.data || []).forEach((v) => { vMap[v.id] = v; });
        (resCli.data || []).forEach((c) => { cMap[c.id] = c; });

        list = resFin.data.map((item) => {
          const v = vMap[item.veiculo_id] || {};
          const c = cMap[item.cliente_id] || {};
          return {
            ...item,
            veic_marca: item.veic_marca || v.marca || '',
            veic_modelo: item.veic_modelo || v.modelo || '',
            veic_placa: item.veic_placa || v.placa || '',
            cliente_nome: item.cliente_nome || c.nome || ''
          };
        });
        salvarCache('financeiro', list);
      }
    } catch {}
  }

  if (list.length === 0) {
    const emCache = lerCache('financeiro', null);
    if (Array.isArray(emCache)) list = emCache;
  }

  return list;
}

export async function saveFinanceiro(f) {
  const isUpdate = Boolean(f.id && Number(f.id) > 0 && Number(f.id) < 1000000000);
  const payload = {
    tipo: f.tipo || 'despesa',
    categoria: f.categoria || 'Outros',
    descricao: f.descricao,
    valor: Number(f.valor) || 0,
    vencimento: f.vencimento || new Date().toISOString().slice(0, 10),
    pagamento_data: f.pagamento_data || (f.status === 'pago' ? new Date().toISOString().slice(0, 10) : null),
    status: f.status || 'pendente',
    forma_pagamento: f.forma_pagamento || 'Pix / TED',
    conta_bancaria: f.conta || f.conta_bancaria || 'ITAÚ EMPRESAS',
    veiculo_id: f.veiculo_id ? Number(f.veiculo_id) : null,
    cliente_id: f.cliente_id ? Number(f.cliente_id) : null,
    negociacao_id: f.negociacao_id ? Number(f.negociacao_id) : null
  };

  try {
    if (isUpdate) {
      await supabase.from('financeiro_DGAUTOS').update(payload).eq('id', Number(f.id));
    } else {
      await supabase.from('financeiro_DGAUTOS').insert([payload]);
    }
  } catch (err) {
    console.warn('Supabase saveFinanceiro error:', err);
  }

  return await getFinanceiro();
}

export async function pagarComissao({ negociacao_id, valor, vendedor_nome, veiculo_desc, conta_bancaria }) {
  const payload = {
    tipo: 'despesa',
    categoria: 'Comissão',
    descricao: `Comissão Venda #${negociacao_id} — ${vendedor_nome} (${veiculo_desc || 'Veículo'})`,
    valor: Number(valor) || 0,
    vencimento: new Date().toISOString().slice(0, 10),
    pagamento_data: new Date().toISOString().slice(0, 10),
    status: 'pago',
    forma_pagamento: 'Pix / TED',
    conta_bancaria: conta_bancaria || 'ITAÚ EMPRESAS',
    negociacao_id: negociacao_id ? Number(negociacao_id) : null
  };

  try {
    await supabase.from('financeiro_DGAUTOS').insert([payload]);
  } catch (err) {
    console.warn('Supabase pagarComissao error:', err);
  }

  return await getFinanceiro();
}

// ==============================================================================
// 7. CONTAS BANCÁRIAS E CAIXAS FÍSICOS (GESTÃO DE MÚLTIPLAS CONTAS)
// ==============================================================================
export function getContasBancarias() {
  const padrao = [
    { id: '1', nome: 'ITAÚ EMPRESAS', tipo: 'banco', banco: '341 - Itaú', agencia: '0123', conta: '45678-9', titular: 'DG AUTOMÓVEIS', saldo_inicial: 0 },
    { id: '2', nome: 'SICOOB', tipo: 'banco', banco: '756 - Sicoob', agencia: '3001', conta: '12345-6', titular: 'DG AUTOMÓVEIS', saldo_inicial: 0 },
    { id: '3', nome: 'BRADESCO', tipo: 'banco', banco: '237 - Bradesco', agencia: '0456', conta: '98765-4', titular: 'DG AUTOMÓVEIS', saldo_inicial: 0 },
    { id: '4', nome: 'CAIXA FÍSICO / GAVETA LOJA', tipo: 'caixa', banco: 'Caixa Interno', agencia: '—', conta: '—', titular: 'DG AUTOMÓVEIS', saldo_inicial: 0 },
    { id: '5', nome: 'COFRE LOJA', tipo: 'caixa', banco: 'Caixa Interno', agencia: '—', conta: '—', titular: 'DG AUTOMÓVEIS', saldo_inicial: 0 }
  ];
  const salvo = lerCache('contas_bancarias', null);
  if (Array.isArray(salvo) && salvo.length > 0) return salvo;
  salvarCache('contas_bancarias', padrao);
  return padrao;
}

export function saveContaBancaria(conta) {
  const lista = getContasBancarias();
  const nomeUpper = String(typeof conta === 'string' ? conta : conta.nome || '').trim().toUpperCase();
  if (!nomeUpper) return lista;

  let atualizada;
  const idConta = typeof conta === 'object' && conta.id ? conta.id : null;
  if (idConta) {
    atualizada = lista.map((c) => (c.id === idConta ? { ...c, ...conta, nome: nomeUpper } : c));
  } else {
    const existe = lista.find((c) => c.nome.toUpperCase() === nomeUpper);
    if (existe) return lista;
    const tipo = typeof conta === 'object' && conta.tipo ? conta.tipo : (nomeUpper.includes('CAIXA') || nomeUpper.includes('COFRE') ? 'caixa' : 'banco');
    atualizada = [...lista, {
      id: 'conta_' + Date.now(),
      nome: nomeUpper,
      tipo,
      banco: conta.banco || (tipo === 'caixa' ? 'Caixa Interno' : 'Banco'),
      agencia: conta.agencia || '',
      conta: conta.conta || '',
      titular: conta.titular || 'DG AUTOMÓVEIS',
      saldo_inicial: Number(conta.saldo_inicial) || 0
    }];
  }
  salvarCache('contas_bancarias', atualizada);
  return atualizada;
}

export function deleteContaBancaria(id) {
  const lista = getContasBancarias();
  const atualizada = lista.filter((c) => c.id !== id);
  salvarCache('contas_bancarias', atualizada);
  return atualizada;
}

// ==============================================================================
// 8. FINANCEIRAS E BANCOS DE FINANCIAMENTO
// ==============================================================================
export function getFinanceiras() {
  const padrao = [
    { id: '1', nome: 'SANTANDER FINANCIAMENTOS', operador: 'ROBERTO OPERADOR', telefone: '(47) 99123-4567', email: 'financiamento@santander.com.br', retorno_padrao: '2.0%', ativo: true },
    { id: '2', nome: 'BV FINANCEIRA', operador: 'CARLOS BV', telefone: '(47) 99234-5678', email: 'veiculos@bv.com.br', retorno_padrao: '2.5%', ativo: true },
    { id: '3', nome: 'BANCO PAN', operador: 'MARIA PAN', telefone: '(47) 99345-6789', email: 'auto@bancopan.com.br', retorno_padrao: '2.0%', ativo: true },
    { id: '4', nome: 'BRADESCO FINANCIAMENTOS', operador: 'FERNANDO BRADESCO', telefone: '(47) 99456-7890', email: 'financiamento@bradesco.com.br', retorno_padrao: '2.0%', ativo: true },
    { id: '5', nome: 'C6 BANK AUTO', operador: 'JULIANA C6', telefone: '(47) 99567-8901', email: 'auto@c6bank.com.br', retorno_padrao: '2.5%', ativo: true },
    { id: '6', nome: 'ITAÚ FINANCIAMENTOS', operador: 'LUCAS ITAU', telefone: '(47) 99678-9012', email: 'veiculos@itau.com.br', retorno_padrao: '2.0%', ativo: true },
    { id: '7', nome: 'SAFRA FINANCEIRA', operador: 'MARCELO SAFRA', telefone: '(47) 99789-0123', email: 'safrauto@safra.com.br', retorno_padrao: '2.5%', ativo: true }
  ];
  const salvo = lerCache('financeiras_financiamento', null);
  if (Array.isArray(salvo) && salvo.length > 0) return salvo;
  salvarCache('financeiras_financiamento', padrao);
  return padrao;
}

export function saveFinanceira(fin) {
  const lista = getFinanceiras();
  const nomeUpper = String(fin.nome || '').trim().toUpperCase();
  if (!nomeUpper) return lista;

  let atualizada;
  if (fin.id) {
    atualizada = lista.map((f) => (f.id === fin.id ? { ...f, ...fin, nome: nomeUpper } : f));
  } else {
    atualizada = [...lista, {
      ...fin,
      id: 'fin_' + Date.now(),
      nome: nomeUpper,
      ativo: fin.ativo !== false
    }];
  }
  salvarCache('financeiras_financiamento', atualizada);
  return atualizada;
}

export function deleteFinanceira(id) {
  const lista = getFinanceiras();
  const atualizada = lista.filter((f) => f.id !== id);
  salvarCache('financeiras_financiamento', atualizada);
  return atualizada;
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
  cnpj: '35.236.994/0001-24',
  telefone: '(47) 98916-9598',
  whatsapp: '(47) 98916-9598',
  email: 'contato@dgautomoveis.com.br',
  site_url: 'https://dgautos-site.vercel.app',
  endereco: 'Rua Dom Pedro II, 461 - Canoas',
  cidade: 'Rio do Sul',
  uf: 'SC',
  cep: '89164-138',
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

  let usuarios = [];
  try {
    const { data: us, error } = await supabase
      .from('usuarios_DGAUTOS')
      .select('id, nome, email, perfil, ativo')
      .order('id', { ascending: true });
    if (!error && Array.isArray(us) && us.length > 0) {
      usuarios = us;
    }
  } catch {}

  if (usuarios.length === 0) {
    usuarios = [
      { id: 6, nome: 'Administrador DG', email: 'admin@dgautos.com.br', perfil: 'admin', ativo: true }
    ];
  }

  return { loja, usuarios, auditoria: [] };
}

export async function getUsuarios() {
  const cfg = await getConfig();
  return cfg.usuarios || [];
}

export async function saveConfigLoja(loja) {
  salvarCache('config_loja', loja);
  try {
    const { error } = await supabase.from('config_loja_DGAUTOS').upsert({ id: 1, ...loja });
    if (error) throw error;
  } catch (e) {
    console.warn('Supabase saveConfigLoja:', e);
    throw new Error('Falha ao salvar dados da loja: ' + (e.message || 'Erro desconhecido'));
  }
  return loja;
}

export async function createUsuario(u) {
  try {
    const { data, error } = await supabase.from('usuarios_DGAUTOS').insert([{
      nome: u.nome,
      email: String(u.email || '').trim().toLowerCase(),
      senha_hash: u.senha || 'admin123',
      perfil: u.perfil || 'vendedor',
      ativo: true
    }]).select();
    if (error) throw error;
  } catch (err) {
    console.error('Supabase createUsuario error:', err);
    throw new Error(err.message || 'Falha ao cadastrar usuário no banco de dados');
  }
  const { usuarios } = await getConfig();
  return usuarios;
}

export async function updateUsuario(id, dados) {
  try {
    const { error } = await supabase.from('usuarios_DGAUTOS').update(dados).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Supabase updateUsuario error:', err);
    throw new Error(err.message || 'Falha ao atualizar usuário no banco de dados');
  }
  const { usuarios } = await getConfig();
  return usuarios;
}

export async function deleteUsuario(id) {
  try {
    const { error } = await supabase.from('usuarios_DGAUTOS').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Supabase deleteUsuario error:', err);
    throw new Error(err.message || 'Falha ao excluir usuário no banco de dados');
  }
  const { usuarios } = await getConfig();
  return usuarios.filter((u) => u.id !== id);
}

export async function alterarSenhaUsuario(idOuEmail, novaSenha) {
  const senhaLimpa = String(novaSenha || '').trim();
  if (!senhaLimpa || senhaLimpa.length < 4) {
    throw new Error('A nova senha deve ter no mínimo 4 caracteres.');
  }

  let query = supabase.from('usuarios_DGAUTOS').update({
    senha_hash: senhaLimpa,
    atualizado_em: new Date().toISOString()
  });

  const numId = Number(idOuEmail);
  if (!isNaN(numId) && numId > 0) {
    query = query.eq('id', numId);
  } else {
    query = query.eq('email', String(idOuEmail).trim().toLowerCase());
  }

  const { error } = await query;
  if (error) {
    console.error('Supabase alterarSenhaUsuario error:', error);
    throw new Error(error.message || 'Falha ao atualizar senha no banco de dados');
  }

  return true;
}

export async function recuperarSenhaAuto(email, dadoValidacao, novaSenha) {
  const emailLimpo = String(email || '').trim().toLowerCase();
  const senhaLimpa = String(novaSenha || '').trim();
  if (!emailLimpo) throw new Error('Informe o e-mail cadastrado.');
  if (!senhaLimpa || senhaLimpa.length < 4) throw new Error('A nova senha deve ter no mínimo 4 caracteres.');

  const { data: usuario, error: errUser } = await supabase
    .from('usuarios_DGAUTOS')
    .select('id, nome, email, perfil, ativo')
    .eq('email', emailLimpo)
    .maybeSingle();

  if (errUser || !usuario) {
    throw new Error('Nenhum usuário encontrado com este e-mail no banco de dados.');
  }

  const valLimpo = String(dadoValidacao || '').replace(/\D/g, '');
  const ehCnpj = valLimpo === '35236994000124';
  const ehTel = valLimpo.includes('989169598') || valLimpo.includes('47989169598');
  const ehChaveMestra = String(dadoValidacao || '').trim().toLowerCase() === 'dg2026';

  if (!ehCnpj && !ehTel && !ehChaveMestra) {
    throw new Error('Dado de segurança incorreto. Informe o CNPJ da loja (35.236.994/0001-24) ou WhatsApp oficial para confirmar.');
  }

  await alterarSenhaUsuario(usuario.id, senhaLimpa);
  return usuario;
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

export const normalizarEstagio = (estagio) => {
  if (!estagio) return 'pendente';
  const mapa = {
    em_atendimento: 'primeiro_contato',
    visita: 'aguardando_visita',
    negociacao: 'em_negociacao',
    concluido: 'venda_realizada',
    perdido: 'venda_perdida',
  };
  return mapa[estagio] || estagio;
};

export const ESTAGIOS_CRM = [
  { id: 'pendente', label: 'Pendente', cor: '#f59e0b', grupo: 'entrada' },
  { id: 'primeiro_contato', label: 'Primeiro contato feito', cor: '#3b82f6', grupo: 'atendimento' },
  { id: 'segundo_contato', label: 'Segundo contato', cor: '#6366f1', grupo: 'atendimento' },
  { id: 'aguardando_resposta', label: 'Aguardando resposta', cor: '#eab308', grupo: 'atendimento' },
  { id: 'prioridade', label: 'Prioridade no atendimento', cor: '#ef4444', grupo: 'atendimento' },
  { id: 'aguardando_visita', label: 'Aguardando visita', cor: '#8b5cf6', grupo: 'visita' },
  { id: 'whatsapp', label: 'WhatsApp', cor: '#22c55e', grupo: 'atendimento' },
  { id: 'em_negociacao', label: 'Em negociação', cor: '#06b6d4', grupo: 'negociacao' },
  { id: 'venda_realizada', label: 'Venda realizada', cor: '#10b981', grupo: 'ganho' },
  { id: 'venda_perdida', label: 'Venda perdida', cor: '#64748b', grupo: 'perdido' },
  { id: 'sem_contato', label: 'Sem contato', cor: '#94a3b8', grupo: 'atendimento' },
  { id: 'contato_futuro', label: 'Contato futuro', cor: '#a855f7', grupo: 'atendimento' },
  { id: 'sem_interesse', label: 'Cliente sem interesse', cor: '#71717a', grupo: 'perdido' },
  { id: 'transferencia', label: 'Transferência de setor', cor: '#f97316', grupo: 'atendimento' },
  { id: 'score_baixo', label: 'SCORE BAIXO', cor: '#dc2626', grupo: 'perdido' },
];

export const ORIGENS_LEAD = {
  PORTAL_MERCADOLIVRE: 'Portal Mercado Livre',
  PORTAL_WEBMOTORS: 'Portal Webmotors',
  PORTAL_OLX: 'Portal OLX',
  SITE_AUTOS_360: 'Site DG Autos / Autos 360',
  INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp',
  LOJA_FISICA: 'Loja Física',
  PORTAL_ICARROS: 'Portal iCarros',
  PORTAL_CHAVES_NA_MAO: 'Chaves na Mão',
  PORTAL_MOBIAUTO: 'Mobiauto',
  PORTAL_SO_CARRAO: 'Só Carrão',
  FACEBOOK: 'Facebook',
  TRAFEGO_PAGO: 'Tráfego Pago',
  INDICACAO: 'Indicação',
  OUTROS: 'Outros',
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

// ==============================================================================
// 8. FORMATAÇÃO E VALIDAÇÃO OFICIAL DE CPF E CNPJ (RECEITA FEDERAL)
// ==============================================================================
export function formatarCpfCnpj(valor) {
  if (!valor) return '';
  const digits = String(valor).replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function validarCPF(cpf) {
  if (!cpf) return false;
  const c = String(cpf).replace(/\D/g, '');
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(c.charAt(i), 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(c.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(c.charAt(i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(c.charAt(10), 10)) return false;

  return true;
}

export function validarCNPJ(cnpj) {
  if (!cnpj) return false;
  const c = String(cnpj).replace(/\D/g, '');
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;

  let tamanho = c.length - 2;
  let numeros = c.substring(0, tamanho);
  const digitos = c.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  tamanho = tamanho + 1;
  numeros = c.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

  return true;
}

export function validarCpfCnpj(valor) {
  if (!valor || !String(valor).trim()) return { valido: true, mensagem: '' };
  const digits = String(valor).replace(/\D/g, '');
  if (digits.length === 11) {
    const ok = validarCPF(digits);
    return { valido: ok, tipo: 'CPF', mensagem: ok ? '' : 'CPF inválido: dígito verificador incorreto.' };
  }
  if (digits.length === 14) {
    const ok = validarCNPJ(digits);
    return { valido: ok, tipo: 'CNPJ', mensagem: ok ? '' : 'CNPJ inválido: dígito verificador incorreto.' };
  }
  return { valido: false, tipo: 'INCOMPLETO', mensagem: 'Documento incompleto (CPF deve ter 11 números e CNPJ 14 números).' };
}
