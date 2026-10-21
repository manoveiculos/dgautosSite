import React, { useState, useEffect } from 'react';
import { SiteShell } from './ManosUI';
import { fetchStock, type Vehicle } from '../services/stockService';
import { waLink } from '../lib/manos';
import { track } from '../lib/track';
import { 
  CheckCircle2, 
  Send, 
  Phone, 
  Zap, 
  ShieldCheck, 
  Calendar, 
  Gauge, 
  Fuel, 
  ChevronRight,
  ExternalLink,
  MessageCircle,
  X
} from 'lucide-react';

export default function HavalPresentation() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsApp, setWhatsApp] = useState('');

  // Imagem oficial do Haval H6 GT em estoque na Manos
  const havalImage = 'https://dealersites-content.s3.us-east-1.amazonaws.com/dealersites/vehicles/versions/gwm/foto_version_890_69a192343cf8e.webp';

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const stock = await fetchStock();
      const haval = stock.find(v => 
        v.description.toLowerCase().includes('haval') && 
        v.description.toLowerCase().includes('gt')
      ) || stock.find(v => v.description.toLowerCase().includes('haval')) || null;

      if (haval) {
        setVehicle(haval);
        setSelectedImage(haval.image || haval.images[0] || havalImage);
      } else {
        const fallbackVehicle: Vehicle = {
          id: '4433644',
          slug: 'gwm-haval-h6-gt-1-5-awd-hibrido-cinza-2024',
          description: 'GWM Haval H6 GT 1.5 AWD Híbrido',
          brand: 'GWM',
          year: '2024/2024',
          price: 319000,
          priceFormatted: 'R$ 319.000,00',
          km: '0 km',
          image: havalImage,
          images: [
            havalImage,
            'https://cdn.dealerspace.ai/dealersites/vehicles/models/gwm/foto_model_890_1307.webp'
          ],
          fuel: 'Híbrido PHEV',
          transmission: 'Automático AWD',
          color: 'Cinza',
          options: ['Tração AWD', '393 cv', 'Teto Panorâmico', 'Piloto Automático Adaptativo', 'Câmera 360°'],
          link: '/estoque/gwm-haval-h6-gt-1-5-awd-hibrido-cinza-2024'
        };
        setVehicle(fallbackVehicle);
        setSelectedImage(havalImage);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    track('lead_submit', { veiculo: vehicle?.description, nome, whatsApp });
    setFormSubmitted(true);
  };

  return (
    <SiteShell title="Haval H6 GT em Estoque">
      
      {/* ---------------------------------------------------- */}
      {/* CABEÇALHO DO MODELO EM ESTOQUE                       */}
      {/* ---------------------------------------------------- */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-manos-sand shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Disponível em Estoque Pronta Entrega
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-extrabold text-[#0B1120] tracking-tight">
              {vehicle ? vehicle.description : 'GWM Haval H6 GT 1.5 AWD Híbrido'}
            </h1>
            <p className="text-sm text-[#475569] font-semibold">
              Veículo revisado com garantia DG Automóveis • Rio do Sul / SC
            </p>
          </div>

          <div className="flex flex-col sm:items-end justify-center bg-manos-cream/80 p-5 rounded-2xl border border-manos-sand">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#475569]">Preço da Unidade</span>
            <span className="text-3xl sm:text-4xl font-serif font-black text-manos-red tracking-tight">
              {vehicle ? vehicle.priceFormatted : 'R$ 319.000,00'}
            </span>
            <span className="text-[11px] text-emerald-600 font-bold mt-0.5">
              Condição Exclusiva de Financiamento & Troca
            </span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* MOSTROU 3D VIRTUAL SHOWROOM OFICIAL (GWM)            */}
      {/* ---------------------------------------------------- */}
      <section className="bg-[#14171d] rounded-3xl overflow-hidden shadow-2xl border border-gray-800 mb-12">
        <div className="w-full relative min-h-[600px] sm:min-h-[750px] bg-[#1a1d24]">
          <iframe 
            src="https://br-h5-abroad-community.gwmcloud.com/br-vr/?name=NOVOH6GT" 
            className="w-full h-[600px] sm:h-[750px] border-0" 
            allowFullScreen
            title="Visualização 360° Haval H6 GT"
          />
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* DETALHES DO CARRO EM ESTOQUE                         */}
      {/* ---------------------------------------------------- */}
      {vehicle && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          
          {/* Coluna Esquerda: Galeria de Fotos */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-manos-sand shadow-sm overflow-hidden h-[380px] sm:h-[460px] flex items-center justify-center bg-gray-50">
              <img 
                src={selectedImage} 
                alt={vehicle.description} 
                className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
              />
            </div>

            {/* Miniaturas de fotos */}
            {vehicle.images && vehicle.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {vehicle.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-20 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all ${
                      selectedImage === img ? 'border-manos-red scale-105 shadow-md' : 'border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Coluna Direita: Ficha do Estoque & CTAs */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-manos-sand shadow-sm space-y-6">
              <h2 className="font-serif font-extrabold text-xl text-[#0B1120] border-b border-manos-sand pb-3">
                Ficha da Nossa Unidade
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-manos-cream/60 rounded-2xl border border-manos-sand/50">
                  <span className="text-[10px] font-extrabold uppercase text-[#475569] block mb-1">Ano / Modelo</span>
                  <span className="font-extrabold text-base text-[#0B1120]">{vehicle.year || '2024'}</span>
                </div>

                <div className="p-3.5 bg-manos-cream/60 rounded-2xl border border-manos-sand/50">
                  <span className="text-[10px] font-extrabold uppercase text-[#475569] block mb-1">Quilometragem</span>
                  <span className="font-extrabold text-base text-[#0B1120]">{vehicle.km || '0 km'}</span>
                </div>

                <div className="p-3.5 bg-manos-cream/60 rounded-2xl border border-manos-sand/50">
                  <span className="text-[10px] font-extrabold uppercase text-[#475569] block mb-1">Motorização</span>
                  <span className="font-extrabold text-base text-[#0B1120]">Híbrido 393cv</span>
                </div>

                <div className="p-3.5 bg-manos-cream/60 rounded-2xl border border-manos-sand/50">
                  <span className="text-[10px] font-extrabold uppercase text-[#475569] block mb-1">Câmbio / Tração</span>
                  <span className="font-extrabold text-base text-[#0B1120]">Aut. AWD</span>
                </div>
              </div>

              {/* Destaques do Carro */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-extrabold uppercase text-[#475569] tracking-wider block">Principais Opcionais:</span>
                <div className="flex flex-wrap gap-2">
                  {['Teto Panorâmico', 'Piloto Adaptativo ADAS', 'Tração e-AWD', '393 cv Combinados', 'Câmeras 360°', 'Bancos Elétricos'].map((opt, i) => (
                    <span key={i} className="text-xs font-bold px-3 py-1 bg-manos-warm text-[#0B1120] rounded-full border border-manos-sand">
                      ✓ {opt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="space-y-3 pt-4 border-t border-manos-sand">
                <button
                  onClick={() => setIsLeadModalOpen(true)}
                  className="w-full py-4 bg-manos-red hover:bg-[#003ECC] text-manos-accent font-extrabold text-sm uppercase rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Tenho Interesse Nesta Unidade
                </button>

                <a
                  href={waLink(`Olá! Gostaria de falar sobre o Haval H6 GT que está no estoque.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('whatsapp_click', { pagina: 'haval_presentation', vehicleId: vehicle.id })}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm uppercase rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5 fill-current" />
                  Chamar no WhatsApp da Loja
                </a>

                <a
                  href={`/financiamento?veiculo=${vehicle.slug}`}
                  className="w-full py-3.5 bg-manos-warm hover:bg-manos-cream text-[#0B1120] border border-manos-sand font-extrabold text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  Simular Financiamento Para Este Veículo
                </a>
              </div>
            </div>
          </div>

        </section>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL DE PROPOSTA                                    */}
      {/* ---------------------------------------------------- */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#F8FAFC] max-w-md w-full rounded-3xl shadow-2xl border border-manos-sand overflow-hidden relative p-6 sm:p-8">
            <button 
              onClick={() => setIsLeadModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-[#475569] hover:text-[#0B1120]"
            >
              <X className="w-6 h-6" />
            </button>

            {!formSubmitted ? (
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-manos-red">DG Automóveis</span>
                  <h3 className="text-2xl font-serif font-extrabold text-[#0B1120] mt-1">
                    Solicitar Atendimento
                  </h3>
                  <p className="text-xs text-[#475569] font-medium mt-1">
                    {vehicle ? vehicle.description : 'Haval H6 GT'}
                  </p>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#475569] ml-2">Seu Nome</label>
                    <input 
                      type="text" 
                      required 
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full py-3.5 px-4 bg-white border border-manos-sand rounded-xl text-sm focus:outline-none focus:border-manos-red"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#475569] ml-2">WhatsApp</label>
                    <input 
                      type="tel" 
                      required 
                      value={whatsApp}
                      onChange={(e) => setWhatsApp(e.target.value)}
                      placeholder="(47) 99999-9999"
                      className="w-full py-3.5 px-4 bg-white border border-manos-sand rounded-xl text-sm focus:outline-none focus:border-manos-red"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-manos-red hover:bg-[#003ECC] text-manos-accent font-extrabold text-sm uppercase rounded-xl shadow-lg transition-all"
                  >
                    Falar com Consultor
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
                <h3 className="text-2xl font-serif font-extrabold text-[#0B1120]">Solicitação Enviada!</h3>
                <p className="text-sm text-[#475569]">
                  Obrigado, {nome}! Um consultor da DG Automóveis entrará em contato com você pelo WhatsApp em instantes.
                </p>
                <button 
                  onClick={() => { setFormSubmitted(false); setIsLeadModalOpen(false); }}
                  className="px-6 py-3 bg-[#0B1120] text-[#FFFFFF] text-xs font-extrabold uppercase rounded-xl"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </SiteShell>
  );
}
