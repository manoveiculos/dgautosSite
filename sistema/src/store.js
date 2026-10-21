// Camada de dados: chama a API REST do backend (pasta /backend).

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.pathname.startsWith('/sistema') ? '/api' : 'http://localhost:3333/api');
const AUTH = 'dgautos_sessao';

const sessao = () => JSON.parse(localStorage.getItem(AUTH) || localStorage.getItem('motriz_sessao') || 'null');

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao()?.token || ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { logout(); location.reload(); }
  if (!res.ok) throw new Error(data.erro || 'Erro ao falar com o servidor.');
  return data;
}

// ---------- Veículos ----------
export const getVeiculos = () => api('/veiculos');
export const saveVeiculo = (v) =>
  v.id ? api(`/veiculos/${v.id}`, { method: 'PUT', body: v }) : api('/veiculos', { method: 'POST', body: v });
export const deleteVeiculo = (id) => api(`/veiculos/${id}`, { method: 'DELETE' });

// ---------- Clientes & Fornecedores ----------
export const getClientes = () => api('/clientes');
export const saveCliente = (c) =>
  c.id ? api(`/clientes/${c.id}`, { method: 'PUT', body: c }) : api('/clientes', { method: 'POST', body: c });
export const deleteCliente = (id) => api(`/clientes/${id}`, { method: 'DELETE' });

// ---------- CRM / Oportunidades ----------
export const getOportunidades = () => api('/oportunidades');
export const saveOportunidade = (o) =>
  o.id ? api(`/oportunidades/${o.id}`, { method: 'PUT', body: o }) : api('/oportunidades', { method: 'POST', body: o });
export const moveOportunidadeEstagio = (id, estagio, motivo_conclusao) =>
  api(`/oportunidades/${id}/estagio`, { method: 'PATCH', body: { estagio, motivo_conclusao } });
export const deleteOportunidade = (id) => api(`/oportunidades/${id}`, { method: 'DELETE' });

// ---------- Negociações ----------
export const getNegociacoes = () => api('/negociacoes');
export const saveNegociacao = (n) =>
  n.id ? api(`/negociacoes/${n.id}`, { method: 'PUT', body: n }) : api('/negociacoes', { method: 'POST', body: n });
export const concluirNegociacao = (id) => api(`/negociacoes/${id}/concluir`, { method: 'POST' });
export const deleteNegociacao = (id) => api(`/negociacoes/${id}`, { method: 'DELETE' });

// ---------- Financeiro ----------
export const getFinanceiro = () => api('/financeiro');
export const saveFinanceiro = (f) =>
  f.id ? api(`/financeiro/${f.id}`, { method: 'PUT', body: f }) : api('/financeiro', { method: 'POST', body: f });
export const baixarFinanceiro = (id) => api(`/financeiro/${id}/baixar`, { method: 'PATCH' });
export const deleteFinanceiro = (id) => api(`/financeiro/${id}`, { method: 'DELETE' });

// ---------- Configurações & Usuários ----------
export const getConfig = () => api('/config');
export const saveConfigLoja = (loja) => api('/config/loja', { method: 'PUT', body: loja });
export const createUsuario = (u) => api('/usuarios', { method: 'POST', body: u });
export const deleteUsuario = (id) => api(`/usuarios/${id}`, { method: 'DELETE' });

// ---------- Integração com Site & Portais ----------
export const getIntegracaoSite = () => api('/integracao/site');
export const saveIntegracaoSite = (dados) => api('/integracao/site', { method: 'PUT', body: dados });
export const regerarTokenSite = () => api('/integracao/site/regerar-token', { method: 'POST' });

// ---------- Sessão ----------
export const getUser = () => sessao()?.user || null;
export async function login(email, senha) {
  try {
    const s = await api('/auth/login', { method: 'POST', body: { email, senha } });
    localStorage.setItem(AUTH, JSON.stringify(s));
    return s.user;
  } catch {
    return null;
  }
}
export const logout = () => localStorage.removeItem(AUTH);

// ---------- Formatadores & Constantes ----------
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
