import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import TransparenciaDashboard from './TransparenciaDashboard';

export default function TransparenciaPage() {
  const handleGoToBolao = () => {
    window.location.href = '/bolao';
  };

  return (
    <div className="bolao-viewport">
      <div className="bolao-glow" />

      {/* Header */}
      <header className="p-4 flex flex-col items-center gap-4 z-20 backdrop-blur-md bg-manos-dark/50 border-b border-white/5">
        <img
          src="/logo-dg.png"
          alt="DG Automóveis"
          className="h-8 w-auto object-contain animate-pulse"
        />

        <div className="w-full flex justify-between items-center px-1">
          <button
            onClick={handleGoToBolao}
            className="flex items-center gap-1 text-[10px] font-black text-manos-red uppercase tracking-widest hover:brightness-125 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Palpitar
          </button>
          <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
            Transparência Copa 2026
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="scroll-container custom-scrollbar pb-10">
        <TransparenciaDashboard />
      </main>

      {/* Footer Branding */}
      <div className="sticky-footer">
        <div className="text-center py-2">
          <p className="text-[9px] text-white/10 uppercase tracking-[0.3em] font-black italic">
            DG Automóveis • Copa 2026
          </p>
        </div>
      </div>
    </div>
  );
}
