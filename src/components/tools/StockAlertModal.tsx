import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatPhone } from '../../lib/manos';
import { track } from '../../lib/track';

export default function StockAlertModal({
  isOpen,
  onClose,
  initialCategory = 'SUV',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
}) {
  const [categoria, setCategoria] = useState(initialCategory);
  const [faixaPreco, setFaixaPreco] = useState('Até R$ 80 mil');
  const [nome, setNome] = useState('');
  const [phone, setPhone] = useState('');

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const rawPhone = phone.replace(/\D/g, '');
  const isValid = nome.trim().length >= 2 && rawPhone.length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || status === 'submitting') return;

    setStatus('submitting');
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;

    const payload = {
      origem: 'site-dg',
      tipo: 'alerta_estoque',
      enviadoEm: new Date().toISOString(),
      cliente: {
        nome: nome.trim(),
        telefone: formattedPhone,
      },
      criterios: {
        categoria,
        faixaPreco,
      },
      contexto: {
        pagina: window.location.pathname,
        userAgent: navigator.userAgent,
      },
    };

    try {
      const res = await fetch('https://n8n.drivvoo.com/webhook/veiculosnatrocadg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatus('success');
        track('stock_alert_submit', { categoria, faixaPreco });
      } else {
        throw new Error('Falha no servidor');
      }
    } catch {
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white text-[#0B1120] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 relative overflow-hidden"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-manos-warm text-[#0B1120]"
          >
            <X className="w-5 h-5" />
          </button>

          {status === 'success' ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-serif font-bold text-xl text-[#0B1120]">Alerta Ativado!</h3>
              <p className="text-xs text-[#475569]">
                Avisaremos você no WhatsApp assim que entrar um <strong>{categoria}</strong> ({faixaPreco}) no pátio da DG Automóveis.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-manos-red text-manos-accent font-extrabold text-xs uppercase rounded-2xl"
              >
                Concluir
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 border-b border-manos-sand pb-3">
                <div className="w-10 h-10 rounded-xl bg-manos-warm text-manos-red flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#0B1120]">Alerta de Estoque</h3>
                  <p className="text-[11px] text-[#475569]">Seja avisado antes de anunciarem no site</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  Tipo de Veículo Desejado
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="input-manos py-3 text-sm cursor-pointer font-bold"
                >
                  <option value="SUV">SUVs / Crossovers</option>
                  <option value="Hatch">Hatchback Econômico</option>
                  <option value="Sedan">Sedan Confortável</option>
                  <option value="Pickup">Picape / Utilitário</option>
                  <option value="Moto">Moto</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  Faixa de Preço Pretendida
                </label>
                <select
                  value={faixaPreco}
                  onChange={(e) => setFaixaPreco(e.target.value)}
                  className="input-manos py-3 text-sm cursor-pointer font-bold"
                >
                  <option value="Até R$ 50 mil">Até R$ 50 mil</option>
                  <option value="De R$ 50 mil a 80 mil">De R$ 50 mil a 80 mil</option>
                  <option value="De R$ 80 mil a 120 mil">De R$ 80 mil a 120 mil</option>
                  <option value="Acima de R$ 120 mil">Acima de R$ 120 mil</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  Seu Nome
                </label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input-manos py-3 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
                  Seu WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  placeholder="(47) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="input-manos py-3 text-sm"
                />
              </div>

              {status === 'error' && (
                <p className="text-xs text-red-500 font-bold text-center">
                  Ocorreu um erro ao salvar o alerta. Tente novamente.
                </p>
              )}

              <button
                type="submit"
                disabled={!isValid || status === 'submitting'}
                className="btn-manos py-4 text-sm"
              >
                {status === 'submitting' ? 'Criando Alerta...' : 'Ativar Alerta no WhatsApp'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
