import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Car, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  DollarSign, 
  Clock, 
  Sparkles,
  HelpCircle,
  Search
} from 'lucide-react';
import { SiteShell, PrivacyNotice, TrustCards } from '../ManosUI';
import { CONTATO, waLink, validatePlaca, formatPhone } from '../../lib/manos';
import { track } from '../../lib/track';
import { consultarPlaca, type VeiculoPlaca } from '../../services/vendasService';
import { fetchStock, type Vehicle } from '../../services/stockService';
import { getStoredLead, saveStoredLead } from '../../lib/leadStore';

export default function VenderCarroPage() {
  const [placa, setPlaca] = useState('');
  const [semPlaca, setSemPlaca] = useState(false);
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<VeiculoPlaca | null>(null);
  const [veiculoInteresse, setVeiculoInteresse] = useState<Vehicle | null>(null);
  
  // Manual inputs for "sem placa"
  const [marcaModelo, setMarcaModelo] = useState('');
  const [anoManual, setAnoManual] = useState('');
  const [valorDesejado, setValorDesejado] = useState('');

  // Universal Lead Pre-fill
  const [nome, setNome] = useState(() => getStoredLead().nome || '');
  const [telefone, setTelefone] = useState(() => {
    const saved = getStoredLead().telefone;
    return saved ? formatPhone(saved) : '';
  });

  // Auto-sync lead info & vehicle of interest from URL ?veiculo=<slug>
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('veiculo');
    if (slug) {
      fetchStock().then((list) => {
        const found = list.find((v) => v.id === slug || v.slug === slug || v.description.toLowerCase().includes(slug.toLowerCase()));
        if (found) setVeiculoInteresse(found);
      }).catch(() => {});
    }

    const sync = () => {
      const stored = getStoredLead();
      if (stored.nome && !nome) setNome(stored.nome);
      if (stored.telefone && !telefone) setTelefone(formatPhone(stored.telefone));
    };
    sync();
    window.addEventListener('manos-lead-updated', sync);
    return () => window.removeEventListener('manos-lead-updated', sync);
  }, [nome, telefone]);

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const cleanPlaca = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const isPlacaValid = validatePlaca(cleanPlaca);

  const formatPlacaDisplay = (v: string) => {
    const raw = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
    if (raw.length > 3 && !/^[A-Z]{3}[0-9][A-Z]/.test(raw)) {
      return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    }
    return raw;
  };

  const handleConsultarPlaca = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isPlacaValid || status === 'submitting') return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await consultarPlaca(cleanPlaca);
      if (res.ok && res.veiculo) {
        setVeiculoEncontrado(res.veiculo);
        setStatus('idle');
        track('placa_lookup_success', { placa: cleanPlaca, marca: res.veiculo.marca });
      } else {
        setVeiculoEncontrado(null);
        setErrorMessage(res.error || 'Não foi possível identificar os dados da placa. Você pode informar o modelo manualmente.');
        setStatus('idle');
      }
    } catch (err: any) {
      setErrorMessage('Falha na consulta da placa. Você pode continuar preenchendo manualmente.');
      setStatus('idle');
    }
  };

  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setErrorMessage('');

    const storedLead = getStoredLead();
    const payload = {
      origem: 'site-dg',
      tipo: 'proposta_troca_venda',
      enviadoEm: new Date().toISOString(),
      cliente: {
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, ''),
        cpf: storedLead.cpf || '',
        dataNascimento: storedLead.dataNascimento || '',
      },
      veiculoTroca: {
        placa: semPlaca ? null : cleanPlaca,
        marca: veiculoEncontrado?.marca || marcaModelo.split(' ')[0] || '',
        modelo: veiculoEncontrado?.modelo || marcaModelo || '',
        versao: veiculoEncontrado?.versao || '',
        ano: veiculoEncontrado?.ano || anoManual,
        fipeValor: veiculoEncontrado?.fipeValor || '',
        valorDesejado: valorDesejado || null,
      },
      veiculoInteresse: veiculoInteresse ? {
        id: veiculoInteresse.id,
        slug: veiculoInteresse.slug || veiculoInteresse.id,
        titulo: veiculoInteresse.description,
        preco: veiculoInteresse.price,
        precoFormatado: veiculoInteresse.priceFormatted,
        foto: veiculoInteresse.image,
      } : null,
      contexto: {
        pagina: window.location.pathname + window.location.search,
        userAgent: navigator.userAgent,
        utm: {
          source: new URLSearchParams(window.location.search).get('utm_source') || '',
          medium: new URLSearchParams(window.location.search).get('utm_medium') || '',
          campaign: new URLSearchParams(window.location.search).get('utm_campaign') || '',
        },
      },
    };

    try {
      saveStoredLead({ nome: nome.trim(), telefone: telefone.replace(/\D/g, '') });

      const response = await fetch('https://n8n.drivvoo.com/webhook/veiculosnatrocadg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setStatus('success');
        track('venda_lead_submit', { placa: cleanPlaca, marcaModelo });
      } else {
        throw new Error('Servidor indisponível no momento.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Falha ao enviar a solicitação. Fale conosco pelo WhatsApp.');
    }
  };

  return (
    <SiteShell variant="vendas" title="Avaliar / Vender Carro">
        {status === 'success' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 bg-[#0B1120] text-[#FFFFFF] rounded-3xl text-center space-y-6 my-6 shadow-2xl"
          >
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl shadow-green-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="font-serif text-3xl font-extrabold text-white">
                Solicitação Recebida!
              </h2>
              <p className="text-sm text-[#CBD5E1] leading-relaxed">
                {veiculoEncontrado ? (
                  <>Veículo <strong className="text-white">{veiculoEncontrado.marca} {veiculoEncontrado.modelo} ({veiculoEncontrado.ano})</strong> cadastrado para avaliação.</>
                ) : (
                  <>Sua solicitação de avaliação para <strong className="text-white">{marcaModelo || cleanPlaca}</strong> foi enviada para o nosso avaliador.</>
                )}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={waLink(`Olá! Enviei a avaliação do meu carro (${veiculoEncontrado?.modelo || marcaModelo || cleanPlaca}) no site da DG Automóveis.`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('whatsapp_click', { pagina: '/vender-meu-carro_sucesso' })}
                className="w-full py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
              >
                Falar com Avaliador no WhatsApp
              </a>

              <a
                href="/"
                className="block w-full py-3.5 bg-white/10 text-white font-extrabold text-xs uppercase rounded-2xl hover:bg-white/20 min-h-[44px]"
              >
                Voltar à Página Inicial
              </a>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Header Hero */}
            <div className="text-center space-y-2 pt-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                Avaliação Grátis & Sem Compromisso
              </span>
              <h1 className="font-serif text-3xl font-extrabold text-[#0B1120] tracking-tight">
                Venda ou Troque seu Carro
              </h1>
              <p className="text-xs text-[#475569]">
                Pagamento à vista na conta via PIX e documentação resolvida pela DG Automóveis em Rio do Sul/SC.
              </p>
            </div>

            {/* Step 1: Placa Lookup Form */}
            {!semPlaca && !veiculoEncontrado && (
              <form onSubmit={handleConsultarPlaca} className="p-6 bg-white border border-manos-sand rounded-3xl space-y-5 shadow-sm">
                <div className="text-center space-y-1">
                  <label className="text-xs font-extrabold text-[#0B1120] uppercase tracking-wider block">
                    Digite a Placa do seu Veículo
                  </label>
                  <p className="text-[11px] text-[#64748B]">
                    Padrão Mercosul (ABC1D23) ou Antigo (ABC-1234)
                  </p>
                </div>

                {/* License Plate Input */}
                <div className="relative max-w-xs mx-auto">
                  <input
                    type="text"
                    required
                    inputMode="text"
                    autoCapitalize="characters"
                    maxLength={8}
                    placeholder="ABC-1234"
                    value={formatPlacaDisplay(placa)}
                    onChange={(e) => setPlaca(e.target.value)}
                    className="w-full py-5 px-6 text-center font-serif text-3xl font-extrabold tracking-widest uppercase bg-manos-warm border-2 border-manos-sand rounded-2xl focus:border-manos-red outline-none text-[#0B1120] placeholder:text-[#64748B]/40"
                  />
                  {cleanPlaca.length >= 7 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isPlacaValid ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                  )}
                </div>

                {errorMessage && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1">
                    <p className="text-xs font-bold text-amber-800">{errorMessage}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isPlacaValid || status === 'submitting'}
                  className="btn-manos"
                >
                  {status === 'submitting' ? 'Consultando Placa...' : 'Buscar Dados da Placa'}
                </button>

                {/* Option to continue without plate */}
                <div className="pt-2 text-center border-t border-manos-sand/60">
                  <button
                    type="button"
                    onClick={() => {
                      setSemPlaca(true);
                      setErrorMessage('');
                    }}
                    className="text-xs font-bold text-[#0052FF] hover:underline flex items-center justify-center gap-1.5 mx-auto py-2"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Não sei a placa / Continuar sem placa</span>
                  </button>
                </div>

                <PrivacyNotice />
              </form>
            )}

            {/* Step 2: Vehicle Specs Confirmed or Manual Fill Form */}
            {(veiculoEncontrado || semPlaca) && (
              <form onSubmit={handleSubmitFinal} className="p-6 bg-white border border-manos-sand rounded-3xl space-y-5 shadow-sm animate-fade-in">
                {veiculoEncontrado ? (
                  <div className="p-4 bg-[#0B1120] text-[#FFFFFF] rounded-2xl space-y-2 border border-[#38BDF8]/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md">
                        Placa Identificada: {cleanPlaca}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setVeiculoEncontrado(null); setPlaca(''); }}
                        className="text-[10px] text-[#CBD5E1] underline"
                      >
                        Alterar
                      </button>
                    </div>
                    <h3 className="font-serif font-extrabold text-lg text-white">
                      {veiculoEncontrado.marca} {veiculoEncontrado.modelo}
                    </h3>
                    <p className="text-xs text-[#CBD5E1]">
                      Versão: {veiculoEncontrado.versao || 'Padrão'} · Ano: {veiculoEncontrado.ano}
                    </p>
                    {veiculoEncontrado.fipeValor && (
                      <p className="text-xs font-bold text-amber-300 pt-1">
                        Tabela FIPE Estimada: {veiculoEncontrado.fipeValor}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-manos-sand pb-2">
                      <h3 className="font-serif font-bold text-base text-[#0B1120]">Informações do Veículo</h3>
                      <button
                        type="button"
                        onClick={() => { setSemPlaca(false); setErrorMessage(''); }}
                        className="text-[11px] font-bold text-[#0052FF] underline"
                      >
                        Tenho a placa
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B1120] uppercase">Marca e Modelo</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Fiat Palio 1.0 Fire"
                        value={marcaModelo}
                        onChange={(e) => setMarcaModelo(e.target.value)}
                        className="w-full py-3 px-4 text-xs bg-manos-warm border border-manos-sand rounded-xl focus:border-manos-red outline-none text-[#0B1120]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#0B1120] uppercase">Ano</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: 2018"
                          value={anoManual}
                          onChange={(e) => setAnoManual(e.target.value)}
                          className="w-full py-3 px-4 text-xs bg-manos-warm border border-manos-sand rounded-xl focus:border-manos-red outline-none text-[#0B1120]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#0B1120] uppercase">Valor Desejado (R$)</label>
                        <input
                          type="text"
                          placeholder="Ex: 35.000"
                          value={valorDesejado}
                          onChange={(e) => setValorDesejado(e.target.value)}
                          className="w-full py-3 px-4 text-xs bg-manos-warm border border-manos-sand rounded-xl focus:border-manos-red outline-none text-[#0B1120]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Client Contact Inputs */}
                <div className="space-y-3 pt-2 border-t border-manos-sand/60">
                  <h4 className="font-serif font-bold text-sm text-[#0B1120]">Para onde enviamos a proposta?</h4>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#0B1120] uppercase">Seu Nome Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Nome e Sobrenome"
                      value={nome}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNome(val);
                        saveStoredLead({ nome: val });
                      }}
                      className="w-full py-3.5 px-4 text-xs bg-manos-warm border border-manos-sand rounded-xl focus:border-manos-red outline-none text-[#0B1120]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#0B1120] uppercase">Seu WhatsApp</label>
                    <input
                      type="tel"
                      required
                      placeholder="(47) 99999-9999"
                      value={telefone}
                      onChange={(e) => {
                        const formatted = formatPhone(e.target.value);
                        setTelefone(formatted);
                        saveStoredLead({ telefone: formatted });
                      }}
                      className="w-full py-3.5 px-4 text-xs bg-manos-warm border border-manos-sand rounded-xl focus:border-manos-red outline-none text-[#0B1120]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'submitting' || !nome.trim() || telefone.replace(/\D/g, '').length < 10}
                  className="btn-manos"
                >
                  {status === 'submitting' ? 'Enviando Proposta...' : 'Solicitar Proposta'}
                </button>

                <PrivacyNotice />
              </form>
            )}

            {/* Step-by-step Explanation */}
            <div className="p-6 bg-[#0B1120] text-[#FFFFFF] rounded-3xl space-y-4 shadow-xl">
              <h3 className="font-serif font-bold text-xl text-white">Como Funciona a Avaliação</h3>
              
              <div className="space-y-3">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-manos-red text-manos-accent flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Identificação pela Placa ou Modelo</h4>
                    <p className="text-xs text-[#CBD5E1]">Você digita a placa ou informa o modelo do carro para buscarmos o histórico e FIPE.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-manos-red text-manos-accent flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Proposta Rápida no WhatsApp</h4>
                    <p className="text-xs text-[#CBD5E1]">Nosso avaliador envia o valor estimado de compra ou margem de troca no mesmo dia.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-manos-red text-manos-accent flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Pagamento no PIX na Hora</h4>
                    <p className="text-xs text-[#CBD5E1]">Fechou na loja? A gente transfere o dinheiro direto pra sua conta e cuida da transferência.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp Alternative */}
            <div className="p-6 bg-white border border-manos-sand rounded-3xl space-y-3 text-center">
              <h4 className="font-serif font-bold text-base text-[#0B1120]">Prefere falar direto com um avaliador?</h4>
              <p className="text-xs text-[#475569]">Manda fotos e detalhes do seu carro direto pelo WhatsApp sem precisar preencher nada.</p>
              <a
                href={waLink('Olá! Quero avaliar meu carro para venda ou troca.')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('whatsapp_click', { pagina: '/vender-meu-carro_direto' })}
                className="w-full py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 shadow-md min-h-[48px]"
              >
                Avaliar via WhatsApp
              </a>
            </div>

            <TrustCards />
          </div>
        )}
    </SiteShell>
  );
}
