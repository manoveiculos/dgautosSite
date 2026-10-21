import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  Handshake, 
  CreditCard, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Clock,
  ExternalLink,
  Star,
  StarHalf,
  ShieldCheck,
  Shield,
  MapPin,
  Zap,
  Building2,
  LayoutGrid,
  Phone,
  Sparkles
} from 'lucide-react';
import { cn } from './lib/utils';
import { createLead, registrarLeadParcial, novoLeadId } from './lib/leads';
import {
  trackFunnelStart,
  trackFunnelStep,
  trackViewVehicle,
  trackSelectVehicle,
  trackLead,
  trackLeadParcial,
  trackContato,
} from './lib/tracking';
import { fetchStock, type Vehicle } from './services/stockService';
import { lojaAberta, promessaDeRetorno, statusConsultores } from './lib/horario';
import { generateAutoDealerSchema } from './lib/seoSchemas';

type LeadType = 'Compra' | 'Venda' | 'Financiamento';

/**
 * `fase` roda por fora da numeração de passos de propósito: a tela de contato
 * entra em momentos diferentes de cada funil (logo de cara em Venda e
 * Financiamento; depois de escolher o carro em Compra) sem renumerar o quiz.
 */
interface QuizState {
  step: number;
  type: LeadType | null;
  data: Record<string, any>;
  selectedVehicle: Vehicle | null;
  fase: 'quiz' | 'contato';
}

// ---------------------------------------------------------------------------
// Persistência da sessão do funil (UX-09).
// sessionStorage, não localStorage: retomar de onde parou faz sentido na mesma
// visita; dias depois, o estoque e a intenção já mudaram.
// ---------------------------------------------------------------------------
const SESSAO_KEY = 'manos_funil_sessao_v1';

interface SessaoSalva {
  quiz: QuizState;
  leadId: string;
  contatoSalvo: boolean;
}

function sessaoSalva(): SessaoSalva | null {
  try {
    const raw = sessionStorage.getItem(SESSAO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessaoSalva;
    if (!parsed?.quiz || typeof parsed.quiz.step !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function salvarSessao(sessao: SessaoSalva): void {
  try {
    sessionStorage.setItem(SESSAO_KEY, JSON.stringify(sessao));
  } catch {
    /* modo privado / storage cheio — o funil segue normalmente */
  }
}

function limparSessao(): void {
  try {
    sessionStorage.removeItem(SESSAO_KEY);
  } catch {
    /* noop */
  }
}

export default function App() {
  const [quiz, setQuiz] = useState<QuizState>({
    step: 1,
    type: null,
    data: {},
    selectedVehicle: null,
    fase: 'quiz',
  });
  const [stock, setStock] = useState<Vehicle[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPlanB, setShowPlanB] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mesmo id no lead parcial e no completo, para o n8n atualizar o registro em
  // vez de criar dois.
  const [leadId] = useState(() => sessaoSalva()?.leadId ?? novoLeadId());
  const [contatoSalvo, setContatoSalvo] = useState(() => sessaoSalva()?.contatoSalvo ?? false);
  const [salvandoContato, setSalvandoContato] = useState(false);

  // Retoma de onde parou. Antes, recarregar a página — ou sair para o WhatsApp e
  // voltar — jogava a pessoa de volta no passo 1, com todas as respostas
  // perdidas. A sessão é descartada assim que o lead é finalizado.
  useEffect(() => {
    try {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(generateAutoDealerSchema());
      document.head.appendChild(script);
    } catch {}

    const salva = sessaoSalva();
    if (!salva) return;
    // Um deep link novo (?id=) manda mais que a sessão antiga.
    if (new URLSearchParams(window.location.search).get('id')) return;
    if (salva.quiz.step > 1 || salva.quiz.fase === 'contato') setQuiz(salva.quiz);
  }, []);

  useEffect(() => {
    if (isSuccess) {
      limparSessao();
      return;
    }
    if (quiz.step === 1 && quiz.fase === 'quiz') return;
    salvarSessao({ quiz, leadId, contatoSalvo });
  }, [quiz, leadId, contatoSalvo, isSuccess]);

  const formatPhone = (val: string) => {
    let r = val.replace(/\D/g, "");
    if (r.length > 11) r = r.substring(0, 11);
    if (r.length > 10) {
      return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (r.length > 6) {
      return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (r.length > 2) {
      return r.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
    } else if (r.length > 0) {
      return "(" + r;
    }
    return r;
  };

  useEffect(() => {
    // Evento de funil dedicado. A versão anterior disparava PageView a cada
    // passo "para manter a atividade alta" — o que inflava o volume de PageView
    // ~9x sem mexer no Lead e ensinava a Meta com um sinal falso de qualidade.
    if (quiz.step > 1) trackFunnelStep(quiz.type, quiz.step);
  }, [quiz.step, quiz.type]);

  const handleWhatsAppClick = (context: string) => {
    trackContato('whatsapp', context);
    const message = encodeURIComponent(`Olá, estou no site e gostaria de falar com um consultor sobre ${context}.`);
    window.open(`https://wa.me/5547989169598?text=${message}`, '_blank');
  };

  const lojaEstaAberta = lojaAberta();

  useEffect(() => {
    const loadStock = async () => {
      setIsLoadingStock(true);
      const data = await fetchStock();
      setStock(data);
      setIsLoadingStock(false);

      // Handle Catalog Match / Direct Entry
      const params = new URLSearchParams(window.location.search);
      const contentId = params.get('content_id') || params.get('id');
      
      if (contentId && data.length > 0) {
        const vehicle = data.find(v => v.id === contentId);
        if (vehicle) {
          trackViewVehicle(vehicle);
          // Quem chega por link direto do catálogo é a maior intenção do site.
          // Pede o contato de imediato (com o carro à vista na tela) e só então
          // segue para troca / financiamento / cidade — antes esse visitante
          // caía num formulário nu no passo 9 e virava o lead mais fraco da fila.
          setQuiz(prev => ({
            step: 5, // troca -> financiamento -> cidade -> confirmação
            type: 'Compra',
            data: comContato(prev, { has_interest: 'Sim', vehicle_id: vehicle.id, origem: 'catalogo' }),
            selectedVehicle: vehicle,
            fase: 'contato',
          }));
        }
      }
    };
    loadStock();
  }, []);

  const handleSelectVehicle = (vehicle: Vehicle) => {
    trackSelectVehicle(vehicle);

    setQuiz(prev => ({
      ...prev,
      selectedVehicle: vehicle,
      step: prev.type === 'Compra' ? 5 : 4,
      // Em Compra o contato é pedido AQUI: a pessoa já viu o estoque e escolheu
      // um carro (recebeu valor e mostrou intenção), mas ainda faltam 4 telas
      // de qualificação — que antes eram respondidas por um visitante anônimo.
      fase: contatoSalvo ? 'quiz' : 'contato',
    }));
  };

  /**
   * Monta o `data` de um novo trecho do funil PRESERVANDO o contato já digitado.
   *
   * Sem isto havia um beco sem saída: depois de dar o telefone, voltar para a
   * home zerava name/phone enquanto `contatoSalvo` continuava true. A tela final
   * então pulava o formulário (porque o contato "já existe"), mostrava os dados
   * em branco e deixava o botão Finalizar desabilitado para sempre — o cliente
   * ficava preso e o lead completo nunca chegava ao consultor.
   */
  const comContato = (prev: QuizState, extra: Record<string, any> = {}) =>
    prev.data.name ? { name: prev.data.name, phone: prev.data.phone, ...extra } : { ...extra };

  /** Volta ao início mantendo o contato já capturado. */
  const voltarAoInicio = () =>
    setQuiz(prev => ({ step: 1, type: null, data: comContato(prev), selectedVehicle: null, fase: 'quiz' }));

  /** Carro escolhido direto na home — pula o menu e o passo "qual o seu foco". */
  const escolherDaHome = (vehicle: Vehicle) => {
    trackFunnelStart('Compra');
    trackSelectVehicle(vehicle);
    setQuiz(prev => ({
      step: 5, // troca -> financiamento -> cidade -> confirmação
      type: 'Compra',
      data: comContato(prev, { has_interest: 'Sim', vehicle_id: vehicle.id, origem: 'home' }),
      selectedVehicle: vehicle,
      fase: contatoSalvo ? 'quiz' : 'contato',
    }));
  };

  /** Lista completa do estoque, com a busca já digitada na home preservada. */
  const irParaEstoque = () => {
    trackFunnelStart('Compra');
    setQuiz(prev => ({ step: 3, type: 'Compra', data: comContato(prev, { has_interest: 'Sim' }), selectedVehicle: null, fase: 'quiz' }));
  };

  /** Para quem ainda não sabe o modelo: entra pela faixa de preço. */
  const irParaFaixaDePreco = () => {
    trackFunnelStart('Compra');
    setQuiz(prev => ({ step: 3, type: 'Compra', data: comContato(prev, { has_interest: 'Não' }), selectedVehicle: null, fase: 'quiz' }));
  };

  const handleInitialChoice = (type: LeadType) => {
    trackFunnelStart(type);
    setQuiz(prev => ({
      step: 2,
      type,
      data: comContato(prev),
      selectedVehicle: null,
      // Venda e Financiamento entregam justamente o retorno do consultor, então
      // o contato vem primeiro (mesmo padrão do /vendasrapidas). Compra precisa
      // mostrar carro antes de pedir telefone.
      fase: type === 'Compra' || contatoSalvo ? 'quiz' : 'contato',
    }));
  };

  const handleDataChange = (field: string, value: any) => {
    setQuiz(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value },
    }));
  };

  const nextStep = () => {
    setQuiz(prev => ({ ...prev, step: prev.step + 1 }));
  };

  /**
   * Grava o contato assim que ele é digitado, no meio do funil. É a correção de
   * maior impacto do site: antes, o lead só passava a existir no último passo
   * (9 em Compra, 10 em Venda), então todo abandono era invisível.
   * Nunca bloqueia — se a entrega falhar, o cliente segue e o envio final
   * tenta de novo.
   */
  const handleContatoSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isFormValid || salvandoContato || !quiz.type) return;

    setSalvandoContato(true);
    setError(null);

    const phone = quiz.data.phone.replace(/\D/g, '');
    const eventId = trackLeadParcial({
      tipo: quiz.type,
      valor: quiz.selectedVehicle?.price ?? null,
    });

    await registrarLeadParcial({
      lead_id: leadId,
      name: quiz.data.name,
      phone,
      lead_type: quiz.type,
      event_id: eventId,
      details: {
        id_veiculo: quiz.selectedVehicle?.id,
        nome_veiculo: quiz.selectedVehicle?.description,
        valor_veiculo: quiz.selectedVehicle?.price,
        link_veiculo: quiz.selectedVehicle?.link,
        origem: quiz.data.origem,
      },
    });

    setContatoSalvo(true);
    setSalvandoContato(false);
    setQuiz(prev => ({ ...prev, fase: 'quiz' }));
  };

  const navigateBack = () => {
    // Sair da tela de contato volta para o passo do quiz que a originou.
    if (quiz.fase === 'contato') {
      if (contatoSalvo) {
        setQuiz(prev => ({ ...prev, fase: 'quiz' }));
      } else if (quiz.type === 'Compra' && quiz.selectedVehicle) {
        setQuiz(prev => ({ ...prev, fase: 'quiz', step: prev.data.has_interest === 'Sim' ? 3 : 4 }));
      } else {
        voltarAoInicio();
      }
      return;
    }

    // Compra entra direto no passo 3 pela home — o passo 2 não existe mais nesse
    // funil, então voltar dali tem que ir para o início.
    if (quiz.step === 3 && quiz.type === 'Compra') {
      voltarAoInicio();
    } else if (quiz.step === 7 && quiz.data.tem_troca === 'Não' && quiz.type === 'Compra') {
      setQuiz(prev => ({ ...prev, step: 5 }));
    } else if (quiz.step === 2) {
      voltarAoInicio();
    } else if (quiz.step > 1) {
      setQuiz(prev => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const phone = quiz.data.phone?.replace(/\D/g, '') || '';
    if (!quiz.data.name || phone.length < 10) {
      setError("Por favor, preencha seu nome e um WhatsApp válido.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { name, phone: rawPhone, ...otherData } = quiz.data;

      const eventId = trackLead({
        tipo: quiz.type!,
        valor: quiz.selectedVehicle?.price ?? null,
        vehicleId: quiz.selectedVehicle?.id ?? null,
        vehicleName: quiz.selectedVehicle?.description ?? null,
      });

      await createLead({
        lead_id: leadId,
        name,
        phone,
        lead_type: quiz.type!,
        stage: 'completo',
        event_id: eventId,
        details: {
          ...otherData,
          id_veiculo: quiz.selectedVehicle?.id,
          nome_veiculo: quiz.selectedVehicle?.description,
          valor_veiculo: quiz.selectedVehicle?.price,
          link_veiculo: quiz.selectedVehicle?.link,
          resumo: `Lead de ${quiz.type} | Interessado em: ${quiz.selectedVehicle ? quiz.selectedVehicle.description : (quiz.data.marca_modelo || quiz.data.carro_venda || 'não especificado')} | Detalhes: ${quiz.data.has_car || ''} ${quiz.data.down_payment || ''} ${quiz.data.desired_payment || ''}`
        },
      });

      setIsSuccess(true);
    } catch (err) {
      console.error("Submission error:", err);
      // O contato já foi gravado no início do funil: mesmo com erro aqui, o
      // consultor tem como retomar. A mensagem reflete isso em vez de assustar.
      setError(
        contatoSalvo
          ? "Não conseguimos enviar os últimos detalhes, mas seu contato já está com a gente."
          : "Ocorreu um erro ao salvar seus dados.",
      );
      setShowPlanB(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Venda saiu daqui: agora roda inteiro no /vendasrapidas (contato -> placa ->
  // detalhes), em vez de pedir o preço desejado na segunda tela.
  const getMaxSteps = () => {
    if (quiz.type === 'Compra') return 9;
    if (quiz.type === 'Financiamento') return 6;
    return 1;
  };

  const maxSteps = getMaxSteps();
  const progressValue = (quiz.step / maxSteps) * 100;
  const isPhoneValid = (quiz.data.phone?.replace(/\D/g, '') || '').length >= 10;
  const isFormValid = quiz.data.name && isPhoneValid;

  /**
   * Fonte única da verdade para "esta é a tela final". As três condições viviam
   * duplicadas no corpo e no rodapé e já tinham divergido: o rodapé habilitava
   * o Finalizar do Financiamento no passo 5 enquanto o formulário só aparecia
   * no 6 — botão morto numa tela, rodapé morto na outra.
   */
  const isContactStep =
    quiz.fase === 'quiz' &&
    ((quiz.step === 9 && quiz.type === 'Compra') ||
      (quiz.step === 6 && quiz.type === 'Financiamento'));

  // Listas derivadas, extraídas do JSX para as telas conseguirem reagir ao
  // resultado vazio em vez de renderizar espaço em branco.
  const resultadosBusca = stock.filter(v =>
    v.description.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const resultadosFaixa = stock.filter(v => {
    if (priceFilter === '50k') return v.price <= 50000;
    if (priceFilter === '100k') return v.price > 50000 && v.price <= 100000;
    if (priceFilter === 'plus') return v.price > 100000;
    return true;
  });

  return (
    <div className="app-viewport lg:max-w-none lg:h-auto lg:min-h-screen lg:bg-[#E2E8F0] lg:flex lg:items-center lg:justify-center lg:p-12">
      <div className="glow-bg" />

      {/* WhatsApp Floating Button */}
      <button 
        onClick={() => handleWhatsAppClick('Estoque e Condições')}
        className="fixed bottom-6 right-6 z-50 group sm:bottom-10 sm:right-10"
      >
        <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="relative w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/20 hover:scale-110 active:scale-95 transition-all">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-white fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </div>
        <div className="absolute right-full mr-4 bottom-1/2 translate-y-1/2">
          <div className="bg-manos-accent text-manos-dark text-[10px] font-extrabold uppercase tracking-widest py-2 px-4 rounded-xl shadow-2xl whitespace-nowrap hidden sm:block">
            Precisa de ajuda imediata?
          </div>
        </div>
      </button>

      <div className="app-viewport">
        {/* Desktop Side Showcase Panel (Visible on lg screens >= 1024px) */}
        <aside className="hidden lg:flex flex-col bg-[#0B1120] text-[#FFFFFF] p-8 overflow-hidden relative justify-between border-r border-[#E2E8F0]/10">
          {/* Cover Image Background */}
          <div className="absolute inset-0 z-0">
            <img 
              src="/fachada-dg.png" 
              alt="Fachada DG Automóveis" 
              className="w-full h-full object-cover opacity-20 scale-105 filter blur-[1px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-[#0B1120]/90 to-[#0B1120]/65" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <img 
                src="/logo-dg.png" 
                alt="DG Automóveis" 
                className="h-10 w-auto object-contain"
              />
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 bg-manos-red text-manos-accent rounded-full">
                Alto Vale do Itajaí
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFFFFF]/10 border border-[#FFFFFF]/20 rounded-full text-xs font-bold text-[#CBD5E1]">
                <Building2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Sua Revenda de Confiança em Rio do Sul</span>
              </div>
              <h2 className="font-serif text-3xl font-extrabold text-white leading-tight tracking-tight">
                Compre, Venda ou Financie seu Veículo com Segurança
              </h2>
              <p className="text-sm text-[#CBD5E1]/90 font-medium leading-relaxed">
                Atendimento personalizado, veículos 100% revisados com garantia e aprovação facilitada.
              </p>
            </div>

            {/* Featured Cover Card Photo */}
            <div className="relative rounded-2xl overflow-hidden border border-[#FFFFFF]/20 shadow-xl group">
              <img 
                src="/fachada-dg.png" 
                alt="Fachada DG Automóveis" 
                className="w-full h-44 object-cover group-hover:scale-105 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs font-bold">
                <span className="text-white drop-shadow-md">Nossa Loja Física em Rio do Sul/SC</span>
                <span className="text-xs font-extrabold text-[#FFFFFF] bg-manos-red/90 px-2.5 py-0.5 rounded-full">Garantia DG</span>
              </div>
            </div>

            {/* Trust Pillars */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  ★ 4.9
                </div>
                <div>
                  <p className="text-xs font-extrabold text-white">Excelente no Google</p>
                  <p className="text-[11px] text-[#CBD5E1]/70">Liderança em reputação no Alto Vale</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-white">100% Procedência & Vistoria</p>
                  <p className="text-[11px] text-[#CBD5E1]/70">Sem leilão, sem sinistro — nota fiscal e garantia</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Store Status */}
          <div className="relative z-10 pt-4 border-t border-[#FFFFFF]/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", lojaAberta() ? "bg-green-400" : "bg-yellow-400")} />
                <span className="text-xs font-bold text-white">
                  {lojaAberta() ? 'Loja Aberta Agora' : 'Atendimento Digital Ativo'}
                </span>
              </div>
              <span className="text-[11px] text-[#CBD5E1]/60 font-semibold">{statusConsultores()}</span>
            </div>

            <button
              onClick={() => handleWhatsAppClick('Desktop Banner')}
              className="w-full py-3.5 bg-manos-red hover:bg-[#003ECC] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Phone className="w-4 h-4" />
              Chamar no WhatsApp (47) 98916-9598
            </button>
          </div>
        </aside>

        {/* Main Step App Area */}
        <div className="flex flex-col h-full min-h-0 relative overflow-hidden bg-manos-cream">
          {/* Header - Fixed & Minimalist */}
          <header className="p-4 flex flex-col items-center gap-3 z-20 bg-[#0B1120]">
          <img 
            src="/logo-dg.png" 
            alt="DG Automóveis" 
            className="h-9 w-auto object-contain"
          />
          
          {!isSuccess && quiz.step > 1 && (
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-extrabold text-[#CBD5E1]/60 uppercase tracking-widest">
                    {quiz.fase === 'contato' ? 'Seus dados' :
                     quiz.step <= 2 ? 'Início' :
                     quiz.step < maxSteps ? 'Preferências' : 'Finalizando'}
                 </span>
                 <button
                   onClick={navigateBack}
                   className="flex items-center gap-1 text-[10px] font-extrabold text-[#FFFFFF] uppercase tracking-widest hover:brightness-125 active:scale-95 transition-all"
                 >
                   <ChevronLeft className="w-3 h-3" />
                   Voltar
                 </button>
                 <span className="text-[10px] font-extrabold text-[#CBD5E1]/60 uppercase tracking-widest">
                    {quiz.fase === 'contato' ? 'Leva 20 segundos' : `Passo ${quiz.step} de ${maxSteps}`}
                 </span>
              </div>
              <div className="w-full flex items-center gap-3">
               <div className="flex-grow h-1 bg-[#CBD5E1]/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressValue}%` }}
                    className="h-full bg-[#FFFFFF]"
                  />
               </div>
               <span className="text-[10px] font-extrabold text-[#FFFFFF] tracking-widest">{Math.round(progressValue)}%</span>
              </div>
            </div>
          )}
        </header>

      {/* Main Content - Scrollable Region */}
      <main className="scroll-container custom-scrollbar">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center pt-6 space-y-8"
            >
              <div className="relative inline-block">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(34,197,94,0.2)]"
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>
              </div>

              <div className="space-y-4 px-4">
                <h2 className="text-3xl font-extrabold tracking-tight leading-none font-serif text-[#0B1120]">Solicitação Recebida!</h2>
                <div className="space-y-4">
                  <p className="text-[#334155] text-base leading-relaxed">
                    Obrigado pela confiança, <span className="text-manos-red font-bold">{quiz.data.name}</span>! Seus dados foram encaminhados com sucesso para nossa consultoria especializada.
                  </p>
                  <p className="text-[#475569] text-sm leading-relaxed border-l-2 border-manos-red/30 pl-4 py-1 italic">
                    Fique atento ao seu WhatsApp. Em instantes, um de nossos consultores entrará em contato para dar continuidade ao seu atendimento de forma personalizada.
                  </p>
                </div>
              </div>

              <div className="px-4 space-y-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#64748B] text-center">Enquanto isso, explore:</p>
                <a
                  href="/estoque"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-white border border-manos-sand p-6 rounded-2xl flex items-center gap-4 group hover:bg-manos-warm/50 transition-all text-left shadow-lg"
                >
                  <div className="w-12 h-12 bg-manos-red rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-manos-red/15 flex-shrink-0">
                    <ExternalLink className="w-6 h-6 text-manos-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-tight text-[#0B1120]">Navegar pelo Estoque</p>
                    <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest">dgautomoveis.com.br</p>
                  </div>
                </a>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]/40 hover:text-[#64748B] transition-colors"
                >
                  Finalizar Sessão
                </button>
              </div>
            </motion.div>
          ) : quiz.fase === 'contato' ? (
            /* -----------------------------------------------------------------
             * Captura de contato antecipada (LEAD-01).
             * Entra logo no início em Venda/Financiamento e logo após a escolha
             * do carro em Compra. A partir daqui o lead existe no CRM mesmo se a
             * pessoa abandonar o resto do funil.
             * ----------------------------------------------------------------- */
            <motion.div
              key="contato"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6 pb-12"
            >
              {quiz.selectedVehicle && (
                <div className="card-glass p-4 flex items-center gap-4">
                  <div className="w-20 h-16 rounded-xl overflow-hidden bg-manos-warm flex-shrink-0">
                    <img
                      src={quiz.selectedVehicle.image}
                      alt={quiz.selectedVehicle.description}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-extrabold uppercase tracking-widest text-green-600">Carro selecionado</p>
                    <h4 className="font-extrabold text-sm tracking-tight leading-tight font-serif text-[#0B1120] line-clamp-2">
                      {quiz.selectedVehicle.description}
                    </h4>
                    <p className="text-manos-red font-extrabold text-base tracking-tight">
                      {quiz.selectedVehicle.priceFormatted}
                    </p>
                  </div>
                </div>
              )}

              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                  <Zap className="w-3 h-3 text-green-600 fill-current" />
                  <span className="text-[10px] font-extrabold text-green-600 uppercase tracking-widest">
                    {promessaDeRetorno()}
                  </span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight font-serif leading-[0.95] text-[#0B1120]">
                  {quiz.type === 'Financiamento' ? (
                    <>Para onde enviamos <br /><span className="text-manos-red">sua simulação?</span></>
                  ) : (
                    <>Para onde enviamos <br /><span className="text-manos-red">sua proposta?</span></>
                  )}
                </h2>
                <p className="text-xs text-[#64748B] uppercase font-bold tracking-widest">
                  Um consultor fala com você pelo WhatsApp
                </p>
              </div>

              <form onSubmit={handleContatoSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] ml-4">Como devemos te chamar?</label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    autoFocus
                    className="w-full py-5 px-6"
                    placeholder="Nome completo"
                    value={quiz.data.name || ''}
                    onChange={(e) => handleDataChange('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] ml-4">Seu WhatsApp de contato</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      inputMode="numeric"
                      autoComplete="tel"
                      className={cn(
                        "w-full py-5 px-6 pr-12 transition-all",
                        quiz.data.phone && (isPhoneValid ? "border-green-500/50" : "border-red-400/50")
                      )}
                      placeholder="(47) 99999-9999"
                      value={quiz.data.phone || ''}
                      onChange={(e) => handleDataChange('phone', formatPhone(e.target.value))}
                    />
                    {quiz.data.phone && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {isPhoneValid ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <PrivacyNotice />

                <button
                  type="submit"
                  disabled={!isFormValid || salvandoContato}
                  className="w-full py-6 bg-manos-red text-manos-accent font-extrabold text-lg uppercase rounded-2xl shadow-[0_12px_36px_rgba(122,46,30,0.25)] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                >
                  {salvandoContato ? 'Enviando...' : 'Continuar'}
                </button>

                <div className="flex items-center justify-center gap-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleWhatsAppClick('Atendimento direto')}
                    className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest hover:text-[#475569] transition-colors"
                  >
                    Falar no WhatsApp
                  </button>
                  <span className="w-px h-4 bg-manos-sand" />
                  <PhoneLink label="Ligar agora" />
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key={quiz.step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-8"
            >
              {quiz.step === 1 && (
                <div className="space-y-6">
                  {/* Hero — foto + headline */}
                  <div className="relative -mx-5 sm:-mx-6 -mt-4 overflow-hidden rounded-b-3xl">
                    <img
                      src="/fachada-dg.png"
                      alt="Fachada DG Automóveis"
                      className="w-full h-[268px] sm:h-[300px] object-cover"
                    />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(46,20,12,0.15) 0%, rgba(46,20,12,0.82) 78%)' }} />
                    <div className="absolute left-5 right-5 bottom-5 sm:left-6 sm:right-6 sm:bottom-6">
                      <div className="inline-flex items-center h-7 px-3 rounded-lg bg-manos-accent text-manos-red text-[12px] font-extrabold tracking-[0.08em]">SEMINOVOS REVISADOS</div>
                      <h1 className="mt-3 font-serif text-[33px] leading-[1.12] font-bold tracking-tight text-white text-balance">
                        A revenda do Alto Vale, de gente que você conhece.
                      </h1>
                    </div>
                  </div>

                  {/* CTA banner */}
                  <div className="p-5 bg-manos-red rounded-2xl">
                    <p className="text-base leading-relaxed text-[#E2E8F0] mb-4">Compra, venda, troca e financiamento em Rio do Sul. Chama no WhatsApp que a conversa começa na hora.</p>
                    <div className="grid grid-cols-[1.4fr_1fr] gap-3">
                      <button
                        onClick={() => handleWhatsAppClick('Atendimento Prioritário')}
                        className="h-[54px] bg-manos-accent text-manos-red font-extrabold text-base rounded-xl"
                      >
                        Chamar no WhatsApp
                      </button>
                      <PhoneLink label="Ligar" className="h-[54px] border-[1.5px] border-[rgba(253,243,231,0.45)] text-manos-accent font-bold text-base rounded-xl justify-center" />
                    </div>
                  </div>

                  {/* Busca */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] w-5 h-5" />
                      <input
                        type="text"
                        className="w-full bg-white border border-[#CBD5E1] rounded-[14px] p-4 pl-12 focus:ring-2 focus:ring-manos-red/20 outline-none text-base transition-all"
                        placeholder="Buscar por modelo, marca ou ano"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') irParaEstoque(); }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setPriceFilter('50k'); irParaFaixaDePreco(); }} className="h-[46px] bg-manos-warm text-manos-red text-[15px] font-bold rounded-xl">
                        Até R$ 50 mil
                      </button>
                      <button onClick={() => { setPriceFilter('100k'); irParaFaixaDePreco(); }} className="h-[46px] bg-manos-warm text-manos-red text-[15px] font-bold rounded-xl">
                        R$ 50–100 mil
                      </button>
                      <button onClick={() => irParaEstoque()} className="h-[46px] bg-manos-warm text-manos-red text-[15px] font-bold rounded-xl">
                        SUVs
                      </button>
                      <button onClick={() => irParaFaixaDePreco()} className="h-[46px] bg-manos-warm text-manos-red text-[15px] font-bold rounded-xl">
                        Motos
                      </button>
                    </div>
                  </div>

                  {/* Escolhidos da semana */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-serif text-[23px] font-bold text-[#0B1120]">Escolhidos da semana</h3>
                      <p className="mt-1 text-[15px] text-[#475569]">Os três que mais saem daqui.</p>
                    </div>
                    <div className="grid gap-3">
                      {isLoadingStock
                        ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                        : resultadosBusca.slice(0, 3).map(v => (
                            <VehicleCardMini key={v.id} vehicle={v} onClick={() => escolherDaHome(v)} />
                          ))}
                    </div>

                    {!isLoadingStock && resultadosBusca.length === 0 && searchQuery && (
                      <p className="text-center text-xs text-[#64748B] py-2">
                        Não temos <span className="text-[#0B1120] font-bold">{searchQuery}</span> no pátio agora —
                        <button onClick={irParaEstoque} className="min-h-0 text-manos-red font-bold underline underline-offset-2 ml-1">
                          ver o que temos
                        </button>
                      </p>
                    )}

                    <button
                      onClick={irParaEstoque}
                      className="w-full h-[52px] border-[1.5px] border-manos-red text-manos-red font-bold text-base rounded-[13px] hover:bg-manos-red/5 active:scale-[0.98] transition-all"
                    >
                      {stock.length > 0 ? `Ver todo o estoque` : 'Ver estoque completo'}
                    </button>
                  </div>

                  {/* Compramos seu carro — numbered steps */}
                  <div className="p-6 bg-manos-warm rounded-2xl">
                    <h3 className="font-serif text-[24px] leading-[1.2] font-bold text-[#0B1120]">Compramos o seu carro</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#6B4E3D]">Avaliação sem compromisso, na loja ou por foto no WhatsApp. Se preferir, entra na troca por um do nosso pátio.</p>
                    <div className="grid gap-2 mt-4">
                      <div className="flex gap-3 items-baseline text-[15px] text-[#0B1120]"><span className="font-extrabold text-manos-red">1</span><span>Manda marca, ano e km</span></div>
                      <div className="flex gap-3 items-baseline text-[15px] text-[#0B1120]"><span className="font-extrabold text-manos-red">2</span><span>A gente avalia e responde no mesmo dia</span></div>
                      <div className="flex gap-3 items-baseline text-[15px] text-[#0B1120]"><span className="font-extrabold text-manos-red">3</span><span>Fecha na loja, com documentação resolvida</span></div>
                    </div>
                    <button
                      onClick={() => { trackFunnelStart('Venda'); window.location.href = '/vendasrapidas'; }}
                      className="w-full h-[54px] mt-5 bg-manos-red text-manos-accent font-extrabold text-base rounded-[13px] active:scale-95 transition-all"
                    >
                      Quero uma avaliação
                    </button>
                  </div>

                  {/* Outros serviços */}
                  <div className="space-y-3">
                    <MainOption
                      icon={<Sparkles className="w-8 h-8 text-amber-600" />}
                      title="Consignar meu Veículo"
                      desc="Venda pelo valor máximo com financiamento aprovado"
                      onClick={() => { trackFunnelStart('Venda'); window.location.href = '/consignacao'; }}
                    />
                    <MainOption
                      icon={<CreditCard className="w-8 h-8" />}
                      title="Simular meu Financiamento"
                      desc="Aprovação rápida e fácil"
                      onClick={() => handleInitialChoice('Financiamento')}
                    />
                  </div>

                  {/* Trust signals — checklist */}
                  <div className="space-y-4 py-2">
                    {[
                      { title: 'Loja física na Dom Pedro II', desc: 'Canoas, Rio do Sul/SC. Pode passar pra ver e dirigir.' },
                      { title: 'Estoque revisado e atualizado', desc: 'Cada veículo passa pela oficina antes de anunciar.' },
                      { title: 'Financiamento com os bancos', desc: 'Simulação de entrada e parcela pelo WhatsApp.' },
                      { title: 'Atendemos no seu horário', desc: 'Com hora marcada, abrimos qualquer dia da semana, inclusive fora do expediente.' },
                    ].map((item) => (
                      <div key={item.title} className="flex gap-3 items-start">
                        <span className="flex-none w-[30px] h-[30px] rounded-full bg-manos-warm text-manos-red flex items-center justify-center text-[15px] font-extrabold">✓</span>
                        <div>
                          <div className="text-[15px] font-extrabold text-[#0B1120]">{item.title}</div>
                          <div className="mt-1 text-[14px] leading-[1.45] text-[#475569]">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Social proof */}
                  <div className="p-6 bg-gradient-to-br from-[#060B14] via-[#0B1120] to-[#060B14] rounded-2xl border border-[#38BDF8]/30 shadow-xl space-y-4">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 uppercase tracking-wider mb-2">
                        Reputação Pública
                      </span>
                      <h3 className="font-serif text-[23px] leading-[1.2] font-bold text-white">Quem já comprou aqui conta</h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-[#E2E8F0]">Nossa reputação é pública e confirmada. Pode conferir antes de vir.</p>
                    </div>
                    <div className="grid gap-3 mt-4">
                      <a href="https://share.google/gVOMunGbpS3ZbjKoa" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#0052FF] transition-all shadow-md group">
                        <span className="flex-none w-11 h-11 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center shadow-xs">
                          <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4z"></path><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.3 15.4 46 24 46z"></path><path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.2-2.9.7-4.3v-5.7H4.5C2.9 17.2 2 20.5 2 24s.9 6.8 2.5 10l7.3-5.7z"></path><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.7 4.5 13.7l7.3 5.7c1.7-5.2 6.5-8.7 12.2-8.7z"></path></svg>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-extrabold text-[#0B1120] flex items-center gap-1.5">
                            Google Avaliações <span className="text-amber-400 text-xs">★★★★★</span>
                          </span>
                          <span className="block mt-0.5 text-[13px] text-[#475569]">Nota máxima de clientes de Rio do Sul</span>
                        </span>
                        <span className="text-[#0052FF] text-lg font-bold group-hover:translate-x-1 transition-transform">›</span>
                      </a>
                      <a href="https://www.google.com/maps/search/?api=1&query=DG+Automoveis+Rua+Dom+Pedro+II+461+Rio+do+Sul+SC" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#0052FF] transition-all shadow-md group">
                        <span className="flex-none w-11 h-11 rounded-full bg-[#0052FF] text-white flex items-center justify-center text-[13px] font-extrabold tracking-wide shadow-xs">DG</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-extrabold text-[#0B1120]">Showroom em Rio do Sul</span>
                          <span className="block mt-0.5 text-[13px] text-emerald-700 font-bold">+250 carros entregues com procedência</span>
                        </span>
                        <span className="text-[#0052FF] text-lg font-bold group-hover:translate-x-1 transition-transform">›</span>
                      </a>
                      <a href="https://www.instagram.com/dgautomoveis__/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#0052FF] transition-all shadow-md group">
                        <span className="flex-none w-11 h-11 rounded-full flex items-center justify-center shadow-xs" style={{ background: 'linear-gradient(45deg, #F9CE34 0%, #EE2A7B 50%, #6228D7 100%)' }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.2" cy="6.8" r="1.1" fill="#FFFFFF" stroke="none"></circle></svg>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-extrabold text-[#0B1120]">@dgautomoveis__</span>
                          <span className="block mt-0.5 text-[13px] text-[#475569]">Novidades diárias e entregas no Instagram</span>
                        </span>
                        <span className="text-[#0052FF] text-lg font-bold group-hover:translate-x-1 transition-transform">›</span>
                      </a>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-6 bg-[#060B14] rounded-2xl text-[#E2E8F0]">
                    <img src="/logo-dg.png" alt="DG Automóveis" className="h-[34px] w-auto" />
                    <div className="mt-3 text-[14px] leading-[1.65]">
                      R. Dom Pedro II, 461 — Canoas<br />Rio do Sul/SC, 89164-138<br />(47) 98916-9598<br />Seg a Sex 8h–19h · Sáb 8h–13h
                    </div>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=DG+Automoveis+Rua+Dom+Pedro+II+461+Rio+do+Sul+SC"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 h-12 mt-4 px-5 rounded-xl bg-manos-accent text-manos-red text-[15px] font-extrabold"
                    >
                      <MapPin className="w-4 h-4" />
                      Como chegar
                    </a>
                    <div className="flex gap-2 mt-4">
                      <a href="https://www.instagram.com/dgautomoveis__/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-10 px-4 rounded-xl border border-[rgba(246,220,200,0.35)] text-[#E2E8F0] text-[14px] font-bold">Instagram</a>
                      <a href="https://www.google.com/maps/search/?api=1&query=DG+Automoveis+Rua+Dom+Pedro+II+461+Rio+do+Sul+SC" target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-10 px-4 rounded-xl border border-[rgba(246,220,200,0.35)] text-[#E2E8F0] text-[14px] font-bold">Google Maps</a>
                      <a href="https://wa.me/message/JLPK7PRHBFKVM1" target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-10 px-4 rounded-xl border border-[rgba(246,220,200,0.35)] text-[#E2E8F0] text-[14px] font-bold">WhatsApp Oficial</a>
                    </div>
                  </div>
                </div>
              )}

              {/* Só Financiamento passa por aqui. Em Compra, a home já leva
                  direto para o estoque ou para a faixa de preço — a tela
                  "Qual o seu foco hoje?" repetia a pergunta que a pessoa
                  acabara de responder ao tocar em ver carros. */}
              {quiz.step === 2 && quiz.type === 'Financiamento' && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-extrabold tracking-tight font-serif text-center text-[#0B1120]">
                    Já escolheu o carro?
                  </h2>
                  <div className="grid gap-4">
                    <QuizButton
                      icon={<Search className="w-6 h-6" />}
                      label="Sim, do estoque"
                      onClick={() => { handleDataChange('has_car', 'Sim, do estoque'); nextStep(); }}
                    />
                    <QuizButton
                      icon={<Car className="w-6 h-6" />}
                      label="Não, ainda procurando"
                      onClick={() => { handleDataChange('has_car', 'Não, ainda procurando'); nextStep(); }}
                    />
                  </div>
                  <div className="pt-4 text-center">
                    <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-extrabold">Ou</p>
                    <button
                      onClick={() => handleWhatsAppClick('Dúvidas sobre financiamento')}
                      className="mt-2 text-xs font-bold text-manos-red uppercase tracking-wider underline underline-offset-4"
                    >
                      Dúvida rápida? Chamar no Whats
                    </button>
                  </div>
                </div>
              )}

              {quiz.step === 3 && (quiz.type === 'Compra' || quiz.type === 'Financiamento') && (
                <div className="space-y-6">
                  {((quiz.type === 'Compra' && quiz.data.has_interest === 'Sim') || 
                    (quiz.type === 'Financiamento' && quiz.data.has_car === 'Sim, do estoque')) ? (
                    <div className="space-y-6">
                      <h2 className="text-3xl font-extrabold tracking-tight font-serif text-center text-[#0B1120]">Qual modelo?</h2>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] w-5 h-5" />
                        <input 
                          type="text"
                          className="w-full bg-white border border-[#CBD5E1] rounded-2xl p-5 pl-12 focus:ring-2 focus:ring-manos-red/20 outline-none text-lg transition-all"
                          placeholder="Ex: BMW, Hilux..."
                          value={searchQuery}
                          autoFocus
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-4 pb-12">
                        {isLoadingStock ? (
                          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                        ) : (
                          <>
                            {resultadosBusca.slice(0, 10).map(v => (
                              <VehicleCard
                                key={v.id}
                                vehicle={v}
                                onClick={() => handleSelectVehicle(v)}
                              />
                            ))}
                            {/* Antes, a mensagem de vazio olhava para stock.length em vez do
                                resultado filtrado: quem buscava um modelo fora do pátio via
                                uma tela em branco, sem aviso e sem saída. */}
                            {resultadosBusca.length === 0 && (
                              <EmptyStock
                                titulo={searchQuery ? `Não temos ${searchQuery} no pátio agora` : 'Estoque indisponível no momento'}
                                descricao={
                                  searchQuery
                                    ? 'O estoque gira toda semana. Deixe seu contato que avisamos assim que entrar um — ou fale agora com um consultor, que buscamos para você.'
                                    : 'Não conseguimos carregar o estoque agora. Um consultor te manda as opções na hora.'
                                }
                                onAvisar={() => {
                                  handleDataChange('modelo_procurado', searchQuery);
                                  handleDataChange('has_interest', 'Busca sem resultado');
                                  setQuiz(prev => ({ ...prev, step: 5, fase: contatoSalvo ? 'quiz' : 'contato' }));
                                }}
                                onFalar={() => handleWhatsAppClick(`Procuro um ${searchQuery || 'carro'}`)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {quiz.type === 'Compra' ? (
                        <>
                          <h2 className="text-3xl font-extrabold tracking-tight font-serif text-center text-[#0B1120]">Quanto você pretende investir no seu novo carro?</h2>
                          <div className="grid gap-3">
                            <OptionButton label="Até R$ 50 mil" active={priceFilter === '50k'} onClick={() => { setPriceFilter('50k'); nextStep(); }} />
                            <OptionButton label="De R$ 50 mil a 100 mil" active={priceFilter === '100k'} onClick={() => { setPriceFilter('100k'); nextStep(); }} />
                            <OptionButton label="Acima de R$ 100 mil" active={priceFilter === 'plus'} onClick={() => { setPriceFilter('plus'); nextStep(); }} />
                          </div>
                        </>
                      ) : (
                        <>
                          <h2 className="text-3xl font-extrabold tracking-tight font-serif text-center text-[#0B1120]">Qual valor de entrada você tem em mente?</h2>
                          <div className="grid gap-3">
                            {['Vou tentar sem entrada', 'Até R$ 10 mil', 'Mais de R$ 20 mil'].map(v => <StepOption key={v} label={v} active={quiz.data.down_payment === v} onClick={() => { handleDataChange('down_payment', v); nextStep(); }} />)}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {quiz.step === 4 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-extrabold tracking-tight font-serif text-[#0B1120]">Sugestões de Veículos:</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-12">
                    {isLoadingStock ? (
                      Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                    ) : (
                      <>
                        {resultadosFaixa.slice(0, 10).map(v => (
                          <VehicleCard key={v.id} vehicle={v} onClick={() => handleSelectVehicle(v)} />
                        ))}
                        {/* Esta lista não tinha estado vazio nenhum: faixa de preço sem
                            carro devolvia tela morta. */}
                        {resultadosFaixa.length === 0 && (
                          <EmptyStock
                            titulo="Nenhum carro nessa faixa agora"
                            descricao="O estoque gira toda semana. Deixe seu contato que avisamos assim que entrar um no seu orçamento — ou veja o que temos nas outras faixas."
                            onAvisar={() => {
                              handleDataChange('faixa_procurada', priceFilter);
                              setQuiz(prev => ({ ...prev, step: 5, fase: contatoSalvo ? 'quiz' : 'contato' }));
                            }}
                            onFalar={() => handleWhatsAppClick('Quero ver outras faixas de preço')}
                            rotuloSecundario="Ver todas as faixas"
                            onSecundario={() => { setPriceFilter(null); setQuiz(prev => ({ ...prev, step: 3 })); }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {quiz.step === 5 && quiz.type === 'Compra' && (
                <div className="space-y-6 text-center">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase">Você possui troca?</h2>
                  <p className="text-xs text-[#64748B] uppercase font-bold tracking-widest -mt-4">Aceitamos seu usado com a melhor avaliação</p>
                  <div className="grid gap-4">
                    <QuizButton 
                      key="sim"
                      icon={<Check className="w-6 h-6" />}
                      label="Sim, quero dar meu carro na troca"
                      onClick={() => { handleDataChange('tem_troca', 'Sim'); nextStep(); }}
                    />
                    <QuizButton 
                      key="nao"
                      icon={<ArrowRight className="w-6 h-6" />}
                      label="Não, apenas comprar (à vista/financiado)"
                      onClick={() => { handleDataChange('tem_troca', 'Não'); setQuiz(prev => ({ ...prev, step: 7 })); }}
                    />
                  </div>
                </div>
              )}

              {quiz.step === 6 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                   <h2 className="text-3xl font-extrabold tracking-tight font-serif text-center text-[#0B1120]">Seu veículo na troca:</h2>
                   <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] ml-4">Modelo e Ano</label>
                        <textarea 
                          className="w-full bg-white border border-[#CBD5E1] rounded-2xl p-6 h-32 outline-none focus:border-manos-red/40" 
                          placeholder="Ex: Onix 2020..." 
                          value={quiz.data.troca_detalhes || ''} 
                          onChange={(e) => handleDataChange('troca_detalhes', e.target.value)} 
                        />
                      </div>
                      <button 
                        onClick={nextStep} 
                        disabled={!quiz.data.troca_detalhes}
                        className="w-full py-5 bg-manos-red text-manos-accent font-extrabold uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                      >
                        Continuar
                      </button>
                   </div>
                </div>
              )}

              {quiz.step === 7 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                   <h2 className="text-3xl font-extrabold tracking-tight font-serif text-center text-[#0B1120]">Precisa financiar?</h2>
                    <div className="grid gap-4">
                      <QuizButton 
                        icon={<CreditCard className="w-6 h-6" />}
                        label="Sim, quero simular"
                        onClick={() => { handleDataChange('quer_financiamento', 'Sim'); nextStep(); }}
                      />
                      <QuizButton 
                        icon={<Check className="w-6 h-6" />}
                        label="Não, compra à vista"
                        onClick={() => { handleDataChange('quer_financiamento', 'Não'); nextStep(); }}
                      />
                    </div>
                </div>
              )}

              {quiz.step === 8 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                   <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Qual sua cidade?</h2>
                   <div className="space-y-4">
                      <input 
                        type="text" 
                        className="w-full bg-white border border-[#CBD5E1] rounded-2xl p-6 outline-none focus:border-manos-red/40 text-lg"
                        placeholder="Ex: Rio do Sul / SC"
                        value={quiz.data.cidade || ''}
                        onChange={(e) => handleDataChange('cidade', e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={nextStep} 
                        disabled={!quiz.data.cidade}
                        className="w-full py-5 bg-manos-red text-manos-accent font-extrabold uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                      >
                        Continuar
                      </button>
                   </div>
                </div>
              )}

              {/* Step 4 for Financiamento */}
              {(quiz.step === 4 && quiz.type === 'Financiamento') && (
                <div className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-extrabold tracking-tight font-serif text-[#0B1120]">
                      {quiz.data.has_car === 'Sim, do estoque' ? "Quanto você gostaria de dar de entrada?" : "Quanto você gostaria de pagar por mês?"}
                    </h2>
                  </div>
                  <div className="grid gap-4">
                    {quiz.data.has_car === 'Sim, do estoque' ? (
                       ['Vou tentar sem entrada', 'Até R$ 10 mil', 'Mais de R$ 20 mil'].map(v => <StepOption key={v} label={v} active={quiz.data.down_payment === v} onClick={() => { handleDataChange('down_payment', v); nextStep(); }} />)
                    ) : (
                       ['R$ 800 - R$ 1.200', 'R$ 1.200 - R$ 1.800', 'Acima de R$ 2.000'].map(v => <StepOption key={v} label={v} active={quiz.data.desired_payment === v} onClick={() => { handleDataChange('desired_payment', v); setQuiz(prev => ({ ...prev, step: 6 })); }} />)
                    )}
                  </div>
                </div>
              )}

              {/* Step 5 for Financiamento */}
              {(quiz.step === 5 && quiz.type === 'Financiamento' && quiz.data.has_car === 'Sim, do estoque') && (
                <div className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-extrabold tracking-tight font-serif text-[#0B1120]">
                      Quanto você gostaria de pagar por mês?
                    </h2>
                  </div>
                  <div className="grid gap-4">
                    {['R$ 800 - R$ 1.200', 'R$ 1.200 - R$ 1.800', 'Acima de R$ 2.000'].map(v => (
                       <StepOption key={v} label={v} active={quiz.data.desired_payment === v} onClick={() => { handleDataChange('desired_payment', v); nextStep(); }} />
                    ))}
                  </div>
                </div>
              )}

              {isContactStep && (
                <div className="space-y-8 pb-12">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                       <Zap className="w-3 h-3 text-green-600 fill-current" />
                       <span className="text-[10px] font-extrabold text-green-600 uppercase tracking-widest">
                          {promessaDeRetorno()}
                       </span>
                    </div>
                    <h2 className="text-4xl font-extrabold tracking-tight font-serif leading-[0.9] text-[#0B1120]">
                      Tudo pronto! <br />
                      <span className="text-manos-red">Receba sua oferta</span>
                    </h2>
                    <p className="text-xs text-[#64748B] uppercase font-bold tracking-widest">
                      {contatoSalvo ? 'Confirme e enviamos para o consultor' : 'Onde enviamos as informações?'}
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {contatoSalvo ? (
                      /* O contato já foi gravado no início do funil — repetir os
                         campos aqui só criaria atrito na última tela. */
                      <div className="card-glass p-5 space-y-3">
                        {quiz.selectedVehicle && (
                          <div className="flex items-center justify-between gap-3 pb-3 border-b border-manos-sand">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">Veículo</span>
                            <span className="text-xs font-bold text-[#0B1120] text-right line-clamp-1">{quiz.selectedVehicle.description}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">Nome</span>
                          <span className="text-xs font-bold text-[#0B1120]">{quiz.data.name}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">WhatsApp</span>
                          <span className="text-xs font-bold text-[#0B1120]">{quiz.data.phone}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuiz(prev => ({ ...prev, fase: 'contato' }))}
                          className="text-[10px] font-extrabold uppercase tracking-widest text-manos-red hover:brightness-125 transition-all"
                        >
                          Corrigir meus dados
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] ml-4">Como devemos te chamar?</label>
                          <input type="text" required autoComplete="name" className="w-full py-5 px-6" placeholder="Nome completo" value={quiz.data.name || ''} onChange={(e) => handleDataChange('name', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B] ml-4">Seu WhatsApp de contato</label>
                          <div className="relative">
                            <input type="tel" required inputMode="numeric" autoComplete="tel"
                              className={cn(
                                "w-full py-5 px-6 pr-12 transition-all",
                                quiz.data.phone && (isPhoneValid ? "border-green-500/50" : "border-red-400/50")
                              )}
                              placeholder="(47) 99999-9999"
                              value={quiz.data.phone || ''}
                              onChange={(e) => {
                                const formatted = formatPhone(e.target.value);
                                handleDataChange('phone', formatted);
                              }}
                            />
                            {quiz.data.phone && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                {isPhoneValid ? (
                                  <CheckCircle2 className="w-6 h-6 text-green-500 animate-in zoom-in" />
                                ) : (
                                  <AlertCircle className="w-6 h-6 text-red-400 animate-in fade-in" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <PrivacyNotice />

                    {error && (
                      <div className="space-y-4">
                        <p className="text-manos-red font-black text-center text-xs uppercase tracking-widest">{error}</p>
                        {showPlanB && (
                          <button 
                            type="button"
                            onClick={() => handleWhatsAppClick(`Erro no formulário: ${quiz.data.name} - ${quiz.data.phone}`)}
                            className="w-full py-5 bg-green-500 text-white font-black text-lg uppercase rounded-2xl flex items-center justify-center gap-3 animate-bounce shadow-2xl shadow-green-500/20"
                          >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            Finalizar pelo WhatsApp
                          </button>
                        )}
                      </div>
                    )}
                    
                    <button 
                      type="submit"
                      disabled={isSubmitting || !isFormValid}
                      className="w-full py-6 bg-manos-red text-manos-accent font-extrabold text-xl uppercase rounded-2xl shadow-[0_12px_36px_rgba(122,46,30,0.25)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                    >
                      {isSubmitting ? 'Gerando sua oferta...' : 'Receber Proposta Agora'}
                    </button>
                    
                    <p className="text-center text-[9px] text-[#64748B] uppercase tracking-[0.3em] font-extrabold">
                      Seguro &bull; Rápido &bull; Confidencial
                    </p>
                  </form>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Sticky Action Footer */}
      {!isSuccess && (
        <div className="sticky-footer">
          {quiz.step > 1 ? (
            <div className="flex gap-4">
              <button 
                onClick={navigateBack} 
                className="w-16 h-16 flex items-center justify-center bg-manos-warm border border-manos-sand rounded-2xl text-[#64748B] active:scale-95 transition-all"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              {isContactStep ? (
                <button
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting || !isFormValid}
                  className="flex-grow bg-manos-red text-manos-accent font-extrabold text-lg uppercase rounded-2xl shadow-lg shadow-manos-red/15 active:scale-95 transition-all disabled:opacity-30"
                >
                  {isSubmitting ? 'Finalizando...' : 'Finalizar'}
                </button>
              ) : (
                <div className="flex-grow flex items-center justify-center">
                  <span className="text-manos-sand font-extrabold uppercase text-lg tracking-tight">DG Automóveis</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-2 space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="flex -space-x-2">
                  {Array.from({ length: lojaEstaAberta ? 5 : 1 }).map((_, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-manos-cream bg-[#0052FF] flex items-center justify-center text-[7px] font-extrabold text-white">DG</div>
                  ))}
                </div>
                <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#64748B]">
                  {lojaEstaAberta ? '5 consultores online no momento' : 'Seg a Sex 8h–19h • Sáb 8h–13h'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

/**
 * Telefone clicável. Antes o único `tel:` do site inteiro estava na tela de
 * erro — e parte relevante de quem compra carro liga em vez de digitar.
 */
function PhoneLink({ label, className }: { label: string; className?: string }) {
  return (
    <a
      href="tel:+5547989169598"
      onClick={() => trackContato('telefone', label)}
      className={cn(
        'min-h-0 inline-flex items-center gap-1.5 text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest hover:text-[#475569] transition-colors no-underline',
        className,
      )}
    >
      <Phone className="w-3 h-3" />
      {label}
    </a>
  );
}

/**
 * Aviso de LGPD. A política precisa ser um link acessível: Meta e Google exigem
 * isso em formulário de captação, e antes o texto era um <span> morto — risco de
 * reprovação de anúncio, não só detalhe de interface.
 */
function PrivacyNotice() {
  return (
    <div className="px-2">
      <div className="flex items-start gap-3 p-4 bg-manos-warm/50 rounded-2xl border border-manos-sand">
        <Shield className="w-5 h-5 text-manos-red flex-shrink-0" />
        <p className="text-[10px] text-[#475569] leading-relaxed font-medium uppercase tracking-wide">
          Ao continuar, você concorda com nossa{' '}
          <a
            href="/politica-de-privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-0 inline text-[#0B1120] underline underline-offset-2 hover:text-manos-red transition-colors"
          >
            Política de Privacidade (LGPD)
          </a>{' '}
          e autoriza o contato de nossos especialistas.
        </p>
      </div>
    </div>
  );
}

/**
 * Saída para lista vazia. Sem isto, buscar um modelo fora do pátio (ou uma faixa
 * de preço sem carro) devolvia uma tela em branco — sem aviso e sem caminho.
 * Cada opção aqui é também uma captura de lead.
 */
function EmptyStock({
  titulo,
  descricao,
  onAvisar,
  onFalar,
  rotuloSecundario,
  onSecundario,
}: {
  titulo: string;
  descricao: string;
  onAvisar: () => void;
  onFalar: () => void;
  rotuloSecundario?: string;
  onSecundario?: () => void;
}) {
  return (
    <div className="card-glass p-6 space-y-5 text-center">
      <div className="w-14 h-14 bg-manos-warm border border-manos-sand rounded-2xl flex items-center justify-center mx-auto">
        <Search className="w-7 h-7 text-manos-red" />
      </div>
      <div className="space-y-2">
        <h3 className="font-extrabold text-lg tracking-tight font-serif leading-tight text-balance text-[#0B1120]">{titulo}</h3>
        <p className="text-xs text-[#475569] leading-relaxed">{descricao}</p>
      </div>
      <div className="space-y-3">
        <button
          onClick={onAvisar}
          className="w-full py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl shadow-lg shadow-manos-red/15 active:scale-95 transition-all"
        >
          Quero ser avisado quando chegar
        </button>
        {rotuloSecundario && onSecundario && (
          <button
            onClick={onSecundario}
            className="w-full py-4 bg-manos-warm border border-manos-sand text-[#0B1120] font-bold text-xs uppercase tracking-wider rounded-2xl hover:bg-manos-warm/80 active:scale-95 transition-all"
          >
            {rotuloSecundario}
          </button>
        )}
        <button
          onClick={onFalar}
          className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest hover:text-[#475569] transition-colors"
        >
          Ou falar com um consultor agora &rarr;
        </button>
      </div>
    </div>
  );
}

function QuizButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void, key?: any }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card-glass p-5 text-left flex items-center gap-4 group hover:border-manos-red/30 transition-all"
    >
      <div className="w-10 h-10 bg-manos-warm rounded-xl flex items-center justify-center text-manos-red group-hover:bg-manos-red/10 transition-all">
        {icon}
      </div>
      <span className="font-extrabold text-sm text-[#0B1120]">{label}</span>
    </motion.button>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle; onClick?: () => void; key?: any }) {
  return (
    <a
      href={`/estoque/${vehicle.id}`}
      className="card-glass p-4 text-left group relative overflow-hidden transition-all hover:border-manos-red/30 block no-underline"
    >
      <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-manos-warm mb-4 relative">
        <img 
          src={vehicle.image} 
          alt={vehicle.description} 
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" 
          referrerPolicy="no-referrer" 
        />
      </div>
      <div className="space-y-2">
        <h4 className="font-serif font-bold text-[16px] tracking-tight leading-tight text-[#0B1120] line-clamp-1">
          {vehicle.description}
        </h4>
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-[#475569] text-[13px] font-semibold">
            <span>{vehicle.year}</span>
            <span>·</span>
            <span>{vehicle.km}</span>
          </div>
          <p className="text-manos-red font-extrabold text-lg tracking-tight">
            {vehicle.priceFormatted}
          </p>
        </div>
      </div>
    </a>
  );
}

/** Versão compacta para lista de veículos da home (1b: layout horizontal com thumbnail). */
function VehicleCardMini({ vehicle }: { vehicle: Vehicle; onClick?: () => void; key?: any }) {
  return (
    <a
      href={`/estoque/${vehicle.id}`}
      className="card-glass p-3 text-left group overflow-hidden transition-all hover:border-manos-red/30 flex gap-4 no-underline"
    >
      <div className="flex-none w-[104px] h-[96px] rounded-xl overflow-hidden bg-manos-warm">
        <img
          src={vehicle.image}
          alt={vehicle.description}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <h4 className="font-extrabold text-[16px] tracking-tight leading-tight text-[#0B1120] line-clamp-2">
          {vehicle.description}
        </h4>
        <div className="text-[13px] text-[#475569]">
          {vehicle.year} · {vehicle.km}
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-manos-red font-extrabold text-[20px] tracking-tight">
            {vehicle.priceFormatted}
          </p>
          <span className="text-[14px] font-bold text-manos-red" style={{ borderBottom: '1.5px solid #38BDF8' }}>Ver</span>
        </div>
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="card-glass p-3 flex flex-col w-full animate-pulse border border-manos-sand">
      <div className="aspect-video w-full rounded-xl bg-manos-warm mb-3" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 bg-manos-warm rounded" />
        <div className="flex justify-between">
          <div className="h-2 w-1/4 bg-manos-warm rounded" />
          <div className="h-2 w-1/4 bg-manos-warm rounded" />
        </div>
        <div className="h-6 w-1/2 bg-manos-warm rounded mt-2" />
      </div>
    </div>
  );
}

function MainOption({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void, key?: any }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card-glass p-6 text-left hover:border-manos-red/30 transition-all group relative overflow-hidden"
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 bg-manos-warm rounded-2xl flex items-center justify-center text-manos-red group-hover:bg-manos-red group-hover:text-manos-accent transition-all shadow-sm">
          {icon}
        </div>
        <div>
          <h3 className="font-extrabold text-lg tracking-tight text-[#0B1120]">{title}</h3>
          <p className="text-[#475569] text-xs font-bold leading-tight">{desc}</p>
        </div>
        <ChevronRight className="ml-auto w-5 h-5 text-manos-sand group-hover:text-manos-red group-hover:translate-x-1 transition-all" />
      </div>
    </motion.button>
  );
}

function OptionButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void, key?: any }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full py-5 rounded-2xl font-extrabold text-sm transition-all border",
        active 
          ? "bg-manos-red text-manos-accent border-manos-red shadow-lg shadow-manos-red/15" 
          : "bg-manos-warm text-[#0B1120] border-manos-sand hover:border-manos-red/30"
      )}
    >
      {label}
    </button>
  );
}

function StepOption({ label, active, onClick }: { label: string, active: boolean, onClick: () => void, key?: any }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full py-5 rounded-2xl font-extrabold text-sm transition-all border",
        active 
          ? "bg-manos-red text-manos-accent border-manos-red shadow-lg shadow-manos-red/15" 
          : "bg-manos-warm text-[#0B1120] border-manos-sand hover:border-manos-red/30"
      )}
    >
      {label}
    </button>
  );
}


