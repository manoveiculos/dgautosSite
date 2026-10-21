import React, { useState } from 'react';
import { Search, AlertTriangle, ArrowRight, MessageCircle } from 'lucide-react';
import { SiteShell, Logo } from '../ManosUI';
import { CONTATO, waLink } from '../../lib/manos';
import { track } from '../../lib/track';

export default function NotFoundPage() {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/?search=${encodeURIComponent(query.trim())}`;
    } else {
      window.location.href = '/';
    }
  };

  return (
    <SiteShell title="Página Não Encontrada">
      <div className="space-y-6 text-center py-4">
        <div className="space-y-4">
          <Logo className="h-12 w-auto mx-auto" />
          
          <div className="w-16 h-16 rounded-2xl bg-manos-red/20 text-manos-red flex items-center justify-center mx-auto border border-manos-red/30">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-extrabold text-[#0B1120]">
              Página Não Encontrada (404)
            </h1>
            <p className="text-sm text-[#475569] max-w-xs mx-auto">
              O endereço que você acessou mudou ou não está mais disponível. Busque um veículo no nosso estoque:
            </p>
          </div>
        </div>

        {/* Search Stock Input */}
        <form onSubmit={handleSearch} className="space-y-3 max-w-sm mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
            <input
              type="text"
              placeholder="Buscar por modelo, marca ou ano..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full py-4 pl-12 pr-4 bg-white text-[#0B1120] border border-[#CBD5E1] rounded-2xl focus:border-manos-red outline-none text-sm placeholder:text-[#64748B]"
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-[#0052FF] text-[#FFFFFF] font-extrabold text-sm uppercase rounded-2xl hover:bg-[#003ECC] active:scale-95 transition-all min-h-[48px]"
          >
            Buscar no Estoque Completo
          </button>
        </form>

        {/* Direct WhatsApp Alternative */}
        <div className="p-6 bg-white border border-[#E2E8F0] rounded-3xl space-y-3 max-w-sm mx-auto pt-4 shadow-sm">
          <h3 className="font-serif font-bold text-base text-[#0B1120]">Precisa de ajuda imediata?</h3>
          <p className="text-xs text-[#475569]">Fale com um de nossos consultores pelo WhatsApp.</p>
          <a
            href={waLink('Olá! Acessei um link não encontrado no site e gostaria de atendimento.')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { pagina: '/404' })}
            className="w-full py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
          >
            <MessageCircle className="w-4 h-4" />
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </SiteShell>
  );
}
