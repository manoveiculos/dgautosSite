import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, Clock, Trophy, AlertCircle, CheckCircle2 } from 'lucide-react';
import brazilFlag from './brazil-flag.png';
import japanFlag from './japan-flag.png';

interface StepPalpiteProps {
  onSubmit: (nome: string, whatsapp: string, placarBrasil: number, placarHaiti: number) => void;
  isLoading: boolean;
}

// Encerramento das inscrições: 29/06/2026 às 14h00 (horário de Brasília),
// no apito inicial de Brasil x Japão.
// Lembre-se: 14:00 no Brasil (UTC-3) = 17:00 do MESMO dia em UTC.
const DEADLINE = new Date('2026-06-29T17:00:00.000Z');

export default function StepPalpite({ onSubmit, isLoading }: StepPalpiteProps) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [placarBrasil, setPlacarBrasil] = useState<string>('');
  const [placarHaiti, setPlacarHaiti] = useState<string>('');
  const [activeInput, setActiveInput] = useState<'brasil' | 'haiti' | null>(null);

  const now = new Date();
  const isClosed = now >= DEADLINE;

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
  const isScoresValid = placarBrasil !== '' && placarHaiti !== '';
  const isFormValid = nome.trim().length >= 3 && isPhoneValid && isScoresValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isLoading) {
      const brVal = parseInt(placarBrasil, 10);
      const opVal = parseInt(placarHaiti, 10);
      onSubmit(nome.trim(), rawPhone, brVal, opVal);
    }
  };

  const handleScoreChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 2) {
      setter(clean);
    }
  };

  if (isClosed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6 py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 bg-manos-red/10 border border-manos-red/20 rounded-full flex items-center justify-center mx-auto"
        >
          <Clock className="w-10 h-10 text-manos-red" />
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-3xl font-black tracking-tighter italic uppercase leading-none">
            Inscrições <span className="text-manos-red">Encerradas!</span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-xs mx-auto">
            O jogo já vai começar. As inscrições foram encerradas às 14h.
          </p>
        </div>

        <div className="card-glass p-4 max-w-xs mx-auto">
          <p className="text-xs text-white/40">
            Fique ligado no resultado e na nossa próxima promoção!
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      {/* Title */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full animate-bounce">
          <Trophy className="w-3.5 h-3.5 text-yellow-400 fill-current" />
          <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
            Faça seu palpite da Copa
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tighter italic uppercase leading-none">
          Qual o seu palpite? ⚽
        </h2>

        <p className="text-xs text-white/40 uppercase tracking-widest font-black">
          Brasil x Japão
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Identificação */}
        <div className="space-y-4 max-w-sm mx-auto">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">
              Nome Completo
            </label>
            <input
              type="text"
              required
              autoComplete="name"
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
        </div>

        {/* Score inputs */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {/* Brazil Glowing Card */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className={`flex-1 card-glass p-4 sm:p-5 flex flex-col items-center gap-3 transition-all duration-300 border ${
              activeInput === 'brasil' 
                ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.25)] bg-green-500/5' 
                : 'border-white/5 hover:border-green-500/40'
            }`}
          >
            <img 
              src={brazilFlag} 
              alt="Brasil" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_4px_12px_rgba(34,197,94,0.35)]" 
            />
            <span className="text-xs font-black uppercase tracking-widest text-green-400">
              Brasil
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={placarBrasil}
              onFocus={() => setActiveInput('brasil')}
              onBlur={() => setActiveInput(null)}
              onChange={(e) => handleScoreChange(setPlacarBrasil, e.target.value)}
              className="w-16 h-16 sm:w-20 sm:h-20 text-center text-3xl sm:text-4xl font-black bg-[#1A1A1A] border border-white/10 rounded-2xl outline-none focus:border-green-500/80 transition-all text-white"
              placeholder="0"
            />
          </motion.div>

          {/* X Divider */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-white/20 italic">VS</span>
          </div>

          {/* Opponent Glowing Card */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={`flex-1 card-glass p-4 sm:p-5 flex flex-col items-center gap-3 transition-all duration-300 border ${
              activeInput === 'haiti'
                ? 'border-manos-red shadow-[0_0_30px_rgba(237,28,36,0.25)] bg-manos-red/5'
                : 'border-white/5 hover:border-manos-red/40'
            }`}
          >
            <img
              src={japanFlag}
              alt="Japão"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_4px_12px_rgba(237,28,36,0.35)]"
            />
            <span className="text-xs font-black uppercase tracking-widest text-manos-red">
              Japão
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={placarHaiti}
              onFocus={() => setActiveInput('haiti')}
              onBlur={() => setActiveInput(null)}
              onChange={(e) => handleScoreChange(setPlacarHaiti, e.target.value)}
              className="w-16 h-16 sm:w-20 sm:h-20 text-center text-3xl sm:text-4xl font-black bg-[#1A1A1A] border border-white/10 rounded-2xl outline-none focus:border-manos-red/80 transition-all text-white"
              placeholder="0"
            />
          </motion.div>
        </div>

        {/* Info card */}
        <div className="card-glass p-4 space-y-2 max-w-sm mx-auto">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 animate-pulse" />
            <p className="text-xs text-white/60">
              Palpites abertos até o <span className="text-white font-bold">início do jogo de hoje</span>
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className="flex-1 py-5 bg-gradient-to-r from-manos-red to-red-600 text-white font-black text-lg uppercase rounded-2xl shadow-[0_20px_50px_rgba(237,28,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5" />
                Enviar Palpite
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
