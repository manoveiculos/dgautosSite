import React, { useState, useMemo } from 'react';
import {
  X, Calculator, DollarSign, Share2, Check, Landmark, ShieldCheck,
  TrendingUp, Copy, Sparkles, Building2
} from 'lucide-react';
import { brl } from '../store';

const FINANCEIRAS_CONFIG = [
  { id: 'santander', nome: 'Santander Financiamentos', taxaBase: 0.0165, cor: '#ea1d2d' },
  { id: 'bv', nome: 'BV Financeira', taxaBase: 0.0169, cor: '#005caa' },
  { id: 'pan', nome: 'Banco Pan', taxaBase: 0.0172, cor: '#00a3e0' },
  { id: 'bradesco', nome: 'Bradesco Financiamentos', taxaBase: 0.0162, cor: '#cc092f' },
  { id: 'itau', nome: 'Itaú Veículos', taxaBase: 0.0164, cor: '#ec7000' },
  { id: 'safra', nome: 'Banco Safra', taxaBase: 0.0175, cor: '#c49a45' },
];

export default function SimuladorFinanciamentoModal({
  isOpen,
  onClose,
  veiculoInicial = null,
  onAplicarSimulacao = null,
}) {
  const [nomeCarro, setNomeCarro] = useState(
    veiculoInicial ? `${veiculoInicial.marca || ''} ${veiculoInicial.modelo || ''}`.trim() : 'Veículo Seminovos DG'
  );
  const [valorVeiculo, setValorVeiculo] = useState(
    veiculoInicial ? Number(veiculoInicial.preco || 60000) : 60000
  );
  const [valorEntrada, setValorEntrada] = useState(
    veiculoInicial ? Math.round(Number(veiculoInicial.preco || 60000) * 0.25) : 15000
  );
  const [bancoId, setBancoId] = useState('santander');
  const [retornoLoja, setRetornoLoja] = useState(2); // 0 a 6% de retorno da financeira
  const [carenciaDias, setCarenciaDias] = useState(30);
  const [copiado, setCopiado] = useState(false);

  const bancoAtual = useMemo(() => {
    return FINANCEIRAS_CONFIG.find((b) => b.id === bancoId) || FINANCEIRAS_CONFIG[0];
  }, [bancoId]);

  const saldoFinanciar = Math.max(0, valorVeiculo - valorEntrada);
  const valorRetornoLoja = Math.round(saldoFinanciar * (retornoLoja / 100));

  // Tabela Price para simulação automotiva
  const parcelasSimuladas = useMemo(() => {
    const prazos = [12, 24, 36, 48, 60];
    if (saldoFinanciar <= 0) return [];

    // Taxa mensal ajustada pelo retorno da loja (~0.08% a.m. por ponto de retorno)
    const taxaEfetiva = bancoAtual.taxaBase + (retornoLoja * 0.0008);

    return prazos.map((n) => {
      // Fórmula Price: PMT = PV * (i * (1 + i)^n) / ((1 + i)^n - 1)
      const fator = Math.pow(1 + taxaEfetiva, n);
      const parcelaBase = saldoFinanciar * ((taxaEfetiva * fator) / (fator - 1));
      
      // TAC estimada e IOF diluído
      const taxaCadastro = 1150 / n;
      const iofDiluido = (saldoFinanciar * 0.03) / n;
      const parcelaFinal = Math.round(parcelaBase + taxaCadastro + iofDiluido);

      return {
        prazo: n,
        parcela: parcelaFinal,
        total: parcelaFinal * n,
        taxaMes: (taxaEfetiva * 100).toFixed(2),
      };
    });
  }, [saldoFinanciar, bancoAtual, retornoLoja]);

  const copiarTextoWhatsApp = () => {
    const linhasParcelas = parcelasSimuladas
      .filter((p) => [24, 36, 48, 60].includes(p.prazo))
      .map((p) => `• *${p.prazo}x* de *${brl(p.parcela)}*`)
      .join('\n');

    const texto = `🚗 *DG AUTOMÓVEIS — SIMULAÇÃO DE FINANCIAMENTO*
---------------------------------------
*Veículo:* ${nomeCarro || 'Veículo do Estoque'}
*Valor do Carro:* ${brl(valorVeiculo)}
*Entrada Proposta:* ${brl(valorEntrada)}
*Saldo a Financiar:* ${brl(saldoFinanciar)}

*Opções de Parcelamento:*
${linhasParcelas}

🏦 *Banco Parceiro:* ${bancoAtual.nome}
📅 *Primeira parcela:* para ${carenciaDias} dias
---------------------------------------
✓ *Sujeito à análise e aprovação de crédito.*
📞 *DG Automóveis* — (47) 98916-9598
📍 Rua Dom Pedro II, 461 - Canoas, Rio do Sul/SC`;

    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    });
  };

  const handleAplicar = () => {
    if (onAplicarSimulacao) {
      const p48 = parcelasSimuladas.find((p) => p.prazo === 48) || parcelasSimuladas[0];
      onAplicarSimulacao({
        financeira: bancoAtual.nome,
        valorFinanciado: saldoFinanciar,
        parcelas: p48 ? p48.prazo : 48,
        valorParcela: p48 ? p48.parcela : 0,
        retornoLoja: valorRetornoLoja,
      });
    }
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 14,
          padding: 24,
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO SIMULADOR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'var(--primary)', color: '#fff', padding: 8, borderRadius: 8 }}>
              <Calculator size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>
                Simulador de Financiamento Automotivo
              </h2>
              <small style={{ color: 'var(--muted)' }}>
                Tabela de coeficientes bancários com cálculo de parcelas e retorno da loja (Altimus Standard).
              </small>
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} style={{ borderRadius: '50%', width: 34, height: 34, padding: 0, justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* FORMULÁRIO DE ENTRADA DE DADOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: '.82rem', fontWeight: 700 }}>Veículo Pretendido</label>
            <input
              className="input input-sm"
              value={nomeCarro}
              onChange={(e) => setNomeCarro(e.target.value)}
              placeholder="Ex: Jeep Renegade Longitude 1.8"
            />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: '.82rem', fontWeight: 700 }}>Valor Total do Carro (R$)</label>
            <input
              type="number"
              className="input input-sm"
              value={valorVeiculo}
              onChange={(e) => setValorVeiculo(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: '.82rem', fontWeight: 700 }}>Valor de Entrada (R$)</label>
            <input
              type="number"
              className="input input-sm"
              value={valorEntrada}
              onChange={(e) => setValorEntrada(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>

        {/* SELETOR DE FINANCEIRA E RETORNO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18, background: 'var(--color-neutral-80)', padding: 14, borderRadius: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: '.82rem', fontWeight: 700 }}>Banco / Financeira Parceira</label>
            <select
              className="select select-sm"
              value={bancoId}
              onChange={(e) => setBancoId(e.target.value)}
            >
              {FINANCEIRAS_CONFIG.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome} (~{(b.taxaBase * 100).toFixed(2)}% a.m.)
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: '.82rem', fontWeight: 700 }}>
              Retorno da Loja (Comissão da Financeira): <strong>R$ {retornoLoja}%</strong>
            </label>
            <select
              className="select select-sm"
              value={retornoLoja}
              onChange={(e) => setRetornoLoja(Number(e.target.value))}
            >
              <option value={0}>Retorno 0 (0% - Sem comissão de retorno)</option>
              <option value={1}>Retorno 1 (1% de comissão para a loja)</option>
              <option value={2}>Retorno 2 (2% de comissão para a loja)</option>
              <option value={3}>Retorno 3 (3% de comissão para a loja)</option>
              <option value={4}>Retorno 4 (4% de comissão para a loja)</option>
              <option value={5}>Retorno 5 (5% de comissão para a loja)</option>
              <option value={6}>Retorno 6 (6% de comissão para a loja)</option>
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: '.82rem', fontWeight: 700 }}>Carência da 1ª Parcela</label>
            <select
              className="select select-sm"
              value={carenciaDias}
              onChange={(e) => setCarenciaDias(Number(e.target.value))}
            >
              <option value={30}>30 dias (Padrão)</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </div>
        </div>

        {/* RESUMO DO VALOR FINANCIADO E DO RETORNO DA LOJA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 18 }}>
          <div className="card stat" style={{ margin: 0, padding: 14 }}>
            <div className="stat-label">Saldo a Financiar</div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>{brl(saldoFinanciar)}</div>
            <div className="stat-sub">Valor líquido de principal</div>
          </div>

          <div className="card stat" style={{ margin: 0, padding: 14, borderLeft: '4px solid #10b981' }}>
            <div className="stat-label" style={{ color: '#059669', fontWeight: 800 }}>
              <TrendingUp size={14} /> Retorno Líquido da Loja
            </div>
            <div className="stat-value" style={{ fontSize: '1.4rem', color: '#10b981' }}>
              {brl(valorRetornoLoja)}
            </div>
            <div className="stat-sub">Bônus pago pelo banco à DG Automóveis</div>
          </div>
        </div>

        {/* TABELA DE PARCELAS */}
        <div className="card table-wrap" style={{ margin: 0, border: '1px solid var(--border)', borderRadius: 10 }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '8px 12px' }}>Prazo</th>
                <th style={{ padding: '8px 12px' }}>Taxa Estimada</th>
                <th style={{ padding: '8px 12px' }}>Valor da Parcela</th>
                <th style={{ padding: '8px 12px' }}>Total Estimado</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {parcelasSimuladas.map((p) => (
                <tr key={p.prazo}>
                  <td style={{ fontWeight: 800 }}>{p.prazo}x</td>
                  <td style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{p.taxaMes}% a.m.</td>
                  <td>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>
                      {brl(p.parcela)}
                    </strong>
                    <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>com TAC e IOF</div>
                  </td>
                  <td style={{ fontSize: '.86rem', color: 'var(--muted)' }}>{brl(p.total)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      title="Copiar apenas esta parcela"
                      onClick={() => {
                        const t = `🚗 ${nomeCarro}\nEntrada: ${brl(valorEntrada)}\nParcela: *${p.prazo}x de ${brl(p.parcela)}* no ${bancoAtual.nome}.`;
                        navigator.clipboard.writeText(t);
                        alert(`✓ Opção de ${p.prazo}x copiada!`);
                      }}
                    >
                      <Copy size={12} /> Copiar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BARRA DE BOTÕES DE AÇÃO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            style={{ fontWeight: 700, color: '#16a34a', borderColor: '#16a34a' }}
            onClick={copiarTextoWhatsApp}
          >
            {copiado ? (
              <>
                <Check size={16} /> ✓ Simulação Copiada para WhatsApp!
              </>
            ) : (
              <>
                <Share2 size={16} /> 📲 Copiar Simulação para WhatsApp
              </>
            )}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn" onClick={onClose}>
              Fechar
            </button>
            {onAplicarSimulacao && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAplicar}
              >
                <Check size={16} /> Aplicar na Negociação
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
