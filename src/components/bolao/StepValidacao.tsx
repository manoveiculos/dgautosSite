import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Loader2, RotateCw } from 'lucide-react';
import { verifyCode } from '../../services/bolaoService';

interface StepValidacaoProps {
  whatsapp: string;
  onNext: () => void;
  isLoading: boolean;
  onResend?: () => void | Promise<void>;
}

export default function StepValidacao({ whatsapp, onNext, isLoading, onResend }: StepValidacaoProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    const fullCode = newCode.join('');
    if (fullCode.length === 6) {
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length >= 4) {
      const newCode = [...code];
      for (let i = 0; i < 6; i++) {
        newCode[i] = pastedData[i] || '';
      }
      setCode(newCode);
      if (pastedData.length === 6) {
        handleVerify(pastedData);
      }
    }
  };

  const handleVerify = async (fullCode: string) => {
    if (fullCode.length < 6) {
      setError('Digite os 6 dígitos do código.');
      return;
    }
    if (verifying) return;

    setVerifying(true);
    setError('');
    const isValid = await verifyCode(whatsapp, fullCode);
    setVerifying(false);

    if (isValid) {
      onNext();
    } else {
      setError('Código incorreto. Confira o que enviamos no seu WhatsApp.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    setCanResend(false);
    setCountdown(30);
    setCode(['', '', '', '', '', '']);
    setError('');
    inputRefs.current[0]?.focus();
    try {
      await onResend?.();
    } catch (err) {
      console.error('Resend code error:', err);
    }
  };

  // Format display phone
  const displayPhone = whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      {/* Icon */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto"
        >
          <ShieldCheck className="w-10 h-10 text-green-500" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tighter italic uppercase">
            Verificação <span className="text-green-400">WhatsApp</span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            Enviamos um código de verificação para
          </p>
          <p className="text-base font-bold text-white/80">{displayPhone}</p>
        </div>
      </div>

      {/* Code inputs */}
      <div className="space-y-4">
        <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-black bg-[#1A1A1A] border rounded-xl outline-none transition-all ${
                digit
                  ? 'border-green-500/50 text-white'
                  : 'border-white/10 text-white/50 focus:border-manos-red/50'
              } ${error ? 'border-red-500/50 animate-shake' : ''}`}
            />
          ))}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xs text-red-400 font-bold"
          >
            {error}
          </motion.p>
        )}
      </div>

      {/* Verify button */}
      <button
        onClick={() => handleVerify(code.join(''))}
        disabled={code.join('').length < 6 || isLoading || verifying}
        className="w-full py-5 bg-manos-red text-white font-black text-lg uppercase rounded-2xl shadow-[0_20px_50px_rgba(237,28,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3"
      >
        {isLoading || verifying ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Verificando...
          </>
        ) : (
          'Verificar Código'
        )}
      </button>

      {/* Resend */}
      <div className="text-center">
        {canResend ? (
          <button
            onClick={handleResend}
            className="text-xs font-bold text-manos-red uppercase tracking-wider flex items-center gap-2 mx-auto hover:brightness-125 transition-all"
          >
            <RotateCw className="w-3 h-3" />
            Reenviar código
          </button>
        ) : (
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-black">
            Reenviar em {countdown}s
          </p>
        )}
      </div>
    </motion.div>
  );
}
