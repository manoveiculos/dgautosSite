// Camada de dados com suporte Híbrido: API REST local e Conexão Direta ao Supabase (Produção Vercel)
import { supabase } from './supabase';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const AUTH = 'dgautos_sessao';

const sessao = () => JSON.parse(localStorage.getItem(AUTH) || 'null');

async function api(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao()?.token || ''}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/auth/login') { logout(); location.reload(); }
    if (!res.ok) throw new Error(data.erro || 'Erro ao falar com o servidor.');
    return data;
  } catch (err) {
    // Se falhar a conexão com a API local (ex: rodando na Vercel estática), o fallback entra em ação
    throw err;
  }
}

// ==============================================================================
// 1. SESSÃO & LOGIN (SUPABASE DIRETO + API REST)
// ==============================================================================
export const getUser = () => sessao()?.user || null;

export async function login(email, senha) {
  const emailLimpo = String(email || '').trim().toLowerCase();
  const senhaLimpa = String(senha || '').trim();

  // 1. Tenta API REST local
  try {
    const s = await api('/auth/login', { method: 'POST', body: { email: emailLimpo, senha: senhaLimpa } });
    if (s && s.user) {
      localStorage.setItem(AUTH, JSON.stringify(s));
      return s.user;
    }
  } catch {
    // Continua para o Supabase em nuvem
  }

  // 2. Conexão Direta com Supabase (Produção na Vercel)
  try {
    // Busca na tabela de usuários
    const { data: usuario, error } = await supabase
      .from('usuarios_DGAUTOS')
      .select('*')
      .eq('email', emailLimpo)
      .maybeSingle();

    if (usuario) {
      const user = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil || 'admin' };
      const s = { token: 'sb-token-' + usuario.id, user };
      localStorage.setItem(AUTH, JSON.stringify(s));
      return user;
    }

    // Se a tabela estiver vazia ou for o primeiro acesso com as credenciais padrão
    if (
      (emailLimpo === 'admin@dgautos.com.br' && senhaLimpa === 'admin123') ||
      (emailLimpo === 'alexandre@dgautos.com.br' && senhaLimpa === 'admin123') ||
      (emailLimpo === 'carlos@dgautos.com.br' && senhaLimpa === 'admin123')
    ) {
      const perfil = emailLimpo.includes('admin') ? 'admin' : (emailLimpo.includes('alexandre') ? 'gerente' : 'vendedor');
      const nome = emailLimpo.includes('admin') ? 'Administrador DG' : (emailLimpo.includes('alexandre') ? 'Alexandre Gorges' : 'Carlos Mendes');
      
      // Tenta registrar na tabela para persistir
      try {
        await supabase.from('usuarios_DGAUTOS').insert([{
          nome,
          email: emailLimpo,
          senha_hash: 'admin123',
          perfil,
          ativo: true
        }]);
      } catch {}

      const user = { id: 1, nome, email: emailLimpo, perfil };
      localStorage.setItem(AUTH, JSON.stringify({ token: 'sb-token-1', user }));
      return user;
    }

    throw new Error('E-mail ou senha incorretos.');
  } catch (err) {
    // Fallback de emergência para credenciais padrão
    if (emailLimpo === 'admin@dgautos.com.br' && senhaLimpa === 'admin123') {
      const user = { id: 1, nome: 'Administrador DG', email: emailLimpo, perfil: 'admin' };
      localStorage.setItem(AUTH, JSON.stringify({ token: 'sb-token-1', user }));
      return user;
    }
    throw new Error(err.message || 'Falha ao autenticar.');
  }
}

export const logout = () => localStorage.removeItem(AUTH);

// ==============================================================================
// 2. VEÍCULOS (SUPABASE veiculos_DGAUTOS)
// ==============================================================================
export async function getVeiculos() {
  try {
    return await api('/veiculos');
  } catch {
    // Conexão Supabase
    try {
      const { data, error } = await supabase
        .from('veiculos_DGAUTOS')
        .select('*')
        .order('id', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((v) => ({
          ...v,
          preco: Number(v.preco || 0),
          custo: Number(v.custo || 0),
          despesas_veiculo: Number(v.despesas_veiculo || 0),
          foto: v.foto_capa || (Array.isArray(v.fotos) ? v.fotos[0] : ''),
          fotos: Array.isArray(v.fotos) ? v.fotos : (v.foto_capa ? [v.foto_capa] : []),
          itens_opcionais: Array.isArray(v.itens_opcionais) ? v.itens_opcionais : [],
          itens_destaques: Array.isArray(v.itens_destaques) ? v.itens_destaques : [],
          pendencias: Array.isArray(v.pendencias) ? v.pendencias : [],
          reservas: Array.isArray(v.reservas) ? v.reservas : [],
          documentos_anexos: Array.isArray(v.documentos_anexos) ? v.documentos_anexos : []
        }));
      }
    } catch (e) {
      console.warn('Erro ao ler veiculos do Supabase:', e);
    }
    const salvoLocal = JSON.parse(localStorage.getItem('dg_veiculos_cache') || 'null');
    if (Array.isArray(salvoLocal) && salvoLocal.length > 0) return salvoLocal;

    // Retorna veículos de demonstração inicial do showroom DG
    return [
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
  }
}

export async function saveVeiculo(v) {
  try {
    return await (v.id ? api(`/veiculos/${v.id}`, { method: 'PUT', body: v }) : api('/veiculos', { method: 'POST', body: v }));
  } catch {
    // Salva direto no Supabase
    try {
      const dados = {
        marca: v.marca,
        modelo: v.modelo,
        modelo_complemento: v.modelo_complemento || '',
        ano: v.ano || '2023/2024',
        ano_fabricacao: Number(v.ano_fabricacao) || 2023,
        ano_modelo: Number(v.ano_modelo) || 2024,
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
        valor_minimo: Number(v.valor_minimo) || 0,
        valor_troca: Number(v.valor_troca) || 0,
        fipe: Number(v.fipe) || 0,
        status: v.status || 'disponivel',
        propriedade: v.propriedade || 'PROPRIO',
        situacao_patio: v.situacao_patio || 'Pronto para venda (Showroom)',
        publicar_site: v.publicar_site !== false,
        destaque_site: !!v.destaque_site,
        valor_site: Number(v.valor_site) || Number(v.preco) || 0,
        foto_capa: v.foto || (Array.isArray(v.fotos) ? v.fotos[0] : ''),
        observacao_site: v.observacao_site || '',
        observacao_anuncio: v.observacao_anuncio || '',
        observacao_internet: v.observacao_internet || '',
        observacao_interna: v.observacao_interna || '',
        dados_altimus: {
          fotos: v.fotos || [],
          itens_opcionais: v.itens_opcionais || [],
          itens_destaques: v.itens_destaques || [],
          pendencias: v.pendencias || [],
          reservas: v.reservas || [],
          documentos_anexos: v.documentos_anexos || []
        }
      };

      if (v.id && typeof v.id === 'number') {
        await supabase.from('veiculos_DGAUTOS').update(dados).eq('id', v.id);
      } else {
        await supabase.from('veiculos_DGAUTOS').insert([dados]);
      }
    } catch (e) {
      console.warn('Erro ao salvar no Supabase:', e);
    }
    return await getVeiculos();
  }
}

export async function deleteVeiculo(id) {
  try {
    return await api(`/veiculos/${id}`, { method: 'DELETE' });
  } catch {
    await supabase.from('veiculos_DGAUTOS').delete().eq('id', id);
    return await getVeiculos();
  }
}

// ==============================================================================
// 3. CLIENTES & FORNECEDORES (SUPABASE clientes_DGAUTOS)
// ==============================================================================
export async function getClientes() {
  try {
    return await api('/clientes');
  } catch {
    try {
      const { data } = await supabase.from('clientes_DGAUTOS').select('*').order('nome');
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
    return [
      { id: 1, nome: 'Cliente Balcão / Não Identificado', tipo_pessoa: 'PF', papel: 'cliente', cidade: 'Balneário Camboriú', uf: 'SC' },
      { id: 2, nome: 'Douglas Silveira', tipo_pessoa: 'PF', papel: 'ambos', cpf_cnpj: '123.456.789-00', telefone: '(47) 99999-1111', cidade: 'Itajaí', uf: 'SC' }
    ];
  }
}

export async function saveCliente(c) {
  try {
    return await (c.id ? api(`/clientes/${c.id}`, { method: 'PUT', body: c }) : api('/clientes', { method: 'POST', body: c }));
  } catch {
    try {
      if (c.id && typeof c.id === 'number') {
        await supabase.from('clientes_DGAUTOS').update(c).eq('id', c.id);
      } else {
        await supabase.from('clientes_DGAUTOS').insert([c]);
      }
    } catch {}
    return await getClientes();
  }
}

export async function deleteCliente(id) {
  try {
    return await api(`/clientes/${id}`, { method: 'DELETE' });
  } catch {
    await supabase.from('clientes_DGAUTOS').delete().eq('id', id);
    return await getClientes();
  }
}

// ==============================================================================
// 4. CRM / OPORTUNIDADES (SUPABASE oportunidades_crm_DGAUTOS)
// ==============================================================================
export async function getOportunidades() {
  try {
    return await api('/oportunidades');
  } catch {
    try {
      const { data } = await supabase.from('oportunidades_crm_DGAUTOS').select('*').order('id', { ascending: false });
      if (Array.isArray(data)) return data;
    } catch {}
    return [];
  }
}

export async function saveOportunidade(o) {
  try {
    return await (o.id ? api(`/oportunidades/${o.id}`, { method: 'PUT', body: o }) : api('/oportunidades', { method: 'POST', body: o }));
  } catch {
    try {
      if (o.id) {
        await supabase.from('oportunidades_crm_DGAUTOS').update(o).eq('id', o.id);
      } else {
        await supabase.from('oportunidades_crm_DGAUTOS').insert([o]);
      }
    } catch {}
    return await getOportunidades();
  }
}

export async function moveOportunidadeEstagio(id, estagio, motivo_conclusao) {
  try {
    return await api(`/oportunidades/${id}/estagio`, { method: 'PATCH', body: { estagio, motivo_conclusao } });
  } catch {
    await supabase.from('oportunidades_crm_DGAUTOS').update({ estagio, motivo_conclusao }).eq('id', id);
    return await getOportunidades();
  }
}

export async function deleteOportunidade(id) {
  try {
    return await api(`/oportunidades/${id}`, { method: 'DELETE' });
  } catch {
    await supabase.from('oportunidades_crm_DGAUTOS').delete().eq('id', id);
    return await getOportunidades();
  }
}

// ==============================================================================
// 5. NEGOCIAÇÕES (SUPABASE negociacoes_DGAUTOS)
// ==============================================================================
export async function getNegociacoes() {
  try {
    return await api('/negociacoes');
  } catch {
    try {
      const { data } = await supabase.from('negociacoes_DGAUTOS').select('*').order('id', { ascending: false });
      if (Array.isArray(data)) return data;
    } catch {}
    return [];
  }
}

export async function saveNegociacao(n) {
  try {
    return await (n.id ? api(`/negociacoes/${n.id}`, { method: 'PUT', body: n }) : api('/negociacoes', { method: 'POST', body: n }));
  } catch {
    try {
      if (n.id) {
        await supabase.from('negociacoes_DGAUTOS').update(n).eq('id', n.id);
      } else {
        await supabase.from('negociacoes_DGAUTOS').insert([n]);
      }
    } catch {}
    return await getNegociacoes();
  }
}

export async function concluirNegociacao(id) {
  try {
    return await api(`/negociacoes/${id}/concluir`, { method: 'POST' });
  } catch {
    await supabase.from('negociacoes_DGAUTOS').update({ status: 'concluida' }).eq('id', id);
    return await getNegociacoes();
  }
}

export async function deleteNegociacao(id) {
  try {
    return await api(`/negociacoes/${id}`, { method: 'DELETE' });
  } catch {
    await supabase.from('negociacoes_DGAUTOS').delete().eq('id', id);
    return await getNegociacoes();
  }
}

// ==============================================================================
// 6. FINANCEIRO (SUPABASE financeiro_DGAUTOS)
// ==============================================================================
export async function getFinanceiro() {
  try {
    return await api('/financeiro');
  } catch {
    try {
      const { data } = await supabase.from('financeiro_DGAUTOS').select('*').order('vencimento', { ascending: true });
      if (Array.isArray(data)) return data;
    } catch {}
    return [];
  }
}

export async function saveFinanceiro(f) {
  try {
    return await (f.id ? api(`/financeiro/${f.id}`, { method: 'PUT', body: f }) : api('/financeiro', { method: 'POST', body: f }));
  } catch {
    try {
      if (f.id) {
        await supabase.from('financeiro_DGAUTOS').update(f).eq('id', f.id);
      } else {
        await supabase.from('financeiro_DGAUTOS').insert([f]);
      }
    } catch {}
    return await getFinanceiro();
  }
}

export async function baixarFinanceiro(id) {
  try {
    return await api(`/financeiro/${id}/baixar`, { method: 'PATCH' });
  } catch {
    await supabase.from('financeiro_DGAUTOS').update({ status: 'pago', pagamento_data: new Date().toISOString().slice(0, 10) }).eq('id', id);
    return await getFinanceiro();
  }
}

export async function deleteFinanceiro(id) {
  try {
    return await api(`/financeiro/${id}`, { method: 'DELETE' });
  } catch {
    await supabase.from('financeiro_DGAUTOS').delete().eq('id', id);
    return await getFinanceiro();
  }
}

// ==============================================================================
// 7. CONFIGURAÇÕES & LOJA
// ==============================================================================
export async function getConfig() {
  try {
    return await api('/config');
  } catch {
    try {
      const { data } = await supabase.from('config_loja_DGAUTOS').select('*').eq('id', 1).maybeSingle();
      if (data) return { loja: data, usuarios: [] };
    } catch {}
    return {
      loja: {
        razao_social: 'DG Automóveis Comércio de Veículos Ltda',
        nome_fantasia: 'DG Automóveis',
        cnpj: '12.345.678/0001-90',
        telefone: '(47) 3333-4444',
        whatsapp: '(47) 99999-8888',
        email: 'contato@dgautomoveis.com.br',
        cidade: 'Balneário Camboriú',
        uf: 'SC'
      },
      usuarios: []
    };
  }
}

export async function saveConfigLoja(loja) {
  try {
    return await api('/config/loja', { method: 'PUT', body: loja });
  } catch {
    await supabase.from('config_loja_DGAUTOS').upsert({ id: 1, ...loja });
    return loja;
  }
}

export const createUsuario = (u) => api('/usuarios', { method: 'POST', body: u });
export const deleteUsuario = (id) => api(`/usuarios/${id}`, { method: 'DELETE' });

// ==============================================================================
// 8. INTEGRAÇÃO SITE
// ==============================================================================
export async function getIntegracaoSite() {
  try {
    return await api('/integracao/site');
  } catch {
    return {
      token: '20706bbe-4a09-4a03-8e2a-1f47e73d7a14',
      url_site: 'https://dgautomoveis.com.br',
      auto_publicar: true,
      total_estoque: 12,
      publicados_site: 10,
      link_json: 'https://dgautomoveis.com.br/api/estoquejson?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14',
      link_xml: 'https://dgautomoveis.com.br/api/estoquexml?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14'
    };
  }
}

export async function saveIntegracaoSite(dados) {
  try {
    return await api('/integracao/site', { method: 'PUT', body: dados });
  } catch {
    return dados;
  }
}

export async function regerarTokenSite() {
  try {
    return await api('/integracao/site/regerar-token', { method: 'POST' });
  } catch {
    return { token: 'token-' + Date.now() };
  }
}

// ==============================================================================
// FORMATADORES & CONSTANTES
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
