import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Search, Tag, AlertCircle, CheckCircle2, ShieldCheck, Info,
  ChevronRight, Phone, MessageCircle, ArrowRight, Loader2, RefreshCw,
  Sparkles, Filter, Percent, Banknote, X, ChevronLeft, Building2, HelpCircle,
  Plus, Check, ExternalLink, ShieldAlert, Lock, Unlock, UserCheck, Users,
  Send, FileText, BadgeDollarSign, Clock, MapPin, Eye
} from 'lucide-react';
import {
  fetchVeiculosRepasse,
  enviarLeadRepasse,
  type VeiculoRepasse
} from '../../services/repasseService';
import { SiteShell, Logo } from '../ManosUI';
import { novoLeadId } from '../../lib/leads';
import { trackFunnelStart, trackLead } from '../../lib/tracking';

const WHATSAPP_NUM = '5547989169598';

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

const FAQS_LEIGOS = [
  {
    q: 'O que significa um veículo ser "de repasse"?',
    a: 'Veículos de repasse são carros colocados à venda por valores significativamente abaixo da Tabela FIPE. Eles são repassados no estado em que se encontram, sem o custo de reformulação estética completa de loja de varejo e sem a garantia mecânica tradicional de 90 dias. É uma forma de economizar milhares de reais assumindo pequenos detalhes por conta própria.'
  },
  {
    q: 'Os carros possuem garantia mecânica de loja?',
    a: 'Não. Devido ao desconto expressivo (geralmente entre R$ 8.000 e R$ 20.000 abaixo da FIPE), o veículo é vendido "no estado de conservação em que se encontra", sem garantia contratual de loja. Todos os detalhes conhecidos do veículo são relatados com 100% de transparência na descrição de cada oferta.'
  },
  {
    q: 'Posso trazer meu mecânico de confiança para examinar o carro?',
    a: 'Com certeza! Encorajamos que você venha à nossa loja física em Rio do Sul / SC acompanhado pelo seu mecânico ou funileiro de confiança. Você poderá inspecionar o veículo, testar o motor e tirar todas as suas dúvidas antes de fechar o negócio.'
  },
  {
    q: 'Como está a documentação do veículo?',
    a: 'Todos os nossos veículos de repasse possuem documentação rigorosamente em dia, sem débitos pendentes ou restrições judiciais, prontos para transferência imediata no Detran.'
  },
  {
    q: 'Posso financiar ou parcelar um carro de repasse?',
    a: 'Sim! Aceitamos financiamento bancário e parcelamento no cartão de crédito. Como o valor cobrado é muito abaixo da Tabela FIPE, as parcelas costumam ser muito acessíveis.'
  }
];

export default function RepassePublicoPage() {
  const [veiculos, setVeiculos] = useState<VeiculoRepasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [marcaFilter, setMarcaFilter] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<'maior_desconto' | 'menor_preco'>('maior_desconto');

  // Modal de Detalhes / Formulário de Interesse
  const [selectedVeiculo, setSelectedVeiculo] = useState<VeiculoRepasse | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Form State
  const [leadId] = useState(novoLeadId);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [proposta, setProposta] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal Educativo
  const [showGuiaModal, setShowGuiaModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    trackFunnelStart('Compra');
    loadVeiculos();
  }, []);

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
        return (b.preco_fipe - b.preco_repasse) - (a.preco_fipe - a.preco_repasse);
      }
      return a.preco_repasse - b.preco_repasse;
    });

  const handleOpenDetail = (v: VeiculoRepasse) => {
    setSelectedVeiculo(v);
    setActivePhotoIdx(0);
    setSuccess(false);
    setErrorMsg('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVeiculo || submitting) return;

    const rawPhone = telefone.replace(/\D/g, '');
    if (nome.trim().length < 3 || rawPhone.length < 10 || cidade.trim().length < 2) {
      setErrorMsg('Por favor, preencha nome completo, WhatsApp válido e sua cidade.');
      return;
    }

    if (!aceitouTermos) {
      setErrorMsg('É necessário declarar ciência dos termos do veículo de repasse.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const eventId = trackLead({
      tipo: 'Compra',
      valor: selectedVeiculo.preco_repasse,
      vehicleId: String(selectedVeiculo.id),
      vehicleName: selectedVeiculo.titulo,
    });

    const res = await enviarLeadRepasse({
      lead_id: leadId,
      nome: nome.trim(),
      telefone: rawPhone,
      cidade: cidade.trim(),
      veiculo_id: selectedVeiculo.id,
      veiculo_titulo: selectedVeiculo.titulo,
      preco_fipe: selectedVeiculo.preco_fipe,
      preco_repasse: selectedVeiculo.preco_repasse,
      proposta_mensagem: `[REPASSE PÚBLICO] ${proposta.trim()}`,
      aceitou_termos: aceitouTermos,
      event_id: eventId,
    });

    setSubmitting(false);

    if (res.ok) {
      setSuccess(true);
    } else {
      setErrorMsg(res.error || 'Ocorreu um erro ao enviar. Tente novamente.');
    }
  };

  const openWhatsAppDirect = (v?: VeiculoRepasse) => {
    const txt = v
      ? `Olá! Vi o anúncio público do repasse ${v.titulo} por ${formatBRL(v.preco_repasse)} (FIPE: ${formatBRL(v.preco_fipe)}) no site e gostaria de atendimento.`
      : `Olá! Vi as ofertas de Repasse Público no site da DG Automóveis e gostaria de mais informações.`;
    window.open(`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(txt)}`, '_blank');
  };

  return (
    <SiteShell title="Repasse Público DG Automóveis" showTrustCards={false}>
      <div className="space-y-8 lg:space-y-12">
        
        {/* HERO HEADER REPASSE PÚBLICO */}
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
            
            {/* Top Bar Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-xs font-bold text-amber-300">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Oportunidades de Repasse para o Público</span>
              </div>
              <a
                href="/repasse"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-bold text-white transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>É lojista ou revendedor? Acesse a Área Exclusiva &rarr;</span>
              </a>
            </div>

            {/* Main Title */}
            <div className="space-y-3">
              <h1 className="font-serif font-extrabold text-2xl sm:text-4xl lg:text-5xl text-white leading-tight">
                Carros de Repasse com <span className="text-[#38BDF8]">Preço Abaixo da FIPE</span>
              </h1>
              <p className="text-sm sm:text-base text-[#E2E8F0]/90 max-w-2xl leading-relaxed">
                Compre veículos diretamente do estoque da DG Automóveis com descontos expressivos. <strong className="text-white">Total transparência sobre a condição no estado em que se encontram.</strong>
              </p>
            </div>

            {/* Banner Informativo Transparente para Leigos */}
            <div className="bg-[#060B14]/90 border border-[#38BDF8]/30 rounded-2xl p-4 sm:p-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 flex-shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-sm sm:text-base text-amber-300">
                    O que você precisa saber antes de comprar um veículo de repasse:
                  </h3>
                  <p className="text-xs text-[#E2E8F0]/80 leading-relaxed">
                    Para sua segurança e clareza total, entenda as 4 regras do veículo de repasse:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
                <div className="p-3 bg-black/30 rounded-xl border border-white/10 space-y-1">
                  <span className="font-bold text-emerald-400 block">1. Desconto FIPE Real</span>
                  <span className="text-[#E2E8F0]/80 text-[11px]">Valores de R$ 8.000 a R$ 20.000 abaixo do mercado.</span>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/10 space-y-1">
                  <span className="font-bold text-amber-400 block">2. Venda no Estado</span>
                  <span className="text-[#E2E8F0]/80 text-[11px]">Sem garantia contratual de 90 dias de varejo.</span>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/10 space-y-1">
                  <span className="font-bold text-emerald-400 block">3. Traga seu Mecânico</span>
                  <span className="text-[#E2E8F0]/80 text-[11px]">Faça vistoria presencial completa em nossa loja.</span>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/10 space-y-1">
                  <span className="font-bold text-amber-400 block">4. Doc 100% Ok</span>
                  <span className="text-[#E2E8F0]/80 text-[11px]">Documentação sem débitos, pronta p/ transferência.</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-[#38BDF8]/20">
                <button
                  onClick={() => setShowGuiaModal(true)}
                  className="font-bold text-[#38BDF8] hover:underline flex items-center gap-1.5"
                >
                  <Info className="w-4 h-4" />
                  <span>Dúvidas frequentes do repasse para o comprador final &rarr;</span>
                </button>
                <button
                  onClick={() => openWhatsAppDirect()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-md"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  Falar no WhatsApp
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* FILTROS E BUSCA */}
        <section className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E2E8F0] space-y-4 shadow-xs">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#475569] w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por marca, modelo ou versão..."
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
                <option value="maior_desconto">Maior Desconto R$ (FIPE)</option>
                <option value="menor_preco">Menor Preço Pedido</option>
              </select>
            </div>

          </div>

          <div className="flex items-center justify-between text-xs text-[#475569] pt-2 border-t border-[#E2E8F0]">
            <span>Exibindo <strong className="text-[#0B1120]">{veiculosFiltrados.length}</strong> veículos de repasse público</span>
            {loading && <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-[#0052FF]" /> Atualizando...</span>}
          </div>
        </section>

        {/* SHOWCASE / GRID DE VEÍCULOS DE REPASSE */}
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
              <p className="text-xs text-[#475569]">Tente ajustar o termo de busca ou escolha outra marca.</p>
              <button
                onClick={() => { setSearchQuery(''); setMarcaFilter('todos'); }}
                className="px-4 py-2 bg-[#0052FF] text-white text-xs font-bold uppercase rounded-xl"
              >
                Limpar Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {veiculosFiltrados.map(v => {
                const economia = v.preco_fipe - v.preco_repasse;
                const pctDesconto = Math.round((economia / v.preco_fipe) * 100);

                return (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white border border-[#E2E8F0] hover:border-[#0052FF] rounded-3xl overflow-hidden flex flex-col justify-between group shadow-sm hover:shadow-xl transition-all duration-300"
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

                      {/* Badge Desconto FIPE */}
                      <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5" />
                        -{pctDesconto}% ABAIXO DA FIPE
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white font-bold">
                        <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                          Placa final {v.placa_final || '*'}
                        </span>
                        <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                          📷 {v.fotos.length} fotos
                        </span>
                      </div>
                    </div>

                    {/* Informações Principais */}
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

                      {/* Preço e Comparativo */}
                      <div className="space-y-3 pt-3 border-t border-[#E2E8F0]">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-[#475569] uppercase block">Tabela FIPE</span>
                            <span className="text-xs font-bold text-[#475569] line-through">{formatBRL(v.preco_fipe)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">Preço Repasse</span>
                            <span className="text-2xl font-black text-[#0052FF] leading-none">{formatBRL(v.preco_repasse)}</span>
                          </div>
                        </div>

                        <div className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center justify-between text-xs font-bold text-emerald-700">
                          <span>Economia Imediata:</span>
                          <span className="font-extrabold">{formatBRL(economia)}</span>
                        </div>

                        {/* Botões de Ação */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => handleOpenDetail(v)}
                            className="py-3 px-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B1120] font-bold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-4 h-4 text-[#0052FF]" />
                            Ver Detalhes
                          </button>
                          <button
                            onClick={() => openWhatsAppDirect(v)}
                            className="py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <MessageCircle className="w-4 h-4 fill-current" />
                            Comprar
                          </button>
                        </div>

                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* MODAL DETALHES DO VEÍCULO E FORMULÁRIO */}
      <AnimatePresence>
        {selectedVeiculo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVeiculo(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white text-[#0B1120] rounded-3xl overflow-hidden shadow-2xl z-10 my-auto max-h-[90vh] flex flex-col"
            >
              {/* Header Modal */}
              <div className="p-4 sm:p-6 bg-[#0B1120] text-[#FFFFFF] flex items-center justify-between border-b border-[#38BDF8]/20 flex-shrink-0">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#38BDF8] tracking-widest">Veículo de Repasse Público</span>
                  <h3 className="font-serif font-extrabold text-base sm:text-xl text-white truncate max-w-md">{selectedVeiculo.titulo}</h3>
                </div>
                <button
                  onClick={() => setSelectedVeiculo(null)}
                  className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
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
                      src={selectedVeiculo.fotos[activePhotoIdx] || selectedVeiculo.fotos[0]}
                      alt={selectedVeiculo.titulo}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase">
                      {formatBRL(selectedVeiculo.preco_repasse)}
                    </div>
                  </div>

                  {selectedVeiculo.fotos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {selectedVeiculo.fotos.map((foto, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`relative w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                            activePhotoIdx === idx ? 'border-[#0052FF] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={foto} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dados Técnicos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[#475569] block">Ano:</span>
                    <strong className="text-[#0B1120] text-sm">{selectedVeiculo.ano}</strong>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[#475569] block">Quilometragem:</span>
                    <strong className="text-[#0B1120] text-sm">{selectedVeiculo.km.toLocaleString('pt-BR')} km</strong>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[#475569] block">Câmbio:</span>
                    <strong className="text-[#0B1120] text-sm">{selectedVeiculo.cambio}</strong>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[#475569] block">Combustível:</span>
                    <strong className="text-[#0B1120] text-sm">{selectedVeiculo.combustivel}</strong>
                  </div>
                </div>

                {/* Observações de Repasse */}
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                  <h4 className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Observações Importantes do Repasse:
                  </h4>
                  <p className="text-xs text-amber-950 leading-relaxed font-medium">
                    {selectedVeiculo.observacoes_repasse}
                  </p>
                </div>

                {/* Formulário de Envio de Proposta */}
                <div className="p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-4">
                  <h4 className="font-serif font-bold text-base text-[#0B1120]">
                    Tenho interesse neste veículo
                  </h4>

                  {success ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <h5 className="font-bold text-emerald-900 text-sm">Interesse Enviado com Sucesso!</h5>
                      <p className="text-xs text-emerald-800">
                        Um de nossos consultores entrará em contato com você pelo WhatsApp em breve.
                      </p>
                      <button
                        onClick={() => openWhatsAppDirect(selectedVeiculo)}
                        className="mt-2 px-4 py-2 bg-emerald-600 text-white font-bold text-xs uppercase rounded-xl inline-flex items-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Chamar no WhatsApp Agora
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-[#475569] block mb-1">Seu Nome Completo</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: João da Silva"
                            className="w-full p-3 bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#0052FF]"
                            value={nome}
                            onChange={e => setNome(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="font-bold text-[#475569] block mb-1">Seu WhatsApp (com DDD)</label>
                          <input
                            type="tel"
                            required
                            placeholder="(47) 99999-9999"
                            className="w-full p-3 bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#0052FF]"
                            value={telefone}
                            onChange={e => setTelefone(formatPhone(e.target.value))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-[#475569] block mb-1">Sua Cidade / UF</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Rio do Sul / SC"
                            className="w-full p-3 bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#0052FF]"
                            value={cidade}
                            onChange={e => setCidade(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="font-bold text-[#475569] block mb-1">Mensagem ou Proposta (Opcional)</label>
                          <input
                            type="text"
                            placeholder="Ex: Tenho interesse no pagamento à vista"
                            className="w-full p-3 bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#0052FF]"
                            value={proposta}
                            onChange={e => setProposta(e.target.value)}
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={aceitouTermos}
                          onChange={e => setAceitouTermos(e.target.checked)}
                          className="rounded text-[#0052FF] focus:ring-[#0052FF]"
                        />
                        <span className="text-[#475569]">
                          Declaro ciência de que se trata de um <strong className="text-[#0B1120]">veículo de repasse no estado</strong> sem garantia contratual de varejo.
                        </span>
                      </label>

                      {errorMsg && (
                        <p className="text-red-600 font-bold text-center">{errorMsg}</p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 bg-[#0052FF] hover:bg-[#003ECC] text-white font-extrabold text-sm uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Enviar Interesse para a Consultoria</span>
                      </button>
                    </form>
                  )}
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL GUIA EDUCATIVO DO REPASSE */}
      <AnimatePresence>
        {showGuiaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuiaModal(false)}
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
                  <Info className="w-6 h-6 text-[#0052FF]" />
                  <h3 className="font-serif font-extrabold text-lg">Guia do Veículo de Repasse</h3>
                </div>
                <button onClick={() => setShowGuiaModal(false)} className="p-2 text-[#475569] hover:text-[#0B1120]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {FAQS_LEIGOS.map((faq, idx) => (
                  <div key={idx} className="border border-[#E2E8F0] rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="w-full p-4 bg-[#F8FAFC] text-left font-bold text-sm text-[#0B1120] flex items-center justify-between"
                    >
                      <span>{faq.q}</span>
                      <ChevronRight className={`w-4 h-4 text-[#0052FF] transition-transform ${openFaq === idx ? 'rotate-90' : ''}`} />
                    </button>
                    {openFaq === idx && (
                      <div className="p-4 bg-white text-xs text-[#475569] leading-relaxed border-t border-[#E2E8F0]">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setShowGuiaModal(false)}
                  className="px-6 py-3 bg-[#0052FF] text-white font-bold text-xs uppercase rounded-xl"
                >
                  Entendi o Funcionamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </SiteShell>
  );
}
