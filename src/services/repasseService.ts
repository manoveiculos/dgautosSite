import { supabase } from '../lib/supabase';
import { getAttribution } from '../lib/attribution';

export interface VeiculoRepasse {
  id: number | string;
  titulo: string;
  marca: string;
  modelo: string;
  ano: string;
  km: number;
  cor: string;
  combustivel: string;
  cambio: string;
  placa_final?: string;
  preco_fipe: number;
  preco_repasse: number;
  preco_lojista?: number;
  fotos: string[];
  descricao: string;
  observacoes_repasse: string;
  destaque?: boolean;
  status: 'disponivel' | 'reservado' | 'vendido';
  created_at?: string;
}

export interface LeadRepassePayload {
  lead_id: string;
  nome: string;
  telefone: string;
  cidade: string;
  veiculo_id?: number | string;
  veiculo_titulo?: string;
  preco_fipe?: number;
  preco_repasse?: number;
  proposta_mensagem?: string;
  aceitou_termos: boolean;
  event_id?: string;
}

const WEBHOOK_N8N_REPASSE = 'https://n8n.drivvoo.com/webhook/42d8e1c7-83ec-40b2-a646-ec363cf88c2e';

// Fallback visual imediato caso a tabela no Supabase ainda não tenha sido populada
const MOCK_VEICULOS_REPASSE: VeiculoRepasse[] = [
  {
    id: 1,
    titulo: 'Volkswagen Gol 1.6 MSI TotalFlex 8V',
    marca: 'Volkswagen',
    modelo: 'Gol',
    ano: '2019/2020',
    km: 82000,
    cor: 'Branca',
    combustivel: 'Flex',
    cambio: 'Manual',
    placa_final: '7',
    preco_fipe: 52400,
    preco_repasse: 39900,
    preco_lojista: 37500,
    fotos: [
      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80'
    ],
    descricao: 'Completo com ar condicionado, direção hidráulica, vidros elétricos e travas. Excelente estrutura e mecânica confiável.',
    observacoes_repasse: 'Veículo de repasse com desconto de R$ 12.500 abaixo da FIPE. Pequenos riscos no para-choque traseiro e detalhe estético no banco do motorista. Documentação 2026 ok, motor e câmbio testados. Vendido no estado sem garantia de loja.',
    destaque: true,
    status: 'disponivel',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    titulo: 'Chevrolet Onix 1.0 LT Flex 8V',
    marca: 'Chevrolet',
    modelo: 'Onix',
    ano: '2018/2018',
    km: 95000,
    cor: 'Prata',
    combustivel: 'Flex',
    cambio: 'Manual',
    placa_final: '3',
    preco_fipe: 54800,
    preco_repasse: 41500,
    preco_lojista: 38900,
    fotos: [
      'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80'
    ],
    descricao: 'Onix LT com MyLink, volante multifuncional, ar condicionado e direção elétrica. Econômico e ótimo para o dia a dia.',
    observacoes_repasse: 'Desconto expressivo de R$ 13.300 em relação à Tabela FIPE. Pneus dianteiros com meia vida, pequeno detalhe de pintura na porta direita. Estrutura 100% selada. Repasse direto para giro rápido.',
    destaque: true,
    status: 'disponivel',
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    titulo: 'Hyundai HB20 Comfort Plus 1.0',
    marca: 'Hyundai',
    modelo: 'HB20',
    ano: '2017/2017',
    km: 104000,
    cor: 'Vermelha',
    combustivel: 'Flex',
    cambio: 'Manual',
    placa_final: '9',
    preco_fipe: 49900,
    preco_repasse: 37800,
    preco_lojista: 35500,
    fotos: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80'
    ],
    descricao: 'HB20 Comfort Plus com som original com Bluetooth, ar condicionado, direção hidráulica, vidros elétricos nas 4 portas.',
    observacoes_repasse: 'Preço de repasse imediato (R$ 12.100 abaixo da FIPE). Mecânica revisada recente, ar gelando. Possui leve amassado na tampa do porta-malas. Documentos quitados prontos para transferência.',
    destaque: false,
    status: 'disponivel',
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    titulo: 'Renault Kwid 1.0 12V Zen Flex',
    marca: 'Renault',
    modelo: 'Kwid',
    ano: '2021/2022',
    km: 61000,
    cor: 'Branca',
    combustivel: 'Flex',
    cambio: 'Manual',
    placa_final: '5',
    preco_fipe: 46500,
    preco_repasse: 35900,
    preco_lojista: 33800,
    fotos: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=80'
    ],
    descricao: 'Super econômico! Kwid Zen 2022 com ar condicionado, direção elétrica, airbags frontais e laterais, som Bluetooth.',
    observacoes_repasse: 'Economia de R$ 10.600 em relação à FIPE. Veículo de repasse em ótimo estado de conservação geral, apenas com desgaste natural de uso urbano. Repasse no estado.',
    destaque: true,
    status: 'disponivel',
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    titulo: 'Ford EcoSport 1.6 SE 16V Flex',
    marca: 'Ford',
    modelo: 'EcoSport',
    ano: '2015/2015',
    km: 118000,
    cor: 'Preta',
    combustivel: 'Flex',
    cambio: 'Manual',
    placa_final: '1',
    preco_fipe: 53200,
    preco_repasse: 39900,
    preco_lojista: 37200,
    fotos: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80'
    ],
    descricao: 'SUV compacto completo com sistema SYNC, rodas de liga leve, faróis de neblina, espaço interno excelente e posição alta de dirigir.',
    observacoes_repasse: 'Oportunidade SUV de repasse (R$ 13.300 abaixo da FIPE). Mecânica 1.6 forte, necessita substituição de 2 pneus e buchas da suspensão dianteira. Vendido no estado.',
    destaque: false,
    status: 'disponivel',
    created_at: new Date().toISOString()
  },
  {
    id: 6,
    titulo: 'Fiat Strada 1.4 Hard Working CD',
    marca: 'Fiat',
    modelo: 'Strada',
    ano: '2018/2019',
    km: 112000,
    cor: 'Branca',
    combustivel: 'Flex',
    cambio: 'Manual',
    placa_final: '4',
    preco_fipe: 64500,
    preco_repasse: 49900,
    preco_lojista: 46900,
    fotos: [
      'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80'
    ],
    descricao: 'Picape de trabalho Cabine Dupla, motor 1.4 Fire consagrado, ar condicionado, direção hidráulica e protetor de caçamba.',
    observacoes_repasse: 'R$ 14.600 abaixo da FIPE! Veículo de repasse de frota comercial. Lataria com marcas de trabalho, porém motor e caixa 100% revisados. Excelente custo-benefício.',
    destaque: true,
    status: 'disponivel',
    created_at: new Date().toISOString()
  }
];

const LOCAL_VEICULOS_KEY = 'manos_veiculos_repasse_local_v2';

function getLocalVeiculos(): VeiculoRepasse[] {
  try {
    const raw = localStorage.getItem(LOCAL_VEICULOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalVeiculos(list: VeiculoRepasse[]): void {
  try {
    localStorage.setItem(LOCAL_VEICULOS_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

/**
 * Busca todos os veículos de repasse disponíveis.
 * Tenta buscar no Supabase e mescla com os dados locais salvos.
 */
export async function fetchVeiculosRepasse(): Promise<VeiculoRepasse[]> {
  const localItems = getLocalVeiculos();
  let supabaseItems: VeiculoRepasse[] = [];

  try {
    const { data, error } = await supabase
      .from('veiculos_repasse')
      .select('*')
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      supabaseItems = data.map((item: any) => ({
        ...item,
        fotos: Array.isArray(item.fotos)
          ? item.fotos
          : typeof item.fotos === 'string'
          ? JSON.parse(item.fotos)
          : [],
        preco_fipe: Number(item.preco_fipe),
        preco_repasse: Number(item.preco_repasse),
        preco_lojista: item.preco_lojista ? Number(item.preco_lojista) : undefined,
      }));
    }
  } catch (err) {
    console.error('Error fetching veiculos_repasse:', err);
  }

  const map = new Map<string | number, VeiculoRepasse>();

  if (supabaseItems.length === 0 && localItems.length === 0) {
    MOCK_VEICULOS_REPASSE.forEach(item => map.set(String(item.id), item));
  }

  supabaseItems.forEach(item => map.set(String(item.id), item));
  localItems.forEach(item => map.set(String(item.id), item));

  return Array.from(map.values()).sort((a, b) => {
    if (a.destaque && !b.destaque) return -1;
    if (!a.destaque && b.destaque) return 1;
    return 0;
  });
}


/**
 * Converte um arquivo para Base64 como fallback caso o bucket de storage não esteja ativo.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Envia um arquivo de foto local para o bucket fotos-repasse do Supabase Storage.
 * Caso haja qualquer erro no bucket, realiza o fallback transparente para Base64.
 */
export async function uploadFotoRepasse(file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `veiculos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('fotos-repasse')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase storage upload warn, falling back to base64:', uploadError.message);
      const base64 = await fileToBase64(file);
      return { ok: true, url: base64 };
    }

    const { data } = supabase.storage
      .from('fotos-repasse')
      .getPublicUrl(filePath);

    return { ok: true, url: data.publicUrl };
  } catch (err: any) {
    console.warn('Error uploading photo, using base64 fallback:', err);
    try {
      const base64 = await fileToBase64(file);
      return { ok: true, url: base64 };
    } catch (fallbackErr: any) {
      return { ok: false, error: fallbackErr.message || 'Erro ao processar imagem' };
    }
  }
}

/**
 * Cadastra um novo veículo de repasse no Supabase e atualiza o cache local.
 */
export async function cadastrarVeiculoRepasse(veiculo: Omit<VeiculoRepasse, 'id' | 'created_at'>): Promise<{ ok: boolean; data?: any; error?: string }> {
  const tempId = `repasse_${Date.now()}`;
  const novoVeiculo: VeiculoRepasse = {
    ...veiculo,
    id: tempId,
    created_at: new Date().toISOString()
  };

  // Atualiza cache local imediatamente
  const localList = getLocalVeiculos();
  saveLocalVeiculos([novoVeiculo, ...localList]);

  try {
    const { data, error } = await supabase
      .from('veiculos_repasse')
      .insert([veiculo])
      .select();

    if (error) {
      console.warn('Inserção Supabase em stand-by (salvo localmente):', error.message);
      return { ok: true, data: novoVeiculo };
    }

    const created = data?.[0];
    if (created) {
      const current = getLocalVeiculos().filter(i => i.id !== tempId);
      current.unshift({
        ...created,
        fotos: Array.isArray(created.fotos)
          ? created.fotos
          : typeof created.fotos === 'string'
          ? JSON.parse(created.fotos)
          : [],
        preco_fipe: Number(created.preco_fipe),
        preco_repasse: Number(created.preco_repasse),
      });
      saveLocalVeiculos(current);
      return { ok: true, data: created };
    }

    return { ok: true, data: novoVeiculo };
  } catch (err: any) {
    return { ok: true, data: novoVeiculo };
  }
}

/**
 * Envia o interesse do cliente para o proxy do servidor e diretamente para o webhook do n8n.
 */
export async function enviarLeadRepasse(payload: LeadRepassePayload): Promise<{ ok: boolean; error?: string }> {
  const envelope = {
    ...payload,
    source: 'Veículos de Repasse - DG Automóveis',
    webhook_target: WEBHOOK_N8N_REPASSE,
    atribuicao: getAttribution(),
    timestamp: new Date().toISOString(),
  };

  let proxySuccess = false;

  // 1. Tenta enviar via Backend Proxy Express
  try {
    const res = await fetch('/api/repasse/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    if (res.ok) {
      proxySuccess = true;
    }
  } catch (err) {
    console.warn('Proxy /api/repasse/lead failed, trying direct webhook fallback:', err);
  }

  // 2. Envio direto para o Webhook n8n (garantindo redundância)
  try {
    const response = await fetch(WEBHOOK_N8N_REPASSE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    if (response.ok || proxySuccess) {
      // Opcional: salvar cópia do lead no Supabase se configurado
      try {
        await supabase.from('leads_repasse').insert([
          {
            lead_id: payload.lead_id,
            nome: payload.nome,
            telefone: payload.telefone,
            cidade: payload.cidade,
            veiculo_id: payload.veiculo_id ? Number(payload.veiculo_id) : null,
            veiculo_titulo: payload.veiculo_titulo,
            valor_repasse: payload.preco_repasse,
            proposta_mensagem: payload.proposta_mensagem,
            aceitou_termos: payload.aceitou_termos,
          },
        ]);
      } catch (dbErr) {
        /* ignora falhas de DB secundário */
      }

      return { ok: true };
    }

    return { ok: false, error: 'Falha na resposta do webhook de repasse.' };
  } catch (err: any) {
    console.error('enviarLeadRepasse direct webhook error:', err);
    if (proxySuccess) return { ok: true };
    return { ok: false, error: err.message || 'Erro ao enviar proposta.' };
  }
}

/**
 * Atualiza um veículo de repasse existente no Supabase e no cache local.
 */
export async function atualizarVeiculoRepasse(
  id: number | string,
  veiculo: Partial<VeiculoRepasse>
): Promise<{ ok: boolean; data?: any; error?: string }> {
  // Sincroniza cache local
  const localList = getLocalVeiculos();
  const idx = localList.findIndex(item => String(item.id) === String(id));
  if (idx !== -1) {
    localList[idx] = { ...localList[idx], ...veiculo };
    saveLocalVeiculos(localList);
  }

  try {
    const { data, error } = await supabase
      .from('veiculos_repasse')
      .update(veiculo)
      .eq('id', id)
      .select();

    if (error) {
      console.warn('Atualização Supabase aviso (salvo localmente):', error.message);
      return { ok: true };
    }
    return { ok: true, data: data?.[0] };
  } catch (err: any) {
    return { ok: true };
  }
}

/**
 * Altera rapidamente o status de um veículo de repasse.
 */
export async function atualizarStatusVeiculoRepasse(
  id: number | string,
  status: 'disponivel' | 'reservado' | 'vendido'
): Promise<{ ok: boolean; error?: string }> {
  return atualizarVeiculoRepasse(id, { status });
}

/**
 * Exclui um veículo de repasse do Supabase e do cache local.
 */
export async function excluirVeiculoRepasse(id: number | string): Promise<{ ok: boolean; error?: string }> {
  // Remove do cache local
  const localList = getLocalVeiculos().filter(item => String(item.id) !== String(id));
  saveLocalVeiculos(localList);

  try {
    const { error } = await supabase
      .from('veiculos_repasse')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Exclusão Supabase aviso (removido localmente):', error.message);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: true };
  }
}


export interface LeadRepasseRecord {
  id: number | string;
  created_at: string;
  lead_id: string;
  nome: string;
  telefone: string;
  cidade: string;
  veiculo_id?: number | null;
  veiculo_titulo?: string | null;
  valor_repasse?: number | null;
  proposta_mensagem?: string | null;
  aceitou_termos: boolean;
}

/**
 * Busca a lista de leads/propostas registrados para veículos de repasse.
 */
export async function fetchLeadsRepasse(): Promise<LeadRepasseRecord[]> {
  try {
    const { data, error } = await supabase
      .from('leads_repasse')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchLeadsRepasse warn:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Error fetching leads_repasse:', err);
    return [];
  }
}

/**
 * Exclui um registro de lead de repasse.
 */
export async function excluirLeadRepasse(id: number | string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('leads_repasse')
      .delete()
      .eq('id', id);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Erro ao excluir lead' };
  }
}


// ===========================================================================
// GESTÃO E AUTENTICAÇÃO DE LOJISTAS E REPASSADORES (ÁREA RESTRITA)
// ===========================================================================

const WEBHOOK_N8N_CADASTRO_REPASSE = 'https://n8n.drivvoo.com/webhook/7a146026-4b40-447d-a49d-0853ac749f26';

export interface Repassador {
  id: number | string;
  created_at?: string;
  nome_completo: string;
  cpf_cnpj: string;
  nome_loja: string;
  cidade?: string;
  telefone: string;
  status: 'pendente' | 'ativo' | 'bloqueado';
  observacoes?: string;
}

const LOCAL_REPASSADORES_KEY = 'manos_veiculos_repassadores_v1';

function cleanPhoneDigits(val: string): string {
  return val.replace(/\D/g, '');
}

function getLocalRepassadores(): Repassador[] {
  try {
    const raw = localStorage.getItem(LOCAL_REPASSADORES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRepassadores(list: Repassador[]): void {
  try {
    localStorage.setItem(LOCAL_REPASSADORES_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export async function fetchRepassadores(): Promise<Repassador[]> {
  const localItems = getLocalRepassadores();
  let supabaseItems: Repassador[] = [];

  try {
    const { data, error } = await supabase
      .from('repassadores')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      supabaseItems = data;
    }
  } catch (err) {
    console.warn('Supabase fetchRepassadores warn:', err);
  }

  const map = new Map<string, Repassador>();
  supabaseItems.forEach(item => map.set(cleanPhoneDigits(item.telefone), item));
  localItems.forEach(item => {
    const key = cleanPhoneDigits(item.telefone);
    if (!map.has(key)) map.set(key, item);
  });

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}

/**
 * Cadastra um novo Lojista / Repassador com status padrão 'pendente'
 * e dispara a notificação para o webhook do n8n (https://n8n.drivvoo.com/webhook/7a146026-4b40-447d-a49d-0853ac749f26).
 */
export async function cadastrarRepassador(
  payload: Omit<Repassador, 'id' | 'created_at' | 'status'> & { status?: 'pendente' | 'ativo' | 'bloqueado' }
): Promise<{ ok: boolean; data?: Repassador; error?: string }> {
  const telefoneDigits = cleanPhoneDigits(payload.telefone);
  if (telefoneDigits.length < 10) {
    return { ok: false, error: 'Número de telefone / WhatsApp inválido.' };
  }

  const novoRepassador: Repassador = {
    id: `rep_${Date.now()}`,
    created_at: new Date().toISOString(),
    nome_completo: payload.nome_completo.trim(),
    cpf_cnpj: payload.cpf_cnpj.trim(),
    nome_loja: payload.nome_loja.trim(),
    cidade: payload.cidade ? payload.cidade.trim() : '',
    telefone: telefoneDigits,
    status: payload.status || 'pendente',
    observacoes: payload.observacoes || '',
  };

  // 1. Notifica Webhook n8n de Novo Cadastro
  const webhookEnvelope = {
    event: 'novo_cadastro_lojista',
    source: 'Portal Lojistas - DG Automóveis',
    timestamp: new Date().toISOString(),
    repassador: {
      id: novoRepassador.id,
      nome_completo: novoRepassador.nome_completo,
      cpf_cnpj: novoRepassador.cpf_cnpj,
      nome_loja: novoRepassador.nome_loja,
      cidade: novoRepassador.cidade,
      telefone: novoRepassador.telefone,
      status: novoRepassador.status,
      observacoes: novoRepassador.observacoes,
    }
  };

  // Disparo assíncrono via proxy do backend
  try {
    fetch('/api/repasse/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookEnvelope),
    }).catch(() => null);
  } catch {}

  // Disparo direto em fallback para redundância
  try {
    fetch(WEBHOOK_N8N_CADASTRO_REPASSE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookEnvelope),
    }).catch(() => null);
  } catch {}

  // 2. Atualiza cache local
  const currentLocal = getLocalRepassadores();
  const existingIdx = currentLocal.findIndex(r => cleanPhoneDigits(r.telefone) === telefoneDigits);
  if (existingIdx !== -1) {
    currentLocal[existingIdx] = novoRepassador;
  } else {
    currentLocal.unshift(novoRepassador);
  }
  saveLocalRepassadores(currentLocal);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('manos-repassadores-updated'));
    window.dispatchEvent(new Event('storage'));
  }

  try {
    const { data, error } = await supabase
      .from('repassadores')
      .insert([{
        nome_completo: novoRepassador.nome_completo,
        cpf_cnpj: novoRepassador.cpf_cnpj,
        nome_loja: novoRepassador.nome_loja,
        cidade: novoRepassador.cidade,
        telefone: novoRepassador.telefone,
        status: novoRepassador.status,
        observacoes: novoRepassador.observacoes
      }])
      .select();

    if (error) {
      if (error.code === '23505') {
        // Se o telefone já existir no Supabase, atualiza o cadastro para pendente
        const { data: updatedData } = await supabase
          .from('repassadores')
          .update({
            nome_completo: novoRepassador.nome_completo,
            cpf_cnpj: novoRepassador.cpf_cnpj,
            nome_loja: novoRepassador.nome_loja,
            cidade: novoRepassador.cidade,
            status: novoRepassador.status,
            observacoes: novoRepassador.observacoes
          })
          .eq('telefone', novoRepassador.telefone)
          .select();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('manos-repassadores-updated'));
        }
        return { ok: true, data: updatedData?.[0] || novoRepassador };
      }
      console.warn('Inserção Supabase repassador aviso (salvo localmente):', error.message);
      return { ok: true, data: novoRepassador };
    }

    const created = data?.[0];
    if (created) {
      return { ok: true, data: created };
    }
    return { ok: true, data: novoRepassador };
  } catch (err: any) {
    return { ok: true, data: novoRepassador };
  }
}

export async function verificarAcessoRepassador(telefoneInput: string): Promise<{ ok: boolean; status?: 'ativo' | 'pendente' | 'bloqueado' | 'nao_encontrado'; repassador?: Repassador; error?: string }> {
  const digits = cleanPhoneDigits(telefoneInput);
  if (digits.length < 10) {
    return { ok: false, error: 'Telefone inválido' };
  }

  try {
    const { data, error } = await supabase
      .from('repassadores')
      .select('*')
      .eq('telefone', digits)
      .limit(1);

    if (!error && data && data.length > 0) {
      const found = data[0] as Repassador;
      return { ok: true, status: found.status, repassador: found };
    }
  } catch (err) {
    console.warn('Verificar repassador Supabase err:', err);
  }

  const localList = getLocalRepassadores();
  const localFound = localList.find(r => cleanPhoneDigits(r.telefone) === digits);
  if (localFound) {
    return { ok: true, status: localFound.status, repassador: localFound };
  }

  return { ok: true, status: 'nao_encontrado' };
}

export async function atualizarStatusRepassador(
  id: number | string,
  status: 'ativo' | 'pendente' | 'bloqueado'
): Promise<{ ok: boolean; error?: string }> {
  const localList = getLocalRepassadores();
  const idx = localList.findIndex(r => String(r.id) === String(id));
  if (idx !== -1) {
    localList[idx].status = status;
    saveLocalRepassadores(localList);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('manos-repassadores-updated'));
    window.dispatchEvent(new Event('storage'));
  }

  try {
    const { error } = await supabase
      .from('repassadores')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.warn('Atualização status repassador aviso:', error.message);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: true };
  }
}

export async function excluirRepassador(id: number | string): Promise<{ ok: boolean; error?: string }> {
  const localList = getLocalRepassadores().filter(r => String(r.id) !== String(id));
  saveLocalRepassadores(localList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('manos-repassadores-updated'));
    window.dispatchEvent(new Event('storage'));
  }

  try {
    const { error } = await supabase
      .from('repassadores')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Exclusão repassador aviso:', error.message);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: true };
  }
}

// -------------------------------------------------------------
// GERENCIAMENTO DE PROPOSTAS E CONTRAPROPOSTAS DE LOJISTAS
// -------------------------------------------------------------

export interface PropostaRepasse {
  id: number | string;
  created_at?: string;
  updated_at?: string;
  repassador_id?: number | string;
  repassador_nome: string;
  repassador_telefone: string;
  repassador_loja: string;
  repassador_cidade?: string;
  veiculo_id?: number | string;
  veiculo_titulo: string;
  valor_veiculo: number;
  valor_proposta: number;
  mensagem_lojista?: string;
  status: 'pendente' | 'aceita' | 'recusada' | 'contraproposta';
  valor_contraproposta?: number;
  resposta_manos?: string;
}

const LOCAL_PROPOSTAS_KEY = 'manos_propostas_repasse_v1';

function getLocalPropostas(): PropostaRepasse[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROPOSTAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPropostas(propostas: PropostaRepasse[]): void {
  try {
    localStorage.setItem(LOCAL_PROPOSTAS_KEY, JSON.stringify(propostas));
  } catch (e) {
    console.error('Erro localStorage propostas:', e);
  }
}

export async function cadastrarPropostaLojista(
  payload: Omit<PropostaRepasse, 'id' | 'created_at' | 'updated_at' | 'status'>
): Promise<{ ok: boolean; data?: PropostaRepasse; error?: string }> {
  const newProposta: PropostaRepasse = {
    ...payload,
    id: Date.now(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'pendente',
  };

  const currentList = getLocalPropostas();
  currentList.unshift(newProposta);
  saveLocalPropostas(currentList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('manos-propostas-updated'));
    window.dispatchEvent(new Event('storage'));
  }

  try {
    const { data, error } = await supabase
      .from('propostas_repasse')
      .insert({
        repassador_id: payload.repassador_id || null,
        repassador_nome: payload.repassador_nome,
        repassador_telefone: payload.repassador_telefone,
        repassador_loja: payload.repassador_loja,
        repassador_cidade: payload.repassador_cidade || null,
        veiculo_id: payload.veiculo_id || null,
        veiculo_titulo: payload.veiculo_titulo,
        valor_veiculo: payload.valor_veiculo,
        valor_proposta: payload.valor_proposta,
        mensagem_lojista: payload.mensagem_lojista || null,
        status: 'pendente',
      })
      .select('*')
      .single();

    if (!error && data) {
      const updatedList = getLocalPropostas().map(p => p.id === newProposta.id ? (data as PropostaRepasse) : p);
      saveLocalPropostas(updatedList);
      return { ok: true, data: data as PropostaRepasse };
    }
  } catch (err: any) {
    console.warn('Erro ao salvar proposta no Supabase, usando local:', err);
  }

  return { ok: true, data: newProposta };
}

export async function fetchPropostasPorTelefone(telefone: string): Promise<PropostaRepasse[]> {
  const digits = cleanPhoneDigits(telefone);

  try {
    const { data, error } = await supabase
      .from('propostas_repasse')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const filtered = (data as PropostaRepasse[]).filter(
        p => cleanPhoneDigits(p.repassador_telefone) === digits
      );
      const local = getLocalPropostas().filter(p => cleanPhoneDigits(p.repassador_telefone) === digits);
      const mergedMap = new Map<string, PropostaRepasse>();
      filtered.forEach(p => mergedMap.set(String(p.id), p));
      local.forEach(p => mergedMap.set(String(p.id), p));
      return Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }
  } catch (err) {
    console.warn('Erro fetchPropostasPorTelefone Supabase:', err);
  }

  return getLocalPropostas().filter(p => cleanPhoneDigits(p.repassador_telefone) === digits);
}

export async function fetchTodasPropostasAdmin(): Promise<PropostaRepasse[]> {
  try {
    const { data, error } = await supabase
      .from('propostas_repasse')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const local = getLocalPropostas();
      const mergedMap = new Map<string, PropostaRepasse>();
      (data as PropostaRepasse[]).forEach(p => mergedMap.set(String(p.id), p));
      local.forEach(p => mergedMap.set(String(p.id), p));
      return Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }
  } catch (err) {
    console.warn('Erro fetchTodasPropostasAdmin Supabase:', err);
  }

  return getLocalPropostas();
}

export async function responderPropostaAdmin(
  id: number | string,
  status: PropostaRepasse['status'],
  valorContraproposta?: number,
  respostaManos?: string
): Promise<{ ok: boolean; error?: string }> {
  const localList = getLocalPropostas();
  const idx = localList.findIndex(p => String(p.id) === String(id));
  if (idx !== -1) {
    localList[idx].status = status;
    if (valorContraproposta !== undefined) localList[idx].valor_contraproposta = valorContraproposta;
    if (respostaManos !== undefined) localList[idx].resposta_manos = respostaManos;
    localList[idx].updated_at = new Date().toISOString();
    saveLocalPropostas(localList);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('manos-propostas-updated'));
    window.dispatchEvent(new Event('storage'));
  }

  try {
    const updateObj: any = {
      status,
      updated_at: new Date().toISOString()
    };
    if (valorContraproposta !== undefined) updateObj.valor_contraproposta = valorContraproposta;
    if (respostaManos !== undefined) updateObj.resposta_manos = respostaManos;

    const { error } = await supabase
      .from('propostas_repasse')
      .update(updateObj)
      .eq('id', id);

    if (error) {
      console.warn('Responder proposta Supabase aviso:', error.message);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: true };
  }
}

export async function excluirProposta(id: number | string): Promise<{ ok: boolean; error?: string }> {
  const localList = getLocalPropostas().filter(p => String(p.id) !== String(id));
  saveLocalPropostas(localList);

  try {
    const { error } = await supabase
      .from('propostas_repasse')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Excluir proposta Supabase aviso:', error.message);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: true };
  }
}


