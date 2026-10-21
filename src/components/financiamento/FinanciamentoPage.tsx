import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  ArrowRight, 
  Phone, 
  ShieldCheck, 
  Car,
  Calculator
} from 'lucide-react';
import { SiteShell, PrivacyNotice, TrustCards } from '../ManosUI';
import { 
  CONTATO, 
  LOJA, 
  waLink, 
  brl, 
  formatCPF, 
  formatPhone, 
  validateCPF, 
  calcParcela 
} from '../../lib/manos';
import { track } from '../../lib/track';
import { fetchStock, type Vehicle } from '../../services/stockService';
import { getStoredLead, saveStoredLead } from '../../lib/leadStore';

export default function FinanciamentoPage() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleValue, setVehicleValue] = useState<number>(85000);
  
  // Universal Lead Pre-fill
  const [nome, setNome] = useState(() => getStoredLead().nome || '');
  const [phone, setPhone] = useState(() => {
    const saved = getStoredLead().telefone;
    return saved ? formatPhone(saved) : '';
  });
  const [cpf, setCpf] = useState(() => {
    const saved = getStoredLead().cpf;
    return saved ? formatCPF(saved) : '';
  });
  const [dataNascimento, setDataNascimento] = useState(() => getStoredLead().dataNascimento || '');
  const [entrada, setEntrada] = useState<number>(0);
  const [meses, setMeses] = useState<number>(48);

  // Status State
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-sync lead info if entered elsewhere on the site & detect ?veiculo=<slug>
  useEffect(() => {
    track('sim_start', { pagina: '/financiamento' });
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('veiculo');
    
    if (slug) {
      fetchStock().then((list) => {
        const found = list.find((v) => v.id === slug || v.description.toLowerCase().includes(slug.toLowerCase()));
        if (found) {
          setVehicle(found);
          setVehicleValue(found.price);
          setEntrada(Math.round(found.price * 0.25));
        }
      }).catch(() => {});
    }

    const sync = () => {
      const stored = getStoredLead();
      if (stored.nome && !nome) setNome(stored.nome);
      if (stored.telefone && !phone) setPhone(formatPhone(stored.telefone));
      if (stored.cpf && !cpf) setCpf(formatCPF(stored.cpf));
      if (stored.dataNascimento && !dataNascimento) setDataNascimento(stored.dataNascimento);
    };
    sync();
    window.addEventListener('manos-lead-updated', sync);
    return () => window.removeEventListener('manos-lead-updated', sync);
  }, [nome, phone, cpf, dataNascimento]);

  // Validation Checkers
  const isNameValid = nome.trim().split(/\s+/).length >= 2;
  const rawPhone = phone.replace(/\D/g, '');
  const isPhoneValid = rawPhone.length >= 10 && rawPhone.length <= 11;
  const isCpfValid = validateCPF(cpf);

  const calculateAge = (birthDateString: string): number => {
    if (!birthDateString) return 0;
    const today = new Date();
    const birth = new Date(birthDateString);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const isAgeValid = calculateAge(dataNascimento) >= 18;
  const maxEntrada = Math.round(vehicleValue * 0.8);
  const isEntradaValid = entrada >= 0 && entrada <= maxEntrada;

  const isFormValid = isNameValid && isPhoneValid && isCpfValid && isAgeValid && isEntradaValid;

  // Live estimated installment com juros de 3% a.m. padrão 48x
  const parcelaEstimada = calcParcela({
    valor: vehicleValue,
    entrada: entrada,
    meses: meses,
    taxaMensal: 0.03,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || status === 'submitting') return;

    setStatus('submitting');
    setErrorMessage('');

    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;

    const payload = {
      origem: 'site-dg',
      tipo: 'simulacao_financiamento',
      enviadoEm: new Date().toISOString(),
      cliente: {
        nome: nome.trim(),
        telefone: formattedPhone,
        cpf: cpf.replace(/\D/g, ''),
        dataNascimento: dataNascimento,
      },
      simulacao: {
        valorVeiculo: vehicleValue,
        entrada: entrada,
        meses: meses,
        parcelaEstimada: parcelaEstimada,
        taxaMensalReferencia: 0.03,
      },
      veiculo: vehicle ? {
        id: vehicle.id,
        slug: vehicle.id,
        titulo: vehicle.description,
        marca: (vehicle as any).brand || '',
        modelo: (vehicle as any).model || '',
        ano: parseInt(vehicle.year) || 2022,
        km: parseInt(vehicle.km.replace(/\D/g, '')) || 0,
        cambio: (vehicle as any).transmission || '',
        combustivel: (vehicle as any).fuel || '',
        cor: '',
        preco: vehicle.price,
        url: `${window.location.origin}/?veiculo=${vehicle.id}`,
        foto: vehicle.image,
      } : null,
      contexto: {
        pagina: '/financiamento',
        userAgent: navigator.userAgent,
        utm: {
          source: new URLSearchParams(window.location.search).get('utm_source') || '',
          medium: new URLSearchParams(window.location.search).get('utm_medium') || '',
          campaign: new URLSearchParams(window.location.search).get('utm_campaign') || '',
        },
      },
    };

    try {
      const response = await fetch('https://n8n.drivvoo.com/webhook/veiculosnatrocadg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setStatus('success');
        track('sim_submit', { valorVeiculo: vehicleValue, entrada, meses });
      } else {
        throw new Error('Servidor indisponível no momento.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Falha ao enviar a simulação. Tente novamente.');
    }
  };

  return (
    <SiteShell variant="financiamento" title="Simulação de Financiamento">
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
                Simulação Recebida!
              </h2>
              <p className="text-sm text-[#CBD5E1] leading-relaxed">
                Recebemos seus dados para análise de crédito. Um consultor da DG Automóveis entrará em contato em instantes com as taxas aprovadas.
              </p>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl text-left text-xs space-y-2 text-[#FFFFFF]/90 border border-white/10">
              <div className="flex justify-between">
                <span>Valor do Carro:</span>
                <span className="font-bold text-white">{brl(vehicleValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Entrada informada:</span>
                <span className="font-bold text-white">{brl(entrada)}</span>
              </div>
              <div className="flex justify-between">
                <span>Prazo:</span>
                <span className="font-bold text-white">{meses} parcelas</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 font-bold text-sm text-green-400">
                <span>Estimativa inicial:</span>
                <span>{brl(parcelaEstimada)}/mês</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={waLink(`Olá! Acabei de enviar minha simulação de financiamento no site para um veículo de ${brl(vehicleValue)} com entrada de ${brl(entrada)}.`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('whatsapp_click', { pagina: '/financiamento_sucesso' })}
                className="w-full py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
              >
                Acompanhar com Consultor no WhatsApp
              </a>

              <a
                href="/"
                className="block w-full py-3.5 bg-white/10 text-white font-extrabold text-xs uppercase rounded-2xl hover:bg-white/20 min-h-[44px]"
              >
                Voltar ao Estoque
              </a>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Header Hero */}
            <div className="text-center space-y-2 pt-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                Aprovação Rápida & Sem Complicação
              </span>
              <h1 className="font-serif text-3xl font-extrabold text-[#0B1120] tracking-tight">
                Simule seu Financiamento
              </h1>
              <p className="text-xs text-[#475569]">
                Trabalhamos com os principais bancos para garantir as menores taxas do mercado.
              </p>
            </div>

            {/* Selected Vehicle Banner (if ?veiculo=<slug>) */}
            {vehicle && (
              <div className="p-4 bg-white border border-manos-sand rounded-2xl flex items-center gap-4 shadow-sm">
                <img
                  src={vehicle.image}
                  alt={vehicle.description}
                  className="w-20 h-16 object-cover rounded-xl bg-manos-warm flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-extrabold text-manos-red uppercase tracking-widest block">
                    Carro Selecionado
                  </span>
                  <h4 className="font-serif font-bold text-sm text-[#0B1120] truncate">
                    {vehicle.description}
                  </h4>
                  <p className="text-manos-red font-extrabold text-base">
                    {vehicle.priceFormatted}
                  </p>
                </div>
              </div>
            )}

            {/* Live Calculator Card */}
            <div className="p-6 bg-[#0B1120] text-[#FFFFFF] rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E2E8F0]/15 pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[#38BDF8]" />
                  <span className="text-xs font-extrabold text-[#CBD5E1] uppercase tracking-wider">
                    Estimativa da Parcela
                  </span>
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-1 bg-[#0052FF] text-white rounded-full">
                  Condição Especial
                </span>
              </div>

              <div className="text-center py-2 space-y-1">
                <div className="text-3xl sm:text-4xl font-serif font-extrabold text-white tracking-tight">
                  {parcelaEstimada > 0 ? `${brl(parcelaEstimada)}` : 'R$ --'}
                  <span className="text-xs sm:text-sm font-sans text-[#CBD5E1] font-semibold"> / mês</span>
                </div>
                <p className="text-xs font-bold text-[#38BDF8]">
                  Simulação em {meses}x parcelas {entrada > 0 ? `· Entrada de ${brl(entrada)}` : '· Sem entrada'}
                </p>
                <p className="text-[10px] text-[#CBD5E1] leading-tight font-medium pt-1">
                  *Simulação prévia estimada em 48x. A aprovação final depende da análise do perfil pelas financeiras parceiras.
                </p>
              </div>

              {!vehicle && (
                <div className="space-y-4 pt-3 border-t border-[#E2E8F0]/15">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#CBD5E1]">
                        Valor aproximado do veículo
                      </label>
                      <span className="text-base sm:text-lg font-serif font-black text-[#38BDF8] bg-white/10 px-3 py-1 rounded-xl border border-white/15 shadow-inner">
                        {brl(vehicleValue)}
                      </span>
                    </div>

                    {/* Barra deslizante (Range Slider) */}
                    <div className="space-y-1.5">
                      <input
                        type="range"
                        min={15000}
                        max={250000}
                        step={1000}
                        value={vehicleValue || 85000}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setVehicleValue(val);
                          const newMax = Math.round(val * 0.8);
                          if (entrada > newMax) setEntrada(Math.round(val * 0.25));
                        }}
                        className="range-slider-dg"
                        style={{
                          background: `linear-gradient(to right, #0052FF 0%, #38BDF8 ${Math.min(100, Math.max(0, ((vehicleValue - 15000) / (250000 - 15000)) * 100))}%, #334155 ${Math.min(100, Math.max(0, ((vehicleValue - 15000) / (250000 - 15000)) * 100))}%, #334155 100%)`
                        }}
                      />
                      
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                        <span>R$ 15 mil</span>
                        <span>R$ 130 mil</span>
                        <span>R$ 250 mil</span>
                      </div>
                    </div>

                    {/* Atalhos Rápidos de Seleção de Valor */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      <span className="text-[10px] text-slate-400 font-semibold mr-1">Atalhos:</span>
                      {[35000, 50000, 85000, 120000, 180000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setVehicleValue(val);
                            const newMax = Math.round(val * 0.8);
                            if (entrada > newMax) setEntrada(Math.round(val * 0.25));
                          }}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                            vehicleValue === val
                              ? 'bg-[#0052FF] text-white shadow-[0_0_12px_rgba(0,82,255,0.5)] border border-sky-400'
                              : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white border border-white/5'
                          }`}
                        >
                          {val >= 1000 ? `R$ ${val / 1000} mil` : brl(val)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Entrada Rápida Integrada no Card */}
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#CBD5E1]">
                        Entrada na Simulação
                      </span>
                      <span className="font-extrabold text-[#38BDF8]">
                        {entrada > 0 ? brl(entrada) : 'Sem entrada (R$ 0)'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Sem entrada', pct: 0 },
                        { label: '20%', pct: 0.20 },
                        { label: '30%', pct: 0.30 },
                        { label: '50%', pct: 0.50 },
                      ].map((preset) => {
                        const presetVal = Math.round(vehicleValue * preset.pct);
                        const isSelected = entrada === presetVal;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setEntrada(presetVal)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-[#0052FF] text-white border-sky-400 shadow-[0_0_10px_rgba(0,82,255,0.4)]'
                                : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white border-white/5'
                            }`}
                          >
                            {preset.label} {presetVal > 0 ? `(${brl(presetVal)})` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Full Financing Form */}
            <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-3xl border border-manos-sand shadow-sm">
              <h3 className="font-serif font-bold text-lg text-[#0B1120] border-b border-manos-sand pb-3">
                Dados para Análise de Crédito
              </h3>

              {/* 1. Nome Completo */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  1. Nome Completo <span className="text-manos-red">*</span>
                </label>
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
                  className="input-manos"
                />
                {nome && !isNameValid && (
                  <p className="text-[10px] text-red-500 font-bold">Informe seu nome e sobrenome completos.</p>
                )}
              </div>

              {/* 2. Telefone */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  2. Telefone / WhatsApp <span className="text-manos-red">*</span>
                </label>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  placeholder="(47) 99999-9999"
                  value={phone}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    setPhone(formatted);
                    saveStoredLead({ telefone: formatted });
                  }}
                  className="input-manos"
                />
              </div>

              {/* 3. CPF */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  3. CPF <span className="text-manos-red">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => {
                      const formatted = formatCPF(e.target.value);
                      setCpf(formatted);
                      saveStoredLead({ cpf: formatted });
                    }}
                    className="input-manos"
                  />
                  {cpf.length >= 11 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isCpfValid ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {cpf.length >= 11 && !isCpfValid && (
                  <p className="text-[10px] text-red-500 font-bold">CPF inválido. Verifique os números digitados.</p>
                )}
              </div>

              {/* 4. Data de Nascimento */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  4. Data de Nascimento <span className="text-manos-red">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dataNascimento}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDataNascimento(val);
                    saveStoredLead({ dataNascimento: val });
                  }}
                  className="input-manos"
                />
                {dataNascimento && !isAgeValid && (
                  <p className="text-[10px] text-red-500 font-bold">É necessário ser maior de 18 anos para financiar.</p>
                )}
              </div>

              {/* 5. Valor de Entrada */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                    5. Valor de Entrada (R$) <span className="text-manos-red">*</span>
                  </label>
                  <span className="text-xs font-extrabold text-[#0052FF] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                    {brl(entrada)}
                  </span>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={maxEntrada}
                    step={500}
                    value={entrada}
                    onChange={(e) => setEntrada(Number(e.target.value))}
                    className="range-slider-dg"
                    style={{
                      background: `linear-gradient(to right, #0052FF 0%, #38BDF8 ${maxEntrada > 0 ? Math.min(100, Math.max(0, (entrada / maxEntrada) * 100)) : 0}%, #CBD5E1 ${maxEntrada > 0 ? Math.min(100, Math.max(0, (entrada / maxEntrada) * 100)) : 0}%, #CBD5E1 100%)`
                    }}
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 px-0.5">
                    <span>Sem Entrada (R$ 0)</span>
                    <span>Máx 80% ({brl(maxEntrada)})</span>
                  </div>
                </div>

                {/* Atalhos de % de entrada */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: 'Sem entrada', pct: 0 },
                    { label: '20%', pct: 0.20 },
                    { label: '30%', pct: 0.30 },
                    { label: '50%', pct: 0.50 },
                  ].map((preset) => {
                    const presetVal = Math.round(vehicleValue * preset.pct);
                    const isSelected = entrada === presetVal;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setEntrada(presetVal)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-[#0052FF] text-white border-[#0052FF] shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                        }`}
                      >
                        {preset.label} ({brl(presetVal)})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Quantidade de Meses */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  6. Quantidade de Parcela <span className="text-manos-red">*</span>
                </label>
                <select
                  value={meses}
                  onChange={(e) => setMeses(Number(e.target.value))}
                  className="input-manos cursor-pointer font-bold"
                >
                  <option value={12}>12x parcelas</option>
                  <option value={24}>24x parcelas</option>
                  <option value={36}>36x parcelas</option>
                  <option value={48}>48x parcelas</option>
                  <option value={60}>60x parcelas</option>
                </select>
              </div>

              <PrivacyNotice />

              {status === 'error' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-red-600 text-center">{errorMessage}</p>
                  <a
                    href={waLink(`Olá! Tentei enviar minha simulação de financiamento pelo site mas deu erro. Dados: ${nome} - ${phone}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track('whatsapp_click', { pagina: '/financiamento_error' })}
                    className="w-full py-3.5 bg-green-600 text-white font-extrabold text-xs uppercase rounded-xl flex items-center justify-center gap-2"
                  >
                    Enviar Simulação pelo WhatsApp
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={!isFormValid || status === 'submitting'}
                className="btn-manos"
              >
                {status === 'submitting' ? 'Enviando Simulação...' : 'Enviar Dados para Análise'}
              </button>
            </form>

            <TrustCards />
          </div>
        )}
    </SiteShell>
  );
}
