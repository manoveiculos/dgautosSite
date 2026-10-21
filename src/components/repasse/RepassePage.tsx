import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Search, Tag, AlertCircle, CheckCircle2, ShieldCheck, Info,
  ChevronRight, Phone, MessageCircle, ArrowRight, Loader2, RefreshCw,
  Sparkles, Filter, Percent, Banknote, X, ChevronLeft, Building2, HelpCircle,
  Plus, Check, ExternalLink, ShieldAlert, Lock, Unlock, UserCheck, UserPlus,
  KeyRound, Users, Send, FileText, BadgeDollarSign, Clock, XCircle, Handshake, Eye
} from 'lucide-react';
import {
  fetchVeiculosRepasse,
  enviarLeadRepasse,
  cadastrarRepassador,
  verificarAcessoRepassador,
  cadastrarPropostaLojista,
  fetchPropostasPorTelefone,
  type VeiculoRepasse,
  type Repassador,
  type PropostaRepasse
} from '../../services/repasseService';
import { SiteShell } from '../ManosUI';
import { novoLeadId } from '../../lib/leads';
import { trackFunnelStart, trackLead } from '../../lib/tracking';

const WHATSAPP_NUM = '5547989169598';

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCpfCnpj(val: string): string {
  let r = val.replace(/\D/g, '');
  if (r.length > 14) r = r.substring(0, 14);
  if (r.length > 11) {
    return r.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
  }
  if (r.length > 9) {
    return r.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/, '$1.$2.$3-$4');
  }
  if (r.length > 6) {
    return r.replace(/^(\d{3})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
  }
  if (r.length > 3) {
    return r.replace(/^(\d{3})(\d{0,3}).*/, '$1.$2');
  }
  return r;
}

function formatPhone(val: string): string {
  let r = val.replace(/\D/g, '');
  if (r.length > 11) r = r.substring(0, 11);
  if (r.length > 10) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (r.length > 6) return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  if (r.length > 2) return r.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (r.length > 0) return '(' + r;
  return r;
}

export default function RepassePage() {
  const [veiculos, setVeiculos] = useState<VeiculoRepasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [marcaFilter, setMarcaFilter] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<'maior_desconto' | 'menor_preco'>('maior_desconto');

  // Modal de Detalhes / Envio de Proposta
  const [selectedVeiculo, setSelectedVeiculo] = useState<VeiculoRepasse | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Form State Lead
  const [leadId] = useState(novoLeadId);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [proposta, setProposta] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sessão do Lojista Autenticado
  const LOJISTA_SESSION_KEY = 'manos_repasse_lojista_session_v1';
  const [activeLojista, setActiveLojista] = useState<Repassador | null>(() => {
    try {
      const raw = localStorage.getItem(LOJISTA_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [lojistaTab, setLojistaTab] = useState<'login' | 'cadastro'>('login');
  const [pendingNotice, setPendingNotice] = useState(false);

  // Form Lojista Login State
  const [loginTelefone, setLoginTelefone] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Form Lojista Cadastro State
  const [cadNome, setCadNome] = useState('');
  const [cadCpfCnpj, setCadCpfCnpj] = useState('');
  const [cadLoja, setCadLoja] = useState('');
  const [cadCidade, setCadCidade] = useState('');
  const [cadTelefone, setCadTelefone] = useState('');
  const [cadLoading, setCadLoading] = useState(false);
  const [cadError, setCadError] = useState('');
  const [cadSuccess, setCadSuccess] = useState(false);

  // Propostas de Lojistas State
  const [propostasLojista, setPropostasLojista] = useState<PropostaRepasse[]>([]);
  const [showMinhasPropostasModal, setShowMinhasPropostasModal] = useState(false);
  const [showPropostaModal, setShowPropostaModal] = useState(false);
  const [selectedVeiculoProposta, setSelectedVeiculoProposta] = useState<VeiculoRepasse | null>(null);
  const [valorPropostaInput, setValorPropostaInput] = useState('');
  const [mensagemPropostaInput, setMensagemPropostaInput] = useState('');
  const [propostaLoading, setPropostaLoading] = useState(false);
  const [propostaSuccess, setPropostaSuccess] = useState(false);
  const [propostaError, setPropostaError] = useState('');

  const loadPropostasLojista = async (tel?: string) => {
    const phoneToUse = tel || activeLojista?.telefone;
    if (!phoneToUse) return;
    const list = await fetchPropostasPorTelefone(phoneToUse);
    setPropostasLojista(list);
  };

  useEffect(() => {
    trackFunnelStart('Compra');
    if (activeLojista && activeLojista.status === 'ativo') {
      loadVeiculos();
      setNome(activeLojista.nome_completo);
      setTelefone(formatPhone(activeLojista.telefone));
      if (activeLojista.cidade) setCidade(activeLojista.cidade);
      loadPropostasLojista(activeLojista.telefone);
    } else {
      setLoading(false);
    }
  }, []);

  const handleLojistaLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setPendingNotice(false);
    const rawTel = loginTelefone.replace(/\D/g, '');
    if (rawTel.length < 10) {
      setLoginError('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }

    setLoginLoading(true);
    const res = await verificarAcessoRepassador(rawTel);
    setLoginLoading(false);

    if (res.ok && res.status === 'ativo' && res.repassador) {
      setActiveLojista(res.repassador);
      try {
        localStorage.setItem(LOJISTA_SESSION_KEY, JSON.stringify(res.repassador));
      } catch {}
      setNome(res.repassador.nome_completo);
      setTelefone(formatPhone(res.repassador.telefone));
      if (res.repassador.cidade) setCidade(res.repassador.cidade);
      loadVeiculos();
      loadPropostasLojista(res.repassador.telefone);
    } else if (res.status === 'pendente') {
      setPendingNotice(true);
      setLoginError('Seu cadastro foi recebido e está aguardando aprovação manual da equipe DG Automóveis. Você receberá uma notificação no WhatsApp assim que aprovado.');
    } else if (res.status === 'bloqueado') {
      setLoginError('Acesso suspenso pelo administrador. Entre em contato conosco pelo WhatsApp.');
    } else {
      setLoginError('Telefone não encontrado no cadastro de lojistas. Faça seu cadastro rápido abaixo!');
      setCadTelefone(loginTelefone);
      setLojistaTab('cadastro');
    }
  };

  const handleLojistaCadastroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCadError('');
    setCadSuccess(false);

    if (cadNome.trim().length < 3) {
      setCadError('Por favor, informe seu nome completo.');
      return;
    }
    const cleanDoc = cadCpfCnpj.replace(/\D/g, '');
    if (cleanDoc.length < 11) {
      setCadError('Por favor, informe um CPF ou CNPJ válido.');
      return;
    }
    if (cadLoja.trim().length < 2) {
      setCadError('Por favor, informe o nome da loja ou empresa de repasse.');
      return;
    }
    if (cadCidade.trim().length < 2) {
      setCadError('Por favor, informe sua cidade e UF.');
      return;
    }
    const cleanTel = cadTelefone.replace(/\D/g, '');
    if (cleanTel.length < 10) {
      setCadError('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }

    setCadLoading(true);

    const res = await cadastrarRepassador({
      nome_completo: cadNome.trim(),
      cpf_cnpj: cadCpfCnpj.trim(),
      nome_loja: cadLoja.trim(),
      cidade: cadCidade.trim(),
      telefone: cleanTel,
      status: 'pendente',
    });

    setCadLoading(false);

    if (res.ok && res.data) {
      setCadSuccess(true);
      setPendingNotice(true);
    } else {
      setCadError(res.error || 'Erro ao realizar cadastro.');
    }
  };

  const handleLogoutLojista = () => {
    setActiveLojista(null);
    setPropostasLojista([]);
    setVeiculos([]);
    try {
      localStorage.removeItem(LOJISTA_SESSION_KEY);
    } catch {}
  };

  const handleAbrirModalProposta = (veiculo: VeiculoRepasse) => {
    if (!activeLojista || activeLojista.status !== 'ativo') return;
    setSelectedVeiculoProposta(veiculo);
    const defaultPrice = veiculo.preco_lojista || veiculo.preco_repasse;
    setValorPropostaInput(String(defaultPrice));
    setMensagemPropostaInput('');
    setPropostaError('');
    setPropostaSuccess(false);
    setShowPropostaModal(true);
  };

  const handleEnviarPropostaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLojista || !selectedVeiculoProposta) return;

    setPropostaError('');
    const rawVal = parseFloat(valorPropostaInput.replace(/\D/g, '')) || 0;
    if (!rawVal || rawVal <= 0) {
      setPropostaError('Por favor, informe um valor de proposta válido.');
      return;
    }

    setPropostaLoading(true);
    const basePrice = selectedVeiculoProposta.preco_lojista || selectedVeiculoProposta.preco_repasse;

    const res = await cadastrarPropostaLojista({
      repassador_id: activeLojista.id,
      repassador_nome: activeLojista.nome_completo,
      repassador_telefone: activeLojista.telefone,
      repassador_loja: activeLojista.nome_loja,
      repassador_cidade: activeLojista.cidade,
      veiculo_id: selectedVeiculoProposta.id,
      veiculo_titulo: selectedVeiculoProposta.titulo,
      valor_veiculo: basePrice,
      valor_proposta: rawVal,
      mensagem_lojista: mensagemPropostaInput.trim(),
    });

    setPropostaLoading(false);

    if (res.ok) {
      setPropostaSuccess(true);
      loadPropostasLojista();
    } else {
      setPropostaError('Não foi possível registrar sua proposta. Tente novamente.');
    }
  };

  const loadVeiculos = async () => {
    setLoading(true);
    const data = await fetchVeiculosRepasse();
    setVeiculos(data);
    setLoading(false);
  };

  const marcasDisponiveis = Array.from(new Set(veiculos.map(v => v.marca))).sort();

  const veiculosFiltrados = veiculos
    .filter(v => {
      const matchSearch =
        v.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.modelo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchMarca = marcaFilter === 'todos' || v.marca === marcaFilter;
      return matchSearch && matchMarca;
    })
    .sort((a, b) => {
      if (ordenacao === 'maior_desconto') {
        const descA = a.preco_fipe - (a.preco_lojista || a.preco_repasse);
        const descB = b.preco_fipe - (b.preco_lojista || b.preco_repasse);
        return descB - descA;
      }
      const priceA = a.preco_lojista || a.preco_repasse;
      const priceB = b.preco_lojista || b.preco_repasse;
      return priceA - priceB;
    });

  const handleOpenDetail = (v: VeiculoRepasse) => {
    setSelectedVeiculo(v);
    setActivePhotoIdx(0);
    setSuccess(false);
    setErrorMsg('');
  };

  const openWhatsAppDirect = (v?: VeiculoRepasse) => {
    const lojistaPrefix = activeLojista ? `Olá! Sou da loja ${activeLojista.nome_loja} (Lojista Credenciado). ` : `Olá! `;
    const priceText = (v && v.preco_lojista)
      ? `Preço Lojista: ${formatBRL(v.preco_lojista)}`
      : v ? `Preço Repasse: ${formatBRL(v.preco_repasse)}` : '';
    const txt = v
      ? `${lojistaPrefix}Tenho interesse no repasse de lojista do veículo ${v.titulo} (FIPE: ${formatBRL(v.preco_fipe)}${priceText ? ` | ${priceText}` : ''}). Gostaria de negociar.`
      : `${lojistaPrefix}Vim pelo Portal de Lojistas da DG Automóveis e gostaria de ver os repasses disponíveis.`;
    window.open(`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(txt)}`, '_blank');
  };

  return (
    <SiteShell title="Portal Lojistas & Repassadores" showTrustCards={false}>
      <div className="space-y-8 lg:space-y-12">
        
        {/* HERO SECTION PORTAL LOJISTA */}
        <section className="bg-[#0B1120] text-[#FFFFFF] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden border border-[#38BDF8]/20">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
              src="/fachada-dg.png" 
              alt="Fachada DG Automóveis" 
              className="w-full h-full object-cover opacity-25 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1120] via-[#0B1120]/90 to-[#0B1120]/70" />
          </div>

          <div className="relative z-10 max-w-4xl space-y-6">
            
            {/* Top Badges & Public Repasse Link */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-xs font-bold text-amber-300">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Portal Exclusivo para Lojistas & Repassadores</span>
              </div>

              <a
                href="/repasse-publico"
                className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-bold text-white transition-all"
              >
                <span>Procurando para uso próprio? Ver Repasse Público &rarr;</span>
              </a>
            </div>

            {/* Title */}
            <div className="space-y-3">
              <h1 className="font-serif font-extrabold text-2xl sm:text-4xl lg:text-5xl text-white leading-tight">
                Estoque de Repasse com <span className="text-[#38BDF8]">Preços de Atacado</span>
              </h1>
              <p className="text-sm sm:text-base text-[#E2E8F0]/90 max-w-2xl leading-relaxed">
                Acesso restrito para revendedores credenciados. <strong className="text-white">Giro rápido com margens diferenciadas abaixo da Tabela FIPE.</strong>
              </p>
            </div>

            {/* LOGGED IN LOJISTA BAR OR AUTH GATEWAY */}
            {activeLojista && activeLojista.status === 'ativo' ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 flex-shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-black uppercase text-emerald-400 tracking-wider">
                          🔓 Cadastro Aprovado · {activeLojista.nome_loja}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-500/30 text-white text-[10px] font-black uppercase rounded-md">
                          Preços Lojista Liberados
                        </span>
                      </div>
                      <p className="text-xs text-[#E2E8F0]/90">
                        Bem-vindo, <strong className="text-white">{activeLojista.nome_completo}</strong> ({activeLojista.cidade || 'Lojista Credenciado'}).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        loadPropostasLojista();
                        setShowMinhasPropostasModal(true);
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      Propostas ({propostasLojista.length})
                    </button>
                    <button
                      onClick={handleLogoutLojista}
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      Sair
                    </button>
                  </div>
                </div>

                {/* WhatsApp VIP Community Banner */}
                <div className="p-4 bg-[#060B14] border border-[#38BDF8]/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-white">Grupo VIP de Lojistas no WhatsApp</h4>
                      <p className="text-xs text-[#E2E8F0]/80">Receba novas ofertas de repasse antes de entrarem no site!</p>
                    </div>
                  </div>
                  <a
                    href="https://chat.whatsapp.com/Cy0yyao3XDiBeHcNxiz5WT"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-2 transition-all shadow-md whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    Entrar no Grupo VIP
                  </a>
                </div>
              </div>
            ) : (
              /* UNAUTHENTICATED / PENDING GATEWAY CARD */
              <div className="bg-[#060B14] border border-[#38BDF8]/30 rounded-3xl p-6 space-y-6">
                
                {/* Tabs Login vs Cadastro */}
                <div className="flex items-center gap-2 border-b border-[#38BDF8]/20 pb-4">
                  <button
                    onClick={() => { setLojistaTab('login'); setPendingNotice(false); }}
                    className={`px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                      lojistaTab === 'login'
                        ? 'bg-[#0052FF] text-white shadow-md'
                        : 'text-[#E2E8F0]/60 hover:text-white'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    Já sou Lojista (Entrar)
                  </button>

                  <button
                    onClick={() => { setLojistaTab('cadastro'); setPendingNotice(false); }}
                    className={`px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                      lojistaTab === 'cadastro'
                        ? 'bg-[#0052FF] text-white shadow-md'
                        : 'text-[#E2E8F0]/60 hover:text-white'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    Solicitar Credenciamento
                  </button>
                </div>

                {/* Form TAB LOGIN */}
                {lojistaTab === 'login' && (
                  <form onSubmit={handleLojistaLoginSubmit} className="space-y-4 max-w-md">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#E2E8F0] uppercase">WhatsApp Cadastrado</label>
                      <input
                        type="tel"
                        required
                        placeholder="(47) 99999-9999"
                        className="w-full p-3.5 bg-black/40 border border-[#38BDF8]/40 rounded-xl text-white outline-none focus:border-[#38BDF8] text-sm"
                        value={loginTelefone}
                        onChange={e => setLoginTelefone(formatPhone(e.target.value))}
                      />
                    </div>

                    {loginError && (
                      <div className={`p-3.5 rounded-xl text-xs font-bold flex items-start gap-2 ${
                        pendingNotice
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}>
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full py-3.5 bg-[#0052FF] hover:bg-[#003ECC] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                      <span>Acessar Estoque de Atacado</span>
                    </button>
                  </form>
                )}

                {/* Form TAB CADASTRO */}
                {lojistaTab === 'cadastro' && (
                  <div className="space-y-4 max-w-xl">
                    {cadSuccess ? (
                      <div className="p-6 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-center space-y-3">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                        <h4 className="font-serif font-extrabold text-base text-white">Solicitação de Cadastro Recebida!</h4>
                        <p className="text-xs text-[#E2E8F0]/90 leading-relaxed max-w-md mx-auto">
                          Obrigado pelo seu interesse! Seus dados foram encaminhados para a equipe DG Automóveis. <strong className="text-white">Seu cadastro está em análise e você receberá uma notificação no WhatsApp assim que aprovado.</strong>
                        </p>
                        <div className="pt-2">
                          <button
                            onClick={() => { setLojistaTab('login'); setCadSuccess(false); }}
                            className="px-5 py-2.5 bg-amber-500 text-black font-extrabold text-xs uppercase rounded-xl"
                          >
                            Ir para Login de Lojistas
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleLojistaCadastroSubmit} className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-bold text-[#E2E8F0] block mb-1">Seu Nome Completo</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Carlos Eduardo"
                              className="w-full p-3 bg-black/40 border border-[#38BDF8]/30 rounded-xl text-white outline-none focus:border-[#38BDF8]"
                              value={cadNome}
                              onChange={e => setCadNome(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="font-bold text-[#E2E8F0] block mb-1">CPF ou CNPJ</label>
                            <input
                              type="text"
                              required
                              placeholder="CPF ou CNPJ da Loja"
                              className="w-full p-3 bg-black/40 border border-[#38BDF8]/30 rounded-xl text-white outline-none focus:border-[#38BDF8]"
                              value={cadCpfCnpj}
                              onChange={e => setCadCpfCnpj(formatCpfCnpj(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-bold text-[#E2E8F0] block mb-1">Nome da Loja / Empresa</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Auto Veículos ou Repasse SC"
                              className="w-full p-3 bg-black/40 border border-[#38BDF8]/30 rounded-xl text-white outline-none focus:border-[#38BDF8]"
                              value={cadLoja}
                              onChange={e => setCadLoja(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="font-bold text-[#E2E8F0] block mb-1">Sua Cidade / UF</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Blumenau / SC"
                              className="w-full p-3 bg-black/40 border border-[#38BDF8]/30 rounded-xl text-white outline-none focus:border-[#38BDF8]"
                              value={cadCidade}
                              onChange={e => setCadCidade(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-[#E2E8F0] block mb-1">WhatsApp para Liberação (com DDD)</label>
                          <input
                            type="tel"
                            required
                            placeholder="(47) 99999-9999"
                            className="w-full p-3 bg-black/40 border border-[#38BDF8]/30 rounded-xl text-white outline-none focus:border-[#38BDF8]"
                            value={cadTelefone}
                            onChange={e => setCadTelefone(formatPhone(e.target.value))}
                          />
                        </div>

                        {cadError && (
                          <p className="text-red-400 font-bold text-center">{cadError}</p>
                        )}

                        <button
                          type="submit"
                          disabled={cadLoading}
                          className="w-full py-3.5 bg-[#0052FF] hover:bg-[#003ECC] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {cadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          <span>Enviar Cadastro para Aprovação Manual</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        </section>

        {/* RESTRICTED STOCK GRID (ONLY DISPLAYED FOR APPROVED LOJISTAS) */}
        {activeLojista && activeLojista.status === 'ativo' ? (
          <>
            {/* FILTROS E BUSCA DE ATACADO */}
            <section className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E2E8F0] space-y-4 shadow-xs">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Search Input */}
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#475569] w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por marca, modelo ou versão no atacado..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl py-3 pl-11 pr-4 text-xs sm:text-sm text-[#0B1120] placeholder-[#475569] focus:border-[#0052FF] outline-none transition-all"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0B1120]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-[#475569]" />
                    <select
                      className="w-full sm:w-auto bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl py-2.5 px-3 text-xs text-[#0B1120] focus:border-[#0052FF] outline-none cursor-pointer font-bold"
                      value={marcaFilter}
                      onChange={e => setMarcaFilter(e.target.value)}
                    >
                      <option value="todos">Todas as Marcas ({veiculos.length})</option>
                      {marcasDisponiveis.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <select
                    className="w-full sm:w-auto bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl py-2.5 px-3 text-xs text-[#0B1120] focus:border-[#0052FF] outline-none cursor-pointer font-bold"
                    value={ordenacao}
                    onChange={e => setOrdenacao(e.target.value as any)}
                  >
                    <option value="maior_desconto">Maior Margem Lojista (FIPE)</option>
                    <option value="menor_preco">Menor Preço Atacado</option>
                  </select>
                </div>

              </div>

              <div className="flex items-center justify-between text-xs text-[#475569] pt-2 border-t border-[#E2E8F0]">
                <span>Estoque de Atacado: <strong className="text-[#0B1120]">{veiculosFiltrados.length}</strong> veículos disponíveis</span>
                {loading && <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-[#0052FF]" /> Atualizando...</span>}
              </div>
            </section>

            {/* GRID DE VEÍCULOS DE ATACADO */}
            <section>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-96 bg-[#F1F5F9] rounded-3xl animate-pulse border border-[#E2E8F0]" />
                  ))}
                </div>
              ) : veiculosFiltrados.length === 0 ? (
                <div className="text-center py-16 p-8 bg-white border border-[#E2E8F0] rounded-3xl space-y-4 max-w-xl mx-auto">
                  <Car className="w-12 h-12 text-[#475569] mx-auto" />
                  <h3 className="text-xl font-bold text-[#0B1120]">Nenhum veículo encontrado</h3>
                  <p className="text-xs text-[#475569]">Tente ajustar os filtros de busca.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {veiculosFiltrados.map(v => {
                    const precoFinalLojista = v.preco_lojista || v.preco_repasse;
                    const economiaFipe = v.preco_fipe - precoFinalLojista;
                    const pctDesconto = Math.round((economiaFipe / v.preco_fipe) * 100);

                    return (
                      <motion.div
                        key={v.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white border-2 border-emerald-500/30 hover:border-emerald-600 rounded-3xl overflow-hidden flex flex-col justify-between group shadow-sm hover:shadow-xl transition-all duration-300"
                      >
                        {/* Foto de Capa & Badges */}
                        <div className="relative aspect-[16/10] bg-[#F1F5F9] overflow-hidden cursor-pointer" onClick={() => handleOpenDetail(v)}>
                          <img
                            src={v.fotos[0] || 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80'}
                            alt={v.titulo}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />

                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                          {/* Badge Preço Lojista */}
                          <div className="absolute top-3 left-3 bg-amber-500 text-black text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            OFERTA ATACADO (-{pctDesconto}%)
                          </div>

                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white font-bold">
                            <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                              Placa final {v.placa_final || '*'}
                            </span>
                            <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                              📷 {v.fotos.length} fotos
                            </span>
                          </div>
                        </div>

                        {/* Conteúdo */}
                        <div className="p-5 sm:p-6 space-y-4 flex-grow flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                              <span>{v.marca}</span>
                              <span>•</span>
                              <span>{v.ano}</span>
                              <span>•</span>
                              <span>{v.km.toLocaleString('pt-BR')} km</span>
                            </div>

                            <h3
                              onClick={() => handleOpenDetail(v)}
                              className="font-serif font-extrabold text-base sm:text-lg text-[#0B1120] group-hover:text-[#0052FF] transition-colors line-clamp-2 cursor-pointer leading-snug"
                            >
                              {v.titulo}
                            </h3>

                            <p className="text-xs text-[#475569] line-clamp-2 italic border-l-2 border-amber-500 pl-2.5 py-0.5">
                              {v.observacoes_repasse}
                            </p>
                          </div>

                          {/* Preços e Margem */}
                          <div className="space-y-3 pt-3 border-t border-[#E2E8F0]">
                            <div className="flex items-baseline justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-[#475569] uppercase block">Tabela FIPE</span>
                                <span className="text-xs font-bold text-[#475569] line-through">{formatBRL(v.preco_fipe)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">Preço Lojista</span>
                                <span className="text-2xl font-black text-emerald-700 leading-none">{formatBRL(precoFinalLojista)}</span>
                              </div>
                            </div>

                            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-800">
                              <span>Margem Lojista vs FIPE:</span>
                              <span className="font-extrabold">{formatBRL(economiaFipe)}</span>
                            </div>

                            {/* Botões de Ação para Lojistas */}
                            <div className="space-y-2 pt-1">
                              <button
                                onClick={() => handleOpenDetail(v)}
                                className="w-full py-2.5 px-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B1120] font-extrabold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-4 h-4 text-[#0052FF]" />
                                Ver Detalhes do Anúncio
                              </button>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleAbrirModalProposta(v)}
                                  className="py-2.5 px-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                >
                                  <Handshake className="w-3.5 h-3.5" />
                                  Enviar Proposta
                                </button>
                                <button
                                  onClick={() => openWhatsAppDirect(v)}
                                  className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                                  Fechar no Whats
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}

      </div>

      {/* MODAL MINHAS PROPOSTAS (LOJISTA) */}
      <AnimatePresence>
        {showMinhasPropostasModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMinhasPropostasModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white text-[#0B1120] rounded-3xl p-6 space-y-6 shadow-2xl z-10 my-auto max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-[#0052FF]" />
                  <h3 className="font-serif font-extrabold text-lg">Minhas Propostas de Lojista</h3>
                </div>
                <button onClick={() => setShowMinhasPropostasModal(false)} className="p-2 text-[#475569] hover:text-[#0B1120]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {propostasLojista.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#475569] space-y-2">
                  <p>Você ainda não enviou propostas para os veículos de repasse.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {propostasLojista.map(p => (
                    <div key={p.id} className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-2 text-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-sm font-extrabold text-[#0B1120]">{p.veiculo_titulo}</strong>
                          <p className="text-[#475569]">Valor Anunciado: {formatBRL(p.valor_veiculo)} | Sua Proposta: <strong className="text-emerald-700">{formatBRL(p.valor_proposta)}</strong></p>
                        </div>
                        <span className={`px-3 py-1 rounded-full font-black uppercase text-[10px] ${
                          p.status === 'aceita' ? 'bg-emerald-100 text-emerald-800' :
                          p.status === 'recusada' ? 'bg-red-100 text-red-800' :
                          p.status === 'contraproposta' ? 'bg-amber-100 text-amber-800' :
                          'bg-zinc-100 text-zinc-800'
                        }`}>
                          {p.status}
                        </span>
                      </div>

                      {p.resposta_manos && (
                        <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] space-y-1">
                          <span className="font-bold text-[#0052FF] block">Resposta DG Automóveis:</span>
                          <p className="text-[#0B1120]">{p.resposta_manos}</p>
                          {p.valor_contraproposta && (
                            <p className="font-extrabold text-amber-800">Contraproposta: {formatBRL(p.valor_contraproposta)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL ENVIAR PROPOSTA DE LOJISTA */}
      <AnimatePresence>
        {showPropostaModal && selectedVeiculoProposta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPropostaModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white text-[#0B1120] rounded-3xl p-6 space-y-5 shadow-2xl z-10 my-auto"
            >
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2">
                  <Handshake className="w-5 h-5 text-amber-600" />
                  <h3 className="font-serif font-extrabold text-base">Proposta de Lojista</h3>
                </div>
                <button onClick={() => setShowPropostaModal(false)} className="p-1.5 text-[#475569]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-[#475569] font-bold block uppercase">Veículo Selecionado:</span>
                <h4 className="font-extrabold text-sm text-[#0B1120]">{selectedVeiculoProposta.titulo}</h4>
                <p className="text-[#475569]">Valor no Atacado: <strong className="text-emerald-700">{formatBRL(selectedVeiculoProposta.preco_lojista || selectedVeiculoProposta.preco_repasse)}</strong></p>
              </div>

              {propostaSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h5 className="font-bold text-emerald-900">Proposta Registrada com Sucesso!</h5>
                  <p className="text-emerald-800">Sua oferta foi recebida pela nossa equipe. Acompanhe a resposta pelo painel de propostas ou WhatsApp.</p>
                  <button
                    onClick={() => setShowPropostaModal(false)}
                    className="mt-2 px-4 py-2 bg-emerald-600 text-white font-bold text-xs uppercase rounded-xl"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEnviarPropostaSubmit} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-[#475569] block">Seu Valor de Proposta (R$)</label>
                    <input
                      type="number"
                      required
                      step="500"
                      className="w-full p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-base font-extrabold text-[#0B1120] outline-none focus:border-[#0052FF]"
                      value={valorPropostaInput}
                      onChange={e => setValorPropostaInput(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#475569] block">Mensagem ou Condição (Opcional)</label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Fechamos no Pix para retirar hoje à tarde."
                      className="w-full p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#0B1120] outline-none focus:border-[#0052FF]"
                      value={mensagemPropostaInput}
                      onChange={e => setMensagemPropostaInput(e.target.value)}
                    />
                  </div>

                  {propostaError && (
                    <p className="text-red-600 font-bold text-center">{propostaError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={propostaLoading}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {propostaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />}
                    <span>Confirmar Envio da Proposta</span>
                  </button>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DETALHES COMPLETOS DO ANÚNCIO (LOJISTA) */}
      <AnimatePresence>
        {selectedVeiculo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVeiculo(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white text-[#0B1120] rounded-3xl overflow-hidden shadow-2xl z-10 my-auto max-h-[90vh] flex flex-col"
            >
              {/* Header Modal */}
              <div className="p-4 sm:p-6 bg-[#0B1120] text-[#FFFFFF] flex items-center justify-between border-b border-[#38BDF8]/20 flex-shrink-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                      Anúncio Completo de Atacado Lojista
                    </span>
                    {selectedVeiculo.placa_final && (
                      <span className="px-2 py-0.5 bg-black/40 text-white text-[10px] font-bold rounded-md border border-white/10">
                        Placa final {selectedVeiculo.placa_final}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif font-extrabold text-base sm:text-xl text-white truncate max-w-md">
                    {selectedVeiculo.titulo}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedVeiculo(null)}
                  className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
                
                {/* Galeria de Fotos */}
                <div className="space-y-3">
                  <div className="relative aspect-[16/10] bg-[#F1F5F9] rounded-2xl overflow-hidden shadow-md">
                    <img
                      src={selectedVeiculo.fotos[activePhotoIdx] || selectedVeiculo.fotos[0] || 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80'}
                      alt={selectedVeiculo.titulo}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-amber-500 text-black text-xs font-black px-3 py-1 rounded-full uppercase shadow-md flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      PREÇO LOJISTA: {formatBRL(selectedVeiculo.preco_lojista || selectedVeiculo.preco_repasse)}
                    </div>
                  </div>

                  {selectedVeiculo.fotos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {selectedVeiculo.fotos.map((foto, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`relative w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                            activePhotoIdx === idx ? 'border-amber-500 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={foto} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preços e Margem Lojista */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[#475569] font-bold block text-[10px] uppercase">Tabela FIPE</span>
                      <strong className="text-[#475569] line-through text-sm">{formatBRL(selectedVeiculo.preco_fipe)}</strong>
                    </div>
                    <div>
                      <span className="text-[#475569] font-bold block text-[10px] uppercase">Repasse Público</span>
                      <strong className="text-[#0B1120] text-sm">{formatBRL(selectedVeiculo.preco_repasse)}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-800 font-black block text-[10px] uppercase">Preço Atacado Lojista</span>
                      <strong className="text-emerald-700 text-xl font-extrabold">{formatBRL(selectedVeiculo.preco_lojista || selectedVeiculo.preco_repasse)}</strong>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-emerald-300 flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span>Margem de Lucro Lojista vs FIPE:</span>
                    <span className="font-extrabold text-sm text-emerald-700">
                      {formatBRL(selectedVeiculo.preco_fipe - (selectedVeiculo.preco_lojista || selectedVeiculo.preco_repasse))}
                    </span>
                  </div>
                </div>

                {/* Dados Técnicos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[#475569] block text-[10px]">Marca / Modelo:</span>
                    <strong className="text-[#0B1120] text-xs font-extrabold">{selectedVeiculo.marca} {selectedVeiculo.modelo}</strong>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[#475569] block text-[10px]">Ano / Modelo:</span>
                    <strong className="text-[#0B1120] text-xs font-extrabold">{selectedVeiculo.ano}</strong>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[#475569] block text-[10px]">Quilometragem:</span>
                    <strong className="text-[#0B1120] text-xs font-extrabold">{selectedVeiculo.km.toLocaleString('pt-BR')} km</strong>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[#475569] block text-[10px]">Câmbio / Combustível:</span>
                    <strong className="text-[#0B1120] text-xs font-extrabold">{selectedVeiculo.cambio} • {selectedVeiculo.combustivel}</strong>
                  </div>
                </div>

                {/* Observações de Repasse */}
                {selectedVeiculo.observacoes_repasse && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-1.5">
                    <h4 className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      Observações Transparentes de Repasse:
                    </h4>
                    <p className="text-xs text-amber-950 leading-relaxed font-medium">
                      {selectedVeiculo.observacoes_repasse}
                    </p>
                  </div>
                )}

                {/* Descrição Detalhada */}
                {selectedVeiculo.descricao && (
                  <div className="space-y-1 text-xs">
                    <h4 className="font-bold text-[#0B1120] uppercase text-[11px]">Descrição do Anúncio:</h4>
                    <p className="text-[#475569] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                      {selectedVeiculo.descricao}
                    </p>
                  </div>
                )}

                {/* Botões de Ação no Modal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      const v = selectedVeiculo;
                      setSelectedVeiculo(null);
                      handleAbrirModalProposta(v);
                    }}
                    className="py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <Handshake className="w-4 h-4" />
                    <span>Enviar Proposta de Lojista</span>
                  </button>

                  <button
                    onClick={() => openWhatsAppDirect(selectedVeiculo)}
                    className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>Fechar Negócio pelo WhatsApp</span>
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </SiteShell>
  );
}
