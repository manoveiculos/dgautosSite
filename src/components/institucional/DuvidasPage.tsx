import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Phone, MessageSquare } from 'lucide-react';
import { SiteShell, TrustCards } from '../ManosUI';
import { CONTATO, waLink } from '../../lib/manos';
import { track } from '../../lib/track';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'Aceitam meu carro ou moto usada na troca?',
    answer: 'Sim! Avaliamos seu veículo usado (carro ou moto) como parte do pagamento ou entrada na compra de qualquer seminovo do nosso pátio. A avaliação pode ser feita presencialmente ou antecipada pelo WhatsApp.',
  },
  {
    question: 'Como funciona a simulação de financiamento?',
    answer: 'Trabalhamos em parceria com as maiores instituições financeiras do país. Você informa seu CPF, data de nascimento e valor de entrada desejado, e nós consultamos as melhores taxas de juros disponíveis para o seu perfil.',
  },
  {
    question: 'Como é resolvida a documentação e transferência?',
    answer: 'Toda a burocracia de documentação, laudo cautelar e transferência de propriedade é gerida diretamente pela equipe da DG Automóveis. Você recebe o carro pronto para rodar, sem dor de cabeça.',
  },
  {
    question: 'Os veículos têm garantia e revisão?',
    answer: 'Sim, 100% do nosso estoque passa por revisão mecânica detalhada antes de ir para a vitrine. Garantimos a procedência do veículo e cobrimos motor e câmbio conforme os termos de garantia legal.',
  },
  {
    question: 'Posso agendar um test drive antes de fechar?',
    answer: 'Com certeza! Convidamos você para vir à nossa loja na R. Dom Pedro II, 461 em Rio do Sul/SC para ver o carro de perto, testar o conforto e fazer o test drive sem compromisso.',
  },
  {
    question: 'Quais são as formas de pagamento aceitas?',
    answer: 'Aceitamos pagamento à vista via PIX ou transferência bancária, financiamento bancário em até 60x, parcelamento no cartão de crédito e seu seminovo na troca.',
  },
];

export default function DuvidasPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <SiteShell title="Dúvidas Frequentes">
      <div className="space-y-6">
        <div className="text-center space-y-2 pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
            Tire suas dúvidas
          </span>
          <h1 className="font-serif text-3xl font-extrabold text-[#0B1120] tracking-tight">
            Perguntas Frequentes
          </h1>
          <p className="text-xs text-[#475569]">
            Respostas transparentes sobre negociação, troca e financiamento na DG Automóveis.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className="bg-white border border-manos-sand rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-serif font-bold text-base text-[#0B1120] hover:bg-manos-warm/40 active:bg-manos-warm transition-colors min-h-[48px]"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-manos-red flex-shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-sm text-[#475569] leading-relaxed border-t border-manos-sand/30">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dark CTA Block for Direct WhatsApp Questions */}
        <div className="p-6 bg-[#0B1120] text-[#FFFFFF] rounded-3xl space-y-4 text-center shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-manos-red text-white flex items-center justify-center mx-auto shadow-md">
            <MessageSquare className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="font-serif font-bold text-xl text-white">
              Sua dúvida não está aqui?
            </h3>
            <p className="text-xs text-[#CBD5E1]">
              Nossa equipe está online no WhatsApp para responder qualquer pergunta sobre os carros ou condições.
            </p>
          </div>

          <a
            href={waLink('Olá! Tenho uma dúvida que não encontrei na página do site.')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { pagina: '/duvidas_cta' })}
            className="w-full py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
          >
            Perguntar no WhatsApp
          </a>
        </div>

        <TrustCards />
      </div>
    </SiteShell>
  );
}
