import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, Check } from 'lucide-react';
import { track } from '../../lib/track';

const LGPD_KEY = 'manos_lgpd_consent_v1';

export default function LGPDBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  // Preference Toggles
  const [analitico, setAnalitico] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LGPD_KEY);
      if (!saved) {
        // Delay 1s before showing
        const timer = setTimeout(() => setVisible(true), 1000);
        return () => clearTimeout(timer);
      }
    } catch {
      /* noop */
    }
  }, []);

  const savePreferences = (full = false) => {
    const prefs = {
      necessario: true,
      analitico: full ? true : analitico,
      marketing: full ? true : marketing,
      timestamp: new Date().toISOString(),
    };

    try {
      localStorage.setItem(LGPD_KEY, JSON.stringify(prefs));
    } catch {
      /* noop */
    }

    setVisible(false);
    track('lgpd_consent_save', prefs);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[#0B1120]/95 backdrop-blur-md text-[#FFFFFF] border-t border-[#E2E8F0]/20 shadow-2xl">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-manos-red text-manos-accent flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-extrabold text-white text-sm">Privacidade & Cookies (LGPD)</h4>
              <p className="text-[#CBD5E1] leading-relaxed">
                Utilizamos cookies essenciais e tecnologias de medição para garantir segurança, simulações de financiamento e melhoria da experiência.{' '}
                <a href="/politica-de-privacidade" className="underline font-bold text-white">
                  Saiba mais
                </a>.
              </p>
            </div>
          </div>

          {showCustomize ? (
            <div className="w-full md:w-auto space-y-3 pt-2 md:pt-0">
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked disabled className="accent-manos-red" />
                  <span>Essenciais (obrigatório)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analitico}
                    onChange={(e) => setAnalitico(e.target.checked)}
                    className="accent-manos-red"
                  />
                  <span>Analíticos</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="accent-manos-red"
                  />
                  <span>Marketing</span>
                </label>
              </div>

              <button
                onClick={() => savePreferences(false)}
                className="w-full py-2.5 px-4 bg-manos-red text-manos-accent font-extrabold text-xs uppercase rounded-xl"
              >
                Salvar Seleção
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
              <button
                onClick={() => setShowCustomize(true)}
                className="flex-1 md:flex-initial py-3 px-4 bg-white/10 text-white font-extrabold text-xs uppercase rounded-xl hover:bg-white/20 min-h-[44px]"
              >
                Personalizar
              </button>
              <button
                onClick={() => savePreferences(true)}
                className="flex-1 md:flex-initial py-3 px-5 bg-manos-red text-manos-accent font-extrabold text-xs uppercase rounded-xl hover:bg-[#003ECC] min-h-[44px]"
              >
                Aceitar Todos
              </button>
            </div>
          )}
        </div>
      </div>
    </AnimatePresence>
  );
}
