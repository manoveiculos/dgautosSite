import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  DollarSign, 
  Handshake, 
  CreditCard,
  ChevronRight,
  Sparkles,
  MessageCircle,
  ExternalLink,
  Award,
  Car,
  Trophy,
  MapPin,
  X
} from 'lucide-react';
import { SiteShell } from '../ManosUI';
import { LOJA, SOCIAL, CONTATO, waLink, brl } from '../../lib/manos';
import { fetchStock, type Vehicle } from '../../services/stockService';
import { track } from '../../lib/track';
import { navigate } from '../../lib/router';

export default function HomePage() {
  const [stock, setStock] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultorPrompt, setConsultorPrompt] = useState('');
  const [buscaEstoque, setBuscaEstoque] = useState('');

  // Estados da Busca Inteligente & Simulação de Parcela Direta na Home
  const [activeSearch, setActiveSearch] = useState(false);
  const [searchSummary, setSearchSummary] = useState('');
  const [entradaSimulacao, setEntradaSimulacao] = useState<number | null>(null);
  const [parcelaMaxInput, setParcelaMaxInput] = useState<number | null>(null);
  const [precoMaxInput, setPrecoMaxInput] = useState<number | null>(null);
  const [cambioPref, setCambioPref] = useState<'todos' | 'automático' | 'manual'>('todos');
  const [categoriaPref, setCategoriaPref] = useState<'todos' | 'suv' | 'hatch' | 'sedan' | 'picape' | 'moto'>('todos');

  useEffect(() => {
    fetchStock().then((data) => {
      setStock(data);
      setLoading(false);
    });
  }, []);

  /**
   * Cálculo de simulação estimada de parcela em 48x (Recomendado = 30% de Entrada)
   */
  const calcularSimulacao48x = (precoVeiculo: number, entradaDesejada?: number | null) => {
    const entrada = (entradaDesejada !== null && entradaDesejada !== undefined) 
      ? entradaDesejada 
      : Math.round(precoVeiculo * 0.30);

    const financiado = Math.max(0, precoVeiculo - entrada);
    const ehRecomendada30 = (entradaDesejada === null || entradaDesejada === undefined);

    if (financiado <= 0) {
      return { 
        financiado: 0, 
        parcela: 0, 
        textoEntrada: '100% Quitado à vista', 
        textoParcela: 'R$ 0',
        ehRecomendada30 
      };
    }
    const parcela = calcParcela({ valor: precoVeiculo, entrada, meses: 48, taxaMensal: 0.03 });
    return {
      financiado,
      parcela,
      textoEntrada: entrada > 0 ? `Entrada de ${brl(entrada)}` : 'Sem entrada',
      textoParcela: `48x de ${brl(parcela)}`,
      ehRecomendada30
    };
  };

  /**
   * Interpretador Inteligente de Linguagem Natural
   */
  const handleConsultorSearch = (promptOverride?: string) => {
    const rawTxt = (promptOverride !== undefined ? promptOverride : consultorPrompt).trim();
    if (!rawTxt) {
      setActiveSearch(false);
      return;
    }

    setConsultorPrompt(rawTxt);
    setSearchSummary(rawTxt);
    setActiveSearch(true);
    track('consultor_home_inline_search', { query: rawTxt });

    const txtLower = rawTxt.toLowerCase();

    // 1. Extração de Parcela
    const matchParcela = txtLower.match(/(?:parcela|mensal(?:idade)?|mês|mes)\D*(\d{3,4})/) || txtLower.match(/(\d{3,4})\s*(?:reais|mensais|por mês|\/mês)/);
    if (matchParcela && matchParcela[1]) {
      const pVal = parseInt(matchParcela[1], 10);
      if (pVal >= 400 && pVal <= 4000) {
        setParcelaMaxInput(pVal);
      }
    } else if (txtLower.includes('900')) {
      setParcelaMaxInput(900);
    } else if (txtLower.includes('800')) {
      setParcelaMaxInput(800);
    } else if (txtLower.includes('700')) {
      setParcelaMaxInput(700);
    } else {
      setParcelaMaxInput(null);
    }

    // 2. Extração de Preço Teto
    const matchMil = txtLower.match(/(?:até|ate|max|máximo)?\s*(\d{2,3})\s*(?:mil|k)/);
    if (matchMil && matchMil[1]) {
      setPrecoMaxInput(parseInt(matchMil[1], 10) * 1000);
    } else {
      setPrecoMaxInput(null);
    }

    // 3. Câmbio
    if (txtLower.includes('automátic') || txtLower.includes('automatic') || txtLower.includes('auto') || txtLower.includes('exclusiv')) {
      setCambioPref('automático');
    } else if (txtLower.includes('manual')) {
      setCambioPref('manual');
    } else {
      setCambioPref('todos');
    }

    // 4. Categoria
    if (txtLower.includes('suv') || txtLower.includes('família') || txtLower.includes('familia') || txtLower.includes('7 lugares')) {
      setCategoriaPref('suv');
    } else if (txtLower.includes('moto')) {
      setCategoriaPref('moto');
    } else if (txtLower.includes('picape') || txtLower.includes('pickup') || txtLower.includes('strada') || txtLower.includes('hilux')) {
      setCategoriaPref('picape');
    } else if (txtLower.includes('sedan') || txtLower.includes('sedã')) {
      setCategoriaPref('sedan');
    } else {
      setCategoriaPref('todos');
    }

    setTimeout(() => {
      const el = document.getElementById('consultor-home-results');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleLimparBuscaInteligente = () => {
    setActiveSearch(false);
    setConsultorPrompt('');
    setSearchSummary('');
    setParcelaMaxInput(null);
    setPrecoMaxInput(null);
    setCambioPref('todos');
    setCategoriaPref('todos');
    setEntradaSimulacao(null);
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (buscaEstoque.trim()) {
      navigate(`/estoque?busca=${encodeURIComponent(buscaEstoque.trim())}`);
    }
  };

  // Filtragem dos veículos conforme preferências
  let veiculosRecomendados = stock.filter((v) => {
    if (!activeSearch) return true;

    if (precoMaxInput && v.price > precoMaxInput) return false;

    if (cambioPref !== 'todos') {
      const desc = ((v.description || '') + ' ' + ((v as any).transmission || '')).toLowerCase();
      const isAuto = desc.includes('aut') || desc.includes('at') || desc.includes('cvt') || desc.includes('dsg') || desc.includes('tiptronic');
      if (cambioPref === 'automático' && !isAuto) return false;
      if (cambioPref === 'manual' && isAuto) return false;
    }

    if (categoriaPref !== 'todos') {
      const desc = ((v.description || '') + ' ' + ((v as any).brand || '')).toLowerCase();
      if (categoriaPref === 'suv') {
        const suvKeywords = [
          'suv', 'spin', '7 lugares', 't-cross', 'tcross', 'nivus', 'tracker', 'creta', 'ecosport',
          'duster', 'hr-v', 'hrv', 'compass', 'renegade', 'kicks', 'pulse', 'fastback', 'tiggo'
        ];
        if (!suvKeywords.some(kw => desc.includes(kw))) return false;
      }
      if (categoriaPref === 'picape') {
        const picapeKeywords = ['picape', 'pickup', 'strada', 'toro', 'hilux', 's10', 'ranger', 'amarok', 'oroch', 'montana', 'saveiro'];
        if (!picapeKeywords.some(kw => desc.includes(kw))) return false;
      }
      if (categoriaPref === 'sedan') {
        const sedanKeywords = ['jetta', 'bmw', '320i', 'voyage', 'corolla', 'civic', 'virtus', 'prisma', 'onix plus', 'hb20s'];
        if (!sedanKeywords.some(kw => desc.includes(kw))) return false;
      }
    }

    if (parcelaMaxInput) {
      const sim = calcularSimulacao48x(v.price, entradaSimulacao);
      if (sim.parcela > parcelaMaxInput + 200) return false;
    }

    return true;
  });

  let ehBuscaAproximada = false;
  if (activeSearch && veiculosRecomendados.length === 0) {
    ehBuscaAproximada = true;
    veiculosRecomendados = [...stock].sort((a, b) => a.price - b.price);
  } else {
    veiculosRecomendados = veiculosRecomendados.sort((a, b) => {
      if (parcelaMaxInput) {
        const simA = calcularSimulacao48x(a.price, entradaSimulacao);
        const simB = calcularSimulacao48x(b.price, entradaSimulacao);
        return Math.abs(simA.parcela - parcelaMaxInput) - Math.abs(simB.parcela - parcelaMaxInput);
      }
      return a.price - b.price;
    });
  }

  // Top 3 featured vehicles para "Destaques da Semana"
  const escolhidos = stock.slice(0, 3);

  return (
    <SiteShell variant="default" showTrustCards={false}>
      <div className="space-y-10 lg:space-y-14">
        
        {/* 1. HERO CONSULTOR DG AUTOMÓVEIS */}
        <section className="bg-[#0B1120] text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden border border-blue-500/30">
          {/* Imagem de Fundo da Loja (Fachada DG Automóveis) */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
              src="/fachada-dg.png" 
              alt="Fachada DG Automóveis Rio do Sul" 
              className="w-full h-full object-cover opacity-45 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060B14]/95 via-[#0B1120]/85 to-[#0B1120]/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060B14]/95 via-transparent to-[#060B14]/40" />
          </div>

          <div className="relative z-10 max-w-3xl space-y-6">
            
            {/* Consultor Header + Badge +250 Carros Vendidos */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[#060B14] border-2 border-[#0052FF] flex items-center justify-center shadow-[0_0_15px_rgba(0,82,255,0.5)]">
                    <Bot className="w-7 h-7 text-sky-400" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0B1120] rounded-full animate-pulse" />
                </div>
                <div>
                  <span className="font-serif font-bold text-sm text-white">Consultor DG Automóveis IA</span>
                  <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Responde na hora · Busca inteligente de parcelas
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/15 border border-sky-400/30 rounded-full text-xs font-extrabold text-sky-300">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>+250 Carros Vendidos em Rio do Sul</span>
              </div>

              {activeSearch && (
                <button
                  onClick={handleLimparBuscaInteligente}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  <span>Limpar Busca</span>
                </button>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-sky-400">
                <span>• COMPRA • VENDE • TROCA • FINANCIA •</span>
              </div>
              <h1 className="font-serif font-extrabold text-2xl sm:text-4xl lg:text-5xl text-white leading-tight">
                Entre populares e exclusividades, <span className="text-sky-400">seu carro tá aqui.</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl">
                Descreva o que você procura: valor de parcela, carro econômico pro dia a dia, familiar 7 lugares ou esportivo exclusivo.
              </p>
            </div>

            {/* Conversational Input Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleConsultorSearch(); }} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ex: Carro até 50 mil, parcela de 900, ou Golf / BMW automática..."
                  value={consultorPrompt}
                  onChange={(e) => setConsultorPrompt(e.target.value)}
                  className="w-full px-5 py-4 text-sm rounded-2xl bg-[#060B14]/90 border border-blue-500/40 text-white placeholder:text-slate-400 focus:outline-hidden focus:border-sky-400 transition-all"
                />
              </div>
              <button
                type="submit"
                className="py-4 px-6 bg-[#0052FF] hover:bg-[#003ECC] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_25px_rgba(0,82,255,0.45)] min-h-[52px]"
              >
                <span>Achar no Pátio</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-400 font-semibold mr-1">Sugestões rápidas:</span>
              {[
                'Populares até 50 mil',
                'Cabe na parcela de 900',
                'Exclusivos & Automáticos',
                'Espaço pra família (7 lugares)',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleConsultorSearch(chip)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#060B14]/90 border border-blue-500/30 hover:border-sky-400 text-slate-200 hover:text-white rounded-full transition-all active:scale-95 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

          </div>
        </section>

        {/* 2. SEÇÃO DE RESULTADOS DA BUSCA INTELIGENTE DO CONSULTOR IA */}
        {activeSearch && (
          <section id="consultor-home-results" className="space-y-6 p-6 sm:p-8 bg-slate-100 rounded-3xl border-2 border-[#0052FF]/30 shadow-xl scroll-mt-6">
            {ehBuscaAproximada && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-start gap-3 text-[#0B1120]">
                <Sparkles className="w-5 h-5 text-[#0052FF] flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm space-y-0.5">
                  <strong className="font-bold text-[#0052FF] block">Opções Recomendadas no Pátio da DG:</strong>
                  <span>Selecionamos os veículos disponíveis no pátio da DG Automóveis mais próximos do que você procura:</span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0052FF] text-white rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                  {ehBuscaAproximada ? 'Opções Mais Próximas no Pátio' : 'Opções Encontradas pelo Consultor DG'}
                </div>
                <h2 className="font-serif font-extrabold text-xl sm:text-3xl text-[#0B1120]">
                  {veiculosRecomendados.length} Veículo(s) para: "{searchSummary || 'sua simulação'}"
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Calculado para: <strong className="text-[#0B1120]">{
                    entradaSimulacao === null
                      ? 'Entrada Recomendada (30% do valor)'
                      : (entradaSimulacao > 0 ? `Entrada de ${brl(entradaSimulacao)}` : 'Sem Entrada')
                  }</strong> em 48x · <span className="italic text-[#0052FF] font-semibold">*Sujeito à aprovação de crédito bancário</span>
                </p>
              </div>

              <button
                onClick={handleLimparBuscaInteligente}
                className="px-4 py-2 bg-white border border-slate-200 hover:border-[#0052FF] text-[#0B1120] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <X className="w-4 h-4 text-[#0052FF]" />
                Ver Todo o Estoque Geral
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {veiculosRecomendados.map((v) => {
                const sim = calcularSimulacao48x(v.price, entradaSimulacao);

                return (
                  <div
                    key={v.id}
                    className="bg-white rounded-2xl border-2 border-[#0052FF]/30 overflow-hidden hover:border-[#0052FF] transition-all group flex flex-col justify-between shadow-md"
                  >
                    <div>
                      <a href={v.link} className="block relative aspect-4/3 overflow-hidden bg-[#0B1120]">
                        <img
                          src={v.image}
                          alt={v.description}
                          className="w-full h-[220px] object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-3 right-3 px-2.5 py-1 bg-[#0052FF] text-white text-[10px] font-black uppercase rounded-lg shadow-md">
                          💡 Simulação Pronta
                        </span>
                      </a>

                      <div className="p-4 space-y-3">
                        <div>
                          <h3 className="font-serif font-bold text-base text-[#0B1120] group-hover:text-[#0052FF] transition-colors leading-snug">
                            <a href={v.link}>{v.description}</a>
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            {v.year} · {v.km} {v.transmission ? `· ${v.transmission}` : ''}
                          </p>
                        </div>

                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-blue-900 block">
                              {sim.ehRecomendada30 ? 'Simulação Recomendada' : 'Simulação de Parcela'}
                            </span>
                            <span className="text-[9px] bg-blue-100 text-blue-900 font-extrabold px-1.5 py-0.5 rounded border border-blue-300">
                              *Sujeito à aprovação
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs font-bold text-slate-800">{sim.textoEntrada}</span>
                            <span className="text-base font-black text-[#0052FF]">{sim.textoParcela}</span>
                          </div>
                          <p className="text-[9px] text-slate-600 leading-tight border-t border-blue-200/60 pt-1">
                            *Simulação estimada em 48x. Aceitamos seu usado na troca.
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                          <span>Preço à vista:</span>
                          <strong className="text-[#0B1120] font-extrabold text-sm">{v.priceFormatted}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <a
                        href={waLink(`Olá! Vi o ${v.description} (${v.priceFormatted}) no site da DG Automóveis.\nFiz a simulação com ${sim.textoEntrada} + ${sim.textoParcela}.\nGostaria de atendimento para este modelo!`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => track('whatsapp_click', { pagina: '/', vehicleId: v.id, simulacao: sim.textoParcela })}
                        className="w-full py-3.5 bg-[#0052FF] hover:bg-[#003ECC] text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all shadow-md min-h-[44px]"
                      >
                        <MessageCircle className="w-4 h-4 fill-current" />
                        <span>Chamar sobre esta parcela no Whats</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. BUSCA POR TEXTO E DESTAQUES DA SEMANA */}
        <section className="space-y-6">
          <form onSubmit={handleBuscar} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por modelo, marca ou versão (ex: Golf, BMW 320i, Jetta, Spin, Mobi, Sandero)..."
                value={buscaEstoque}
                onChange={(e) => setBuscaEstoque(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 text-sm rounded-2xl bg-white border border-slate-200 text-[#0B1120] placeholder:text-slate-400 focus:outline-hidden focus:border-[#0052FF] shadow-2xs"
              />
            </div>
            <button
              type="submit"
              className="py-3.5 px-6 bg-[#0052FF] hover:bg-[#003ECC] text-white font-bold text-sm rounded-2xl transition-all shadow-md"
            >
              Buscar
            </button>
          </form>

          {/* DESTAQUES DO SHOWROOM DG */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-extrabold text-lg sm:text-xl text-[#0B1120]">
                Destaques do Showroom DG
              </h2>
              <a
                href="/estoque"
                className="text-xs font-bold text-[#0052FF] hover:underline flex items-center gap-1 min-h-0"
              >
                <span>Ver todo o estoque</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Carregando destaques do showroom...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {escolhidos.map((v) => (
                  <a
                    key={v.id}
                    href={v.link}
                    className="flex bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-[#0052FF] transition-all group shadow-2xs"
                  >
                    <img
                      src={v.image}
                      alt={v.description}
                      className="w-[112px] h-[112px] object-cover bg-[#0B1120] flex-shrink-0"
                    />
                    <div className="p-3.5 flex flex-col justify-between flex-1 min-w-0">
                      <div>
                        <h3 className="font-serif font-bold text-sm text-[#0B1120] truncate group-hover:text-[#0052FF]">
                          {v.description}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {v.year} · {v.km}
                        </p>
                      </div>
                      <div className="text-base font-extrabold text-[#0052FF]">
                        {v.priceFormatted}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 4. TRÊS PORTAS DE SERVIÇO (COMPRA • VENDE • TROCA • FINANCIA) */}
        <section className="space-y-4">
          <h2 className="font-serif font-extrabold text-xl sm:text-2xl text-[#0B1120]">
            O que você precisa fazer hoje?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Vender ou Trocar */}
            <a
              href="/vender-meu-carro"
              className="p-6 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-2xl space-y-3 transition-all group shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-bold">
                  <DollarSign className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-[#0B1120] group-hover:text-[#0052FF] transition-colors">
                  Vender ou Trocar
                </h3>
                <p className="text-xs text-slate-600">
                  Compramos seu carro à vista no PIX ou pegamos na troca com a melhor avaliação de Rio do Sul.
                </p>
              </div>
              <div className="text-xs font-bold text-[#0052FF] flex items-center gap-1 pt-2">
                <span>Avaliar meu usado agora</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Consignar */}
            <a
              href="/consignacao"
              className="p-6 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-2xl space-y-3 transition-all group shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-bold">
                  <Handshake className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-[#0B1120] group-hover:text-[#0052FF] transition-colors">
                  Consignar na DG
                </h3>
                <p className="text-xs text-slate-600">
                  Fotos profissionais no nosso estúdio com LED hexagonal, anúncio e venda rápida pelo valor máximo.
                </p>
              </div>
              <div className="text-xs font-bold text-[#0052FF] flex items-center gap-1 pt-2">
                <span>Conhecer a consignação</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Financiar */}
            <a
              href="/financiamento"
              className="p-6 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-2xl space-y-3 transition-all group shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center font-bold">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-[#0B1120] group-hover:text-[#0052FF] transition-colors">
                  Financiar em até 60x
                </h3>
                <p className="text-xs text-slate-600">
                  Simule entrada, prazo e parcela nas melhores financeiras e bancos parceiros sem sair de casa.
                </p>
              </div>
              <div className="text-xs font-bold text-[#0052FF] flex items-center gap-1 pt-2">
                <span>Simular parcelas</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

          </div>
        </section>

        {/* 5. ESTOQUE COMPLETO NA HOME */}
        <section className="space-y-6 pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#0B1120]">
                Nosso Estoque no Pátio
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Entre populares e exclusividades — veículos selecionados e revisados na Rua Dom Pedro II, 461
              </p>
            </div>
            <a
              href="/estoque"
              className="text-xs font-bold text-[#0052FF] hover:underline flex items-center gap-1"
            >
              <span>Ir para a página de estoque</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {!loading && stock.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stock.slice(0, 9).map((v) => (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-[#0052FF] transition-all group flex flex-col justify-between shadow-sm hover:shadow-xl"
                >
                  <div>
                    <a href={v.link} className="block relative aspect-4/3 overflow-hidden bg-[#0B1120]">
                      <img
                        src={v.image}
                        alt={v.description}
                        className="w-full h-[220px] object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-3 right-3 px-2.5 py-1 bg-[#0B1120]/85 backdrop-blur-xs text-sky-400 border border-blue-500/30 text-[10px] font-extrabold uppercase rounded-lg">
                        Garantia DG
                      </span>
                    </a>

                    <div className="p-4 space-y-2">
                      <h3 className="font-serif font-bold text-base text-[#0B1120] group-hover:text-[#0052FF] transition-colors leading-snug">
                        <a href={v.link}>{v.description}</a>
                      </h3>
                      
                      <p className="text-xs text-slate-500 font-medium">
                        {v.year} · {v.km} {v.transmission ? `· ${v.transmission}` : ''}
                      </p>

                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Preço à vista</span>
                        <span className="text-2xl font-extrabold text-[#0052FF] leading-none block mt-0.5">
                          {v.priceFormatted}
                        </span>
                        <span className="text-[11px] text-slate-500 block pt-1">
                          Aceita troca e financia em até 60x
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <a
                      href={waLink(`Olá! Vi o ${v.description} (${v.priceFormatted}) no site da DG Automóveis e gostaria de mais informações.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track('whatsapp_click', { pagina: '/', vehicleId: v.id })}
                      className="w-full py-3 bg-[#0B1120] hover:bg-[#0052FF] text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs min-h-[44px]"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span>Chamar Consultor DG</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="text-center pt-2">
            <a
              href="/estoque"
              className="inline-flex items-center gap-2 py-4 px-8 bg-[#0B1120] hover:bg-[#0052FF] text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg"
            >
              <span>Ver Todo o Estoque da DG Automóveis</span>
              <ArrowRight className="w-5 h-5 text-sky-400" />
            </a>
          </div>
        </section>

        {/* 6. COMPRAMOS O SEU CARRO */}
        <section className="bg-slate-100 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="font-serif font-extrabold text-xl sm:text-2xl text-[#0B1120]">
              Compramos ou trocamos o seu carro à vista
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Avaliação justa e rápida em Rio do Sul. Pagamento no PIX à vista ou entrada facilitada no seu próximo carro da DG Automóveis.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { num: '1', titulo: 'Digite a placa', desc: 'Informe a placa ou modelo do seu veículo no site' },
              { num: '2', titulo: 'Avaliação rápida', desc: 'Receba nossa proposta justa para compra ou troca' },
              { num: '3', titulo: 'PIX na conta', desc: 'Pagamento imediato e transferência sem burocracia' },
            ].map((st) => (
              <div key={st.num} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5 shadow-2xs">
                <span className="w-7 h-7 rounded-full bg-[#0052FF] text-white font-bold text-xs flex items-center justify-center">
                  {st.num}
                </span>
                <h3 className="font-serif font-bold text-sm text-[#0B1120]">{st.titulo}</h3>
                <p className="text-xs text-slate-600">{st.desc}</p>
              </div>
            ))}
          </div>

          <a
            href="/vender-meu-carro"
            className="inline-flex items-center gap-2 py-3.5 px-6 bg-[#0052FF] hover:bg-[#003ECC] text-white font-bold text-sm rounded-2xl transition-all shadow-md"
          >
            <span>Quero avaliar meu carro</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </section>

        {/* 7. QUATRO DIFERENCIAIS DA DG AUTOMÓVEIS */}
        <section className="space-y-4">
          <h2 className="font-serif font-extrabold text-xl sm:text-2xl text-[#0B1120]">
            Por que comprar na DG Automóveis?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Loja Física na Dom Pedro II, 461',
                desc: 'Showroom próprio e amplo em Rio do Sul/SC para você conhecer e testar seu próximo carro.',
              },
              {
                title: '+250 Carros Vendidos',
                desc: 'Histórico comprovado de bons negócios, clientes satisfeitos e entrega garantida.',
              },
              {
                title: 'Populares & Exclusividades',
                desc: 'Do compacto econômico para o dia a dia até sedãs e hatches esportivos com teto solar.',
              },
              {
                title: 'Financiamento & Troca Fácil',
                desc: 'Parceria com as principais financeiras e avaliação justa do seu usado na troca.',
              },
            ].map((dif, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-2 shadow-2xs">
                <CheckCircle2 className="w-6 h-6 text-[#0052FF]" />
                <h3 className="font-serif font-bold text-sm text-[#0B1120]">{dif.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{dif.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 8. PROVA SOCIAL & FACHADA DG AUTOMÓVEIS */}
        <section className="bg-gradient-to-br from-[#060B14] via-[#0B1120] to-[#060B14] text-white rounded-3xl p-6 sm:p-10 space-y-6 relative overflow-hidden border border-blue-500/30 shadow-2xl">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
              src="/fachada-dg.png" 
              alt="Fachada DG Automóveis" 
              className="w-full h-full object-cover opacity-35 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060B14]/95 via-[#0B1120]/85 to-[#060B14]/75" />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-500/20 text-sky-400 border border-sky-400/30 tracking-wider uppercase">
              <Award className="w-3.5 h-3.5 text-sky-400" />
              <span>Credibilidade & +250 Carros Entregues</span>
            </div>
            <h2 className="font-serif font-extrabold text-2xl sm:text-3xl text-white tracking-tight drop-shadow-md">
              A sua revenda de confiança em Rio do Sul
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Acompanhe nosso dia a dia, novidades do pátio e entregas para clientes de Rio do Sul e todo o Alto Vale do Itajaí.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
            
            {/* Card 1: Instagram @dgautomoveis__ */}
            <a
              href={SOCIAL.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0B1120] p-6 rounded-2xl border border-slate-200 hover:border-[#0052FF] transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shadow-xs" style={{ background: 'linear-gradient(45deg, #F9CE34 0%, #EE2A7B 50%, #6228D7 100%)' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.2" cy="6.8" r="1.1" fill="#FFFFFF" stroke="none"></circle></svg>
                    </span>
                    <span className="font-extrabold text-xs text-[#0052FF]">@dgautomoveis__</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0052FF] transition-colors" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#0B1120] group-hover:text-[#0052FF] transition-colors">
                    Instagram Oficial (+2.680 seguidores)
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    Confira os vídeos, detalhes internos e novidades que acabaram de entrar no showroom da DG.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-[#0052FF]">
                <span>Seguir @dgautomoveis__</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Card 2: +250 Carros Vendidos */}
            <a
              href={waLink('Olá! Vi no site da DG Automóveis e quero negociar meu próximo carro com vocês.')}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0B1120] p-6 rounded-2xl border border-slate-200 hover:border-[#0052FF] transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#0052FF] text-white font-extrabold text-[11px] flex items-center justify-center shadow-xs">
                      DG
                    </span>
                    <span className="font-extrabold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> +250 Vendidos
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0052FF] transition-colors" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#0B1120] group-hover:text-[#0052FF] transition-colors">
                    Negociação Direta & Transparente
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    Mais de 250 veículos entregues com procedência, garantia e satisfação comprovada.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-[#0052FF]">
                <span>Falar com Consultor DG</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Card 3: Localização Dom Pedro II, 461 */}
            <a
              href={LOJA.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0B1120] p-6 rounded-2xl border border-slate-200 hover:border-[#0052FF] transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-blue-500/15 text-[#0052FF] flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <span className="text-amber-500 text-sm font-extrabold tracking-wider">
                      ★★★★★
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0052FF] transition-colors" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#0B1120] group-hover:text-[#0052FF] transition-colors">
                    Visite Nosso Showroom
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    Rua Dom Pedro II, 461 — Rio do Sul/SC. Venha tomar um café e fazer um test-drive!
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-[#0052FF]">
                <span>Abrir localização no Maps</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

          </div>

          {/* Destaques de Confiança Inferior */}
          <div className="relative z-10 pt-4 border-t border-blue-500/20 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-[#060B14]/80 backdrop-blur-xs p-3 rounded-xl border border-blue-500/20 shadow-xs">
              <span className="block text-xs font-bold text-sky-400">📍 Dom Pedro II, 461</span>
              <span className="text-[10px] text-slate-300 font-medium">Rio do Sul / SC</span>
            </div>
            <div className="bg-[#060B14]/80 backdrop-blur-xs p-3 rounded-xl border border-blue-500/20 shadow-xs">
              <span className="block text-xs font-bold text-sky-400">🏆 +250 Carros</span>
              <span className="text-[10px] text-slate-300 font-medium">Vendidos e entregues</span>
            </div>
            <div className="bg-[#060B14]/80 backdrop-blur-xs p-3 rounded-xl border border-blue-500/20 shadow-xs">
              <span className="block text-xs font-bold text-sky-400">🚗 Populares & Exclusivos</span>
              <span className="text-[10px] text-slate-300 font-medium">Estoque 100% selecionado</span>
            </div>
            <div className="bg-[#060B14]/80 backdrop-blur-xs p-3 rounded-xl border border-blue-500/20 shadow-xs">
              <span className="block text-xs font-bold text-sky-400">📲 {CONTATO.telefone}</span>
              <span className="text-[10px] text-slate-300 font-medium">Atendimento rápido no Whats</span>
            </div>
          </div>
        </section>

      </div>
    </SiteShell>
  );
}
