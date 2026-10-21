import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  X, 
  Check, 
  ArrowRight, 
  MessageCircle, 
  Car, 
  Sparkles, 
  Trash2,
  Bot
} from 'lucide-react';
import { SiteShell, TrustCards } from '../ManosUI';
import { fetchStock, type Vehicle } from '../../services/stockService';
import { brl, calcParcela, waLink } from '../../lib/manos';
import { track } from '../../lib/track';

export default function ComparatorPage() {
  const [stock, setStock] = useState<Vehicle[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    track('comparator_view', { pagina: '/comparar' });
    fetchStock().then((list) => {
      setStock(list);
      // Pre-select first 2 vehicles by default if available
      if (list.length >= 2) {
        setSelectedIds([list[0].id, list[1].id]);
      } else if (list.length >= 1) {
        setSelectedIds([list[0].id]);
      }
    }).catch(() => {});
  }, []);

  const selectedVehicles = stock.filter((v) => selectedIds.includes(v.id));

  const addVehicle = (id: string) => {
    if (selectedIds.length < 3 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
      setIsModalOpen(false);
      track('comparator_add', { vehicleId: id });
    }
  };

  const removeVehicle = (id: string) => {
    setSelectedIds(selectedIds.filter((item) => item !== id));
  };

  const getWhatsAppShareUrl = () => {
    if (selectedVehicles.length === 0) return waLink();
    const names = selectedVehicles.map((v) => `• ${v.description} (${v.priceFormatted})`).join('\n');
    const msg = `Olá! Estou comparando estes veículos no site e gostaria de tirar dúvidas:\n\n${names}`;
    return waLink(msg);
  };

  return (
    <SiteShell title="Comparar Veículos">
      <div className="space-y-6">
        <div className="text-center space-y-2 pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
            Decisão lado a lado
          </span>
          <h1 className="font-serif text-3xl font-extrabold text-[#0B1120] tracking-tight">
            Comparar Veículos
          </h1>
          <p className="text-xs text-[#475569]">
            Escolha até 3 veículos do nosso pátio para analisar valores, especificações e parcelas.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-extrabold text-[#0B1120]">
            {selectedVehicles.length} de 3 selecionados
          </span>
          {selectedIds.length < 3 && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-2.5 px-4 bg-[#0052FF] text-[#FFFFFF] font-extrabold text-xs uppercase rounded-xl flex items-center gap-1.5 hover:bg-[#003ECC] active:scale-95 transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              Adicionar Veículo
            </button>
          )}
        </div>

        {/* Side by Side Comparison Grid */}
        {selectedVehicles.length > 0 ? (
          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-[300px]">
              {selectedVehicles.map((vehicle) => {
                const parcela = calcParcela({
                  valor: vehicle.price,
                  entrada: Math.round(vehicle.price * 0.25),
                  meses: 48,
                });

                return (
                  <div
                    key={vehicle.id}
                    className="p-5 bg-white border border-[#E2E8F0] rounded-3xl space-y-4 shadow-xs relative flex flex-col justify-between"
                  >
                    <button
                      onClick={() => removeVehicle(vehicle.id)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors z-10"
                      title="Remover"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="space-y-3">
                      <div className="aspect-4/3 rounded-2xl overflow-hidden bg-[#F1F5F9]">
                        <img
                          src={vehicle.image}
                          alt={vehicle.description}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div>
                        <h3 className="font-serif font-bold text-base text-[#0B1120] leading-snug line-clamp-2">
                          {vehicle.description}
                        </h3>
                        <p className="text-[#0052FF] font-extrabold text-xl mt-1">
                          {vehicle.priceFormatted}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-[#E2E8F0] text-xs text-[#0B1120]">
                        <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                          <span className="text-[#475569]">Ano / Modelo:</span>
                          <span className="font-bold">{vehicle.year}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                          <span className="text-[#475569]">Quilometragem:</span>
                          <span className="font-bold">{vehicle.km}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                          <span className="text-[#475569]">Entrada Sugerida:</span>
                          <span className="font-bold">{brl(Math.round(vehicle.price * 0.25))}</span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                          <span>Parcela (48x):</span>
                          <span>{brl(parcela)}/mês</span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={waLink(`Olá! Vi o comparativo do ${vehicle.description} por ${vehicle.priceFormatted} no site e quero negociar.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 mt-4 bg-[#0052FF] hover:bg-[#003ECC] text-[#FFFFFF] font-extrabold text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
                    >
                      Tenho Interesse
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-white border border-[#E2E8F0] rounded-3xl space-y-4">
            <Car className="w-12 h-12 text-[#475569] mx-auto" />
            <p className="text-sm font-bold text-[#0B1120]">Nenhum veículo selecionado para comparação.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-3 px-6 bg-[#0052FF] text-[#FFFFFF] font-extrabold text-xs uppercase rounded-2xl"
            >
              Escolher Veículos
            </button>
          </div>
        )}



        {/* WhatsApp Share All Button */}
        {selectedVehicles.length > 0 && (
          <div className="p-6 bg-[#0B1120] text-[#FFFFFF] rounded-3xl space-y-3 text-center shadow-xl border border-[#38BDF8]/20">
            <h3 className="font-serif font-bold text-lg text-white">Dúvida entre os escolhidos?</h3>
            <p className="text-xs text-[#E2E8F0]">Envie esta lista comparativa para nosso consultor humano analisar com você no WhatsApp.</p>
            <a
              href={getWhatsAppShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('whatsapp_click', { pagina: '/comparar_share' })}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
            >
              <MessageCircle className="w-4 h-4 text-white" />
              Enviar Comparativo ao Consultor no WhatsApp
            </a>
          </div>
        )}

        {/* Modal Selection */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white text-[#0B1120] rounded-3xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col justify-between shadow-2xl space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-manos-sand pb-3">
                <h3 className="font-serif font-bold text-lg">Selecione um Veículo</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-full hover:bg-manos-warm"
                >
                  <X className="w-5 h-5 text-[#0B1120]" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-2 pr-1 flex-1 custom-scrollbar">
                {stock.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addVehicle(item.id)}
                    disabled={selectedIds.includes(item.id)}
                    className={`w-full p-3 text-left rounded-2xl flex items-center gap-3 border transition-all ${
                      selectedIds.includes(item.id)
                        ? 'bg-gray-100 opacity-40 border-transparent cursor-not-allowed'
                        : 'bg-manos-cream border-manos-sand hover:border-manos-red'
                    }`}
                  >
                    <img
                      src={item.image}
                      alt={item.description}
                      className="w-14 h-12 object-cover rounded-xl bg-manos-warm flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-[#0B1120] truncate">{item.description}</p>
                      <p className="text-manos-red font-extrabold text-xs">{item.priceFormatted}</p>
                    </div>
                    {selectedIds.includes(item.id) ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Plus className="w-5 h-5 text-manos-red" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        <TrustCards />
      </div>
    </SiteShell>
  );
}
