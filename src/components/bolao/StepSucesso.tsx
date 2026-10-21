import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Car, ExternalLink } from 'lucide-react';
import brazilFlag from './brazil-flag.png';
import japanFlag from './japan-flag.png';

interface StepSucessoProps {
  nome: string;
  placarBrasil: number;
  placarHaiti: number;
}

export default function StepSucesso({ nome, placarBrasil, placarHaiti }: StepSucessoProps) {
  const [countdown, setCountdown] = useState(5);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    // Countdown
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Redirect to main catalog
          window.location.href = '/estoque';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const handleGoToCatalog = () => {
    window.location.href = '/estoque';
  };

  const handleGoToSite = () => {
    window.location.href = '/';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-8 py-4"
    >
      {/* Animated check */}
      <div className="relative inline-block">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: 0.2, stiffness: 200, damping: 15 }}
          className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(34,197,94,0.35)]"
        >
          <CheckCircle2 className="w-12 h-12 text-white" />
        </motion.div>
        <div className="absolute inset-0 bg-green-500 blur-3xl opacity-15 -z-10" />

        {/* Particle effects */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              x: Math.cos((i * Math.PI * 2) / 8) * 80,
              y: Math.sin((i * Math.PI * 2) / 8) * 80,
            }}
            transition={{ duration: 1.5, delay: 0.4 + i * 0.1 }}
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
            style={{
              backgroundColor: i % 2 === 0 ? '#22c55e' : '#facc15',
            }}
          />
        ))}
      </div>

      {/* Success message */}
      <div className="space-y-4">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-black tracking-tighter leading-none italic uppercase"
        >
          Palpite Registrado
          <br />
          <span className="text-green-400">com Sucesso!</span>
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-3"
        >
          <p className="text-white/60 text-sm">
            Boa sorte, <span className="text-white font-bold">{nome.split(' ')[0]}</span>! 🇧🇷
          </p>

          {/* Score recap */}
          <div className="card-glass p-4 max-w-xs mx-auto">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <img src={brazilFlag} alt="Brasil" className="w-9 h-7 object-contain inline-block" />
                <p className="text-2xl font-black text-white">{placarBrasil}</p>
              </div>
              <span className="text-lg font-black text-white/20">×</span>
              <div className="text-center">
                <img src={japanFlag} alt="Japão" className="w-9 h-7 object-contain inline-block" />
                <p className="text-2xl font-black text-white">{placarHaiti}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Redirect progress */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="space-y-4"
      >
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-black">
          Redirecionando em {countdown}s...
        </p>
        <div className="w-full max-w-xs mx-auto h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* CTA buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleGoToCatalog}
            className="w-full py-5 bg-manos-red text-white font-black text-base uppercase rounded-2xl shadow-[0_20px_50px_rgba(237,28,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <Car className="w-5 h-5" />
            Ver Veículos em Estoque
          </button>

          <button
            onClick={handleGoToSite}
            className="w-full py-4 bg-white/5 border border-white/10 text-white/60 font-bold text-sm uppercase rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Voltar ao Site
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
