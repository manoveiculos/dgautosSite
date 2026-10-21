import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Bot, MessageCircle, ChevronDown, Check, ArrowRight } from 'lucide-react';
import { SiteShell } from '../ManosUI';
import { LOJA, waLink, brl } from '../../lib/manos';
import { fetchStock, type Vehicle } from '../../services/stockService';
import { track } from '../../lib/track';

const FAIXAS = [
  { id: 'todos', label: 'Todos os preços' },
  { id: 'ate-50k', label: 'Até R$ 50 mil', min: 0, max: 50000 },
  { id: '50k-100k', label: 'R$ 50 a 100 mil', min: 50000, max: 100000 },
  { id: 'acima-100k', label: 'Acima de R$ 100 mil', min: 100000, max: Infinity },
];

const ORDENS = [
  { id: 'recentes', label: 'Mais recentes' },
  { id: 'menor-preco', label: 'Menor preço' },
  { id: 'maior-preco', label: 'Maior preço' },
  { id: 'menor-km', label: 'Menor km' },
];

export default function EstoquePage() {
  const [stock, setStock] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Read URL query params
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams(window.location.search));
  
  const queryBusca = searchParams.get('busca') || '';
  const queryFaixa = searchParams.get('faixa') || 'todos';
  const queryOrdem = searchParams.get('ordem') || 'recentes';
  const queryMarca = searchParams.get('marca') || 'todas';

  const [busca, setBusca] = useState(queryBusca);
  const [faixa, setFaixa] = useState(queryFaixa);
  const [ordem, setOrdem] = useState(queryOrdem);
  const [marca, setMarca] = useState(queryMarca);

  useEffect(() => {
    fetchStock().then((data) => {
      setStock(data);
      setLoading(false);
    });
  }, []);

  // Update URL whenever filters change
  const updateUrlParams = (newParams: Record<string, string>) => {
    const current = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([k, v]) => {
      if (!v || v === 'todos' || v === 'todas' || v === 'recentes') {
        current.delete(k);
      } else {
        current.set(k, v);
      }
    });
    const newSearch = current.toString() ? `?${current.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newSearch);
    setSearchParams(current);
  };

  // Distinct Brands
  const marcasDisponiveis = useMemo(() => {
    const setM = new Set<string>();
    stock.forEach((v) => {
      const parts = v.description.split(' ');
      if (parts[0]) setM.add(parts[0].toUpperCase());
    });
    return Array.from(setM).sort();
  }, [stock]);

  // Filter and Sort vehicles
  const veiculosFiltrados = useMemo(() => {
    let list = [...stock];

    // Search query
    if (busca.trim()) {
      const b = busca.toLowerCase();
      list = list.filter((v) => v.description.toLowerCase().includes(b) || v.year.includes(b));
    }

    // Price range
    const fObj = FAIXAS.find((f) => f.id === faixa);
    if (fObj && fObj.min !== undefined) {
      list = list.filter((v) => v.price >= fObj.min! && v.price <= fObj.max!);
    }

    // Brand filter
    if (marca !== 'todas') {
      list = list.filter((v) => v.description.toUpperCase().startsWith(marca));
    }

    // Sorting
    if (ordem === 'menor-preco') {
      list.sort((a, b) => a.price - b.price);
    } else if (ordem === 'maior-preco') {
      list.sort((a, b) => b.price - a.price);
    } else if (ordem === 'menor-km') {
      list.sort((a, b) => (parseInt(a.km.replace(/\D/g, '')) || 0) - (parseInt(b.km.replace(/\D/g, '')) || 0));
    } else {
      // recentes (id order)
      list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }

    return list;
  }, [stock, busca, faixa, ordem, marca]);

  return (
    <SiteShell variant="estoque" showTrustCards={false}>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#0B1120]">
            Estoque de Seminovos
          </h1>
          <p className="text-xs sm:text-sm text-[#475569]">
            Veículos 100% revisados e com garantia em Rio do Sul/SC.
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por marca, modelo ou ano..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  updateUrlParams({ busca: e.target.value });
                }}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120]"
              />
            </div>

            {/* Sort Select */}
            <div className="w-full sm:w-48">
              <select
                value={ordem}
                onChange={(e) => {
                  setOrdem(e.target.value);
                  updateUrlParams({ ordem: e.target.value });
                }}
                className="w-full px-3 py-2.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:border-[#0052FF] text-[#0B1120] font-semibold"
              >
                {ORDENS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Price Range Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E2E8F0]/60">
            <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mr-1">Preço:</span>
            {FAIXAS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFaixa(f.id);
                  updateUrlParams({ faixa: f.id });
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  faixa === f.id
                    ? 'bg-[#0052FF] text-[#FFFFFF]'
                    : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B1120]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Brand Filter Chips */}
          {marcasDisponiveis.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mr-1">Marca:</span>
              <button
                onClick={() => { setMarca('todas'); updateUrlParams({ marca: 'todas' }); }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                  marca === 'todas' ? 'bg-[#0B1120] text-[#FFFFFF]' : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#0B1120]'
                }`}
              >
                Todas
              </button>
              {marcasDisponiveis.slice(0, 10).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMarca(m); updateUrlParams({ marca: m }); }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    marca === m ? 'bg-[#0B1120] text-[#FFFFFF]' : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#0B1120]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Results Counter in Bitter */}
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-extrabold text-lg sm:text-xl text-[#0B1120]">
            {loading ? 'Buscando estoque...' : 'Seminovos em estoque'}
          </h2>
        </div>

        {/* Vehicle Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#475569]">Carregando catálogo completo da loja...</div>
        ) : veiculosFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {veiculosFiltrados.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden hover:border-[#0052FF] transition-all group flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <a href={v.link} className="block relative aspect-4/3 overflow-hidden bg-[#F1F5F9]">
                    <img
                      src={v.image}
                      alt={v.description}
                      className="w-full h-[200px] object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 right-3 px-2.5 py-1 bg-[#0B1120]/80 backdrop-blur-xs text-[#FFFFFF] text-[10px] font-extrabold uppercase rounded-lg">
                      Revisado
                    </span>
                  </a>

                  <div className="p-4 space-y-2">
                    <h3 className="font-serif font-bold text-base text-[#0B1120] group-hover:text-[#0052FF] transition-colors leading-snug">
                      <a href={v.link}>{v.description}</a>
                    </h3>
                    
                    <p className="text-xs text-[#475569] font-medium">
                      {v.year} · {v.km}
                    </p>

                    <div className="pt-2 border-t border-[#E2E8F0]">
                      <span className="text-[10px] uppercase font-bold text-[#475569] block">Preço à vista</span>
                      <span className="text-2xl font-extrabold text-[#0052FF] leading-none block">
                        {v.priceFormatted}
                      </span>
                      <span className="text-[11px] text-[#475569] block pt-1">
                        Aceita troca e financia
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <a
                    href={waLink(`Olá! Tenho interesse no ${v.description} (${v.priceFormatted}). Estável no estoque?`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track('whatsapp_click', { pagina: '/estoque', vehicleId: v.id })}
                    className="w-full py-3 bg-[#0052FF] hover:bg-[#003ECC] text-[#FFFFFF] font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs min-h-[44px]"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Falar no WhatsApp</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State — Consultor Hero */
          <div className="bg-[#0B1120] text-[#FFFFFF] p-8 sm:p-12 rounded-3xl text-center space-y-6 max-w-xl mx-auto border border-[#38BDF8]/30">
            <div className="w-16 h-16 rounded-full bg-[#060B14] border-2 border-[#38BDF8] flex items-center justify-center mx-auto">
              <Bot className="w-9 h-9 text-[#38BDF8]" />
            </div>

            <div className="space-y-2">
              <h3 className="font-serif font-extrabold text-xl text-white">
                Diz do que você precisa que eu procuro
              </h3>
              <p className="text-xs text-[#E2E8F0]/80 leading-relaxed">
                Não encontramos um carro com esses filtros exatos agora, mas nosso estoque gira toda semana. Fale com um consultor para buscar pra você!
              </p>
            </div>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-consultor', { detail: { prompt: `Procuro ${busca || 'um seminovo'}` } }));
              }}
              className="py-3.5 px-6 bg-[#0052FF] hover:bg-[#003ECC] text-[#FFFFFF] font-bold text-xs uppercase rounded-xl inline-flex items-center justify-center gap-2 shadow-lg"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Pedir uma busca no WhatsApp</span>
            </button>
          </div>
        )}

      </div>
    </SiteShell>
  );
}
