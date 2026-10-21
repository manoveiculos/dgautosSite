import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, ArrowRight, CheckCircle2, AlertCircle, Car, Search,
  ShieldCheck, Banknote, Home, Clock, Lock, Gauge, Palette, Tag, Star,
  Phone, MessageCircle, ChevronDown, HelpCircle, MapPin, Sparkles, Check,
  Zap, Building2, ThumbsUp, ChevronRight
} from 'lucide-react';
import { registrarLeadVenda, consultarPlaca, enviarVenda, type VeiculoPlaca } from '../../services/vendasService';
import { novoLeadId } from '../../lib/leads';
import {
  trackFunnelStart,
  trackFunnelStep,
  trackLeadParcial,
  trackLead,
  trackPlacaConsultada,
} from '../../lib/tracking';

const LOGO = '/logo-dg.png';
const WHATSAPP_NUM = '5547989169598';

// ---- formatters & helpers -------------------------------------------------
function formatPhone(val: string): string {
  let r = val.replace(/\D/g, '');
  if (r.length > 11) r = r.substring(0, 11);
  if (r.length > 10) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (r.length > 6) return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  if (r.length > 2) return r.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (r.length > 0) return '(' + r;
  return r;
}

function formatPlaca(val: string): string {
  return val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function formatThousands(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 7);
  return d ? parseInt(d, 10).toLocaleString('pt-BR') : '';
}

function formatBRL(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  return (parseInt(d, 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function onlyNumber(masked: string): number {
  const d = masked.replace(/\D/g, '');
  return d ? parseInt(d, 10) : 0;
}

// Depoimentos Reais de Clientes do Google
const REVIEWS = [
  {
    nome: 'Carlos Eduardo M.',
    cidade: 'Rio do Sul - SC',
    carro: 'Hyundai HB20 2021',
    texto: 'Vendi meu HB20 no mesmo dia! O pessoal veio até minha casa, fez a avaliação justa e o PIX caiu na hora antes de assinar o recibo. Excelente atendimento!',
    estrelas: 5,
    tempo: 'Vendido em 45 min'
  },
  {
    nome: 'Juliana Schmidt',
    cidade: 'Blumenau - SC',
    carro: 'Jeep Compass 2020',
    texto: 'Tinha um financiamento em aberto e achava que seria burocrático. A DG Automóveis quitou a dívida no banco e me pagou a diferença inteira no PIX no mesmo dia.',
    estrelas: 5,
    tempo: 'Financiamento quitado'
  },
  {
    nome: 'Roberto Silveira',
    cidade: 'Itajaí - SC',
    carro: 'Volkswagen Gol 2019',
    texto: 'Sem estresse de colocar em sites de anúncio e ficar atendendo golpistas no WhatsApp. Avaliação honesta, rápida e dinheiro na conta sem enrolação.',
    estrelas: 5,
    tempo: 'Vendido sem sair de casa'
  }
];

// Perguntas Frequentes para Clientes Leigos
const FAQS = [
  {
    q: 'Como recebo o pagamento do meu carro?',
    a: 'O pagamento é 100% à vista via PIX direto na sua conta bancária. A transferência do valor é feita no momento da assinatura do documento, antes mesmo de você entregar as chaves.'
  },
  {
    q: 'Meu carro está financiado ou com débitos. Vocês compram?',
    a: 'Sim! Nós calculamos o valor exato para quitar o financiamento ou os débitos no Detran, realizamos a quitação diretamente e pagamos todo o valor restante no seu PIX.'
  },
  {
    q: 'Preciso pagar alguma taxa pela avaliação?',
    a: 'Não! Nossa avaliação é 100% gratuita, sem compromisso e sem taxas escondidas. Você só vende se concordar com a nossa proposta.'
  },
  {
    q: 'Preciso ir até a loja física em Rio do Sul?',
    a: 'Não é obrigatório. Fazemos a avaliação inicial totalmente online pelo WhatsApp. Se preferir, nossa equipe pode ir até a sua casa ou trabalho para concluir a negociação.'
  },
  {
    q: 'Como funciona a transferência da documentação?',
    a: 'Toda a parte burocrática e custos de transferência no Detran ficam por conta da DG Automóveis. Você não precisa se preocupar com nada.'
  }
];

export default function VendasRapidasPage() {
  const [step, setStep] = useState(1);
  const [leadId] = useState(novoLeadId);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Analytics tracking
  useEffect(() => {
    trackFunnelStart('Venda');
  }, []);

  useEffect(() => {
    if (step > 1) trackFunnelStep('Venda', step);
  }, [step]);

  // Step 1: Contato Inicial
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);

  // Step 2: Placa / Modelo
  const [placa, setPlaca] = useState('');
  const [placaLoading, setPlacaLoading] = useState(false);
  const [placaError, setPlacaError] = useState('');
  const [modoBusca, setModoBusca] = useState<'placa' | 'manual'>('placa');

  // Step 3: Detalhes do Carro
  const [veiculo, setVeiculo] = useState<VeiculoPlaca | null>(null);
  const [marcaManual, setMarcaManual] = useState('');
  const [modeloManual, setModeloManual] = useState('');
  const [km, setKm] = useState('');
  const [cor, setCor] = useState('');
  const [valor, setValor] = useState('');
  const [sending, setSending] = useState(false);

  const rawPhone = telefone.replace(/\D/g, '');
  const contatoValido = nome.trim().length >= 3 && rawPhone.length >= 10 && cidade.trim().length >= 2;
  
  const precisaMarcaModelo = !veiculo || (!veiculo.marca && !veiculo.modelo);
  const veiculoValido =
    km.trim() !== '' && cor.trim() !== '' && valor.trim() !== '' &&
    (!precisaMarcaModelo || (marcaManual.trim() !== '' && modeloManual.trim() !== ''));

  // Handler do WhatsApp direto (para leigos)
  const openDirectWhatsApp = (msgExtra = '') => {
    const texto = encodeURIComponent(
      msgExtra || `Olá! Vim pelo site e gostaria de receber uma proposta de compra à vista no PIX para o meu carro.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUM}?text=${texto}`, '_blank');
  };

  // Step 1 Submit
  const handleContato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contatoValido || leadLoading) return;
    setLeadLoading(true);
    trackLeadParcial({ tipo: 'Venda' });
    await registrarLeadVenda({ lead_id: leadId, nome: nome.trim(), telefone: rawPhone, cidade: cidade.trim() });
    setLeadLoading(false);
    setStep(2);

    // Smooth scroll to form top
    const formEl = document.getElementById('hero-evaluation-card');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Step 2 Plate Search
  const handleBuscarPlaca = async () => {
    if (placa.length < 7 || placaLoading) return;
    setPlacaLoading(true);
    setPlacaError('');
    const res = await consultarPlaca(placa);
    setPlacaLoading(false);
    trackPlacaConsultada(Boolean(res.ok && res.veiculo));
    if (res.ok && res.veiculo) {
      setVeiculo(res.veiculo);
      if (res.veiculo.cor) setCor(res.veiculo.cor);
      setStep(3);
    } else {
      setPlacaError(res.error || 'Não encontramos os dados da placa. Você pode preencher manualmente abaixo.');
      setModoBusca('manual');
    }
  };

  const handleSemPlaca = () => {
    setVeiculo(null);
    setModoBusca('manual');
    setStep(3);
  };

  // Step 3 Submit Final
  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!veiculoValido || sending) return;
    setSending(true);
    const eventId = trackLead({
      tipo: 'Venda',
      valor: onlyNumber(valor) / 100,
      vehicleName: [veiculo?.marca || marcaManual, veiculo?.modelo || modeloManual].filter(Boolean).join(' ') || null,
    });

    await enviarVenda({
      lead_id: leadId,
      event_id: eventId,
      nome: nome.trim(),
      telefone: rawPhone,
      cidade: cidade.trim(),
      placa: placa || null,
      marca: veiculo?.marca || marcaManual.trim() || null,
      modelo: veiculo?.modelo || modeloManual.trim() || null,
      versao: veiculo?.versao || null,
      ano: veiculo?.ano || null,
      combustivel: veiculo?.combustivel || null,
      fipe: veiculo?.fipeValor || null,
      km: onlyNumber(km),
      cor: cor.trim(),
      valor_desejado: onlyNumber(valor) / 100,
      valor_desejado_formatado: valor,
    });
    setSending(false);
    setStep(4);
  };

  return (
    <div className="vendas-landing-viewport">
      <div className="vendas-glow-bg" />

      {/* HEADER SUPERIOR TRANSPARENTE E MODERNO */}
      <header className="sticky top-0 z-40 bg-[#070707]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="DG Automóveis" className="h-8 sm:h-10 w-auto object-contain" />
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-green-400">Avaliadores Online em Rio do Sul - SC</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`tel:047989169598`}
              className="hidden sm:inline-flex items-center gap-2 text-xs font-bold text-white/70 hover:text-white transition-colors"
            >
              <Phone className="w-4 h-4 text-manos-red" />
              (47) 98916-9598
            </a>
            
            <button
              onClick={() => openDirectWhatsApp()}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline">Avaliar no</span> WhatsApp
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION — FULL WIDTH DESKTOP DUAL COLUMN & MOBILE STREAMLINED */}
      <section className="relative pt-6 sm:pt-12 pb-12 sm:pb-20 px-4 sm:px-8 max-w-7xl mx-auto w-full flex-grow z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* COLUNA DA ESQUERDA — APRESENTAÇÃO & PROPOSTA DE VALOR */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
            
            {/* Selo Topo */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-manos-red/20 to-green-500/20 border border-white/10 rounded-full">
              <Zap className="w-4 h-4 text-green-400 fill-current animate-bounce" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Pagamento à vista no PIX • Avaliação em 1 Minuto
              </span>
            </div>

            {/* Título Principal de Alta Conversão */}
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight uppercase leading-[1.05] italic">
                Venda seu carro <span className="text-manos-red">hoje mesmo</span> e receba à vista no <span className="text-green-400">PIX</span>
              </h1>
              <p className="text-base sm:text-lg text-white/70 leading-relaxed font-normal max-w-2xl">
                Sem intermediários, sem criar anúncios chato em sites e sem estranhos visitando sua casa. 
                Avaliamos online em 1 minuto, pagamos o dinheiro direto na sua conta e <strong className="text-white font-bold">buscamos o carro no seu endereço</strong>.
              </p>
            </div>

            {/* Grid de Diferenciais Práticos (Para Clientes Leigos) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { icon: <Banknote className="w-5 h-5 text-green-400" />, title: 'Dinheiro na Conta no PIX', desc: 'Transferência feita antes de entregar o carro' },
                { icon: <Home className="w-5 h-5 text-green-400" />, title: 'Buscamos na sua Garagem', desc: 'Em Rio do Sul, Alto Vale e região' },
                { icon: <ShieldCheck className="w-5 h-5 text-green-400" />, title: 'Quitamos Financiamento', desc: 'Compramos mesmo se tiver saldo devedor' },
                { icon: <Lock className="w-5 h-5 text-green-400" />, title: 'Documentação por Nossa Conta', desc: 'Sem burocracia nem taxas para você' },
              ].map((item, idx) => (
                <div key={idx} className="vendas-card-glass p-4 flex items-start gap-3 border-l-4 border-l-green-500">
                  <div className="p-2 bg-green-500/10 rounded-xl flex-shrink-0">{item.icon}</div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">{item.title}</h3>
                    <p className="text-xs text-white/50">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Prova Social Google no Hero */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm font-bold text-white/80">
                <span className="text-white font-black">4.9 no Google</span>
              </p>
              <div className="hidden sm:flex items-center gap-2 text-xs text-white/50">
                <Building2 className="w-4 h-4 text-manos-red" />
                Loja física em Rio do Sul / SC
              </div>
            </div>

            {/* Opção Rápida de WhatsApp Direto (Fricção Zero para Leigos) */}
            <div className="vendas-card-glass p-5 sm:p-6 bg-gradient-to-br from-green-950/30 to-black border-green-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-green-400">Prefere conversar no WhatsApp?</span>
              </div>
              <p className="text-xs sm:text-sm text-white/70">
                Se não quiser preencher formulário agora, você pode chamar nosso avaliador de plantão diretamente no WhatsApp:
              </p>
              <button
                onClick={() => openDirectWhatsApp()}
                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-sm uppercase rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-green-600/30 active:scale-95 transition-all"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                Falar com Avaliador no WhatsApp Agora
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

          </div>

          {/* COLUNA DA DIREITA — CARD DE AVALIAÇÃO INTERATIVO (FORMULÁRIO DE ALTA CONVERSÃO) */}
          <div id="hero-evaluation-card" className="lg:col-span-5 w-full">
            <div className="vendas-card-active p-6 sm:p-8 space-y-6 relative overflow-hidden">
              
              {/* Barra de Progresso do Formulário */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-manos-red font-black">
                    {step === 1 && 'Etapa 1 de 3 • Seus Dados'}
                    {step === 2 && 'Etapa 2 de 3 • Dados do Carro'}
                    {step === 3 && 'Etapa 3 de 3 • Finalizando Proposta'}
                    {step === 4 && 'Concluído com Sucesso'}
                  </span>
                  <span className="text-white/40">
                    {step === 1 && 'Leva 30 seg'}
                    {step === 2 && 'Fipe Automática'}
                    {step === 3 && 'Avaliação Grátis'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-manos-red"
                    initial={{ width: '25%' }}
                    animate={{ width: `${step * 25}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {/* ---------------- STEP 1 — CONTATO INICIAL ---------------- */}
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    <div className="space-y-1 text-left">
                      <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white">
                        Solicite sua <span className="text-manos-red">Avaliação Grátis</span>
                      </h2>
                      <p className="text-xs sm:text-sm text-white/60">
                        Informe seus dados para nosso avaliador enviar a proposta no seu WhatsApp.
                      </p>
                    </div>

                    <form onSubmit={handleContato} className="space-y-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1">
                          Seu Nome Completo *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="name"
                          className="w-full py-4 px-5 bg-white/5 border border-white/15 rounded-2xl text-white placeholder-white/30 text-sm focus:border-manos-red outline-none transition-all"
                          placeholder="Ex.: João Silva"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1">
                          WhatsApp de Contato (com DDD) *
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            required
                            inputMode="numeric"
                            autoComplete="tel"
                            className="w-full py-4 px-5 bg-white/5 border border-white/15 rounded-2xl text-white placeholder-white/30 text-sm focus:border-manos-red outline-none transition-all"
                            placeholder="(47) 99999-9999"
                            value={telefone}
                            onChange={(e) => setTelefone(formatPhone(e.target.value))}
                          />
                          {rawPhone.length >= 10 && (
                            <CheckCircle2 className="w-5 h-5 text-green-400 absolute right-4 top-1/2 -translate-y-1/2" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1">
                          Sua Cidade *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="address-level2"
                          className="w-full py-4 px-5 bg-white/5 border border-white/15 rounded-2xl text-white placeholder-white/30 text-sm focus:border-manos-red outline-none transition-all"
                          placeholder="Ex.: Rio do Sul"
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!contatoValido || leadLoading}
                        className="w-full py-5 bg-manos-red hover:bg-red-600 disabled:opacity-40 text-white font-black text-base uppercase rounded-2xl shadow-xl shadow-manos-red/30 flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer"
                      >
                        {leadLoading ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
                        ) : (
                          <>Quero Minha Proposta no PIX <ArrowRight className="w-5 h-5" /></>
                        )}
                      </button>

                      <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-white/40 font-semibold">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        <span>Seus dados estão 100% protegidos (LGPD). Sem spam.</span>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* ---------------- STEP 2 — PLACA / OPÇÃO MANUAL ---------------- */}
                {step === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    <div className="space-y-1 text-left">
                      <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white">
                        Qual a <span className="text-manos-red">Placa</span> do seu Carro?
                      </h2>
                      <p className="text-xs sm:text-sm text-white/60">
                        Com a placa identificamos a tabela FIPE, marca e ano automaticamente para uma oferta mais justa.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Input no Estilo Placa de Carro Mercosul */}
                      <div className="bg-white rounded-2xl p-3 border-4 border-slate-800 shadow-2xl text-center space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-black tracking-widest text-slate-400 px-2 uppercase">
                          <span>Brasil</span>
                          <span>Mercosul</span>
                        </div>
                        <input
                          type="text"
                          autoFocus
                          autoCapitalize="characters"
                          className="w-full py-2 text-center text-3xl font-black tracking-[0.25em] text-slate-900 bg-transparent outline-none uppercase placeholder:text-slate-300"
                          placeholder="ABC1D23"
                          value={placa}
                          onChange={(e) => { setPlaca(formatPlaca(e.target.value)); setPlacaError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarPlaca(); }}
                        />
                      </div>

                      {placaError && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold text-left">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{placaError}</span>
                        </div>
                      )}

                      <button
                        onClick={handleBuscarPlaca}
                        disabled={placa.length < 7 || placaLoading}
                        className="w-full py-5 bg-manos-red hover:bg-red-600 disabled:opacity-40 text-white font-black text-base uppercase rounded-2xl shadow-xl shadow-manos-red/30 flex items-center justify-center gap-3 active:scale-95 transition-all"
                      >
                        {placaLoading ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Buscando Dados FIPE...</>
                        ) : (
                          <><Search className="w-5 h-5" /> Buscar Dados da Placa</>
                        )}
                      </button>

                      {/* Opção sem placa clara para leigos */}
                      <div className="pt-2 text-center space-y-2 border-t border-white/10">
                        <p className="text-xs text-white/50">Não lembra a placa ou prefere digitar o modelo?</p>
                        <button
                          onClick={handleSemPlaca}
                          className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase rounded-xl transition-all"
                        >
                          Continuar sem a Placa
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ---------------- STEP 3 — DETALHES DO VEÍCULO ---------------- */}
                {step === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    <div className="space-y-1 text-left">
                      <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white">
                        Últimos <span className="text-manos-red">Detalhes</span>
                      </h2>
                      <p className="text-xs sm:text-sm text-white/60">
                        Falta muito pouco para calcularmos a oferta máxima no seu PIX.
                      </p>
                    </div>

                    {/* Card do Veículo Identificado */}
                    {veiculo && (veiculo.marca || veiculo.modelo) && (
                      <div className="p-3.5 bg-green-500/10 border border-green-500/30 rounded-2xl text-left space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-green-400 uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Carro Identificado
                          </span>
                          {veiculo.fipeValor && (
                            <span className="text-xs font-black text-green-400">FIPE: {veiculo.fipeValor}</span>
                          )}
                        </div>
                        <p className="text-sm font-black text-white italic uppercase">
                          {veiculo.marca} {veiculo.modelo} {[veiculo.versao, veiculo.ano].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleEnviar} className="space-y-3.5 text-left">
                      {precisaMarcaModelo && (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-white/70 uppercase">Marca (Ex.: Volkswagen)</label>
                            <input
                              type="text"
                              required
                              className="w-full py-3.5 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:border-manos-red outline-none"
                              placeholder="Marca do carro"
                              value={marcaManual}
                              onChange={(e) => setMarcaManual(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-white/70 uppercase">Modelo (Ex.: Gol 1.6)</label>
                            <input
                              type="text"
                              required
                              className="w-full py-3.5 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:border-manos-red outline-none"
                              placeholder="Modelo e versão"
                              value={modeloManual}
                              onChange={(e) => setModeloManual(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-white/70 uppercase">Quilometragem (km)</label>
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            className="w-full py-3.5 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:border-manos-red outline-none"
                            placeholder="Ex.: 75.000"
                            value={km}
                            onChange={(e) => setKm(formatThousands(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-white/70 uppercase">Cor do Carro</label>
                          <input
                            type="text"
                            required
                            className="w-full py-3.5 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:border-manos-red outline-none"
                            placeholder="Ex.: Prata"
                            value={cor}
                            onChange={(e) => setCor(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-white/70 uppercase">Quanto você espera receber pelo carro?</label>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          className="w-full py-4 px-4 bg-white/5 border border-green-500/40 rounded-xl text-green-400 font-bold text-base focus:border-green-400 outline-none"
                          placeholder="R$ 0,00"
                          value={valor}
                          onChange={(e) => setValor(formatBRL(e.target.value))}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!veiculoValido || sending}
                        className="w-full py-5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-black text-base uppercase rounded-2xl shadow-xl shadow-green-600/30 flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer mt-2"
                      >
                        {sending ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Calculando Proposta...</>
                        ) : (
                          <>Receber Minha Proposta no PIX <ArrowRight className="w-5 h-5" /></>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* ---------------- STEP 4 — SUCESSO ---------------- */}
                {step === 4 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-6 py-4"
                  >
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-500/40">
                      <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">
                        Solicitação Recebida!
                      </h2>
                      <p className="text-sm text-white/80 leading-relaxed">
                        Obrigado, <strong className="text-green-400">{nome}</strong>! Nossa equipe de avaliadores de Rio do Sul já está analisando os dados do seu carro.
                      </p>
                      <p className="text-xs text-white/50 border-l-2 border-green-500/40 pl-3 py-1 text-left italic">
                        Fique atento ao seu WhatsApp <strong className="text-white">{telefone}</strong>. Em instantes um de nossos consultores chamará você com a proposta final.
                      </p>
                    </div>

                    <button
                      onClick={() => openDirectWhatsApp(`Olá! Acabei de enviar meu carro (${veiculo?.marca || marcaManual} ${veiculo?.modelo || modeloManual}) no site. Gostaria de priorizar meu atendimento!`)}
                      className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-sm uppercase rounded-2xl shadow-xl flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-5 h-5 fill-current" />
                      Priorizar Atendimento no WhatsApp
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

        </div>
      </section>

      {/* SEÇÃO 1: COMO FUNCIONA EM 3 PASSOS SIMPLES (PARA CLIENTES LEIGOS) */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 bg-white/[0.02] border-y border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto space-y-12 text-center">
          
          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Vender seu carro é <span className="text-manos-red">Simples e Seguro</span>
            </h2>
            <p className="text-sm sm:text-base text-white/60">
              Veja como funciona o processo em 3 passos transparentes sem você precisar sair de casa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: '01',
                title: 'Você Envia os Dados',
                desc: 'Informe a placa ou modelo do seu carro pelo formulário ou diretamente no WhatsApp em menos de 1 minuto.',
                icon: <Car className="w-8 h-8 text-manos-red" />
              },
              {
                step: '02',
                title: 'Avaliamos com Justiça',
                desc: 'Nossa equipe analisa a tabela FIPE, ano e conservação para calcular a proposta máxima à vista.',
                icon: <Search className="w-8 h-8 text-green-400" />
              },
              {
                step: '03',
                title: 'PIX na Conta + Retirada',
                desc: 'Pagamos o dinheiro integral via PIX antes da transferência e buscamos o carro no seu endereço.',
                icon: <Banknote className="w-8 h-8 text-yellow-400" />
              }
            ].map((item, i) => (
              <div key={i} className="vendas-card-glass p-6 sm:p-8 space-y-4 text-left relative overflow-hidden group hover:border-manos-red/40 transition-all">
                <span className="absolute top-4 right-4 text-4xl font-black text-white/10 group-hover:text-manos-red/20 transition-colors">
                  {item.step}
                </span>
                <div className="p-3 bg-white/5 rounded-2xl w-fit">{item.icon}</div>
                <h3 className="text-xl font-bold text-white">{item.title}</h3>
                <p className="text-xs sm:text-sm text-white/60 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SEÇÃO 2: DEPOIMENTOS REAIS DE QUEM JÁ VENDEU (GOOGLE REVIEWS) */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-7xl mx-auto w-full relative z-10">
        <div className="space-y-12 text-center">
          
          <div className="space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-400 text-xs font-bold uppercase">
              <Star className="w-3.5 h-3.5 fill-current" />
              Avaliações Verificadas no Google
            </div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Quem vendeu na DG <span className="text-green-400">Recomenda</span>
            </h2>
            <p className="text-sm sm:text-base text-white/60">
              Centenas de proprietários de Rio do Sul e de Santa Catarina já venderam com segurança e dinheiro na hora.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {REVIEWS.map((rev, idx) => (
              <div key={idx} className="vendas-card-glass p-6 text-left space-y-4 border-l-4 border-l-yellow-400">
                <div className="flex items-center justify-between">
                  <div className="flex text-yellow-400">
                    {[...Array(rev.estrelas)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                    {rev.tempo}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-white/80 italic leading-relaxed">
                  "{rev.texto}"
                </p>

                <div className="pt-2 border-t border-white/10">
                  <p className="text-sm font-bold text-white">{rev.nome}</p>
                  <p className="text-xs text-white/40">{rev.cidade} • {rev.carro}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SEÇÃO 3: PERGUNTAS FREQUENTES (FAQ PARA CLIENTES LEIGOS) */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 bg-white/[0.02] border-t border-white/10 relative z-10">
        <div className="max-w-4xl mx-auto space-y-10 text-center">
          
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Dúvidas <span className="text-manos-red">Frequentes</span>
            </h2>
            <p className="text-sm sm:text-base text-white/60">
              Respostas claras e transparentes para você vender seu carro com total tranquilidade.
            </p>
          </div>

          <div className="space-y-3 text-left">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="vendas-card-glass overflow-hidden transition-all border border-white/10"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-white hover:text-manos-red transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <HelpCircle className="w-5 h-5 text-manos-red flex-shrink-0" />
                      {faq.q}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? 'rotate-180 text-manos-red' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-white/70 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* FOOTER & LOJA FÍSICA */}
      <footer className="py-10 px-4 sm:px-8 bg-black border-t border-white/10 text-center space-y-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="DG Automóveis" className="h-8 w-auto object-contain" />
            <span className="text-xs text-white/40 border-l border-white/20 pl-3">DG Automóveis • Compra e Venda</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-manos-red" />
              Rua Dom Pedro II, 461 - Canoas, Rio do Sul - SC
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-green-400" />
              (47) 98916-9598
            </span>
          </div>

          <div className="text-[11px] text-white/30">
            © {new Date().getFullYear()} DG Automóveis — CNPJ: 35.236.994/0001-24. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* BARRA FIXA INFERIOR NO MOBILE PARA CONVERSÃO PERMANENTE */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-black/90 backdrop-blur-xl border-t border-white/10 z-50 md:hidden flex items-center gap-2">
        <button
          onClick={() => {
            const formEl = document.getElementById('hero-evaluation-card');
            if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="flex-1 py-3 bg-manos-red text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center justify-center gap-2"
        >
          <Car className="w-4 h-4" />
          Avaliar pelo Site
        </button>

        <button
          onClick={() => openDirectWhatsApp()}
          className="flex-1 py-3 bg-green-600 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          WhatsApp Direto
        </button>
      </div>

    </div>
  );
}
