import React from 'react';
import { Shield, Lock } from 'lucide-react';
import { SiteShell } from '../ManosUI';
import { LOJA, CONTATO } from '../../lib/manos';

export default function PoliticaPrivacidadePage() {
  return (
    <SiteShell title="Política de Privacidade">
      <div className="space-y-6">
        <div className="text-center space-y-2 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-manos-warm text-manos-red flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-3xl font-extrabold text-[#0B1120] tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-xs text-[#475569]">
            Transparência e segurança no tratamento dos seus dados pessoais.
          </p>
        </div>

        <article className="p-6 bg-white border border-manos-sand rounded-3xl space-y-6 text-sm text-[#0B1120] leading-relaxed max-w-prose mx-auto shadow-sm">
          <section className="space-y-2">
            <h2 className="font-serif font-bold text-lg text-[#0B1120] border-b border-manos-sand pb-1">
              1. Coleta de Dados Pessoais
            </h2>
            <p className="text-xs text-[#475569]">
              A <strong>DG Automóveis</strong> coleta dados pessoais estritamente necessários através dos formulários disponíveis em nosso site. Os dados coletados incluem:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#475569] space-y-1">
              <li><strong>Nome completo</strong>: para identificação do titular;</li>
              <li><strong>Telefone / WhatsApp</strong>: para comunicação e envio de propostas;</li>
              <li><strong>CPF e Data de Nascimento</strong>: para realização de simulação de financiamento e consulta de crédito junto aos bancos parceiros;</li>
              <li><strong>Placa do veículo</strong>: para consulta de histórico FIPE na avaliação de compra ou troca.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif font-bold text-lg text-[#0B1120] border-b border-manos-sand pb-1">
              2. Finalidade do Tratamento
            </h2>
            <p className="text-xs text-[#475569]">
              Os dados coletados são utilizados exclusivamente para:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#475569] space-y-1">
              <li>Análise de crédito e aprovação de financiamento automotivo;</li>
              <li>Avaliação e precificação de veículos usados para compra ou troca;</li>
              <li>Atendimento direto via WhatsApp ou ligação por nossos consultores.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif font-bold text-lg text-[#0B1120] border-b border-manos-sand pb-1">
              3. Compartilhamento Seguro
            </h2>
            <p className="text-xs text-[#475569]">
              Seus dados de crédito (CPF e nascimento) são compartilhados unicamente com as instituições financeiras bancárias parceiras homologadas para fins de pré-análise de financiamento. Não vendemos, alugamos ou comercializamos dados pessoais com terceiros.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif font-bold text-lg text-[#0B1120] border-b border-manos-sand pb-1">
              4. Seus Direitos & Exclusão de Dados
            </h2>
            <p className="text-xs text-[#475569]">
              Conforme a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), você possui o direito de confirmar a existência de tratamento, acessar, corrigir ou solicitar a exclusão definitiva dos seus dados de nossos cadastros a qualquer momento.
            </p>
            <p className="text-xs font-bold text-[#0B1120] pt-1">
              Para solicitar a exclusão de seus dados, entre em contato pelo telefone/WhatsApp {CONTATO.telefone} ou presencialmente em nossa loja na {LOJA.endereco} (DG Automóveis — CNPJ {LOJA.cnpj}).
            </p>
          </section>
        </article>
      </div>
    </SiteShell>
  );
}
