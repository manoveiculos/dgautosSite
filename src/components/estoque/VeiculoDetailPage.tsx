import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  Star, 
  Phone, 
  MessageCircle, 
  Calculator, 
  ArrowRightLeft, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Car, 
  ExternalLink,
  Heart,
  Maximize2,
  X,
  MapPin,
  ArrowRight,
  Share2
} from 'lucide-react';
import { SiteShell, TrustCards } from '../ManosUI';
import { 
  LOJA, 
  CONTATO, 
  SOCIAL, 
  waLink, 
  waAppointmentLink, 
  brl, 
  calcParcela 
} from '../../lib/manos';
import { fetchStock, type Vehicle } from '../../services/stockService';
import { isFavorite, toggleFavorite } from '../../lib/favorites';
import { track } from '../../lib/track';
import { generateVehicleSchema } from '../../lib/seoSchemas';
import TradeDiffCalculator from '../tools/TradeDiffCalculator';

function findVehicleBySlugOrId(list: Vehicle[], target: string): Vehicle | undefined {
  if (!target) return undefined;

  // 1. Direct ID match (e.g. "4433644")
  const direct = list.find((v) => v.id === target || v.slug === target);
  if (direct) return direct;

  // 2. Extract trailing ID from slug (e.g. "gwm-haval-h6-gt-1-5-awd-hibrido-cinza-2023-2024-4433644" -> "4433644")
  const parts = target.split('-');
  const idFromSlug = parts[parts.length - 1];
  if (idFromSlug && /^\d+$/.test(idFromSlug)) {
    const matchedById = list.find((v) => v.id === idFromSlug);
    if (matchedById) return matchedById;
  }

  // 3. Match by description slug string
  const cleanTarget = target.toLowerCase().replace(/-\d+$/, '');
  return list.find((v) => {
    const descSlug = v.description.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return descSlug.includes(cleanTarget) || cleanTarget.includes(descSlug);
  });
}

export default function VeiculoDetailPage({ slug }: { slug: string }) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [similar, setSimilar] = useState<Vehicle[]>([]);
  const [activeImg, setActiveImg] = useState<number>(0);
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    fetchStock().then((list) => {
      const found = findVehicleBySlugOrId(list, slug);
      if (found) {
        setVehicle(found);
        setFav(isFavorite(found.id));
        track('view_vehicle_detail', { vehicleId: found.id, name: found.description });

        // Find 3 similar vehicles by price range
        const others = list.filter((v) => v.id !== found.id);
        const sorted = others.sort((a, b) => Math.abs(a.price - found.price) - Math.abs(b.price - found.price));
        setSimilar(sorted.slice(0, 3));

        // Inject JSON-LD Schema
        try {
          const script = document.createElement('script');
          script.type = 'application/ld+json';
          script.text = JSON.stringify(generateVehicleSchema(found));
          document.head.appendChild(script);
        } catch {}
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <SiteShell variant="veiculo" showTrustCards={false}>
        <div className="py-20 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#0052FF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-[#475569]">Carregando anúncio do veículo...</p>
        </div>
      </SiteShell>
    );
  }

  if (!vehicle) {
    return (
      <SiteShell variant="veiculo" title="Veículo não encontrado">
        <div className="py-16 text-center space-y-4 max-w-md mx-auto">
          <Car className="w-16 h-16 text-[#475569] mx-auto opacity-50" />
          <h2 className="font-serif font-bold text-2xl text-[#0B1120]">Este veículo não está mais no pátio</h2>
          <p className="text-xs text-[#475569]">Ele pode ter sido vendido recentemente. Veja nosso estoque atualizado:</p>
          <a
            href="/estoque"
            className="inline-flex items-center gap-2 py-3 px-6 bg-[#0052FF] text-[#FFFFFF] font-bold text-xs uppercase rounded-xl transition-all shadow-md"
          >
            <span>Ver Estoque Completo</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </SiteShell>
    );
  }

  const photos = vehicle.images && vehicle.images.length > 0
    ? vehicle.images
    : [vehicle.image];

  const parcelaEstimada = calcParcela({
    valor: vehicle.price,
    entrada: Math.round(vehicle.price * 0.25),
    meses: 48,
  });

  const prevPhoto = () => {
    setActiveImg((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const nextPhoto = () => {
    setActiveImg((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  return (
    <SiteShell
      variant="veiculo"
      vehicleSlug={vehicle.slug || vehicle.id}
      priceFormatted={vehicle.priceFormatted}
      showTrustCards={false}
    >
      <div className="space-y-8 lg:space-y-12">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#475569]">
          <a href="/estoque" className="hover:underline text-[#0052FF] font-semibold">Estoque</a>
          <span>/</span>
          <span className="truncate font-medium text-[#0B1120]">{vehicle.description}</span>
        </div>

        {/* 2 COLUMNS LAYOUT: Left Gallery (~62%) | Right Sticky Panel (~38%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Gallery & Specs */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* 1. GALERIA DE FOTOS INTERATIVA */}
            <div className="space-y-3">
              <div className="relative aspect-4/3 w-full bg-[#0B1120] rounded-3xl overflow-hidden border border-[#E2E8F0] shadow-lg group">
                <img
                  src={photos[activeImg]}
                  alt={vehicle.description}
                  // @ts-ignore
                  fetchpriority="high"
                  className="w-full h-full object-cover cursor-pointer transition-all duration-300"
                  onClick={() => setIsLightboxOpen(true)}
                />

                {/* Counter Badge */}
                <div className="absolute bottom-4 left-4 bg-[#0B1120]/80 backdrop-blur-md text-[#FFFFFF] text-xs font-extrabold px-3.5 py-1.5 rounded-full border border-white/20">
                  {activeImg + 1} / {photos.length}
                </div>

                {/* Lightbox Zoom Trigger */}
                <button
                  onClick={() => setIsLightboxOpen(true)}
                  className="absolute bottom-4 right-4 p-2.5 rounded-full bg-[#0B1120]/80 backdrop-blur-md text-white border border-white/20 hover:bg-[#0052FF] transition-all"
                  aria-label="Expandir foto"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                {/* Arrow Controls (when multiple photos exist) */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-[#0052FF] text-white flex items-center justify-center transition-all opacity-90 group-hover:opacity-100"
                      aria-label="Foto anterior"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={nextPhoto}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-[#0052FF] text-white flex items-center justify-center transition-all opacity-90 group-hover:opacity-100"
                      aria-label="Próxima foto"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                {/* Favorite & Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold tracking-wider uppercase px-3 py-1 bg-[#0052FF] text-[#FFFFFF] rounded-lg shadow-md">
                    Seminovo Revisado
                  </span>
                  <span className="text-[10px] font-extrabold tracking-wider uppercase px-3 py-1 bg-emerald-700 text-white rounded-lg shadow-md">
                    Garantia DG
                  </span>
                </div>

                <button
                  onClick={() => {
                    toggleFavorite(vehicle.id);
                    setFav(!fav);
                  }}
                  className="absolute top-4 right-4 p-3 rounded-full bg-white/90 backdrop-blur-md text-[#0052FF] shadow-md hover:scale-105 active:scale-95 transition-all"
                  aria-label="Favoritar"
                >
                  <Heart className={`w-5 h-5 ${fav ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Thumbnails Carousel */}
              {photos.length > 1 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                  {photos.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImg(idx)}
                      className={`relative w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                        activeImg === idx
                          ? 'border-[#0052FF] scale-105 shadow-xs'
                          : 'border-[#E2E8F0] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. IDENTIFICAÇÃO E FICHA TÉCNICA */}
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-[#475569] uppercase font-extrabold tracking-widest">
                  {vehicle.brand || 'Seminovo'} · Ano {vehicle.year}
                </span>
                <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B1120] leading-tight">
                  {vehicle.description}
                </h1>
              </div>

              {/* Ficha Técnica (Grade 2xN em bg-areia) */}
              <div className="space-y-3 pt-2">
                <h3 className="font-serif font-bold text-lg text-[#0B1120]">Especificações Técnicas</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl space-y-0.5">
                    <span className="text-[#475569] block font-bold text-[10px] uppercase">Quilometragem</span>
                    <span className="font-extrabold text-[#0B1120] text-sm">{vehicle.km}</span>
                  </div>
                  <div className="p-3.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl space-y-0.5">
                    <span className="text-[#475569] block font-bold text-[10px] uppercase">Ano / Modelo</span>
                    <span className="font-extrabold text-[#0B1120] text-sm">{vehicle.year}</span>
                  </div>
                  <div className="p-3.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl space-y-0.5">
                    <span className="text-[#475569] block font-bold text-[10px] uppercase">Câmbio</span>
                    <span className="font-extrabold text-[#0B1120] text-sm">{vehicle.transmission || 'Manual / Aut.'}</span>
                  </div>
                  <div className="p-3.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl space-y-0.5">
                    <span className="text-[#475569] block font-bold text-[10px] uppercase">Combustível</span>
                    <span className="font-extrabold text-[#0B1120] text-sm">{vehicle.fuel || 'Flex / Gasolina'}</span>
                  </div>
                </div>
              </div>

              {/* Opcionais */}
              {vehicle.options && vehicle.options.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="font-serif font-bold text-base text-[#0B1120]">Opcionais & Equipamentos</h3>
                  <div className="flex flex-wrap gap-2">
                    {vehicle.options.map((op, i) => (
                      <span key={i} className="px-3 py-1.5 bg-[#F1F5F9] border border-[#E2E8F0] text-[#0B1120] font-bold text-xs rounded-xl">
                        ✓ {op}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Descrição SEO */}
              <div className="p-6 bg-white border border-[#E2E8F0] rounded-2xl space-y-2">
                <h3 className="font-serif font-bold text-base text-[#0B1120]">Sobre este Veículo</h3>
                <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                  {vehicle.description} disponível na <strong>{LOJA.nome}</strong> em Rio do Sul/SC. Veículo seminovo totalmente revisado em nossa oficina própria, com laudo cautelar aprovado e procedência garantida. Aceitamos seu usado na troca com excelente avaliação e oferecemos financiamento facilitado com os principais bancos parceiros.
                </p>
              </div>

              {/* Calculadora de Troca */}
              <TradeDiffCalculator targetPrice={vehicle.price} targetTitle={vehicle.description} />
            </div>

          </div>

          {/* RIGHT STICKY COLUMN: Price & 4 Actions */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Price Card */}
            <div className="bg-white border border-[#E2E8F0] p-6 rounded-3xl space-y-4 shadow-sm">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-[#475569] uppercase tracking-wider block">
                  Preço à vista
                </span>
                <span className="text-[#0052FF] font-serif font-extrabold text-3xl sm:text-4xl block">
                  {vehicle.priceFormatted}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#475569] font-medium">Financiamento estimado (48x):</span>
                  <span className="text-[#0052FF] font-extrabold">{brl(parcelaEstimada)}/mês</span>
                </div>
                <p className="text-[10px] text-[#475569] leading-tight border-t border-emerald-200/60 pt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>*Simulação estimada. Sujeito à análise e aprovação de crédito pelas financeiras parceiras.</span>
                </p>
              </div>

              {/* 4 OPÇÕES DE AÇÃO */}
              <div className="space-y-3 pt-2">
                <p className="font-serif font-bold text-sm text-[#0B1120]">Como você prefere seguir?</p>

                {/* 1. Tenho interesse (Principal Terracota) */}
                <a
                  href={waLink(`Olá! Tenho interesse no ${vehicle.description} (${vehicle.priceFormatted}). Estável no pátio?`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('whatsapp_click', { vehicleId: vehicle.id })}
                  className="w-full py-4 bg-[#0052FF] hover:bg-[#003ECC] text-[#FFFFFF] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 min-h-[52px]"
                >
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  <span>Tenho Interesse no Carro</span>
                </a>

                {/* 2. Simular Financiamento */}
                <a
                  href={`/financiamento?veiculo=${vehicle.id}`}
                  className="w-full py-3.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B1120] font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 border border-[#E2E8F0] transition-all min-h-[48px]"
                >
                  <Calculator className="w-4 h-4 text-[#0052FF]" />
                  <span>Simular Financiamento</span>
                </a>

                {/* 3. Colocar meu carro na troca */}
                <a
                  href={`/vender-meu-carro?veiculo=${vehicle.slug || vehicle.id}`}
                  className="w-full py-3.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B1120] font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 border border-[#E2E8F0] transition-all min-h-[48px]"
                >
                  <ArrowRightLeft className="w-4 h-4 text-[#0052FF]" />
                  <span>Colocar meu Carro na Troca</span>
                </a>

                {/* 4. Agendar visita ou test drive com hora marcada */}
                <a
                  href={waAppointmentLink(vehicle.description)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('whatsapp_click', { vehicleId: vehicle.id, agendamento: true })}
                  className="w-full p-4 bg-[#0B1120] text-white font-bold text-xs rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm transition-all hover:bg-[#060B14]"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#38BDF8]" />
                    <span>Agendar Visita ou Test Drive</span>
                  </div>
                  <span className="text-[10px] text-[#E2E8F0] font-medium">Atendemos com hora marcada em qualquer dia</span>
                </a>
              </div>
            </div>

            {/* Atendemos no seu Horário (Card Marrom) */}
            <div className="bg-[#0B1120] text-[#FFFFFF] p-6 rounded-3xl space-y-4 border border-[#38BDF8]/30 shadow-md">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <Clock className="w-6 h-6 text-[#38BDF8]" />
                <div>
                  <h4 className="font-serif font-bold text-base text-white">Atendemos no Seu Horário</h4>
                  <p className="text-xs text-[#E2E8F0]">Com hora marcada, abrimos qualquer dia da semana, inclusive fora do expediente.</p>
                </div>
              </div>

              <div className="text-xs text-[#E2E8F0] space-y-1">
                <p><strong>Loja Física:</strong> {LOJA.endereco}</p>
                <p><strong>Horário Comercial:</strong> {LOJA.horario}</p>
              </div>

              <a
                href={LOJA.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-[#060B14] hover:bg-[#0052FF] text-[#FFFFFF] font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-[#38BDF8]/30 transition-all"
              >
                <MapPin className="w-4 h-4 text-[#38BDF8]" />
                <span>Como Chegar na Loja</span>
              </a>
            </div>

            {/* Trust Cards */}
            <TrustCards />

          </div>

        </div>

        {/* 10. VEÍCULOS PARECIDOS */}
        {similar.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-[#E2E8F0]">
            <h3 className="font-serif font-extrabold text-xl sm:text-2xl text-[#0B1120]">
              Veículos Parecidos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {similar.map((sim) => (
                <a
                  key={sim.id}
                  href={sim.link}
                  className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden hover:border-[#0052FF] transition-all group flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <img
                      src={sim.image}
                      alt={sim.description}
                      className="w-full h-36 object-cover bg-[#F1F5F9]"
                    />
                    <div className="p-3.5 space-y-1">
                      <h4 className="font-serif font-bold text-sm text-[#0B1120] group-hover:text-[#0052FF] truncate">
                        {sim.description}
                      </h4>
                      <p className="text-xs text-[#475569]">{sim.year} · {sim.km}</p>
                      <p className="text-base font-extrabold text-[#0052FF]">{sim.priceFormatted}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* LIGHTBOX FULLSCREEN MODAL FOR ALL PHOTOS */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md animate-fade-in">
          {/* Lightbox Header */}
          <div className="flex items-center justify-between text-white">
            <span className="font-serif font-bold text-sm truncate max-w-xs">{vehicle.description}</span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-white/70 font-semibold">{activeImg + 1} / {photos.length}</span>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-full bg-white/20 hover:bg-[#0052FF] text-white transition-colors"
                aria-label="Fechar fotos"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Image */}
          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            <img
              src={photos[activeImg]}
              alt=""
              className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl"
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-[#0052FF] text-white transition-all"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-[#0052FF] text-white transition-all"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}
          </div>

          {/* Lightbox Bottom Thumbnails Bar */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
            {photos.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                  activeImg === i ? 'border-[#0052FF] scale-110' : 'border-white/30 opacity-60'
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </SiteShell>
  );
}
