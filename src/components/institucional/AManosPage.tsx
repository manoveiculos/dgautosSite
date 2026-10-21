import React from 'react';
import { 
  Building2, 
  ShieldCheck, 
  CreditCard, 
  MapPin, 
  Phone, 
  Star, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { SiteShell, TrustCards, Logo } from '../ManosUI';
import { LOJA, CONTATO, SOCIAL, waLink } from '../../lib/manos';
import { track } from '../../lib/track';

export default function AManosPage() {
  return (
    <SiteShell title="A DG Automóveis">
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl mt-2">
          <img
            src="/fachada-dg.png"
            alt="Fachada DG Automóveis em Rio do Sul"
            className="w-full h-56 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-[#0B1120]/70 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 text-[#FFFFFF]">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 bg-manos-red text-white rounded-full">
              🏆 +250 Carros Vendidos
            </span>
            <h1 className="font-serif text-2xl font-extrabold text-white mt-2">
              Entre populares e exclusividades, seu carro tá aqui ✨
            </h1>
          </div>
        </div>

        {/* Short Presentation */}
        <div className="p-6 bg-white border border-manos-sand rounded-3xl space-y-3 shadow-sm">
          <h2 className="font-serif text-2xl font-extrabold text-[#0B1120]">
            Compra • Vende • Troca • Financia
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            Localizada na <strong>Rua Dom Pedro II, 461</strong> em Rio do Sul/SC, a <strong>DG Automóveis</strong> já realizou o sonho de mais de <strong>250 clientes</strong> em Rio do Sul e todo o Alto Vale do Itajaí. Do carro popular econômico para o dia a dia até sedãs e hatches exclusivos, entregamos qualidade, procedência e negociação transparente.
          </p>
        </div>

        {/* 3 Main Differentials */}
        <div className="space-y-3">
          <h3 className="font-serif font-bold text-xl text-[#0B1120] px-1">
            Nossos Três Diferenciais
          </h3>

          <div className="p-5 bg-white border border-manos-sand rounded-2xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-manos-warm text-manos-red flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-[#0B1120]">Loja Física na Dom Pedro II</h4>
              <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                Localizada no bairro Canoas em Rio do Sul/SC. Pátio amplo para você ver, testar e dirigir com tranquilidade.
              </p>
            </div>
          </div>

          <div className="p-5 bg-white border border-manos-sand rounded-2xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-manos-warm text-manos-red flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-[#0B1120]">Estoque Revisado e com Garantia</h4>
              <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                Cada seminovo passa por rigorosa vistoria mecânica e de histórico, livre de leilões e com nota fiscal.
              </p>
            </div>
          </div>

          <div className="p-5 bg-white border border-manos-sand rounded-2xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-manos-warm text-manos-red flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-[#0B1120]">Financiamento Facilitado nos Bancos</h4>
              <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                Parceria direta com os principais bancos para aprovar seu crédito com as melhores taxas da região.
              </p>
            </div>
          </div>
        </div>

        {/* Address Card in bg-[#0B1120] with Logo */}
        <div className="p-6 bg-[#0B1120] text-[#FFFFFF] rounded-3xl space-y-4 shadow-xl">
          <Logo className="h-9 w-auto" />

          <div className="space-y-2 text-xs text-[#CBD5E1] leading-relaxed">
            <p className="font-bold text-white text-sm">{LOJA.nome}</p>
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-manos-red flex-shrink-0 mt-0.5" />
              <span>{LOJA.endereco}</span>
            </p>
            <p className="flex items-[#0B1120] gap-2">
              <Clock className="w-4 h-4 text-manos-red flex-shrink-0" />
              <span>
                {LOJA.horario}<br />
                <strong className="text-green-400">✓ {LOJA.horarioExtra}</strong>
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-manos-red flex-shrink-0" />
              <span>Telefone/WhatsApp: {CONTATO.telefone}</span>
            </p>
          </div>

          <a
            href={LOJA.maps}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('map_click', { pagina: '/a-dg' })}
            className="w-full py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
          >
            <MapPin className="w-4 h-4" />
            Como Chegar à Loja (Google Maps)
          </a>
        </div>
        <TrustCards />
      </div>
    </SiteShell>
  );
}
