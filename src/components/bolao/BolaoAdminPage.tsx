import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Trophy, Loader2, CheckCircle2, Users, Send, Trash2 } from 'lucide-react';
import Toast, { useToast } from './Toast';
import { fetchPalpites, finalizarJogo, deletePalpite, type Palpite } from '../../services/bolaoService';
import japanFlag from './japan-flag.png';
import scotlandFlag from './scotland-flag.png';
import haitiCrest from './haiti-crest.png';
import moroccoFlag from './morocco-flag.png';

const ADMIN_PASSWORD = (import.meta as any).env?.VITE_BOLAO_ADMIN_PASSWORD || (import.meta as any).env?.VITE_ADMIN_PASSWORD || 'dg2026admin';

export default function BolaoAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [isLoadingPalpites, setIsLoadingPalpites] = useState(false);
  const [placarBrasil, setPlacarBrasil] = useState('');
  const [placarAdversario, setPlacarAdversario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [activeGameTab, setActiveGameTab] = useState<'japao' | 'escocia' | 'haiti' | 'marrocos'>('japao');
  const { toast, showToast, hideToast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Senha incorreta.');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadPalpites();
    }
  }, [isAuthenticated]);

  const loadPalpites = async () => {
    setIsLoadingPalpites(true);
    try {
      const data = await fetchPalpites();
      setPalpites(data);
    } catch (error) {
      showToast('Erro ao carregar palpites.', 'error');
    } finally {
      setIsLoadingPalpites(false);
    }
  };

  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placarBrasil || !placarAdversario) {
      showToast('Preencha ambos os placares.', 'error');
      return;
    }

    if (activeGameTab !== 'japao') {
      showToast('Apenas o jogo atual (Japão) pode ser finalizado agora.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await finalizarJogo(parseInt(placarBrasil, 10), parseInt(placarAdversario, 10));
      setIsFinalized(true);
      showToast('Jogo finalizado com sucesso! Webhook disparado.', 'success');
      loadPalpites();
    } catch (error) {
      showToast('Erro ao finalizar jogo. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePalpite = async (id: any, telefone: string, palpite: string) => {
    if (!id && !telefone) return;
    if (!window.confirm('Tem certeza que deseja excluir este palpite?')) return;
    try {
      await deletePalpite(id, telefone, palpite);
      showToast('Palpite excluído com sucesso.', 'success');
      loadPalpites();
    } catch (error) {
      showToast('Erro ao excluir palpite.', 'error');
    }
  };

  // Separando os palpites por jogo
  const gameKeyword = activeGameTab === 'japao' ? 'Japão' : activeGameTab === 'escocia' ? 'Escócia' : activeGameTab === 'haiti' ? 'Haiti' : 'Marrocos';

  const activePalpites = useMemo(() => {
    return palpites.filter(p => {
      if (p.protocolo?.startsWith('RESULTADO')) return false; // Hide official result from list
      return p.palpite.includes(gameKeyword);
    });
  }, [palpites, gameKeyword]);

  const activeOpponentName = gameKeyword;
  const activeOpponentCode = activeGameTab === 'japao' ? 'JP' : activeGameTab === 'escocia' ? 'ESC' : activeGameTab === 'haiti' ? 'HT' : 'MA';
  const activeOpponentFlagSrc = activeGameTab === 'japao' ? japanFlag : activeGameTab === 'escocia' ? scotlandFlag : activeGameTab === 'haiti' ? haitiCrest : moroccoFlag;

  // Check if current tab is finalized
  const isCurrentGameFinalized = useMemo(() => {
    return palpites.some(p =>
      p.protocolo?.startsWith('RESULTADO') && p.palpite.includes(gameKeyword)
    );
  }, [palpites, gameKeyword]);

  // Password Gate
  if (!isAuthenticated) {
    return (
      <div className="bolao-viewport">
        <div className="bolao-glow" />
        <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />

        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm space-y-8"
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-manos-red/10 border border-manos-red/20 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-manos-red" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter italic uppercase">
                Admin <span className="text-manos-red">Bolão</span>
              </h1>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
                Acesso restrito
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                autoFocus
                className="w-full py-5 px-6 bg-[#1A1A1A] border border-white/5 rounded-2xl focus:border-manos-red/40 transition-all outline-none text-base text-center tracking-widest"
                placeholder="Senha de acesso"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
              />
              {passwordError && (
                <p className="text-center text-xs text-red-400 font-bold">{passwordError}</p>
              )}
              <button
                type="submit"
                className="w-full py-5 bg-manos-red text-white font-black text-lg uppercase rounded-2xl shadow-[0_20px_50px_rgba(237,28,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
              >
                Entrar
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  // Admin Panel
  return (
    <div className="bolao-viewport">
      <div className="bolao-glow" />
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />

      <header className="p-4 flex items-center justify-between z-20 backdrop-blur-md bg-manos-dark/50 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img
            src="/logo-dg.png"
            alt="DG Automóveis"
            className="h-6 w-auto object-contain"
          />
          <span className="text-[10px] font-black text-manos-red uppercase tracking-widest">Admin</span>
        </div>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="text-[10px] font-black text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="scroll-container custom-scrollbar space-y-8 p-4">
        {/* Game Tabs */}
        <div className="flex bg-[#161616] border border-white/5 p-1 rounded-2xl gap-1">
          <button
            onClick={() => { setActiveGameTab('japao'); setPlacarBrasil(''); setPlacarAdversario(''); setIsFinalized(false); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
              activeGameTab === 'japao'
                ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <img src={japanFlag} alt="Japão" className="w-4 h-3 object-cover rounded-sm" /> Japão
          </button>
          <button
            onClick={() => { setActiveGameTab('escocia'); setPlacarBrasil(''); setPlacarAdversario(''); setIsFinalized(false); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
              activeGameTab === 'escocia'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <img src={scotlandFlag} alt="Escócia" className="w-4 h-3 object-cover rounded-sm" /> Escócia
          </button>
          <button
            onClick={() => { setActiveGameTab('haiti'); setPlacarBrasil(''); setPlacarAdversario(''); setIsFinalized(false); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
              activeGameTab === 'haiti'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <img src={haitiCrest} alt="Haiti" className="w-4 h-3 object-contain rounded-sm" /> Haiti
          </button>
          <button
            onClick={() => { setActiveGameTab('marrocos'); setPlacarBrasil(''); setPlacarAdversario(''); setIsFinalized(false); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
              activeGameTab === 'marrocos'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <img src={moroccoFlag} alt="Marrocos" className="w-4 h-3 object-cover rounded-sm" /> Marrocos
          </button>
        </div>

        {/* Finalizar Jogo */}
        <AnimatePresence mode="wait">
          {!isCurrentGameFinalized && !isFinalized && activeGameTab === 'japao' ? (
            <motion.div
              key="finalizar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black tracking-tighter italic uppercase">
                  Placar <span className="text-manos-red">Final</span>
                </h2>
                <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
                  Insira o resultado oficial do jogo
                </p>
              </div>

              <form onSubmit={handleFinalizar} className="space-y-6">
                <div className="flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">🇧🇷 BR</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={placarBrasil}
                      onChange={(e) => setPlacarBrasil(e.target.value.replace(/\D/g, ''))}
                      className="w-16 h-16 text-center text-3xl font-black bg-[#1A1A1A] border border-white/10 rounded-xl outline-none focus:border-green-500/50 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <span className="text-2xl font-black text-white/20 pt-6">×</span>
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex items-center gap-2 text-3xl font-black uppercase tracking-wider"><img src={activeOpponentFlagSrc} alt={activeOpponentName} className="w-8 h-6 object-cover rounded-md" /> {activeOpponentCode}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={placarAdversario}
                      onChange={(e) => setPlacarAdversario(e.target.value.replace(/\D/g, ''))}
                      className="w-16 h-16 text-center text-3xl font-black bg-[#1A1A1A] border border-white/10 rounded-xl outline-none focus:border-red-500/50 transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !placarBrasil || !placarAdversario}
                  className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl shadow-xl shadow-manos-red/20 disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Finalizar Jogo
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="finalized"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-6"
            >
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-black tracking-tighter italic uppercase text-white/80">
                Jogo Finalizado
              </h3>
              <p className="text-xs text-white/30">O resultado deste jogo já foi processado.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Separator */}
        <div className="border-t border-white/5" />

        {/* Palpites List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-manos-red" />
              <h3 className="text-sm font-black uppercase tracking-tighter italic">
                Palpites Registrados
              </h3>
            </div>
            <button
              onClick={loadPalpites}
              className="text-[10px] font-black text-manos-red uppercase tracking-widest hover:brightness-125 transition-all"
            >
              Atualizar
            </button>
          </div>

          {isLoadingPalpites ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/30 mx-auto" />
            </div>
          ) : activePalpites.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-white/30 italic">Nenhum palpite registrado para este jogo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-white/20 uppercase tracking-widest font-black">
                Total: {activePalpites.length} palpite{activePalpites.length !== 1 ? 's' : ''}
              </p>
              {activePalpites.map((p, i) => (
                <motion.div
                  key={p.id || i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-glass p-4 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white/80 truncate max-w-[180px]">{p.nome}</p>
                    <p className="text-[10px] text-white/30 font-mono">{p.telefone}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl">
                      <span className="text-sm">🇧🇷</span>
                      <span className="text-lg font-black text-white">{p.placar_brasil}</span>
                      <span className="text-xs text-white/30 font-black">×</span>
                      <span className="text-lg font-black text-white">{p.placar_adversario}</span>
                      <img src={activeOpponentFlagSrc} alt={activeOpponentName} className="w-5 h-3.5 object-cover rounded-sm ml-1" />
                    </div>
                    <button
                      onClick={() => handleDeletePalpite(p.id, p.telefone, p.palpite)}
                      className="p-2 bg-manos-red/10 text-manos-red hover:bg-manos-red hover:text-white rounded-lg transition-all"
                      title="Excluir Palpite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
