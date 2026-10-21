import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock, Car, Plus, Edit, Trash2, CheckCircle2, AlertCircle, Loader2,
  Search, RefreshCw, MessageCircle, LogOut, ArrowLeft, Eye, ShieldCheck,
  Tag, Percent, ExternalLink, Filter, Check, X, Upload, Image as ImageIcon,
  Sparkles, ChevronLeft, ChevronRight, Star, Move, Building2, Users, Phone,
  ShieldAlert, UserCheck, UserX, Handshake, XCircle, Clock, Send, FileText, BadgeDollarSign
} from 'lucide-react';

import {
  fetchVeiculosRepasse,
  cadastrarVeiculoRepasse,
  atualizarVeiculoRepasse,
  atualizarStatusVeiculoRepasse,
  excluirVeiculoRepasse,
  fetchLeadsRepasse,
  excluirLeadRepasse,
  uploadFotoRepasse,
  fetchRepassadores,
  atualizarStatusRepassador,
  excluirRepassador,
  fetchTodasPropostasAdmin,
  responderPropostaAdmin,
  excluirProposta,
  type VeiculoRepasse,
  type LeadRepasseRecord,
  type Repassador,
  type PropostaRepasse
} from '../../services/repasseService';
import { gerarObservacoesIA, gerarDescricaoIA } from '../../services/aiService';

const ADMIN_PASSWORD = (import.meta as any).env?.VITE_REPASSE_ADMIN_PASSWORD || (import.meta as any).env?.VITE_ADMIN_PASSWORD || 'dg2026admin';
const LOGO = '/logo-dg.png';
const AUTH_KEY = 'manos_repasse_admin_auth_v1';

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RepasseAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(AUTH_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Main Admin Tabs
  const [activeTab, setActiveTab] = useState<'estoque' | 'leads' | 'repassadores' | 'propostas'>('repassadores');

  // Vehicles state
  const [veiculos, setVeiculos] = useState<VeiculoRepasse[]>([]);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Leads state
  const [leads, setLeads] = useState<LeadRepasseRecord[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Repassadores / Lojistas state
  const [repassadores, setRepassadores] = useState<Repassador[]>([]);
  const [loadingRepassadores, setLoadingRepassadores] = useState(false);
  const [searchRepassadores, setSearchRepassadores] = useState('');
  const [filterRepassadorStatus, setFilterRepassadorStatus] = useState<'todos' | 'pendente' | 'ativo' | 'bloqueado'>('todos');

  // Propostas de Lojistas State
  const [propostas, setPropostas] = useState<PropostaRepasse[]>([]);
  const [loadingPropostas, setLoadingPropostas] = useState(false);
  const [searchPropostas, setSearchPropostas] = useState('');

  // Reply Modal / Action state
  const [selectedPropostaAction, setSelectedPropostaAction] = useState<PropostaRepasse | null>(null);
  const [actionModalType, setActionModalType] = useState<'aceitar' | 'recusar' | 'contraproposta' | null>(null);
  const [valorContrapropostaInput, setValorContrapropostaInput] = useState('');
  const [respostaManosInput, setRespostaManosInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modal / Form state for Add/Edit Vehicle
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [draggedPhotoIdx, setDraggedPhotoIdx] = useState<number | null>(null);
  const [generatingObs, setGeneratingObs] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    titulo: '',
    marca: '',
    modelo: '',
    ano: '',
    km: 80000,
    cor: 'Branca',
    combustivel: 'Flex',
    cambio: 'Manual',
    placa_final: '',
    preco_fipe: 0,
    preco_repasse: 0,
    preco_lojista: 0,
    fotosList: [] as string[],
    descricao: '',
    observacoes_repasse: '',
    destaque: true,
    status: 'disponivel' as 'disponivel' | 'reservado' | 'vendido',
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
      try {
        sessionStorage.setItem(AUTH_KEY, 'true');
      } catch {
        /* noop */
      }
    } else {
      setPasswordError('Senha incorreta.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();

      const handleRepassadoresEvent = () => loadRepassadores();
      const handlePropostasEvent = () => loadPropostas();
      const handleStorageEvent = (e: StorageEvent) => {
        if (!e.key || e.key === 'manos_veiculos_repassadores_v1') loadRepassadores();
        if (!e.key || e.key === 'manos_propostas_repasse_v1') loadPropostas();
      };

      window.addEventListener('manos-repassadores-updated', handleRepassadoresEvent);
      window.addEventListener('manos-propostas-updated', handlePropostasEvent);
      window.addEventListener('storage', handleStorageEvent);

      const interval = setInterval(() => {
        loadRepassadores();
        loadPropostas();
      }, 6000);

      return () => {
        window.removeEventListener('manos-repassadores-updated', handleRepassadoresEvent);
        window.removeEventListener('manos-propostas-updated', handlePropostasEvent);
        window.removeEventListener('storage', handleStorageEvent);
        clearInterval(interval);
      };
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    loadVeiculos();
    loadLeads();
    loadRepassadores();
    loadPropostas();
  };

  const loadVeiculos = async () => {
    setLoadingVeiculos(true);
    const data = await fetchVeiculosRepasse();
    setVeiculos(data);
    setLoadingVeiculos(false);
  };

  const loadLeads = async () => {
    setLoadingLeads(true);
    const data = await fetchLeadsRepasse();
    setLeads(data);
    setLoadingLeads(false);
  };

  const loadRepassadores = async () => {
    setLoadingRepassadores(true);
    const data = await fetchRepassadores();
    setRepassadores(data);
    setLoadingRepassadores(false);
  };

  const loadPropostas = async () => {
    setLoadingPropostas(true);
    const data = await fetchTodasPropostasAdmin();
    setPropostas(data);
    setLoadingPropostas(false);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormError('');
    setFormData({
      titulo: '',
      marca: '',
      modelo: '',
      ano: '',
      km: 80000,
      cor: 'Branca',
      combustivel: 'Flex',
      cambio: 'Manual',
      placa_final: '',
      preco_fipe: 0,
      preco_repasse: 0,
      preco_lojista: 0,
      fotosList: [],
      descricao: '',
      observacoes_repasse: '',
      destaque: true,
      status: 'disponivel',
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (v: VeiculoRepasse) => {
    setEditingId(v.id);
    setFormError('');
    setFormData({
      titulo: v.titulo,
      marca: v.marca,
      modelo: v.modelo,
      ano: v.ano,
      km: v.km,
      cor: v.cor,
      combustivel: v.combustivel,
      cambio: v.cambio,
      placa_final: v.placa_final || '',
      preco_fipe: v.preco_fipe,
      preco_repasse: v.preco_repasse,
      preco_lojista: v.preco_lojista || 0,
      fotosList: Array.isArray(v.fotos) ? [...v.fotos] : [],
      descricao: v.descricao,
      observacoes_repasse: v.observacoes_repasse,
      destaque: v.destaque ?? true,
      status: v.status,
    });
    setShowFormModal(true);
  };

  const handleToggleRepassadorStatus = async (r: Repassador, newStatus: 'ativo' | 'pendente' | 'bloqueado') => {
    const res = await atualizarStatusRepassador(r.id, newStatus);
    if (res.ok) {
      loadRepassadores();
    } else {
      alert(`Erro ao atualizar status: ${res.error}`);
    }
  };

  const handleNotificarRepassadorWhatsApp = (r: Repassador) => {
    const txt = `Olá ${r.nome_completo}! Seu cadastro de lojista (${r.nome_loja}) na DG Automóveis foi APROVADO! Agora você pode acessar o nosso estoque de repasse exclusivo em: https://dgautomoveis.com.br/repasse`;
    window.open(`https://wa.me/55${r.telefone}?text=${encodeURIComponent(txt)}`, '_blank');
  };

  const handleDeleteRepassador = async (r: Repassador) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cadastro do repassador "${r.nome_completo}" (${r.nome_loja})?`)) return;
    const res = await excluirRepassador(r.id);
    if (res.ok) {
      loadRepassadores();
    } else {
      alert(`Erro ao excluir repassador: ${res.error}`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    setFormError('');

    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const res = await uploadFotoRepasse(file);
      if (res.ok && res.url) {
        newUrls.push(res.url);
      } else {
        setFormError(res.error || `Erro ao processar imagem ${file.name}`);
      }
    }

    setFormData(prev => ({
      ...prev,
      fotosList: [...prev.fotosList, ...newUrls]
    }));

    setUploadingPhotos(false);
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fotosList: prev.fotosList.filter((_, idx) => idx !== index)
    }));
  };

  const handleGenerateObsIA = async () => {
    if (!formData.titulo || !formData.preco_fipe || !formData.preco_repasse) {
      alert('Por favor, preencha o Título, Preço FIPE e Preço Repasse antes de gerar com IA.');
      return;
    }
    setGeneratingObs(true);
    const obsText = await gerarObservacoesIA({
      titulo: formData.titulo,
      marca: formData.marca || 'Veículo',
      modelo: formData.modelo || 'Repasse',
      ano: formData.ano || '2020',
      km: formData.km,
      cor: formData.cor,
      combustivel: formData.combustivel,
      cambio: formData.cambio,
      preco_fipe: formData.preco_fipe,
      preco_repasse: formData.preco_repasse,
    });
    setFormData(prev => ({ ...prev, observacoes_repasse: obsText }));
    setGeneratingObs(false);
  };

  const handleGenerateDescIA = async () => {
    if (!formData.titulo) {
      alert('Por favor, preencha o Título do Anúncio antes de gerar a descrição com IA.');
      return;
    }
    setGeneratingDesc(true);
    const descText = await gerarDescricaoIA({
      titulo: formData.titulo,
      marca: formData.marca || 'Veículo',
      modelo: formData.modelo || 'Repasse',
      ano: formData.ano || '2020',
      km: formData.km,
      cor: formData.cor,
      combustivel: formData.combustivel,
      cambio: formData.cambio,
      preco_fipe: formData.preco_fipe,
      preco_repasse: formData.preco_repasse,
    });
    setFormData(prev => ({ ...prev, descricao: descText }));
    setGeneratingDesc(false);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploadingPhotos) return;
    setSaving(true);
    setFormError('');

    const fotosArr = [...formData.fotosList];

    if (fotosArr.length === 0) {
      fotosArr.push('https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80');
    }

    const payload = {
      titulo: formData.titulo.trim(),
      marca: formData.marca.trim(),
      modelo: formData.modelo.trim(),
      ano: formData.ano.trim(),
      km: Number(formData.km),
      cor: formData.cor.trim(),
      combustivel: formData.combustivel,
      cambio: formData.cambio,
      placa_final: formData.placa_final.trim(),
      preco_fipe: Number(formData.preco_fipe),
      preco_repasse: Number(formData.preco_repasse),
      preco_lojista: formData.preco_lojista ? Number(formData.preco_lojista) : undefined,
      fotos: fotosArr,
      descricao: formData.descricao.trim(),
      observacoes_repasse: formData.observacoes_repasse.trim(),
      destaque: formData.destaque,
      status: formData.status,
    };

    let res: { ok: boolean; error?: string };

    if (editingId) {
      res = await atualizarVeiculoRepasse(editingId, payload);
    } else {
      res = await cadastrarVeiculoRepasse(payload);
    }

    setSaving(false);

    if (res.ok) {
      setShowFormModal(false);
      loadVeiculos();
    } else {
      setFormError(res.error || 'Erro ao salvar veículo');
    }
  };

  const handleToggleStatus = async (v: VeiculoRepasse, newStatus: 'disponivel' | 'reservado' | 'vendido') => {
    const res = await atualizarStatusVeiculoRepasse(v.id, newStatus);
    if (res.ok) {
      loadVeiculos();
    } else {
      alert(`Erro ao alterar status: ${res.error}`);
    }
  };

  const handleDeleteVeiculo = async (v: VeiculoRepasse) => {
    if (!window.confirm(`Tem certeza que deseja excluir o veículo "${v.titulo}"?`)) return;

    const res = await excluirVeiculoRepasse(v.id);
    if (res.ok) {
      loadVeiculos();
    } else {
      alert(`Erro ao excluir veículo: ${res.error}`);
    }
  };

  const handleDeleteLead = async (leadId: number | string) => {
    if (!window.confirm('Tem certeza que deseja remover este registro de lead?')) return;
    const res = await excluirLeadRepasse(leadId);
    if (res.ok) {
      loadLeads();
    } else {
      alert(`Erro ao excluir lead: ${res.error}`);
    }
  };

  const handleAbrirRespostaModal = (proposta: PropostaRepasse, type: 'aceitar' | 'recusar' | 'contraproposta') => {
    setSelectedPropostaAction(proposta);
    setActionModalType(type);
    setValorContrapropostaInput(String(proposta.valor_proposta));
    if (type === 'aceitar') {
      setRespostaManosInput('Sua proposta foi aceita! Vamos dar andamento pelo WhatsApp.');
    } else if (type === 'recusar') {
      setRespostaManosInput('Infelizmente não conseguimos chegar neste valor para o veículo no momento.');
    } else {
      setRespostaManosInput('Conseguimos fechar neste valor diferenciado para você!');
    }
  };

  const handleResponderPropostaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropostaAction || !actionModalType) return;

    setActionLoading(true);
    let finalStatus: PropostaRepasse['status'] = 'pendente';
    let valContra: number | undefined = undefined;

    if (actionModalType === 'aceitar') {
      finalStatus = 'aceita';
    } else if (actionModalType === 'recusar') {
      finalStatus = 'recusada';
    } else if (actionModalType === 'contraproposta') {
      finalStatus = 'contraproposta';
      valContra = parseFloat(valorContrapropostaInput.replace(/\D/g, '')) || 0;
    }

    const targetId = selectedPropostaAction.id;
    const targetResposta = respostaManosInput.trim();

    // Atualiza otimisticamente a interface
    setPropostas(prev => prev.map(p => {
      if (String(p.id) === String(targetId)) {
        return {
          ...p,
          status: finalStatus,
          valor_contraproposta: valContra,
          resposta_manos: targetResposta,
          updated_at: new Date().toISOString()
        };
      }
      return p;
    }));

    const res = await responderPropostaAdmin(
      targetId,
      finalStatus,
      valContra,
      targetResposta
    );

    setActionLoading(false);
    setActionModalType(null);
    setSelectedPropostaAction(null);

    if (res.ok) {
      loadPropostas();
    } else {
      alert('Erro ao responder proposta.');
    }
  };

  const handleDeleteProposta = async (id: number | string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta proposta?')) return;
    const res = await excluirProposta(id);
    if (res.ok) {
      loadPropostas();
    } else {
      alert(`Erro ao excluir proposta: ${res.error}`);
    }
  };

  const veiculosFiltrados = veiculos.filter(v =>
    v.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.modelo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const repassadoresFiltrados = repassadores.filter(r => {
    const matchText =
      r.nome_completo.toLowerCase().includes(searchRepassadores.toLowerCase()) ||
      r.nome_loja.toLowerCase().includes(searchRepassadores.toLowerCase()) ||
      r.cpf_cnpj.includes(searchRepassadores) ||
      r.telefone.includes(searchRepassadores);
    const matchStatus = filterRepassadorStatus === 'todos' || r.status === filterRepassadorStatus;
    return matchText && matchStatus;
  });

  const repassadoresPendentesCount = repassadores.filter(r => r.status === 'pendente').length;

  // PASSWORD GATE
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-manos-red/15 rounded-full blur-[140px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#121216] border border-white/15 rounded-3xl p-8 space-y-6 shadow-2xl relative z-10 text-center"
        >
          <div className="space-y-3">
            <img src={LOGO} alt="DG Automóveis" className="h-10 w-auto mx-auto object-contain" />
            <div className="w-14 h-14 bg-manos-red/10 border border-manos-red/30 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-manos-red" />
            </div>
            <h1 className="text-2xl font-black uppercase italic tracking-tight">
              Área Admin <span className="text-manos-red">Repasses</span>
            </h1>
            <p className="text-xs text-white/50">
              Acesso exclusivo para administradores DG Automóveis
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-white/70">Senha de Acesso</label>
              <input
                type="password"
                autoFocus
                className="w-full py-4 px-5 bg-white/5 border border-white/15 rounded-xl text-white outline-none focus:border-manos-red text-center tracking-widest text-lg"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
              />
            </div>

            {passwordError && (
              <p className="text-xs text-red-400 font-bold text-center">{passwordError}</p>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-manos-red hover:bg-red-600 text-white font-black text-sm uppercase rounded-xl shadow-xl shadow-manos-red/30 active:scale-95 transition-all cursor-pointer"
            >
              Entrar no Painel Admin
            </button>

            <a
              href="/repasse"
              className="block text-center text-xs text-white/40 hover:text-white pt-2 transition-colors"
            >
              &larr; Voltar para o Portal de Repasses
            </a>
          </form>
        </motion.div>
      </div>
    );
  }

  // MAIN ADMIN DASHBOARD
  return (
    <div className="min-h-screen bg-[#09090B] text-white font-sans selection:bg-manos-red selection:text-white">
      
      {/* HEADER ADMIN */}
      <header className="sticky top-0 z-40 bg-[#09090B]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/repasse" title="Ver site público">
              <img src={LOGO} alt="DG Automóveis" className="h-8 sm:h-10 w-auto object-contain" />
            </a>
            <div className="flex items-center gap-2 px-3 py-1 bg-manos-red/10 border border-manos-red/30 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-manos-red" />
              <span className="text-xs font-black text-manos-red uppercase tracking-wider">Painel Admin Repasse</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/repasse"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Ver Portal Lojistas</span>
            </a>

            <a
              href="/repasse-publico"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Ver Repasse Público</span>
            </a>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        
        {/* TAB CONTROLS & ADD BUTTON */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121216] border border-white/10 p-2 sm:p-3 rounded-2xl">
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('repassadores')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'repassadores'
                  ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4 text-amber-400" />
              Lojistas & Repassadores ({repassadores.length})
              {repassadoresPendentesCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-black text-[10px] font-black rounded-full animate-pulse">
                  {repassadoresPendentesCount} Pendentes
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('estoque')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'estoque'
                  ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Car className="w-4 h-4" />
              Estoque de Repasse ({veiculos.length})
            </button>

            <button
              onClick={() => setActiveTab('propostas')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'propostas'
                  ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Handshake className="w-4 h-4 text-cyan-400" />
              Propostas Lojistas ({propostas.length})
              {propostas.filter(p => p.status === 'pendente').length > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-black text-[10px] font-black rounded-full">
                  {propostas.filter(p => p.status === 'pendente').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('leads')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              Leads Repasse ({leads.length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={loadData}
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 hover:text-white transition-all cursor-pointer"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${(loadingVeiculos || loadingLeads || loadingRepassadores || loadingPropostas) ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Veículo
            </button>
          </div>

        </div>

        {/* TAB 1: GESTÃO DE LOJISTAS E REPASSADORES (APROVAÇÃO MANUAL) */}
        {activeTab === 'repassadores' && (
          <div className="space-y-4">
            
            {/* Filters */}
            <div className="p-4 bg-[#121216] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por nome, loja, CPF/CNPJ ou telefone..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xs text-white placeholder-white/40 outline-none focus:border-manos-red"
                  value={searchRepassadores}
                  onChange={e => setSearchRepassadores(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-white/40" />
                <select
                  className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white outline-none cursor-pointer font-bold"
                  value={filterRepassadorStatus}
                  onChange={e => setFilterRepassadorStatus(e.target.value as any)}
                >
                  <option value="todos" className="bg-zinc-900">Todos os Status ({repassadores.length})</option>
                  <option value="pendente" className="bg-zinc-900">Pendentes de Aprovação ({repassadores.filter(r => r.status === 'pendente').length})</option>
                  <option value="ativo" className="bg-zinc-900">Aprovados / Ativos ({repassadores.filter(r => r.status === 'ativo').length})</option>
                  <option value="bloqueado" className="bg-zinc-900">Bloqueados ({repassadores.filter(r => r.status === 'bloqueado').length})</option>
                </select>
              </div>
            </div>

            {loadingRepassadores ? (
              <div className="text-center py-20 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-manos-red mx-auto" />
                <p className="text-xs text-white/50">Carregando lista de repassadores...</p>
              </div>
            ) : repassadoresFiltrados.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Building2 className="w-10 h-10 text-white/20 mx-auto" />
                <p className="text-sm font-bold text-white/70">Nenhum lojista encontrado com os filtros selecionados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {repassadoresFiltrados.map(r => (
                  <div
                    key={r.id}
                    className={`p-5 rounded-3xl border transition-all space-y-4 ${
                      r.status === 'pendente'
                        ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-500/5'
                        : r.status === 'ativo'
                        ? 'bg-[#121216] border-emerald-500/30'
                        : 'bg-zinc-900/50 border-red-500/30 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-white">{r.nome_completo}</h3>
                          {r.status === 'pendente' && (
                            <span className="px-2.5 py-0.5 bg-amber-500 text-black text-[10px] font-black uppercase rounded-full animate-pulse">
                              Aprovação Pendente
                            </span>
                          )}
                          {r.status === 'ativo' && (
                            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase rounded-full">
                              Aprovado / Ativo
                            </span>
                          )}
                          {r.status === 'bloqueado' && (
                            <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black uppercase rounded-full">
                              Bloqueado
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-amber-400">{r.nome_loja} • {r.cidade || 'Cidade não informada'}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteRepassador(r)}
                        className="p-2 text-white/40 hover:text-red-400 transition-colors"
                        title="Excluir cadastro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-white/70 bg-black/40 p-3 rounded-xl border border-white/5">
                      <div>
                        <span className="text-white/40 block text-[10px]">CPF / CNPJ:</span>
                        <strong className="text-white">{r.cpf_cnpj}</strong>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[10px]">WhatsApp:</span>
                        <strong className="text-white">{r.telefone}</strong>
                      </div>
                    </div>

                    {/* Botões de Aprovação Manual em 1 Clique */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        {r.status !== 'ativo' && (
                          <button
                            onClick={() => handleToggleRepassadorStatus(r, 'ativo')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <UserCheck className="w-4 h-4" />
                            Aprovar Acesso
                          </button>
                        )}

                        {r.status !== 'bloqueado' && (
                          <button
                            onClick={() => handleToggleRepassadorStatus(r, 'bloqueado')}
                            className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold text-xs uppercase rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <UserX className="w-4 h-4" />
                            Bloquear
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => handleNotificarRepassadorWhatsApp(r)}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        Notificar Whats
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* TAB 2: ESTOQUE DE REPASSE */}
        {activeTab === 'estoque' && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Filtrar por nome, marca ou modelo..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-white/40 focus:border-manos-red outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {loadingVeiculos ? (
              <div className="text-center py-20 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-manos-red mx-auto" />
                <p className="text-xs text-white/50">Carregando estoque de repasse...</p>
              </div>
            ) : veiculosFiltrados.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Car className="w-10 h-10 text-white/20 mx-auto" />
                <p className="text-sm font-bold text-white/70">Nenhum veículo encontrado</p>
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl"
                >
                  Cadastrar Primeiro Veículo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {veiculosFiltrados.map(v => {
                  const economia = v.preco_fipe - v.preco_repasse;
                  const pctDesconto = Math.round((economia / v.preco_fipe) * 100);

                  return (
                    <div
                      key={v.id}
                      className="bg-[#121216] border border-white/10 rounded-3xl overflow-hidden flex flex-col justify-between"
                    >
                      <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden">
                        <img
                          src={v.fotos[0] || 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80'}
                          alt={v.titulo}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                        <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                          -{pctDesconto}% FIPE
                        </div>

                        <div className="absolute top-3 right-3">
                          {v.status === 'disponivel' && (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md">
                              Disponível
                            </span>
                          )}
                          {v.status === 'reservado' && (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md">
                              Reservado
                            </span>
                          )}
                          {v.status === 'vendido' && (
                            <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md">
                              Vendido
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-4 flex-grow flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-white/50 uppercase">
                            {v.marca} • {v.ano} • {v.km.toLocaleString('pt-BR')} km
                          </p>
                          <h3 className="font-black uppercase italic text-base text-white line-clamp-2">
                            {v.titulo}
                          </h3>
                          <p className="text-xs text-white/60 line-clamp-2 italic border-l-2 border-amber-500/40 pl-2">
                            {v.observacoes_repasse}
                          </p>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-white/10">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/50">FIPE: {formatBRL(v.preco_fipe)}</span>
                            <span className="font-extrabold text-emerald-400">Repasse: {formatBRL(v.preco_repasse)}</span>
                          </div>
                          {v.preco_lojista && (
                            <div className="flex justify-between text-xs font-bold text-amber-400">
                              <span>Atacado Lojista:</span>
                              <span>{formatBRL(v.preco_lojista)}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                              onClick={() => handleOpenEditModal(v)}
                              className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1.5"
                            >
                              <Edit className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button
                              onClick={() => handleDeleteVeiculo(v)}
                              className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROPOSTAS DE LOJISTAS */}
        {activeTab === 'propostas' && (
          <div className="space-y-4">
            {loadingPropostas ? (
              <div className="text-center py-20 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-manos-red mx-auto" />
                <p className="text-xs text-white/50">Carregando propostas de lojistas...</p>
              </div>
            ) : propostas.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Handshake className="w-10 h-10 text-white/20 mx-auto" />
                <p className="text-sm font-bold text-white/70">Nenhuma proposta recebida até o momento</p>
              </div>
            ) : (
              <div className="space-y-4">
                {propostas.map(p => (
                  <div key={p.id} className="p-5 bg-[#121216] border border-white/10 rounded-3xl space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-amber-400">Lojista: {p.repassador_loja} ({p.repassador_nome})</span>
                        <h4 className="font-extrabold text-base text-white">{p.veiculo_titulo}</h4>
                        <p className="text-xs text-white/50">WhatsApp: {p.repassador_telefone} • Cidade: {p.repassador_cidade || 'N/I'}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                          p.status === 'aceita' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                          p.status === 'recusada' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                          p.status === 'contraproposta' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                          'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}>
                          {p.status}
                        </span>
                        <button
                          onClick={() => handleDeleteProposta(p.id)}
                          className="p-1.5 text-white/40 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-black/40 p-3 rounded-2xl border border-white/5">
                      <div>
                        <span className="text-white/40 block">Valor Anunciado:</span>
                        <strong className="text-white">{formatBRL(p.valor_veiculo)}</strong>
                      </div>
                      <div>
                        <span className="text-white/40 block">Proposta do Lojista:</span>
                        <strong className="text-emerald-400 text-sm">{formatBRL(p.valor_proposta)}</strong>
                      </div>
                      <div>
                        <span className="text-white/40 block">Diferença / Margem:</span>
                        <strong className="text-amber-400">{formatBRL(p.valor_veiculo - p.valor_proposta)}</strong>
                      </div>
                    </div>

                    {p.mensagem_lojista && (
                      <p className="text-xs text-white/80 italic border-l-2 border-amber-500/40 pl-3 py-1">
                        "{p.mensagem_lojista}"
                      </p>
                    )}

                    {/* Resposta do Admin */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAbrirRespostaModal(p, 'aceitar')}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" /> Aceitar Proposta
                        </button>
                        <button
                          onClick={() => handleAbrirRespostaModal(p, 'contraproposta')}
                          className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs uppercase rounded-xl flex items-center gap-1.5"
                        >
                          <Handshake className="w-4 h-4" /> Contraproposta
                        </button>
                        <button
                          onClick={() => handleAbrirRespostaModal(p, 'recusar')}
                          className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold text-xs uppercase rounded-xl flex items-center gap-1.5"
                        >
                          <X className="w-4 h-4" /> Recusar
                        </button>
                      </div>

                      <a
                        href={`https://wa.me/55${rClean(p.repassador_telefone)}?text=${encodeURIComponent(`Olá ${p.repassador_nome} (${p.repassador_loja}), referente à sua proposta no ${p.veiculo_titulo}...`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        Responder no Whats
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LEADS */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            {loadingLeads ? (
              <div className="text-center py-20 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-manos-red mx-auto" />
                <p className="text-xs text-white/50">Carregando leads de repasse...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <MessageCircle className="w-10 h-10 text-white/20 mx-auto" />
                <p className="text-sm font-bold text-white/70">Nenhum lead registrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map(l => (
                  <div key={l.id} className="p-4 bg-[#121216] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-white font-bold">{l.nome}</strong>
                        <span className="text-xs text-amber-400 font-bold">({l.cidade})</span>
                      </div>
                      <p className="text-xs text-white/50">WhatsApp: {l.telefone} • {new Date(l.created_at).toLocaleString('pt-BR')}</p>
                      {l.veiculo_titulo && (
                        <p className="text-xs text-emerald-400 font-bold mt-1">Interesse: {l.veiculo_titulo} ({formatBRL(l.valor_repasse || 0)})</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/55${l.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${l.nome}! Vi seu interesse no repasse ${l.veiculo_titulo || ''} na DG Automóveis...`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                      <button
                        onClick={() => handleDeleteLead(l.id)}
                        className="p-2 text-white/40 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* MODAL CADASTRAR / EDITAR VEÍCULO */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFormModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl bg-[#121216] border border-white/15 text-white rounded-3xl overflow-hidden shadow-2xl z-10 my-auto max-h-[90vh] flex flex-col"
            >
              <div className="p-4 sm:p-6 bg-[#09090B] border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <h3 className="font-black uppercase italic text-base sm:text-lg">
                  {editingId ? 'Editar Veículo de Repasse' : 'Cadastrar Novo Veículo de Repasse'}
                </h3>
                <button onClick={() => setShowFormModal(false)} className="p-2 text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-white/70 block mb-1">Título Completo do Anúncio</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Volkswagen Gol 1.6 MSI TotalFlex"
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red"
                      value={formData.titulo}
                      onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-white/70 block mb-1">Placa Final</label>
                    <input
                      type="text"
                      placeholder="Ex: 7"
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red"
                      value={formData.placa_final}
                      onChange={e => setFormData({ ...formData, placa_final: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="font-bold text-white/70 block mb-1">Marca</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Volkswagen"
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red"
                      value={formData.marca}
                      onChange={e => setFormData({ ...formData, marca: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-white/70 block mb-1">Modelo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Gol"
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red"
                      value={formData.modelo}
                      onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-white/70 block mb-1">Ano / Modelo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 2019/2020"
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red"
                      value={formData.ano}
                      onChange={e => setFormData({ ...formData, ano: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-white/70 block mb-1">Quilometragem (KM)</label>
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red"
                      value={formData.km}
                      onChange={e => setFormData({ ...formData, km: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-white/70 block mb-1">Preço Tabela FIPE (R$)</label>
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red text-sm font-bold text-white"
                      value={formData.preco_fipe}
                      onChange={e => setFormData({ ...formData, preco_fipe: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-white/70 block mb-1">Preço Repasse Público (R$)</label>
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-emerald-400 outline-none focus:border-manos-red text-sm font-bold"
                      value={formData.preco_repasse}
                      onChange={e => setFormData({ ...formData, preco_repasse: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-white/70 block mb-1">Preço Atacado Lojista (R$)</label>
                    <input
                      type="number"
                      placeholder="Preço exclusivo lojista"
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-amber-400 outline-none focus:border-manos-red text-sm font-bold"
                      value={formData.preco_lojista || ''}
                      onChange={e => setFormData({ ...formData, preco_lojista: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Upload de Fotos */}
                <div className="space-y-2">
                  <label className="font-bold text-white/70 block">Fotos do Veículo ({formData.fotosList.length})</label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl cursor-pointer text-xs font-bold flex items-center gap-2 transition-all">
                      <Upload className="w-4 h-4 text-emerald-400" />
                      <span>{uploadingPhotos ? 'Enviando fotos...' : 'Upload de Imagens'}</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploadingPhotos} />
                    </label>
                  </div>

                  {formData.fotosList.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
                      {formData.fotosList.map((url, idx) => (
                        <div key={idx} className="relative aspect-[16/10] bg-zinc-800 rounded-xl overflow-hidden group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-white/70 block">Observações de Repasse (Vendas no Estado)</label>
                    <button
                      type="button"
                      onClick={handleGenerateObsIA}
                      disabled={generatingObs}
                      className="text-amber-400 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> {generatingObs ? 'Gerando com IA...' : 'Gerar Observação com IA'}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Descreva detalhes estéticos, mecânicos ou observações transparentes de repasse..."
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red"
                    value={formData.observacoes_repasse}
                    onChange={e => setFormData({ ...formData, observacoes_repasse: e.target.value })}
                  />
                </div>

                {formError && (
                  <p className="text-red-400 font-bold text-center">{formError}</p>
                )}

                <button
                  type="submit"
                  disabled={saving || uploadingPhotos}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase rounded-xl shadow-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingId ? 'Atualizar Veículo' : 'Cadastrar Veículo de Repasse'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE RESPOSTA / AÇÃO PARA PROPOSTAS DE LOJISTAS */}
      <AnimatePresence>
        {actionModalType && selectedPropostaAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setActionModalType(null); setSelectedPropostaAction(null); }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-[#121216] border border-white/15 text-white rounded-3xl overflow-hidden shadow-2xl z-10 my-auto p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  {actionModalType === 'aceitar' && (
                    <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-black uppercase flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Aceitar Proposta
                    </div>
                  )}
                  {actionModalType === 'contraproposta' && (
                    <div className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-black uppercase flex items-center gap-1.5">
                      <Handshake className="w-4 h-4" /> Enviar Contraproposta
                    </div>
                  )}
                  {actionModalType === 'recusar' && (
                    <div className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full text-xs font-black uppercase flex items-center gap-1.5">
                      <X className="w-4 h-4" /> Recusar Proposta
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { setActionModalType(null); setSelectedPropostaAction(null); }}
                  className="p-1.5 text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Resumo da Proposta */}
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold">Veículo:</span>
                  <strong className="text-white text-sm font-extrabold">{selectedPropostaAction.veiculo_titulo}</strong>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <div>
                    <span className="text-white/40 block text-[10px] font-bold">Lojista:</span>
                    <strong className="text-amber-400">{selectedPropostaAction.repassador_loja}</strong>
                    <span className="block text-white/60 text-[11px]">{selectedPropostaAction.repassador_nome}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[10px] font-bold">Proposta Recebida:</span>
                    <strong className="text-emerald-400 text-sm font-bold">{formatBRL(selectedPropostaAction.valor_proposta)}</strong>
                    <span className="block text-white/50 text-[10px]">Anunciado: {formatBRL(selectedPropostaAction.valor_veiculo)}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleResponderPropostaSubmit} className="space-y-4 text-xs">
                {actionModalType === 'contraproposta' && (
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 block">Valor da Contraproposta (R$)</label>
                    <input
                      type="text"
                      required
                      className="w-full p-3.5 bg-white/5 border border-amber-500/40 rounded-xl text-amber-300 font-extrabold text-base outline-none focus:border-amber-400"
                      value={valorContrapropostaInput}
                      onChange={e => setValorContrapropostaInput(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-white/80 block">Mensagem de Resposta ao Lojista</label>
                  <textarea
                    rows={3}
                    required
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-manos-red"
                    value={respostaManosInput}
                    onChange={e => setRespostaManosInput(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className={`w-full py-3.5 font-black text-xs uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      actionModalType === 'aceitar' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
                      actionModalType === 'contraproposta' ? 'bg-amber-500 hover:bg-amber-400 text-black' :
                      'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>
                          {actionModalType === 'aceitar' && 'Confirmar e Aceitar Proposta'}
                          {actionModalType === 'contraproposta' && 'Enviar Contraproposta'}
                          {actionModalType === 'recusar' && 'Confirmar Recusa'}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActionModalType(null); setSelectedPropostaAction(null); }}
                    className="w-full sm:w-auto px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function rClean(val: string): string {
  return val.replace(/\D/g, '');
}
