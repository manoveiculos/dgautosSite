import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import BolaoHeader from './BolaoHeader';
import StepPalpite from './StepPalpite';
import StepSucesso from './StepSucesso';
import TransparenciaDashboard from './TransparenciaDashboard';
import Toast, { useToast } from './Toast';
import { savePalpite, getPalpiteByPhone } from '../../services/bolaoService';

export default function BolaoPage() {
  const [step, setStep] = useState(1);
  const [leadData, setLeadData] = useState({ nome: '', whatsapp: '' });
  const [palpite, setPalpite] = useState({ brasil: 0, haiti: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'aposta' | 'transparencia'>('aposta');
  const { toast, showToast, hideToast } = useToast();

  const handlePalpite = async (nome: string, whatsapp: string, placarBrasil: number, placarHaiti: number) => {
    setIsLoading(true);
    try {
      // Regra Anti-Duplicidade
      const guess = await getPalpiteByPhone(whatsapp);
      if (guess) {
        showToast('Este número de WhatsApp já registrou um palpite para o jogo de hoje.', 'error');
        setIsLoading(false);
        return;
      }

      await savePalpite(nome, whatsapp, placarBrasil, placarHaiti);
      setLeadData({ nome, whatsapp });
      setPalpite({ brasil: placarBrasil, haiti: placarHaiti });
      setStep(2);
      showToast('Palpite registrado! Boa sorte! 🍀', 'success');
    } catch (error) {
      console.error('Palpite save error:', error);
      showToast('Erro ao registrar palpite. Tente novamente.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  return (
    <div className="bolao-viewport">
      <div className="bolao-glow" />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      <BolaoHeader
        currentStep={activeTab === 'transparencia' ? 1 : step}
        totalSteps={2}
        onBack={handleBack}
        showBack={activeTab === 'aposta' && step > 1}
      />

      {step < 2 && (
        <div className="px-6 pb-2 pt-1 z-20 flex justify-center">
          <div className="flex bg-[#161616] border border-white/5 p-1 rounded-2xl w-full max-w-sm">
            <button
              onClick={() => setActiveTab('aposta')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'aposta'
                  ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              ⚽ Palpitar
            </button>
            <button
              onClick={() => setActiveTab('transparencia')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'transparencia'
                  ? 'bg-white/10 text-white border border-white/5'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              📊 Mural Geral
            </button>
          </div>
        </div>
      )}

      <main className="scroll-container custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'transparencia' && step < 2 ? (
            <motion.div
              key="transparencia-dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.35 }}
            >
              <TransparenciaDashboard />
            </motion.div>
          ) : (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
            >
              {step === 1 && (
                <StepPalpite
                  onSubmit={handlePalpite}
                  isLoading={isLoading}
                />
              )}

              {step === 2 && (
                <StepSucesso
                  nome={leadData.nome}
                  placarBrasil={palpite.brasil}
                  placarHaiti={palpite.haiti}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {step < 2 && (
        <div className="sticky-footer">
          <div className="text-center py-2">
            <p className="text-[9px] text-white/10 uppercase tracking-[0.3em] font-black italic">
              DG Automóveis • Copa 2026
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
