import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

interface BolaoHeaderProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  showBack?: boolean;
}

const stepLabels = ['Identificação', 'Verificação', 'Palpite', 'Confirmado'];

export default function BolaoHeader({ currentStep, totalSteps, onBack, showBack = false }: BolaoHeaderProps) {
  return (
    <header className="p-4 flex flex-col items-center gap-4 z-20 backdrop-blur-md bg-manos-dark/50 lg:rounded-t-[32px]">
      <img
        src="/logo-dg.png"
        alt="DG Automóveis"
        className="h-8 w-auto object-contain"
      />

      <div className="w-full space-y-3">
        {/* Step dots */}
        <div className="flex items-center justify-center gap-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <motion.div
                initial={false}
                animate={{
                  scale: i + 1 === currentStep ? 1.2 : 1,
                  backgroundColor:
                    i + 1 < currentStep
                      ? '#22c55e'
                      : i + 1 === currentStep
                        ? '#ED1C24'
                        : 'rgba(255,255,255,0.1)',
                }}
                className="w-3 h-3 rounded-full"
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
              {i < totalSteps - 1 && (
                <div
                  className={`w-8 h-0.5 rounded-full transition-colors duration-300 ${
                    i + 1 < currentStep ? 'bg-green-500/50' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step label + back */}
        <div className="flex justify-between items-center px-1">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[10px] font-black text-manos-red uppercase tracking-widest hover:brightness-125 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-3 h-3" />
              Voltar
            </button>
          ) : (
            <div />
          )}
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
            {stepLabels[currentStep - 1] || ''}
          </span>
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
            {currentStep}/{totalSteps}
          </span>
        </div>
      </div>
    </header>
  );
}
