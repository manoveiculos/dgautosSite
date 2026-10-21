import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  X, 
  ChevronRight, 
  Phone, 
  ShieldCheck, 
  Trophy,
  Building2, 
  MapPin, 
  Lock,
  MessageCircle
} from 'lucide-react';
import { LOJA, CONTATO, SOCIAL, waLink } from '../lib/manos';
import { track } from '../lib/track';

import LGPDBanner from './tools/LGPDBanner';
import ConsultorPanel from './consultor/ConsultorPanel';

export function Logo({ className = "h-11 w-auto" }: { className?: string }) {
  return (
    <img 
      src={LOJA.logoUrl} 
      alt={LOJA.nome} 
      className={`object-contain drop-shadow-[0_2px_10px_rgba(0,82,255,0.35)] ${className}`} 
    />
  );
}

export function TopBar({ title, onBack }: { title?: string; onBack?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="px-4 py-3.5 flex items-center justify-between z-30 bg-[#0B1120] text-white shadow-lg border-b border-blue-500/20 sticky top-0">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button 
              onClick={onBack}
              className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all"
              aria-label="Voltar"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          ) : null}
          <a href="/" className="flex items-center gap-2.5">
            <Logo className="h-10 sm:h-11 w-auto" />
          </a>
        </div>

        {title ? (
          <span className="font-serif font-bold text-sm text-white truncate max-w-[180px]">
            {title}
          </span>
        ) : (
          <div className="hidden md:flex items-center gap-6 text-xs font-extrabold uppercase tracking-wider text-slate-300">
            <a href="/" className="hover:text-sky-400 transition-colors min-h-0">Início</a>
            <a href="/estoque" className="hover:text-sky-400 transition-colors min-h-0">Estoque</a>
            <a href="/financiamento" className="hover:text-sky-400 transition-colors min-h-0">Financiamento</a>
            <a href="/vender-meu-carro" className="hover:text-sky-400 transition-colors min-h-0">Vender / Trocar</a>
            <a href="/a-dg" className="hover:text-sky-400 transition-colors min-h-0">A Loja</a>
            <div className="flex items-center gap-2 text-[10px] uppercase font-extrabold tracking-widest text-sky-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Rio do Sul/SC · Dom Pedro II, 461</span>
            </div>
          </div>
        )}

        <button
          onClick={() => setMenuOpen(true)}
          className="p-2.5 rounded-xl bg-[#0052FF] text-white font-extrabold flex items-center justify-center gap-2 hover:bg-[#003ECC] active:scale-95 transition-all min-h-[44px] shadow-[0_0_20px_rgba(0,82,255,0.4)]"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Drawer Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative w-full max-w-xs bg-[#0B1120] text-white h-full flex flex-col justify-between p-6 shadow-2xl overflow-y-auto border-l border-blue-500/20"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <Logo className="h-10 w-auto" />
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all min-h-[44px]"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {[
                    { label: 'Início', href: '/' },
                    { label: 'Estoque Completo', href: '/estoque' },
                    { label: 'Simular Financiamento', href: '/financiamento' },
                    { label: 'Vender ou Trocar meu Carro', href: '/vender-meu-carro' },
                    { label: 'Consignar Veículo', href: '/consignacao' },
                    { label: 'Comparar Veículos', href: '/comparar' },
                    { label: 'Sobre a DG Automóveis', href: '/a-dg' },
                    { label: 'Dúvidas Frequentes', href: '/duvidas' },
                    { label: 'Contato & Localização', href: '/contato' },
                    { label: 'Política de Privacidade', href: '/politica-de-privacidade' },
                  ].map((item) => (
                    <a
                      key={item.href + item.label}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3.5 rounded-xl font-extrabold text-base text-white hover:bg-[#0052FF]/20 active:bg-[#0052FF]/40 transition-all min-h-[48px]"
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-sky-400/70" />
                    </a>
                  ))}
                </nav>
              </div>

              <div className="pt-6 border-t border-slate-800 space-y-3">
                <div className="text-[11px] text-slate-400 font-semibold leading-snug">
                  <strong className="text-sky-400 block mb-0.5">🏆 {LOJA.carrosVendidos}</strong>
                  {LOJA.endereco}<br />
                  {LOJA.horario}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={CONTATO.telefoneLink}
                    onClick={() => track('phone_click', { pagina: 'drawer_menu' })}
                    className="py-3 px-3 rounded-xl bg-white/10 text-white font-extrabold text-xs uppercase flex items-center justify-center gap-2 hover:bg-white/20 min-h-[44px]"
                  >
                    <Phone className="w-4 h-4" />
                    Ligar
                  </a>
                  <a
                    href={waLink('Olá! Vim pelo menu do site da DG Automóveis e gostaria de atendimento.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track('whatsapp_click', { pagina: 'drawer_menu' })}
                    className="py-3 px-3 rounded-xl bg-[#0052FF] text-white font-extrabold text-xs uppercase flex items-center justify-center gap-2 hover:bg-[#003ECC] min-h-[44px]"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function TrustCards() {
  return (
    <section className="space-y-3 my-6">
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-[#0052FF] flex items-center justify-center font-bold text-sm flex-shrink-0">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-extrabold text-base text-[#0B1120]">+250 Carros Vendidos</h4>
          <p className="text-xs text-slate-600 mt-0.5">Entre populares e exclusividades, referência em negociação transparente em Rio do Sul e Alto Vale.</p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-extrabold text-base text-[#0B1120]">100% Procedência e Garantia</h4>
          <p className="text-xs text-slate-600 mt-0.5">Compra, vende, troca e financia com revisão criteriosa e documentação garantida.</p>
        </div>
      </div>
    </section>
  );
}

export function PrivacyNotice() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-500 leading-snug">
      <Lock className="w-3.5 h-3.5 flex-shrink-0 text-[#0052FF]" />
      <span>
        Seus dados são protegidos e usados exclusivamente para a simulação/análise na DG Automóveis. Veja nossa{' '}
        <a href="/politica-de-privacidade" className="underline font-bold text-[#0B1120]">
          Política de Privacidade
        </a>.
      </span>
    </div>
  );
}

export function Footer() {
  return (
    <>
      <footer className="bg-gradient-to-br from-[#060B14] via-[#0B1120] to-[#060B14] text-slate-300 p-6 sm:p-10 rounded-3xl space-y-8 mt-12 border border-blue-500/20 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Coluna 1: Logo e Dados da Loja */}
          <div className="md:col-span-5 space-y-3.5 text-left">
            <Logo className="h-12 w-auto" />
            <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
              <p className="font-bold text-white text-sm">{LOJA.nome} — {LOJA.subtitulo} ✨</p>
              <p className="text-sky-400 font-extrabold uppercase tracking-wider text-[11px]">
                • COMPRA • VENDE • TROCA • FINANCIA •
              </p>
              <p className="flex items-center gap-1.5 text-slate-300 pt-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>{LOJA.endereco}</span>
              </p>
              <p className="flex items-center gap-1.5 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>WhatsApp / Telefone: {CONTATO.telefone}</span>
              </p>
              <p className="pt-1 text-slate-400">{LOJA.horario}</p>
              <p className="text-emerald-400 font-bold flex items-center gap-1.5 pt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                🏆 {LOJA.carrosVendidos} em Rio do Sul e região
              </p>
            </div>
          </div>

          {/* Coluna 2: Nossos Serviços */}
          <div className="md:col-span-4 space-y-3 text-left">
            <h3 className="font-serif font-extrabold text-xs text-white uppercase tracking-wider border-b border-blue-500/30 pb-2">
              Nossos Serviços
            </h3>
            <div className="flex flex-col space-y-2.5 text-xs font-semibold text-slate-300">
              <a href="/estoque" className="flex items-center hover:text-sky-400 hover:translate-x-1 transition-all min-h-0 py-1">
                Estoque Completo (Populares & Exclusivos)
              </a>
              <a href="/financiamento" className="flex items-center hover:text-sky-400 hover:translate-x-1 transition-all min-h-0 py-1">
                Simular Financiamento Bancário
              </a>
              <a href="/vender-meu-carro" className="flex items-center hover:text-sky-400 hover:translate-x-1 transition-all min-h-0 py-1">
                Vender ou Trocar meu Carro
              </a>
              <a href="/consignacao" className="flex items-center text-sky-400 font-bold hover:text-white hover:translate-x-1 transition-all min-h-0 py-1">
                Consignação DG Automóveis
              </a>
              <a href="/comparar" className="flex items-center hover:text-sky-400 hover:translate-x-1 transition-all min-h-0 py-1">
                Comparador de Veículos
              </a>
            </div>
          </div>

          {/* Coluna 3: Institucional */}
          <div className="md:col-span-3 space-y-3 text-left">
            <h3 className="font-serif font-extrabold text-xs text-white uppercase tracking-wider border-b border-blue-500/30 pb-2">
              Institucional
            </h3>
            <div className="flex flex-col space-y-2.5 text-xs font-semibold text-slate-300">
              <a href="/a-dg" className="flex items-center hover:text-sky-400 hover:translate-x-1 transition-all min-h-0 py-1">
                Sobre a DG Automóveis
              </a>
              <a href="/duvidas" className="flex items-center hover:text-sky-400 hover:translate-x-1 transition-all min-h-0 py-1">
                Dúvidas Frequentes
              </a>
              <a href="/contato" className="flex items-center hover:text-sky-400 hover:translate-x-1 transition-all min-h-0 py-1">
                Fale Conosco / Localização
              </a>
              <a href="/politica-de-privacidade" className="flex items-center hover:text-sky-400 hover:translate-x-1 transition-all text-slate-400 min-h-0 py-1">
                Política de Privacidade
              </a>
            </div>
          </div>

        </div>

        {/* Linha de Ações e Redes */}
        <div className="pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={LOJA.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#0052FF] hover:bg-[#003ECC] text-white text-xs font-extrabold shadow-md transition-all active:scale-95 min-h-[42px]"
            >
              <MapPin className="w-3.5 h-3.5 text-white" />
              Como Chegar (Dom Pedro II, 461)
            </a>
            <a
              href={SOCIAL.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-10 px-3.5 rounded-xl border border-slate-700 hover:border-sky-400 text-slate-200 hover:text-white text-xs font-bold transition-all min-h-[42px]"
            >
              Instagram {SOCIAL.instagramHandle}
            </a>
            <a
              href={waLink('Olá! Vim pelo site da DG Automóveis e quero falar com um consultor.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-10 px-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all min-h-[42px]"
            >
              WhatsApp Direto
            </a>
          </div>

          <p className="text-[11px] text-slate-500 font-medium">
            © {new Date().getFullYear()} DG Automóveis — CNPJ: {LOJA.cnpj} — Rio do Sul/SC. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <LGPDBanner />
    </>
  );
}

export function StickyBar({ 
  variant = 'default',
  vehicleSlug,
  priceFormatted
}: { 
  variant?: 'default' | 'estoque' | 'veiculo' | 'financiamento' | 'vender' | 'consignar' | 'vendas';
  vehicleSlug?: string;
  priceFormatted?: string;
}) {
  if (variant === 'financiamento' || variant === 'vendas' || variant === 'vender' || variant === 'consignar') {
    return (
      <div className="sticky-footer">
        <div className="grid grid-cols-2 gap-3 max-w-[500px] mx-auto">
          <a
            href={CONTATO.telefoneLink}
            onClick={() => track('phone_click', { pagina: window.location.pathname })}
            className="py-4 bg-slate-100 border border-slate-200 text-[#0B1120] font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px]"
          >
            <Phone className="w-4 h-4 text-[#0052FF]" />
            Ligar
          </a>
          <a
            href={waLink('Olá! Tenho dúvidas sobre ' + (variant === 'financiamento' ? 'financiamento na DG Automóveis' : 'avaliação de veículo na DG Automóveis'))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { pagina: window.location.pathname })}
            className="py-4 bg-[#0052FF] text-white font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px] shadow-md"
          >
            WhatsApp
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'veiculo') {
    return (
      <div className="sticky-footer">
        <div className="flex items-center justify-between gap-3 max-w-[500px] mx-auto">
          {priceFormatted && (
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Valor à vista</span>
              <span className="text-[#0052FF] font-extrabold text-lg leading-none">{priceFormatted}</span>
            </div>
          )}
          <a
            href={`/financiamento?veiculo=${vehicleSlug || ''}`}
            className="py-3.5 px-4 bg-slate-100 border border-slate-200 text-[#0B1120] font-extrabold text-xs uppercase rounded-2xl min-h-[48px] flex items-center justify-center"
          >
            Simular
          </a>
          <a
            href={waLink(`Olá! Tenho interesse no veículo (${vehicleSlug || ''}) que vi no site da DG Automóveis.`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { pagina: window.location.pathname, vehicleSlug })}
            className="flex-1 py-3.5 px-4 bg-[#0052FF] text-white font-extrabold text-xs uppercase rounded-2xl flex items-center justify-center gap-2 shadow-md min-h-[48px]"
          >
            Tenho Interesse
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky-footer">
      <div className="grid grid-cols-2 gap-3 max-w-[500px] mx-auto">
        <a
          href="/estoque"
          className="py-4 bg-slate-100 border border-slate-200 text-[#0B1120] font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px]"
        >
          Ver Estoque
        </a>
        <a
          href={waLink()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('whatsapp_click', { pagina: window.location.pathname })}
          className="py-4 bg-[#0052FF] text-white font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px] shadow-md"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}

export function FloatingWhatsAppButton() {
  return (
    <a
      href={waLink('Olá! Vim pelo site da DG Automóveis e gostaria de atendimento rápido.')}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('whatsapp_click', { pagina: window.location.pathname, tipo: 'floating_button' })}
      className="fixed bottom-20 sm:bottom-6 right-5 z-40 w-12 h-12 sm:w-14 sm:h-14 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group cursor-pointer"
      aria-label="Atendimento via WhatsApp"
      title="Falar no WhatsApp da DG Automóveis"
    >
      <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 fill-current text-white" />
    </a>
  );
}

export function SiteShell({ 
  children, 
  title, 
  onBack, 
  variant = 'default', 
  vehicleSlug, 
  priceFormatted,
  showTrustCards = false
}: { 
  children: React.ReactNode; 
  title?: string; 
  onBack?: () => void; 
  variant?: 'default' | 'estoque' | 'veiculo' | 'financiamento' | 'vender' | 'consignar' | 'vendas'; 
  vehicleSlug?: string; 
  priceFormatted?: string;
  showTrustCards?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B1120] font-sans flex flex-col justify-between relative overflow-x-hidden">
      <div className="flex-1">
        <TopBar title={title} onBack={onBack} />
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-12 w-full">
          {children}
        </main>
      </div>
      <div className="relative pb-20 lg:pb-0 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {showTrustCards && <TrustCards />}
        <Footer />
        <StickyBar variant={variant} vehicleSlug={vehicleSlug} priceFormatted={priceFormatted} />
        <FloatingWhatsAppButton />
        <ConsultorPanel />
        <LGPDBanner />
      </div>
    </div>
  );
}
