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

export default function Negociacoes({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [modo, setModo] = useState('tabela'); // SEMPRE EM LISTA POR PADRÃO
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [editando, setEditando] = useState(null);

  const recarregar = () => {
    getNegociacoes().then((res) => setLista(Array.isArray(res) ? res : [])).catch(() => {});
    getClientes().then((res) => setClientes(Array.isArray(res) ? res : [])).catch(() => {});
    getVeiculos().then((res) => setVeiculos(Array.isArray(res) ? res : [])).catch(() => {});
  };
  useEffect(recarregar, []);

  useEffect(() => {
    const novo = searchParams.get('novo');
    const tipo = searchParams.get('tipo');
    if (novo === '1' || tipo) {
      setEditando({
        ...EMPTY_NEG,
        tipo: tipo || 'venda'
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtradas = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    return arr.filter((n) => {
      if (!n) return false;
      if (filtroStatus && n.status !== filtroStatus) return false;
      return `${n.cliente_nome || ''} ${n.veic_marca || ''} ${n.veic_modelo || ''} ${n.veic_placa || ''} ${n.troca_modelo || ''}`
        .toLowerCase().includes(busca.toLowerCase());
    });
  }, [lista, busca, filtroStatus]);

  const totais = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    const concluidas = arr.filter((n) => n?.status === 'concluida');
    const emAndamento = arr.filter((n) => ['aberta', 'conferencia'].includes(n?.status));
    return {
      fechadasQtd: concluidas.length,
      fechadasValor: concluidas.reduce((s, n) => s + (Number(n.valor_veiculo || 0) - Number(n.desconto || 0)), 0),
      abertasQtd: emAndamento.length,
      abertasValor: emAndamento.reduce((s, n) => s + (Number(n.valor_veiculo || 0) - Number(n.desconto || 0)), 0),
    };
  }, [lista]);

  if (editando) {
    return (
      <NegociacaoWizardModal
        inicial={editando}
        clientes={clientes}
        veiculos={veiculos}
        user={user}
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
        onCancelarNegociacao={async (neg, motivo) => {
          if (user?.perfil !== 'admin') {
            alert('Ação proibida: Apenas administradores podem cancelar contratos e negociações.');
            return;
          }
          await saveNegociacao({
            ...neg,
            status: 'cancelada',
            observacoes: `${neg.observacoes || ''}\n[CONTRATO CANCELADO POR ADMIN em ${new Date().toLocaleString('pt-BR')} - Motivo: ${motivo}]`.trim()
          });
          recarregar();
          setEditando(null);
          alert('Negociação/Contrato cancelado com sucesso. Histórico preservado.');
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
          <h1>Contratos, Vendas & Trocas</h1>
          <p>Apresentação em Lista · Gestão guiada por Etapas: Operação → Veículos → Pagamento → Contratos → Conclusão.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button className={`tab ${modo === 'tabela' ? 'active' : ''}`} onClick={() => setModo('tabela')}>
              <List size={15} />Lista Detalhada
            </button>
            <button className={`tab ${modo === 'cards' ? 'active' : ''}`} onClick={() => setModo('cards')}>
              <LayoutGrid size={15} />Cards
            </button>
          </div>
          <button id="btn-nova-negociacao" className="btn btn-primary" onClick={() => setEditando(EMPTY_NEG)}>
            <Plus size={16} />Nova Negociação / Contrato
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

function NegociacaoWizardModal({ inicial, clientes, veiculos, onClose, onSave, onConcluir, onCancelarNegociacao, onContrato, user }) {
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
          <button type="button" className="btn" onClick={onClose}>← Voltar para Lista</button>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {f.id ? `Contrato / Negociação #${f.id}` : 'Nova Negociação & Contrato'}
          </h2>
          <span className={`badge badge-${f.status}`}>{STATUS_NEG[f.status] || f.status}</span>
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

        {/* PASSO 1: OPERAÇÃO & CLIENTE */}
        {passo === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 10 }}>
                1. Selecione a Operação Comercial *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                {[
                  { id: 'venda', titulo: '🚗 Venda de Veículo', desc: 'Venda direta do estoque com pagamento à vista ou financiado.' },
                  { id: 'troca', titulo: '🔄 Venda com Troca', desc: 'Venda de veículo com entrada de usado abatendo o saldo.' },
                  { id: 'compra', titulo: '📥 Compra para Estoque', desc: 'Contrato de aquisição de veículo para entrada na loja.' },
                  { id: 'consignacao', titulo: '📋 Entrada por Consignação', desc: 'Contrato de consignação e guarda de veículo terceiro.' },
                ].map((op) => {
                  const sel = f.tipo === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      className="card"
                      style={{
                        padding: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: 10,
                        border: sel ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: sel ? 'hsla(217, 91%, 60%, .08)' : '#ffffff',
                        transition: 'all .15s ease'
                      }}
                      onClick={() => setF({ ...f, tipo: op.id })}
                    >
                      <strong style={{ fontSize: '.95rem', display: 'block', color: sel ? 'var(--primary)' : 'var(--text)' }}>
                        {op.titulo}
                      </strong>
                      <span style={{ fontSize: '.78rem', color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                        {op.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-grid">
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
              <div className="field">
                <label>Canal de Venda / Origem</label>
                <select className="select" value={f.canal_venda ?? 'LOJA'} onChange={set('canal_venda')}>
                  {['LOJA', 'OLX', 'WEBMOTORS', 'WHATSAPP', 'INSTAGRAM', 'CHAVES_NA_MAO', 'ICARROS', 'SITE_PROPRIO'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field span-3">
                <label>Cliente / Interessado *</label>
                <select className="select" required value={f.cliente_id ?? ''} onChange={set('cliente_id')}>
                  <option value="">— Selecione o cliente ou fornecedor —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome} — {c.cpf_cnpj || c.telefone || c.cidade}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* PASSO 2: VEÍCULO & TROCA / ENTRADA */}
        {passo === 1 && (
          <div className="form-grid">
            {['venda', 'troca'].includes(f.tipo) ? (
              <>
                <div className="field span-3">
                  <label>Veículo Vendido (Estoque da Loja) *</label>
                  <select className="select" value={f.veiculo_id ?? ''} onChange={selecionarVeiculo}>
                    <option value="">— Selecione o veículo em estoque —</option>
                    {veiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.marca} {v.modelo} ({v.ano}) — Placa {v.placa || '—'} — Preço: {brl(v.preco)} [{STATUS[v.status] || v.status}]
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
                  <label>Valor Líquido Fechado</label>
                  <input className="input" disabled value={brl(valorLiquido)} style={{ fontWeight: 700 }} />
                </div>

                {f.tipo === 'troca' && (
                  <div className="span-3" style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h3 style={{ fontSize: '.98rem', fontWeight: 700 }}>Veículo de Entrada (Dado na Troca)</h3>
                      <button type="button" className="btn btn-sm" onClick={sincronizarTrocaNoPagamento}>
                        <RefreshCw size={13} />Lançar valor da troca no Financeiro
                      </button>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Marca (Troca)</label>
                        <input className="input" value={f.troca_marca ?? ''} onChange={set('troca_marca')} placeholder="Ex: Honda" />
                      </div>
                      <div className="field span-2">
                        <label>Modelo / Versão (Troca)</label>
                        <input className="input" value={f.troca_modelo ?? ''} onChange={set('troca_modelo')} placeholder="Ex: Civic LXR 2.0 Flex Aut." />
                      </div>
                      <div className="field">
                        <label>Ano (Troca)</label>
                        <input className="input" value={f.troca_ano ?? ''} onChange={set('troca_ano')} placeholder="2016/2017" />
                      </div>
                      <div className="field">
                        <label>Placa (Troca)</label>
                        <input className="input" value={f.troca_placa ?? ''} onChange={set('troca_placa')} style={{ textTransform: 'uppercase' }} />
                      </div>
                      <div className="field">
                        <label>KM Hodômetro (Troca) *</label>
                        <input className="input" type="number" value={f.troca_km ?? 0} onChange={set('troca_km')} placeholder="Hodômetro conferido" />
                      </div>
                      <div className="field span-2">
                        <label>Valor Avaliado na Troca (R$)</label>
                        <input className="input" type="number" value={f.troca_valor ?? 0} onChange={set('troca_valor')} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* OPERAÇÃO DE COMPRA OU CONSIGNAÇÃO */
              <div className="span-3" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card" style={{ background: 'var(--color-neutral-80)', padding: 16 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 12 }}>
                    {f.tipo === 'compra' ? 'Dados do Veículo Adquirido para o Estoque' : 'Dados do Veículo Consignado'}
                  </h3>
                  <div className="form-grid">
                    <div className="field">
                      <label>Marca do Veículo *</label>
                      <input className="input" required value={f.troca_marca ?? ''} onChange={set('troca_marca')} placeholder="Ex: Toyota" />
                    </div>
                    <div className="field span-2">
                      <label>Modelo / Versão *</label>
                      <input className="input" required value={f.troca_modelo ?? ''} onChange={set('troca_modelo')} placeholder="Ex: Corolla XEi 2.0 Aut." />
                    </div>
                    <div className="field">
                      <label>Ano Fabricação/Modelo</label>
                      <input className="input" value={f.troca_ano ?? '2023/2024'} onChange={set('troca_ano')} />
                    </div>
                    <div className="field">
                      <label>Placa *</label>
                      <input className="input" style={{ textTransform: 'uppercase', fontWeight: 700 }} value={f.troca_placa ?? ''} onChange={set('troca_placa')} placeholder="ABC1D23" />
                    </div>
                    <div className="field">
                      <label>KM Hodômetro Atual *</label>
                      <input className="input" type="number" value={f.troca_km ?? 0} onChange={set('troca_km')} />
                    </div>
                    <div className="field span-2">
                      <label>Valor de {f.tipo === 'compra' ? 'Compra (R$)' : 'Avaliação (R$)'} *</label>
                      <input className="input" type="number" value={f.valor_veiculo ?? f.troca_valor ?? 0} onChange={(e) => setF({ ...f, valor_veiculo: Number(e.target.value), troca_valor: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>
            )}
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

        {/* PASSO 4: MODELOS DE CONTRATOS OFICIAIS */}
        {passo === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ background: 'var(--color-neutral-80)', padding: 18 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 8 }}>
                Contratos Oficiais da DG Automóveis Pré-Configurados
              </h3>
              <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: 14 }}>
                Selecione o modelo desejado para emitir o contrato oficial preenchido com as cláusulas jurídicas configuradas:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <div className="card" style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '.92rem', display: 'block', color: 'var(--primary)' }}>
                    Modelo 1: Venda Padrão com LGPD (10 Cláusulas)
                  </strong>
                  <span style={{ fontSize: '.78rem', color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                    Transferência 30 dias, comunicação de venda, LGPD e foro da comarca.
                  </span>
                  {f.id && (
                    <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={() => onContrato(f.id)}>
                      <FileText size={13} /> Emitir Modelo 1
                    </button>
                  )}
                </div>

                <div className="card" style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '.92rem', display: 'block', color: 'var(--primary)' }}>
                    Modelo 2: Venda com Desconto / Isenção (11 Cláusulas)
                  </strong>
                  <span style={{ fontSize: '.78rem', color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                    Hodômetro conferido, isenção de vícios por desconto, correia dentada e multa 20%.
                  </span>
                  {f.id && (
                    <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={() => onContrato(f.id)}>
                      <FileText size={13} /> Emitir Modelo 2
                    </button>
                  )}
                </div>

                <div className="card" style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '.92rem', display: 'block', color: 'var(--primary)' }}>
                    Modelo 3: Venda Completa CDC (18 Cláusulas)
                  </strong>
                  <span style={{ fontSize: '.78rem', color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                    Vistoria prévia, garantia CDC 90 dias / 5.000 km, correia dentada e Lei 13.111.
                  </span>
                  {f.id && (
                    <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={() => onContrato(f.id)}>
                      <FileText size={13} /> Emitir Modelo 3
                    </button>
                  )}
                </div>

                <div className="card" style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '.92rem', display: 'block', color: '#059669' }}>
                    Modelo 4: Compra para Estoque (9 Cláusulas)
                  </strong>
                  <span style={{ fontSize: '.78rem', color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                    Aquisição para o estoque da loja, quitação, procedência e garantia.
                  </span>
                  {f.id && (
                    <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={() => onContrato(f.id)}>
                      <FileText size={13} /> Emitir Modelo 4
                    </button>
                  )}
                </div>

                <div className="card" style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '.92rem', display: 'block', color: '#d97706' }}>
                    Modelo 5: Consignação com Serviços (8 Cláusulas)
                  </strong>
                  <span style={{ fontSize: '.78rem', color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                    Prazo de 60 dias, tabela de serviços/despesas de preparação e repasse líquido.
                  </span>
                  {f.id && (
                    <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={() => onContrato(f.id)}>
                      <FileText size={13} /> Emitir Modelo 5
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="field">
              <label>Cláusulas Adicionais / Observações da Negociação e Entrega</label>
              <textarea
                className="input"
                rows={3}
                value={f.observacoes ?? ''}
                onChange={set('observacoes')}
                placeholder="Ex.: Entrega mediante quitação do gravame e laudo cautelar aprovado..."
              />
            </div>
          </div>
        )}

        {/* PASSO 5: CONFERÊNCIA & FECHAMENTO */}
        {passo === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="stats" style={{ marginBottom: 4 }}>
              <div className="card stat">
                <div className="stat-label">Valor Total da Operação</div>
                <div className="stat-value">{brl(valorLiquido)}</div>
                <div className="stat-sub">Operação: {f.tipo.toUpperCase()}</div>
              </div>
              <div className="card stat">
                <div className="stat-label">Comissão do Vendedor</div>
                <div className="stat-value">{brl(f.comissao_vendedor)}</div>
                <div className="stat-sub">Status: {STATUS_NEG[f.status] || f.status}</div>
              </div>
            </div>

            <div className="card" style={{ background: 'hsla(152, 65%, 50%, .08)', borderColor: 'hsla(152, 65%, 50%, .3)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>O que acontece ao Concluir a Negociação:</h3>
              <ul style={{ paddingLeft: 20, fontSize: '.86rem', color: 'var(--muted)', lineHeight: 1.7 }}>
                {['venda', 'troca'].includes(f.tipo) && <li>O veículo vendido tem seu status alterado para <strong>Vendido</strong> no estoque.</li>}
                {f.tipo === 'compra' && <li>O veículo adquirido entra como <strong>Disponível</strong> no estoque da DG Automóveis.</li>}
                {f.tipo === 'consignacao' && <li>O veículo entra no estoque como <strong>Terceiro (Consignado)</strong>.</li>}
                {f.troca_modelo && <li>O veículo de troca entra automaticamente no estoque como <strong>Disponível</strong>.</li>}
                <li>Os títulos financeiros e a comissão do vendedor são lançados no <strong>Financeiro</strong>.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="altimus-crud-footer">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.id && f.status !== 'cancelada' && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (user?.perfil !== 'admin') {
                  alert('Ação bloqueada: Por compliance legal, a exclusão de contratos é estritamente proibida. Somente Administradores podem cancelar uma negociação/contrato.');
                  return;
                }
                const motivo = prompt(`Informe o motivo do cancelamento formal deste contrato #${f.id}:`);
                if (!motivo) return;
                onCancelarNegociacao(f, motivo);
              }}
            >
              <Trash2 size={16} /> Cancelar Contrato (Apenas Admin)
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
