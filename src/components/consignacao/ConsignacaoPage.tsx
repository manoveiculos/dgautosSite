import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Phone,
  MessageCircle,
  Search,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building2,
  Camera,
  TrendingUp,
  Clock,
  Handshake,
  DollarSign,
  Award,
  ChevronDown,
  Check,
  Zap,
  Star,
  ExternalLink,
  Shield,
  HelpCircle
} from 'lucide-react';
import { SiteShell } from '../ManosUI';
import { consultarPlaca, type VeiculoPlaca } from '../../services/vendasService';
import { registrarLeadConsignacao, enviarConsignacao } from '../../services/consignacaoService';
import { getStoredLead, saveStoredLead } from '../../lib/leadStore';
import { LOJA, waLink, formatPhone, validatePlaca } from '../../lib/manos';
import { track } from '../../lib/track';

function novoLeadId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {}
  return `csg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function onlyNumber(str: string): number {
  return parseInt((str || '').replace(/\D/g, ''), 10) || 0;
}

function formatPlacaDisplay(val: string): string {
  const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (raw.length > 3 && !/^[A-Z]{3}[0-9][A-Z]/.test(raw)) {
    return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  }
  return raw;
}

function formatThousands(val: string): string {
  const n = val.replace(/\D/g, '');
  if (!n) return '';
  return parseInt(n, 10).toLocaleString('pt-BR');
}

function formatBRL(val: string): string {
  const n = onlyNumber(val);
  if (!n) return '';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Depoimentos Reais de Clientes
const REVIEWS_CONSIGNACAO = [
  {
    nome: 'Carlos Eduardo M.',
    cidade: 'Rio do Sul - SC',
    carro: 'Compass Longitude 2021',
    texto: 'Tentei vender meu Compass sozinho por 2 meses sem sucesso. Deixei na DG Automóveis em consignação e em menos de 10 dias eles venderam aceitando a troca do comprador e me pagaram o valor líquido certinho!',
    tempo: 'Vendido em 9 dias'
  },
  {
    nome: 'Juliana S. V.',
    cidade: 'Ituporanga - SC',
    carro: 'Civic EXL 2019',
    texto: 'Fiz a consignação virtual porque precisava do carro no dia a dia. Eles tiraram fotos profissionais, anunciaram e em 2 semanas me chamaram com o comprador aprovado no financiamento.',
    tempo: 'Consignação Virtual'
  },
  {
    nome: 'Rodrigo A. F.',
    cidade: 'Laurentino - SC',
    carro: 'Corolla XEi 2020',
    texto: 'Total transparência no contrato. Não tive dor de cabeça com estranhos me chamando toda hora. Venderam pelo valor de mercado que combinamos. Recomendo de olhos fechados!',
    tempo: 'Vendido em 6 dias'
  }
];

// FAQs de Consignação
const FAQS_CONSIGNACAO = [
  {
    q: 'Como funciona a Consignação na DG Automóveis?',
    a: 'Nós combinamos com você o valor líquido que deseja receber pelo seu carro. Cuidamos de todo o processo de divulgação, higienização, fotos profissionais, atendimento a interessados, oferta de financiamento bancário e troca. Quando o carro é vendido, você recebe o valor líquido diretamente na sua conta.'
  },
  {
    q: 'Qual a diferença entre Consignação Física e Virtual?',
    a: 'Na Consignação Física, seu veículo fica exposto em nosso showroom coberto e seguro na loja de Rio do Sul, com alto fluxo diário de compradores. Na Consignação Virtual, você continua rodando com seu carro normalmente enquanto fazemos os anúncios profissionais e trazemos os compradores qualificados.'
  },
  {
    q: 'Por que o carro vende muito mais rápido na DG Automóveis?',
    a: 'Porque a DG Automóveis oferece financiamento bancário com as melhores taxas do mercado para o comprador, além de aceitar o carro usado dele na troca. Mais de 80% das compras de seminovos envolvem troca ou financiamento — facilidades que a venda particular não possui.'
  },
  {
    q: 'Existe alguma taxa antecipada para consignar?',
    a: 'Não! Você não paga nada antecipado. Nossa remuneração é negociada de forma transparente e embutida na venda acima do valor líquido que combinamos com você. Se o carro não for vendido, você não paga absolutamente nada.'
  },
  {
    q: 'Meu carro fica seguro no pátio da loja?',
    a: 'Com certeza! Nosso showroom possui pátio coberto, monitoramento 24h e seguro total. Além disso, firmamos um contrato oficial de consignação discriminando todos os dados do veículo e as responsabilidades da loja.'
  }
];

export default function ConsignacaoPage() {
  const [step, setStep] = useState(1);
  const [leadId] = useState(novoLeadId);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Pre-fill contact from central leadStore
  const [nome, setNome] = useState(() => getStoredLead().nome || '');
  const [telefone, setTelefone] = useState(() => {
    const saved = getStoredLead().telefone;
    return saved ? formatPhone(saved) : '';
  });
  const [cidade, setCidade] = useState(() => getStoredLead().cidade || '');
  const [leadLoading, setLeadLoading] = useState(false);

  // Auto-sync contact details
  useEffect(() => {
    const sync = () => {
      const stored = getStoredLead();
      if (stored.nome && !nome) setNome(stored.nome);
      if (stored.telefone && !telefone) setTelefone(formatPhone(stored.telefone));
      if (stored.cidade && !cidade) setCidade(stored.cidade);
    };
    sync();
    window.addEventListener('manos-lead-updated', sync);
    return () => window.removeEventListener('manos-lead-updated', sync);
  }, [nome, telefone, cidade]);

  // Step 2: Placa / Modelo
  const [placa, setPlaca] = useState('');
  const [placaLoading, setPlacaLoading] = useState(false);
  const [placaError, setPlacaError] = useState('');

  // Step 3: Detalhes do Carro & Consignação
  const [veiculo, setVeiculo] = useState<VeiculoPlaca | null>(null);
  const [marcaManual, setMarcaManual] = useState('');
  const [modeloManual, setModeloManual] = useState('');
  const [km, setKm] = useState('');
  const [cor, setCor] = useState('');
  const [valorLiquido, setValorLiquido] = useState('');
  const [modalidade, setModalidade] = useState<'Fisica' | 'Virtual'>('Fisica');
  const [obs, setObs] = useState('');
  const [sending, setSending] = useState(false);

  const rawPhone = telefone.replace(/\D/g, '');
  const cleanPlaca = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const contatoValido = nome.trim().length >= 3 && rawPhone.length >= 10 && cidade.trim().length >= 2;

  const precisaMarcaModelo = !veiculo || (!veiculo.marca && !veiculo.modelo);
  const veiculoValido =
    km.trim() !== '' && cor.trim() !== '' && valorLiquido.trim() !== '' &&
    (!precisaMarcaModelo || (marcaManual.trim() !== '' && modeloManual.trim() !== ''));

  const handleOpenWa = (msgExtra = '') => {
    track('consignacao_whatsapp_click', { nome });
    const text = msgExtra || `Olá! Gostaria de saber mais sobre a Consignação de Veículos na DG Automóveis em Rio do Sul.`;
    window.open(waLink(text), '_blank');
  };

  // Step 1 Submit
  const handleContato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contatoValido || leadLoading) return;
    setLeadLoading(true);
    saveStoredLead({ nome: nome.trim(), telefone: rawPhone, cidade: cidade.trim() });
    await registrarLeadConsignacao({ lead_id: leadId, nome: nome.trim(), telefone: rawPhone, cidade: cidade.trim() });
    setLeadLoading(false);
    setStep(2);

    const card = document.getElementById('consignacao-form-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Step 2 Plate Lookup
  const handleBuscarPlaca = async () => {
    if (cleanPlaca.length < 7 || placaLoading) return;
    setPlacaLoading(true);
    setPlacaError('');

    try {
      const res = await consultarPlaca(cleanPlaca);
      setPlacaLoading(false);
      if (res.ok && res.veiculo) {
        setVeiculo(res.veiculo);
        if (res.veiculo.cor) setCor(res.veiculo.cor);
        setStep(3);
      } else {
        setPlacaError(res.error || 'Não encontramos os dados automáticos da placa. Você pode preencher manualmente.');
        setVeiculo(null);
        setStep(3);
      }
    } catch (err) {
      setPlacaLoading(false);
      setPlacaError('Erro ao consultar a placa. Você pode preencher manualmente.');
      setVeiculo(null);
      setStep(3);
    }
  };

  const handleSemPlaca = () => {
    setVeiculo(null);
    setStep(3);
  };

  // Step 3 Final Submit
  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!veiculoValido || sending) return;
    setSending(true);

    saveStoredLead({ nome: nome.trim(), telefone: rawPhone, cidade: cidade.trim() });

    const payload = {
      lead_id: leadId,
      tipo_funil: 'Consignacao',
      cliente: {
        nome: nome.trim(),
        telefone: rawPhone,
        cidade: cidade.trim(),
      },
      veiculo: {
        placa: cleanPlaca || null,
        marca: veiculo?.marca || marcaManual.trim() || null,
        modelo: veiculo?.modelo || modeloManual.trim() || null,
        versao: veiculo?.versao || null,
        ano: veiculo?.ano || null,
        combustivel: veiculo?.combustivel || null,
        fipeValor: veiculo?.fipeValor || null,
        km: onlyNumber(km),
        cor: cor.trim(),
      },
      consignacao: {
        modalidade,
        valorDesejado: onlyNumber(valorLiquido) / 100,
        valorDesejadoFormatado: valorLiquido,
        observacoes: obs.trim() || null,
      },
      contexto: {
        fonte: 'site-dg',
        pagina: '/consignacao',
      },
      nome: nome.trim(),
      telefone: rawPhone,
      cidade: cidade.trim(),
      placa: cleanPlaca || null,
      marca: veiculo?.marca || marcaManual.trim() || null,
      modelo: veiculo?.modelo || modeloManual.trim() || null,
      versao: veiculo?.versao || null,
      ano: veiculo?.ano || null,
      combustivel: veiculo?.combustivel || null,
      fipe: veiculo?.fipeValor || null,
      km: onlyNumber(km),
      cor: cor.trim(),
      valor_desejado: onlyNumber(valorLiquido) / 100,
      valor_desejado_formatado: valorLiquido,
      modalidade_consignacao: modalidade,
      observacoes: obs.trim() || null,
    };

    await enviarConsignacao(payload);
    setSending(false);
    setStep(4);
    track('consignacao_submit_success', { marca: veiculo?.marca || marcaManual });
  };

  return (
    <SiteShell title="Consignação de Veículos | DG Automóveis Rio do Sul">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-10">
        
        {/* HERO HERO CONTAINER (ESTILO MANOS VEÍCULOS LUXO) */}
        <section className="bg-gradient-to-br from-[#060B14] via-[#0B1120] to-[#060B14] text-[#FFFFFF] rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden border border-[#38BDF8]/30 shadow-2xl">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src="/fachada-dg.png"
              alt="Fachada DG Automóveis"
              className="w-full h-full object-cover opacity-30 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060B14]/95 via-[#0B1120]/85 to-[#060B14]/75" />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Texto de Apresentação Hero */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 tracking-wider uppercase">
                <Award className="w-4 h-4 text-[#38BDF8]" />
                <span>Consignação Transparente · Rio do Sul/SC</span>
              </div>

              <div className="space-y-3">
                <h1 className="font-serif font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight drop-shadow-md">
                  Venda seu carro pelo <span className="text-[#38BDF8]">valor máximo</span> sem se preocupar com visitas.
                </h1>
                <p className="text-sm sm:text-base text-[#E2E8F0] leading-relaxed max-w-2xl">
                  Você define o valor líquido no bolso. Nós anunciamos nos maiores portais de SC, higienizamos seu veículo, oferecemos <strong className="text-white">financiamento bancário</strong> para o comprador e aceitamos a troca dele.
                </p>
              </div>

              {/* Pilares de Vantagens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  { title: 'Financiamento em até 60x', desc: 'Aceleramos a venda porque 80% compram financiado', icon: <TrendingUp className="w-4 h-4 text-[#38BDF8]" /> },
                  { title: 'Aceitamos Troca do Comprador', desc: 'Pegamos o usado dele e você recebe dinheiro limpo', icon: <Handshake className="w-4 h-4 text-[#38BDF8]" /> },
                  { title: 'Física ou Virtual', desc: 'Exponha na loja de Rio do Sul ou continue usando seu carro', icon: <ShieldCheck className="w-4 h-4 text-emerald-400" /> },
                  { title: 'Tráfego Pago & Fotos HD', desc: 'Anúncios patrocinados de alta conversão nas redes', icon: <Camera className="w-4 h-4 text-[#38BDF8]" /> },
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#060B14]/70 backdrop-blur-xs p-3.5 rounded-2xl border border-[#38BDF8]/20 flex items-start gap-3">
                    <div className="p-2 bg-[#0B1120] rounded-xl border border-[#38BDF8]/30 flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-xs text-white">{item.title}</h3>
                      <p className="text-[11px] text-[#E2E8F0]/75 leading-tight">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão de Dúvidas Direct WhatsApp */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleOpenWa('Olá! Gostaria de conversar com o especialista em consignação da DG Automóveis.')}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl transition-all flex items-center gap-2 shadow-lg active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>Falar com Especialista no WhatsApp</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-[#E2E8F0]/80 font-medium">
                  <Building2 className="w-4 h-4 text-[#38BDF8]" />
                  <span>Atendimento presencial em Rio do Sul/SC</span>
                </div>
              </div>
            </div>

            {/* FORMULÁRIO MULTI-STEP CARD (DESIGN SISTEMA MANOS VEÍCULOS) */}
            <div id="consignacao-form-card" className="lg:col-span-5 w-full">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl text-[#0B1120] space-y-6">
                
                {/* Cabeçalho do Card & Indicador de Progresso */}
                <div className="space-y-3 pb-2 border-b border-[#F1F5F9]">
                  <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider">
                    <span className="text-[#0052FF] flex items-center gap-1.5 font-serif">
                      <Sparkles className="w-4 h-4 text-[#0052FF]" />
                      {step === 1 && 'Etapa 1 de 3 · Seus Dados'}
                      {step === 2 && 'Etapa 2 de 3 · Placa do Carro'}
                      {step === 3 && 'Etapa 3 de 3 · Valor & Modalidade'}
                      {step === 4 && 'Consignação Solicitada'}
                    </span>
                    <span className="text-[#475569]/70 font-sans text-[11px]">
                      {step === 1 && '30 segundos'}
                      {step === 2 && 'FIPE Automática'}
                      {step === 3 && 'Sem Taxa Inicial'}
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#0052FF]"
                      initial={{ width: '33%' }}
                      animate={{ width: `${step * 33}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {/* STEP 1: DADOS DE CONTATO */}
                  {step === 1 && (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="space-y-1 text-left">
                        <h2 className="font-serif font-extrabold text-xl text-[#0B1120]">
                          Simular Proposta de Consignação
                        </h2>
                        <p className="text-xs text-[#475569] leading-relaxed">
                          Informe seus dados de contato para calcularmos o potencial de venda do seu seminovo.
                        </p>
                      </div>

                      <form onSubmit={handleContato} className="space-y-3.5">
                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider ml-1">
                            Seu Nome Completo *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Carlos Andrade"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className="w-full px-4 py-3.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120]"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider ml-1">
                            WhatsApp de Contato (com DDD) *
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              required
                              placeholder="(47) 99999-9999"
                              value={telefone}
                              onChange={(e) => setTelefone(formatPhone(e.target.value))}
                              className="w-full px-4 py-3.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120]"
                            />
                            {rawPhone.length >= 10 && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider ml-1">
                            Sua Cidade *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Rio do Sul"
                            value={cidade}
                            onChange={(e) => setCidade(e.target.value)}
                            className="w-full px-4 py-3.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120]"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={!contatoValido || leadLoading}
                          className="w-full py-4 bg-[#0052FF] hover:bg-[#003ECC] disabled:opacity-40 text-[#FFFFFF] font-bold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-md min-h-[46px]"
                        >
                          {leadLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                          ) : (
                            <>Avançar para Dados do Carro <ArrowRight className="w-4 h-4" /></>
                          )}
                        </button>

                        <p className="text-[10px] text-[#475569]/70 flex items-center justify-center gap-1 pt-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Seus dados estão seguros · Sem custos iniciais
                        </p>
                      </form>
                    </motion.div>
                  )}

                  {/* STEP 2: CONSULTA DE PLACA */}
                  {step === 2 && (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="space-y-1 text-left">
                        <h2 className="font-serif font-extrabold text-xl text-[#0B1120]">
                          Informe a Placa do Carro
                        </h2>
                        <p className="text-xs text-[#475569] leading-relaxed">
                          Buscamos ano, versão e FIPE automaticamente na base de dados oficial.
                        </p>
                      </div>

                      <div className="space-y-3.5">
                        <div className="bg-[#F8FAFC] rounded-2xl p-4 border-2 border-[#E2E8F0] text-center space-y-1 shadow-inner">
                          <div className="flex items-center justify-between text-[9px] font-extrabold tracking-widest text-[#475569] uppercase">
                            <span>Brasil</span>
                            <span>Mercosul</span>
                          </div>
                          <input
                            type="text"
                            autoFocus
                            autoCapitalize="characters"
                            placeholder="ABC1D23"
                            value={placa}
                            onChange={(e) => { setPlaca(formatPlacaDisplay(e.target.value)); setPlacaError(''); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarPlaca(); }}
                            className="w-full py-1 text-center text-3xl font-extrabold tracking-[0.2em] text-[#0B1120] bg-transparent outline-hidden uppercase placeholder:text-[#E2E8F0]"
                          />
                        </div>

                        {placaError && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2 text-left">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <span>{placaError}</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleBuscarPlaca}
                          disabled={cleanPlaca.length < 7 || placaLoading}
                          className="w-full py-4 bg-[#0052FF] hover:bg-[#003ECC] disabled:opacity-40 text-[#FFFFFF] font-bold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-md min-h-[46px]"
                        >
                          {placaLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Consultando FIPE...</>
                          ) : (
                            <><Search className="w-4 h-4" /> Buscar Dados da Placa</>
                          )}
                        </button>

                        <div className="pt-2 text-center border-t border-[#F1F5F9]">
                          <button
                            type="button"
                            onClick={handleSemPlaca}
                            className="text-xs font-bold text-[#0052FF] hover:underline"
                          >
                            Prefere informar o modelo manualmente? Clique aqui
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: VALOR LÍQUIDO & MODALIDADE */}
                  {step === 3 && (
                    <motion.div
                      key="step-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="space-y-1 text-left">
                        <h2 className="font-serif font-extrabold text-xl text-[#0B1120]">
                          Valor & Modalidade Preferida
                        </h2>
                        <p className="text-xs text-[#475569] leading-relaxed">
                          Informe quanto quer receber livre e a forma de consignação.
                        </p>
                      </div>

                      {veiculo && (veiculo.marca || veiculo.modelo) && (
                        <div className="p-3.5 bg-[#F1F5F9] border border-[#38BDF8] rounded-2xl text-left space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-[#0052FF] uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Carro Identificado
                            </span>
                            {veiculo.fipeValor && (
                              <span className="text-xs font-bold text-emerald-800">FIPE: {veiculo.fipeValor}</span>
                            )}
                          </div>
                          <p className="text-xs font-serif font-bold text-[#0B1120]">
                            {veiculo.marca} {veiculo.modelo} {[veiculo.versao, veiculo.ano].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      )}

                      <form onSubmit={handleEnviar} className="space-y-3.5 text-left">
                        {precisaMarcaModelo && (
                          <>
                            <div className="space-y-1">
                              <label className="text-[10px] font-extrabold text-[#475569] uppercase ml-1">Marca do Carro</label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: Toyota"
                                value={marcaManual}
                                onChange={(e) => setMarcaManual(e.target.value)}
                                className="w-full px-4 py-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-extrabold text-[#475569] uppercase ml-1">Modelo e Versão</label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: Corolla XEi 2.0"
                                value={modeloManual}
                                onChange={(e) => setModeloManual(e.target.value)}
                                className="w-full px-4 py-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120]"
                              />
                            </div>
                          </>
                        )}

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-[#475569] uppercase ml-1">Quilometragem (km)</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: 60.000"
                              value={km}
                              onChange={(e) => setKm(formatThousands(e.target.value))}
                              className="w-full px-3.5 py-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-[#475569] uppercase ml-1">Cor do Carro</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Preto"
                              value={cor}
                              onChange={(e) => setCor(e.target.value)}
                              className="w-full px-3.5 py-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120]"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-[#475569] uppercase ml-1">Valor Líquido no Bolso</label>
                          <input
                            type="text"
                            required
                            placeholder="R$ 0,00"
                            value={valorLiquido}
                            onChange={(e) => setValorLiquido(formatBRL(e.target.value))}
                            className="w-full px-4 py-3.5 text-sm font-extrabold bg-[#F8FAFC] border border-[#0052FF] rounded-xl focus:outline-hidden text-[#0052FF]"
                          />
                          <p className="text-[10px] text-[#475569] ml-1">Você recebe exatamente este valor na venda.</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-[#475569] uppercase ml-1">Modalidade Preferida</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setModalidade('Fisica')}
                              className={`p-3 rounded-xl border text-xs font-bold transition-all text-left space-y-0.5 ${
                                modalidade === 'Fisica'
                                  ? 'bg-[#F1F5F9] border-[#0052FF] text-[#0052FF] ring-2 ring-[#0052FF]/20'
                                  : 'bg-white border-[#E2E8F0] text-[#0B1120] hover:border-[#0052FF]'
                              }`}
                            >
                              <span className="block font-serif font-bold">Física (Showroom)</span>
                              <span className="block text-[10px] text-[#475569]">Carro exposto na loja</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setModalidade('Virtual')}
                              className={`p-3 rounded-xl border text-xs font-bold transition-all text-left space-y-0.5 ${
                                modalidade === 'Virtual'
                                  ? 'bg-[#F1F5F9] border-[#0052FF] text-[#0052FF] ring-2 ring-[#0052FF]/20'
                                  : 'bg-white border-[#E2E8F0] text-[#0B1120] hover:border-[#0052FF]'
                              }`}
                            >
                              <span className="block font-serif font-bold">Virtual</span>
                              <span className="block text-[10px] text-[#475569]">Continua rodando com o carro</span>
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={!veiculoValido || sending}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 min-h-[48px] mt-2"
                        >
                          {sending ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Enviando Proposta...</>
                          ) : (
                            <>Solicitar Proposta de Consignação <ArrowRight className="w-4 h-4" /></>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* STEP 4: CONFIRMAÇÃO DE SUCESSO */}
                  {step === 4 && (
                    <motion.div
                      key="step-4"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-5 py-3"
                    >
                      <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                        <CheckCircle2 className="w-9 h-9" />
                      </div>

                      <div className="space-y-1.5">
                        <h2 className="font-serif font-extrabold text-2xl text-[#0B1120]">
                          Solicitação Recebida com Sucesso!
                        </h2>
                        <p className="text-xs text-[#475569] leading-relaxed">
                          Obrigado, <strong>{nome}</strong>! Nossa equipe da DG Automóveis em Rio do Sul já está analisando o seu veículo para dar andamento.
                        </p>
                      </div>

                      <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] text-xs text-[#0B1120] space-y-1 text-left">
                        <span className="text-[10px] font-extrabold text-[#0052FF] uppercase">Próximo Passo</span>
                        <p className="text-[#475569] leading-relaxed">
                          Entraremos em contato no WhatsApp <strong>{telefone}</strong> para agendar a fotos ou vistoria.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenWa(`Olá! Enviei a proposta de consignação do meu carro no site (${veiculo?.marca || marcaManual} ${veiculo?.modelo || modeloManual}) e gostaria de agendar atendimento.`)}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl shadow-md flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4 text-white" />
                        <span>Falar com Consultor no WhatsApp Agora</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </div>

          </div>
        </section>

        {/* SEÇÃO TRANSPARÊNCIA: VENDER PARTICULAR VS CONSIGNAR NA MANOS */}
        <section className="space-y-6">
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#F1F5F9] text-[#0052FF] uppercase tracking-wider">
              Comparativo Transparente
            </span>
            <h2 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#0B1120]">
              Por que consignar é a escolha mais inteligente?
            </h2>
            <p className="text-xs sm:text-sm text-[#475569]">
              Entenda a diferença entre tentar vender sozinho e contar com a estrutura da DG Automóveis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card Vender Particular */}
            <div className="bg-white p-6 rounded-3xl border border-red-200 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-red-100">
                <h3 className="font-serif font-extrabold text-lg text-red-800">Vender Particular</h3>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">Demorado & Arriscado</span>
              </div>
              <ul className="space-y-3 text-xs text-[#475569]">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mt-0.5">✕</span>
                  <span>Sem opção de financiamento bancário (perde 80% dos compradores).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mt-0.5">✕</span>
                  <span>Não aceita veículo usado na troca do comprador.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mt-0.5">✕</span>
                  <span>Desgaste com curiosos e riscos de golpes ou encontros com estranhos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mt-0.5">✕</span>
                  <span>Perda de tempo agendando horários e mostrando o carro repetidamente.</span>
                </li>
              </ul>
            </div>

            {/* Card Consignar na DG Automóveis */}
            <div className="bg-white p-6 rounded-3xl border-2 border-[#0052FF] shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#0052FF] text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl">
                Recomendado
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                <h3 className="font-serif font-extrabold text-lg text-[#0B1120]">Consignar na DG</h3>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">Rápido & Seguro</span>
              </div>
              <ul className="space-y-3 text-xs text-[#0B1120]">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 font-extrabold" />
                  <span><strong>Financiamento Bancário Facilitado:</strong> aprovamos crédito em até 60x para o comprador.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 font-extrabold" />
                  <span><strong>Aceitamos Troca:</strong> recebemos o usado do comprador e pagamos seu valor líquido limpo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 font-extrabold" />
                  <span><strong>Segurança Total:</strong> contrato formal, pátio coberto monitorado em Rio do Sul ou consignação virtual.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 font-extrabold" />
                  <span><strong>Zero Incomodação:</strong> equipe profissional cuida de fotos, anúncios e toda a negociação.</span>
                </li>
              </ul>
            </div>

          </div>
        </section>

        {/* DEPOIMENTOS DE CLIENTES */}
        <section className="bg-[#F1F5F9] rounded-3xl p-6 sm:p-10 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-serif font-extrabold text-2xl text-[#0B1120]">
              Quem consignou na DG recomenda
            </h2>
            <p className="text-xs text-[#475569]">Histórias reais de proprietários em Rio do Sul e região.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REVIEWS_CONSIGNACAO.map((rev, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-500 text-xs">★★★★★</div>
                  <span className="text-[10px] font-extrabold bg-[#F1F5F9] text-[#0052FF] px-2 py-0.5 rounded-md">
                    {rev.tempo}
                  </span>
                </div>
                <p className="text-xs text-[#0B1120] italic leading-relaxed">
                  "{rev.texto}"
                </p>
                <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#0B1120]">{rev.nome}</span>
                  <span className="text-[#475569]">{rev.carro}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ PERGUNTAS FREQUENTES */}
        <section className="space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-serif font-extrabold text-2xl text-[#0B1120]">
              Perguntas Frequentes sobre Consignação
            </h2>
            <p className="text-xs text-[#475569]">Tire todas as suas dúvidas com transparência total.</p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS_CONSIGNACAO.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden transition-all shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 font-serif font-bold text-sm text-[#0B1120] hover:text-[#0052FF]"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#0052FF] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-[#475569] leading-relaxed border-t border-[#F1F5F9] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </SiteShell>
  );
}
