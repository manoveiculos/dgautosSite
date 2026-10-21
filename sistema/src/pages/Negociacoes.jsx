import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Handshake, CheckCircle2, FileText, Trash2, X, Car, DollarSign, RefreshCw, LayoutGrid, List, Edit3
} from 'lucide-react';
import {
  getNegociacoes, saveNegociacao, concluirNegociacao, deleteNegociacao,
  getClientes, getVeiculos, brl, dataBr
} from '../store';

const EMPTY_NEG = {
  tipo: 'venda',
  status: 'aberta',
  cliente_id: '',
  canal_venda: 'LOJA',
  veiculo_id: '',
  valor_veiculo: 0,
  desconto: 0,
  troca_marca: '',
  troca_modelo: '',
  troca_ano: '',
  troca_placa: '',
  troca_km: 0,
  troca_cor: '',
  troca_valor: 0,
  pagamentos: [{ forma: 'Pix / TED', financeira: 'À vista', parcelas: 1, valor: 0 }],
  comissao_vendedor: 0,
  observacoes: '',
  data_negociacao: new Date().toISOString().slice(0, 10)
};

const STATUS_NEG = {
  aberta: 'Em aberto',
  conferencia: 'Em conferência',
  concluida: 'Concluída (Fechada)',
  cancelada: 'Cancelada'
};

export default function Negociacoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [modo, setModo] = useState('cards'); // cards | tabela
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [editando, setEditando] = useState(null);

  const recarregar = () => {
    getNegociacoes().then(setLista).catch(() => {});
    getClientes().then(setClientes).catch(() => {});
    getVeiculos().then(setVeiculos).catch(() => {});
  };
  useEffect(recarregar, []);

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setEditando(EMPTY_NEG);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtradas = useMemo(() => lista.filter((n) => {
    if (filtroStatus && n.status !== filtroStatus) return false;
    return `${n.cliente_nome || ''} ${n.veic_marca || ''} ${n.veic_modelo || ''} ${n.veic_placa || ''} ${n.troca_modelo || ''}`
      .toLowerCase().includes(busca.toLowerCase());
  }), [lista, busca, filtroStatus]);

  const totais = useMemo(() => {
    const concluidas = lista.filter((n) => n.status === 'concluida');
    const emAndamento = lista.filter((n) => ['aberta', 'conferencia'].includes(n.status));
    return {
      fechadasQtd: concluidas.length,
      fechadasValor: concluidas.reduce((s, n) => s + (Number(n.valor_veiculo) - Number(n.desconto || 0)), 0),
      abertasQtd: emAndamento.length,
      abertasValor: emAndamento.reduce((s, n) => s + (Number(n.valor_veiculo) - Number(n.desconto || 0)), 0),
    };
  }, [lista]);

  if (editando) {
    return (
      <NegociacaoWizardModal
        inicial={editando}
        clientes={clientes}
        veiculos={veiculos}
        onClose={() => setEditando(null)}
        onSave={async (neg) => {
          await saveNegociacao(neg);
          recarregar();
          setEditando(null);
        }}
        onConcluir={async (neg) => {
          const listaAtualizada = await saveNegociacao(neg);
          const idAlvo = neg.id || listaAtualizada[0]?.id;
          if (idAlvo) await concluirNegociacao(idAlvo);
          recarregar();
          setEditando(null);
        }}
        onDelete={async (id) => {
          await deleteNegociacao(id);
          recarregar();
          setEditando(null);
        }}
        onContrato={(id) => {
          setEditando(null);
          navigate(`/documentos?negociacao=${id}`);
        }}
      />
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Vendas, Trocas & Negociações</h1>
          <p>Passo a passo simples: Escolha o Cliente → Escolha o Carro (e Troca) → Forma de Pagamento → Concluir Venda.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button className={`tab ${modo === 'cards' ? 'active' : ''}`} onClick={() => setModo('cards')}>
              <LayoutGrid size={15} />Cards
            </button>
            <button className={`tab ${modo === 'tabela' ? 'active' : ''}`} onClick={() => setModo('tabela')}>
              <List size={15} />Tabela
            </button>
          </div>
          <button id="btn-nova-negociacao" className="btn btn-primary" onClick={() => setEditando(EMPTY_NEG)}>
            <Plus size={16} />Abrir Nova Venda / Troca
          </button>
        </div>
      </header>

      <section className="stats">
        <div className="card stat">
          <div className="stat-label"><Handshake size={16} />Negociações em Andamento</div>
          <div className="stat-value">{totais.abertasQtd}</div>
          <div className="stat-sub">{brl(totais.abertasValor)} em propostas ativas</div>
        </div>
        <div className="card stat">
          <div className="stat-label"><CheckCircle2 size={16} />Vendas Concluídas</div>
          <div className="stat-value">{totais.fechadasQtd}</div>
          <div className="stat-sub">{brl(totais.fechadasValor)} faturados</div>
        </div>
      </section>

      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar cliente, veículo, placa ou troca…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select className="select" style={{ maxWidth: 210 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todas as situações</option>
          {Object.entries(STATUS_NEG).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {modo === 'cards' ? (
        <div className="vehicles">
          {filtradas.map((n) => {
            const liquido = Number(n.valor_veiculo || 0) - Number(n.desconto || 0);
            const saldoComplementar = liquido - Number(n.troca_valor || 0);
            return (
              <article key={n.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }} onClick={() => setEditando(n)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '.78rem', color: 'var(--muted)', fontWeight: 700 }}>
                    VENDA #{n.id} · {dataBr(n.data_negociacao)}
                  </span>
                  <span className={`badge badge-${n.status}`}>{STATUS_NEG[n.status] || n.status}</span>
                </div>

                <div>
                  <span style={{ fontSize: '.68rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>Cliente Comprador</span>
                  <h3 style={{ fontSize: '1.05rem', marginTop: 2 }}>{n.cliente_nome || 'Cliente a definir'}</h3>
                  <small style={{ color: 'var(--muted)' }}>Canal: {n.canal_venda || 'LOJA'} · Modalidade: <strong style={{ textTransform: 'uppercase' }}>{n.tipo}</strong></small>
                </div>

                <div className="vehicle-specs" style={{ gridTemplateColumns: n.troca_modelo ? '1fr 1fr' : '1fr' }}>
                  <div className="vehicle-spec-item" style={{ textAlign: 'left', padding: '8px 10px' }}>
                    <span>🚗 Carro Vendido (Saída)</span>
                    <strong style={{ fontSize: '.86rem' }}>{n.veic_modelo ? `${n.veic_marca} ${n.veic_modelo}` : 'A selecionar'}</strong>
                    {n.veic_placa && <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Placa: {n.veic_placa}</div>}
                  </div>
                  {n.troca_modelo && (
                    <div className="vehicle-spec-item" style={{ textAlign: 'left', padding: '8px 10px' }}>
                      <span>🔄 Carro na Troca (Entrada)</span>
                      <strong style={{ fontSize: '.86rem', color: 'var(--primary-2)' }}>{n.troca_marca} {n.troca_modelo}</strong>
                      <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Avaliado: {brl(n.troca_valor)}</div>
                    </div>
                  )}
                </div>

                <div className="vehicle-pricing">
                  <div>
                    <span className="vehicle-price-label">Valor Líquido da Venda</span>
                    <span className="vehicle-price">{brl(liquido)}</span>
                  </div>
                  {n.troca_valor > 0 && (
                    <div className="vehicle-profit-box">
                      <span style={{ fontSize: '.66rem', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 700 }}>Volta / Diferença</span>
                      <strong style={{ fontSize: '.9rem', color: 'var(--success)' }}>{brl(saldoComplementar)}</strong>
                    </div>
                  )}
                </div>

                <div className="vehicle-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn btn-sm" onClick={() => setEditando(n)}>
                    <Edit3 size={13} /> Abrir
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => navigate(`/documentos?negociacao=${n.id}`)}>
                    <FileText size={13} /> Contrato
                  </button>
                  {n.status !== 'concluida' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-success"
                      onClick={async () => {
                        if (!confirm(`Confirmar fechamento da Negociação #${n.id}? Isso baixará o veículo no estoque e lançará os títulos no Financeiro.`)) return;
                        await concluirNegociacao(n.id);
                        recarregar();
                      }}
                    >
                      <CheckCircle2 size={13} /> Concluir
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th># / Data</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Veículo Negociado</th>
                <th>Troca (Entrada)</th>
                <th>Valor Líquido</th>
                <th>Status</th>
                <th>Ações Rápidas</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((n) => {
                const liquido = Number(n.valor_veiculo || 0) - Number(n.desconto || 0);
                return (
                  <tr key={n.id} onClick={() => setEditando(n)}>
                    <td>
                      <strong>#{n.id}</strong>
                      <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>{dataBr(n.data_negociacao)}</div>
                    </td>
                    <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{n.tipo}</td>
                    <td>
                      <strong>{n.cliente_nome || '—'}</strong>
                      <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Canal: {n.canal_venda}</div>
                    </td>
                    <td>
                      {n.veic_modelo ? `${n.veic_marca} ${n.veic_modelo}` : '—'}
                      {n.veic_placa && <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Placa: {n.veic_placa}</div>}
                    </td>
                    <td>
                      {n.troca_modelo ? (
                        <>
                          <span>{n.troca_marca} {n.troca_modelo}</span>
                          <div style={{ fontSize: '.76rem', color: 'var(--primary-2)' }}>Avaliado: {brl(n.troca_valor)}</div>
                        </>
                      ) : 'Sem troca'}
                    </td>
                    <td><strong>{brl(liquido)}</strong></td>
                    <td><span className={`badge badge-${n.status}`}>{STATUS_NEG[n.status] || n.status}</span></td>
                    <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {n.status !== 'concluida' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={async () => {
                            if (!confirm(`Confirmar fechamento da Negociação #${n.id}? Isso baixará o veículo no estoque e lançará os títulos no Financeiro.`)) return;
                            await concluirNegociacao(n.id);
                            recarregar();
                          }}
                        >
                          <CheckCircle2 size={13} />Concluir
                        </button>
                      )}
                      <button
                        className="btn btn-sm"
                        onClick={() => navigate(`/documentos?negociacao=${n.id}`)}
                      >
                        <FileText size={13} />Contrato
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <NegociacaoWizardModal
          inicial={editando}
          clientes={clientes}
          veiculos={veiculos}
          onClose={() => setEditando(null)}
          onSave={async (neg) => {
            await saveNegociacao(neg);
            recarregar();
            setEditando(null);
          }}
          onConcluir={async (neg) => {
            const listaAtualizada = await saveNegociacao(neg);
            const idAlvo = neg.id || listaAtualizada[0]?.id;
            if (idAlvo) await concluirNegociacao(idAlvo);
            recarregar();
            setEditando(null);
          }}
          onDelete={async (id) => {
            await deleteNegociacao(id);
            recarregar();
            setEditando(null);
          }}
          onContrato={(id) => {
            setEditando(null);
            navigate(`/documentos?negociacao=${id}`);
          }}
        />
      )}
    </>
  );
}

const PASSOS = [
  '1. Pessoas & Canal',
  '2. Veículo & Troca',
  '3. Financeiro',
  '4. Documentos',
  '5. Conferência'
];

function NegociacaoWizardModal({ inicial, clientes, veiculos, onClose, onSave, onConcluir, onDelete, onContrato }) {
  const [passo, setPasso] = useState(0);
  const [f, setF] = useState({
    ...inicial,
    pagamentos: Array.isArray(inicial.pagamentos) && inicial.pagamentos.length
      ? inicial.pagamentos
      : [{ forma: 'Pix / TED', financeira: 'À vista', parcelas: 1, valor: Number(inicial.valor_veiculo) || 0 }]
  });

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const selecionarVeiculo = (e) => {
    const id = e.target.value;
    const v = veiculos.find((x) => String(x.id) === String(id));
    const preco = v ? Number(v.preco) : Number(f.valor_veiculo || 0);
    setF({
      ...f,
      veiculo_id: id,
      valor_veiculo: preco,
      pagamentos: f.pagamentos.length === 1 && !f.pagamentos[0].valor
        ? [{ ...f.pagamentos[0], valor: preco }]
        : f.pagamentos
    });
  };

  const valorLiquido = (Number(f.valor_veiculo) || 0) - (Number(f.desconto) || 0);
  const somaPagamentos = (f.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const diferenca = valorLiquido - somaPagamentos;

  const sincronizarTrocaNoPagamento = () => {
    const valTroca = Number(f.troca_valor) || 0;
    if (valTroca <= 0) return;
    const outros = (f.pagamentos || []).filter((p) => p.forma !== 'Veículo na Troca');
    const restante = Math.max(0, valorLiquido - valTroca);
    setF({
      ...f,
      pagamentos: [
        { forma: 'Veículo na Troca', financeira: `${f.troca_marca} ${f.troca_modelo} ${f.troca_placa || ''}`.trim(), parcelas: 1, valor: valTroca },
        ...(outros.length ? outros.map((p, i) => i === 0 ? { ...p, valor: restante } : p) : [{ forma: 'Pix / TED', financeira: 'Saldo', parcelas: 1, valor: restante }])
      ]
    });
  };

  const updatePag = (idx, key, val) => {
    const copia = [...f.pagamentos];
    copia[idx] = { ...copia[idx], [key]: val };
    setF({ ...f, pagamentos: copia });
  };

  const addPag = () => setF({
    ...f,
    pagamentos: [...f.pagamentos, { forma: 'Financiamento', financeira: 'Banco / Financeira', parcelas: 36, valor: Math.max(0, diferenca) }]
  });

  const rmPag = (idx) => setF({ ...f, pagamentos: f.pagamentos.filter((_, i) => i !== idx) });

  const veicSelecionado = veiculos.find((v) => String(v.id) === String(f.veiculo_id));
  const margemEstimada = veicSelecionado
    ? valorLiquido - Number(veicSelecionado.custo || 0) - Number(veicSelecionado.despesas_veiculo || 0) - Number(f.comissao_vendedor || 0)
    : 0;

  return (
    <form className="altimus-crud-page" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="altimus-crud-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn" onClick={onClose}>← Voltar para Negociações</button>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {f.id ? `Negociação #${f.id}` : 'Nova Negociação de Veículo'}
          </h2>
        </div>
        <button type="submit" className="btn btn-primary">✓ Salvar Proposta</button>
      </div>

      <div className="altimus-crud-body">
        <div className="stepper">
          {PASSOS.map((label, idx) => (
            <button
              key={label}
              type="button"
              className={`step-btn ${passo === idx ? 'active' : ''}`}
              onClick={() => setPasso(idx)}
            >
              <span className="step-num">{idx + 1}</span>
              <span>{label.split('. ')[1]}</span>
            </button>
          ))}
        </div>

        {/* PASSO 1: PESSOAS */}
        {passo === 0 && (
          <div className="form-grid">
            <div className="field">
              <label>Operação / Tipo</label>
              <select className="select" value={f.tipo} onChange={set('tipo')}>
                <option value="venda">Venda de Veículo</option>
                <option value="troca">Venda com Troca</option>
                <option value="consignacao">Venda de Consignado</option>
                <option value="compra">Compra para Estoque</option>
              </select>
            </div>
            <div className="field">
              <label>Status da Negociação</label>
              <select className="select" value={f.status} onChange={set('status')}>
                <option value="aberta">Em aberto (Proposta)</option>
                <option value="conferencia">Em conferência (Reserva veículo)</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="field">
              <label>Data da Negociação</label>
              <input className="input" type="date" value={f.data_negociacao ?? ''} onChange={set('data_negociacao')} />
            </div>

            <div className="field span-2">
              <label>Cliente / Comprador *</label>
              <select className="select" required value={f.cliente_id ?? ''} onChange={set('cliente_id')}>
                <option value="">— Selecione o cliente —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.cpf_cnpj || c.telefone || c.cidade}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Canal de Venda</label>
              <select className="select" value={f.canal_venda ?? 'LOJA'} onChange={set('canal_venda')}>
                {['LOJA', 'OLX', 'WEBMOTORS', 'WHATSAPP', 'INSTAGRAM', 'CHAVES_NA_MAO', 'ICARROS', 'SITE_PROPRIO'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* PASSO 2: VEÍCULO & TROCA */}
        {passo === 1 && (
          <div className="form-grid">
            <div className="field span-3">
              <label>Veículo de Saída (Estoque) *</label>
              <select className="select" value={f.veiculo_id ?? ''} onChange={selecionarVeiculo}>
                <option value="">— Selecione o veículo em estoque —</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} ({v.ano}) — Placa {v.placa || '—'} — Preço: {brl(v.preco)} [{v.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Valor do Veículo na Negociação (R$)</label>
              <input className="input" type="number" value={f.valor_veiculo ?? 0} onChange={set('valor_veiculo')} />
            </div>
            <div className="field">
              <label>Desconto Concedido (R$)</label>
              <input className="input" type="number" value={f.desconto ?? 0} onChange={set('desconto')} />
            </div>
            <div className="field">
              <label>Valor Líquido da Venda</label>
              <input className="input" disabled value={brl(valorLiquido)} />
            </div>

            <div className="span-3" style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: '.98rem' }}>Avaliação de Veículo na Troca (Entrada)</h3>
                <button type="button" className="btn btn-sm" onClick={sincronizarTrocaNoPagamento}>
                  <RefreshCw size={13} />Lançar valor da troca no Financeiro
                </button>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Marca (Troca)</label>
                  <input className="input" value={f.troca_marca ?? ''} onChange={set('troca_marca')} placeholder="Ex.: Honda" />
                </div>
                <div className="field span-2">
                  <label>Modelo / Versão (Troca)</label>
                  <input className="input" value={f.troca_modelo ?? ''} onChange={set('troca_modelo')} placeholder="Ex.: Civic LXR 2.0" />
                </div>
                <div className="field">
                  <label>Ano (Troca)</label>
                  <input className="input" value={f.troca_ano ?? ''} onChange={set('troca_ano')} placeholder="2015/2016" />
                </div>
                <div className="field">
                  <label>Placa (Troca)</label>
                  <input className="input" value={f.troca_placa ?? ''} onChange={set('troca_placa')} style={{ textTransform: 'uppercase' }} />
                </div>
                <div className="field">
                  <label>Cor (Troca)</label>
                  <input className="input" value={f.troca_cor ?? ''} onChange={set('troca_cor')} />
                </div>
                <div className="field">
                  <label>KM (Troca)</label>
                  <input className="input" type="number" value={f.troca_km ?? 0} onChange={set('troca_km')} />
                </div>
                <div className="field span-2">
                  <label>Valor Avaliado na Troca (R$)</label>
                  <input className="input" type="number" value={f.troca_valor ?? 0} onChange={set('troca_valor')} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASSO 3: FINANCEIRO & FORMAS DE PAGAMENTO */}
        {passo === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <strong>Valor Líquido do Veículo: {brl(valorLiquido)}</strong>
                <div style={{ fontSize: '.82rem', color: diferenca === 0 ? 'var(--success)' : 'var(--warning)' }}>
                  Soma das formas de pagamento: {brl(somaPagamentos)} · {diferenca === 0 ? '✓ Valores fechados!' : `Diferença a compor: ${brl(diferenca)}`}
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-primary" onClick={addPag}>
                <Plus size={14} />Adicionar Forma de Pagamento
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {f.pagamentos.map((p, idx) => (
                <div key={idx} className="form-grid" style={{ alignItems: 'end', background: 'var(--color-neutral-80)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div className="field">
                    <label>Forma de Pagamento</label>
                    <select className="select" value={p.forma} onChange={(e) => updatePag(idx, 'forma', e.target.value)}>
                      {['Pix / TED', 'Financiamento', 'Veículo na Troca', 'Cartão de Crédito', 'Consórcio', 'Cheque', 'Nota Promissória'].map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Financeira / Banco / Detalhe</label>
                    <input className="input" value={p.financeira || ''} onChange={(e) => updatePag(idx, 'financeira', e.target.value)} placeholder="Ex.: Santander / Itaú / À vista" />
                  </div>
                  <div className="field" style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Valor (R$)</label>
                      <input className="input" type="number" value={p.valor} onChange={(e) => updatePag(idx, 'valor', Number(e.target.value))} />
                    </div>
                    <button type="button" className="btn btn-icon btn-danger" onClick={() => rmPag(idx)} title="Remover">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="field">
                <label>Comissão do Vendedor (R$)</label>
                <input className="input" type="number" value={f.comissao_vendedor ?? 0} onChange={set('comissao_vendedor')} />
              </div>
            </div>
          </div>
        )}

        {/* PASSO 4: DOCUMENTOS & OBSERVAÇÕES */}
        {passo === 3 && (
          <div className="form-grid">
            <div className="field span-3">
              <label>Cláusulas Adicionais / Observações da Negociação e Entrega</label>
              <textarea
                className="input"
                rows={4}
                value={f.observacoes ?? ''}
                onChange={set('observacoes')}
                placeholder="Ex.: IPVA 2026 pago, entrega com tanque cheio e transferência por conta do comprador…"
              />
            </div>
            {f.id && (
              <div className="span-3 card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Impressão de Contratos, Recibos e Termo de Garantia</strong>
                  <p style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Gere o Contrato de Compra e Venda, Recibo ou Nota Promissória preenchidos automaticamente.</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => onContrato(f.id)}>
                  <FileText size={16} />Abrir Documentos da Negociação
                </button>
              </div>
            )}
          </div>
        )}

        {/* PASSO 5: CONFERÊNCIA & FECHAMENTO */}
        {passo === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="stats" style={{ marginBottom: 4 }}>
              <div className="card stat">
                <div className="stat-label">Valor Líquido da Venda</div>
                <div className="stat-value">{brl(valorLiquido)}</div>
                <div className="stat-sub">Desconto: {brl(f.desconto)}</div>
              </div>
              <div className="card stat">
                <div className="stat-label">Custo + Despesas do Veículo</div>
                <div className="stat-value">
                  {veicSelecionado ? brl(Number(veicSelecionado.custo) + Number(veicSelecionado.despesas_veiculo || 0)) : '—'}
                </div>
                <div className="stat-sub">Comissão vendedor: {brl(f.comissao_vendedor)}</div>
              </div>
              <div className="card stat">
                <div className="stat-label">Lucro Líquido Real</div>
                <div className="stat-value" style={{ color: margemEstimada >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {veicSelecionado ? brl(margemEstimada) : '—'}
                </div>
                <div className="stat-sub">Após despesas de pátio e comissão</div>
              </div>
            </div>

            <div className="card" style={{ background: 'hsla(152, 65%, 50%, .08)', borderColor: 'hsla(152, 65%, 50%, .3)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>O que acontece ao Concluir a Negociação:</h3>
              <ul style={{ paddingLeft: 20, fontSize: '.86rem', color: 'var(--muted)', lineHeight: 1.7 }}>
                <li>O veículo vendido tem seu status alterado automaticamente para <strong>Vendido</strong> no estoque.</li>
                {f.troca_modelo && <li>O veículo de troca (<strong>{f.troca_marca} {f.troca_modelo}</strong>) é cadastrado automaticamente como <strong>Disponível</strong> no estoque.</li>}
                <li>Os títulos das formas de pagamento e a comissão do vendedor são lançados automaticamente no módulo <strong>Financeiro</strong>.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="altimus-crud-footer">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.id && (
            <button type="button" className="btn btn-danger"
              onClick={() => confirm('Excluir esta negociação?') && onDelete(f.id)}>
              <Trash2 size={16} />Excluir
            </button>
          )}
          {passo > 0 && (
            <button type="button" className="btn" onClick={() => setPasso(passo - 1)}>← Passo anterior</button>
          )}
          {passo < PASSOS.length - 1 && (
            <button type="button" className="btn" onClick={() => setPasso(passo + 1)}>Próximo passo →</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
          <button type="submit" className="btn btn-primary">✓ Salvar Proposta</button>
          {f.status !== 'concluida' && (
            <button
              type="button"
              className="btn btn-success"
              onClick={() => confirm('Concluir venda agora, baixar estoque e gerar lançamentos financeiros?') && onConcluir(f)}
            >
              <CheckCircle2 size={16} />Concluir e Fechar Venda
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
