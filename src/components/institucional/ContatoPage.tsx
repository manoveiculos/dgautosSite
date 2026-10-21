import React from 'react';
import { 
  MapPin, 
  Phone, 
  Clock, 
  Instagram, 
  MessageCircle, 
  Building2, 
  Star 
} from 'lucide-react';
import { SiteShell, TrustCards, Logo } from '../ManosUI';
import { LOJA, CONTATO, SOCIAL, waLink } from '../../lib/manos';
import { track } from '../../lib/track';

export default function ContatoPage() {
  return (
    <SiteShell title="Canais de Contato">
      <div className="space-y-6">
        <div className="text-center space-y-2 pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
            Atendimento Direto
          </span>
          <h1 className="font-serif text-3xl font-extrabold text-[#0B1120] tracking-tight">
            Fale com a DG Automóveis
          </h1>
          <p className="text-xs text-[#475569]">
            Estamos prontos para te atender por telefone, WhatsApp ou pessoalmente na nossa loja.
          </p>
        </div>

        {/* Contact Methods Cards */}
        <div className="space-y-3">
          {/* WhatsApp Direct */}
          <a
            href={waLink('Olá! Vim pelo site e gostaria de atendimento direto.')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { pagina: '/contato' })}
            className="p-5 bg-white border-2 border-manos-red/30 rounded-2xl flex items-center justify-between gap-4 hover:border-manos-red transition-all shadow-sm group min-h-[48px]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/15 text-green-700 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#0B1120]">WhatsApp Principal</h3>
                <p className="text-xs text-[#475569]">{CONTATO.telefone} · Resposta imediata</p>
              </div>
            </div>
            <span className="text-manos-red font-extrabold text-xs uppercase group-hover:translate-x-1 transition-transform">
              Chamar &rarr;
            </span>
          </a>

          {/* Direct Phone Call */}
          <a
            href={CONTATO.telefoneLink}
            onClick={() => track('phone_click', { pagina: '/contato' })}
            className="p-5 bg-white border border-manos-sand rounded-2xl flex items-center justify-between gap-4 hover:border-manos-red/30 transition-all shadow-sm group min-h-[48px]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-manos-warm text-manos-red flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#0B1120]">Telefone Fixo / Celular</h3>
                <p className="text-xs text-[#475569]">{CONTATO.telefone}</p>
              </div>
            </div>
            <span className="text-[#0B1120] font-extrabold text-xs uppercase group-hover:translate-x-1 transition-transform">
              Ligar &rarr;
            </span>
          </a>

          {/* Instagram */}
          <a
            href={SOCIAL.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="p-5 bg-white border border-manos-sand rounded-2xl flex items-center justify-between gap-4 hover:border-manos-red/30 transition-all shadow-sm group min-h-[48px]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 text-purple-700 flex items-center justify-center flex-shrink-0">
                <Instagram className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#0B1120]">Instagram Oficial</h3>
                <p className="text-xs text-[#475569]">@dgautomoveis__ · Novidades diárias</p>
              </div>
            </div>
            <span className="text-[#0B1120] font-extrabold text-xs uppercase group-hover:translate-x-1 transition-transform">
              Ver &rarr;
            </span>
          </a>
        </div>

        {/* Location & Store Details Card */}
        <div className="p-6 bg-[#0B1120] text-[#FFFFFF] rounded-3xl space-y-4 shadow-xl">
          <Logo className="h-9 w-auto" />

          <div className="space-y-3 pt-2 text-xs text-[#CBD5E1]">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-manos-red flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white text-sm block">Endereço da Loja</strong>
                {LOJA.endereco}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-manos-red flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white text-sm block">Horário de Funcionamento</strong>
                {LOJA.horario}<br />
                <span className="text-green-400 font-bold block mt-1">✓ {LOJA.horarioExtra}</span>
              </div>
            </div>
          </div>

          <a
            href={LOJA.maps}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('map_click', { pagina: '/contato' })}
            className="w-full py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
          >
            <MapPin className="w-4 h-4" />
            Traçar Rota no Google Maps
          </a>
        </div>
        <TrustCards />
      </div>
    </SiteShell>
  );
}
