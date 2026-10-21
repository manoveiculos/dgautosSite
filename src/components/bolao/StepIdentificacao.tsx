import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import brazilFlag from './brazil-flag.png';
import moroccoFlag from './morocco-flag.png';

interface StepIdentificacaoProps {
  onNext: (nome: string, whatsapp: string) => void;
  isLoading: boolean;
}

export default function StepIdentificacao({ onNext, isLoading }: StepIdentificacaoProps) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const formatPhone = (val: string) => {
    let r = val.replace(/\D/g, '');
    if (r.length > 11) r = r.substring(0, 11);
    if (r.length > 10) {
      return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (r.length > 6) {
      return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (r.length > 2) {
      return r.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
    } else if (r.length > 0) {
      return '(' + r;
    }
    return r;
  };

  const rawPhone = whatsapp.replace(/\D/g, '');
  const isPhoneValid = rawPhone.length >= 10;
  const isFormValid = nome.trim().length >= 3 && isPhoneValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isLoading) {
      onNext(nome.trim(), rawPhone);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">
            Copa 2026 • Inscrição Aberta
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter leading-[0.9] italic uppercase">
          Bolão DG Automóveis
          <br />
          <span className="text-manos-red">Brasil x Marrocos</span>
        </h1>

        <div className="flex items-center justify-center gap-4 py-1">
          <img
            src={brazilFlag}
            alt="Brasil"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-[0_4px_12px_rgba(34,197,94,0.35)]"
          />
          <span className="text-sm font-black italic text-white/40 uppercase tracking-widest">
            VS
          </span>
          <img
            src={moroccoFlag}
            alt="Marrocos"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-[0_4px_12px_rgba(237,28,36,0.35)]"
          />
        </div>

        <div className="card-glass p-4 space-y-2 mx-auto max-w-sm">
          <p className="text-sm text-white/70 leading-relaxed">
            🏆 O primeiro a acertar o <span className="text-white font-bold">placar exato</span> leva{' '}
            <span className="text-green-400 font-black">R$ 100 no PIX!</span>
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">
            Nome Completo
          </label>
          <input
            type="text"
            required
            autoComplete="name"
            autoFocus
            className="w-full py-5 px-6 bg-[#1A1A1A] border border-white/5 rounded-2xl focus:border-manos-red/40 transition-all outline-none text-base"
            placeholder="Seu nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">
            WhatsApp (com DDD)
          </label>
          <div className="relative">
            <input
              type="tel"
              required
              inputMode="numeric"
              autoComplete="tel"
              className={`w-full py-5 px-6 pr-14 bg-[#1A1A1A] border rounded-2xl transition-all outline-none text-base ${
                whatsapp
                  ? isPhoneValid
                    ? 'border-green-500/50'
                    : 'border-manos-red/50'
                  : 'border-white/5 focus:border-manos-red/40'
              }`}
              placeholder="(47) 99999-9999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
            />
            {whatsapp && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isPhoneValid ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-manos-red" />
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className="w-full py-5 bg-manos-red text-white font-black text-lg uppercase rounded-2xl shadow-[0_20px_50px_rgba(237,28,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Registrando...
            </>
          ) : (
            <>
              Avançar
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[9px] text-white/20 uppercase tracking-[0.3em] font-black">
        Seus dados estão seguros • LGPD
      </p>
    </motion.div>
  );
}
