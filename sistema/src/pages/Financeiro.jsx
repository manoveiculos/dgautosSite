import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, ArrowUpCircle, ArrowDownCircle, Wallet, CheckCircle2,
  Trash2, X, Car, BarChart3, Wrench
} from 'lucide-react';
import {
  getFinanceiro, saveFinanceiro, baixarFinanceiro, deleteFinanceiro,
  getVeiculos, getClientes, brl, dataBr, CATEGORIAS_FINANCEIRO, STATUS
} from '../store';

const EMPTY_FIN = {
  tipo: 'despesa',
  categoria: 'Preparação / Estética',
  descricao: '',
  valor: '',
  vencimento: new Date().toISOString().slice(0, 10),
  pagamento_data: '',
  status: 'pendente',
  forma_pagamento: 'Pix / TED',
  conta_bancaria: 'Itaú Empresas',
  veiculo_id: '',
  cliente_id: ''
};

export default function Financeiro() {
  const [lista, setLista] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [aba, setAba] = useState('titulos'); // titulos | lucro_veiculos | dre
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [editando, setEditando] = useState(null);

  const recarregar = () => {
    getFinanceiro().then((res) => setLista(Array.isArray(res) ? res : [])).catch(() => {});
    getVeiculos().then((res) => setVeiculos(Array.isArray(res) ? res : [])).catch(() => {});
    getClientes().then((res) => setClientes(Array.isArray(res) ? res : [])).catch(() => {});
  };
  useEffect(recarregar, []);

  const filtrados = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    return arr.filter((f) => {
      if (!f) return false;
      if (filtroTipo && f.tipo !== filtroTipo) return false;
      if (filtroStatus && f.status !== filtroStatus) return false;
      return `${f.descricao || ''} ${f.categoria || ''} ${f.veic_modelo || ''} ${f.veic_placa || ''} ${f.cliente_nome || ''}`
        .toLowerCase().includes(busca.toLowerCase());
    });
  }, [lista, busca, filtroTipo, filtroStatus]);

  const resumo = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    const recPagas = arr.filter((f) => f.tipo === 'receita' && f.status === 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const despPagas = arr.filter((f) => f.tipo === 'despesa' && f.status === 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const aReceber = arr.filter((f) => f.tipo === 'receita' && f.status !== 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const aPagar = arr.filter((f) => f.tipo === 'despesa' && f.status !== 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    return { recPagas, despPagas, saldo: recPagas - despPagas, aReceber, aPagar };
  }, [lista]);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Financeiro, Custos de Pátio & DRE</h1>
          <p>Contas a pagar/receber, despesas vinculadas por veículo e lucro líquido real.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button className={`tab ${aba === 'titulos' ? 'active' : ''}`} onClick={() => setAba('titulos')}>
              <Wallet size={15} />Títulos Financeiros
            </button>
            <button className={`tab ${aba === 'lucro_veiculos' ? 'active' : ''}`} onClick={() => setAba('lucro_veiculos')}>
              <Car size={15} />Lucro & Despesas por Veículo
            </button>
            <button className={`tab ${aba === 'dre' ? 'active' : ''}`} onClick={() => setAba('dre')}>
              <BarChart3 size={15} />DRE da Loja
            </button>
          </div>
          <button id="btn-novo-lancamento" className="btn btn-primary" onClick={() => setEditando(EMPTY_FIN)}>
            <Plus size={16} />Novo lançamento
          </button>
        </div>
      </header>

      <section className="stats">
        <div className="card stat">
          <div className="stat-label"><ArrowUpCircle size={16} style={{ color: 'var(--success)' }} />Receitas Recebidas</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{brl(resumo.recPagas)}</div>
          <div className="stat-sub">A receber: {brl(resumo.aReceber)}</div>
        </div>
        <div className="card stat">
          <div className="stat-label"><ArrowDownCircle size={16} style={{ color: 'var(--danger)' }} />Despesas Pagas</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{brl(resumo.despPagas)}</div>
          <div className="stat-sub">A pagar: {brl(resumo.aPagar)}</div>
        </div>
        <div className="card stat">
          <div className="stat-label"><Wallet size={16} />Saldo de Caixa Realizado</div>
          <div className="stat-value">{brl(resumo.saldo)}</div>
          <div className="stat-sub">Fluxo líquido em conta</div>
        </div>
      </section>

      {aba === 'titulos' && (
        <>
          <div className="toolbar">
            <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder="Buscar descrição, veículo, placa, categoria…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <select className="select" style={{ maxWidth: 180 }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Receitas e Despesas</option>
              <option value="receita">Somente Receitas</option>
              <option value="despesa">Somente Despesas</option>
            </select>
            <select className="select" style={{ maxWidth: 180 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago / Recebido</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>

          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Tipo / Categoria</th>
                  <th>Descrição</th>
                  <th>Veículo Vinculado</th>
                  <th>Forma / Conta</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Baixa</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr key={f.id} onClick={() => setEditando(f)}>
                    <td>{dataBr(f.vencimento)}</td>
                    <td>
                      <span className={`badge badge-${f.tipo}`}>{f.tipo === 'receita' ? 'Receita' : 'Despesa'}</span>
                      <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 3 }}>{f.categoria}</div>
                    </td>
                    <td>
                      <strong>{f.descricao}</strong>
                      {f.cliente_nome && <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>Pessoa: {f.cliente_nome}</div>}
                    </td>
                    <td>
                      {f.veic_modelo ? `${f.veic_marca} ${f.veic_modelo} (${f.veic_placa || ''})` : 'Geral / Loja'}
                    </td>
                    <td>
                      {f.forma_pagamento}
                      <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{f.conta_bancaria}</div>
                    </td>
                    <td>
                      <strong style={{ color: f.tipo === 'receita' ? 'var(--success)' : 'var(--danger)' }}>
                        {f.tipo === 'receita' ? '+' : '-'} {brl(f.valor)}
                      </strong>
                    </td>
                    <td><span className={`badge badge-${f.status}`}>{f.status.toUpperCase()}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {f.status !== 'pago' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={async () => {
                            setLista(await baixarFinanceiro(f.id));
                          }}
                        >
                          <CheckCircle2 size={13} />Baixar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === 'lucro_veiculos' && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Status</th>
                <th>Custo Aquisição</th>
                <th>Despesas (Oficina/Estética/Doc)</th>
                <th>Custo Total Real</th>
                <th>Preço Venda</th>
                <th>Lucro Líquido Real</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {veiculos.map((v) => {
                const desp = Number(v.despesas_veiculo || 0);
                const custoTotal = Number(v.custo || 0) + desp;
                const lucroReal = Number(v.preco || 0) - custoTotal;
                return (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.marca} {v.modelo}</strong>
                      <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>{v.ano} · Placa {v.placa || '—'}</div>
                    </td>
                    <td><span className={`badge badge-${v.status}`}>{STATUS[v.status] || v.status}</span></td>
                    <td>{brl(v.custo)}</td>
                    <td style={{ color: desp > 0 ? 'var(--warning)' : 'var(--muted)' }}>{brl(desp)}</td>
                    <td><strong>{brl(custoTotal)}</strong></td>
                    <td><strong>{brl(v.preco)}</strong></td>
                    <td>
                      <strong style={{ color: lucroReal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {brl(lucroReal)}
                      </strong>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => setEditando({
                          ...EMPTY_FIN,
                          veiculo_id: v.id,
                          descricao: `Preparação / Revisão — ${v.marca} ${v.modelo} (${v.placa || ''})`
                        })}
                      >
                        <Wrench size={13} />+ Despesa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'dre' && <DrePainel lista={lista} veiculos={veiculos} />}

      {editando && (
        <FinanceiroModal
          inicial={editando}
          veiculos={veiculos}
          clientes={clientes}
          onClose={() => setEditando(null)}
          onSave={async (fin) => {
            await saveFinanceiro(fin);
            recarregar();
            setEditando(null);
          }}
          onDelete={async (id) => {
            await deleteFinanceiro(id);
            recarregar();
            setEditando(null);
          }}
        />
      )}
    </>
  );
}

function DrePainel({ lista, veiculos }) {
  const vendidos = veiculos.filter((v) => v.status === 'vendido');
  const faturamentoBruto = vendidos.reduce((s, v) => s + Number(v.preco || 0), 0);
  const cmv = vendidos.reduce((s, v) => s + Number(v.custo || 0), 0);
  const lucroBrutoVendas = faturamentoBruto - cmv;

  const porCat = (cat) => lista.filter((f) => f.tipo === 'despesa' && f.categoria === cat).reduce((s, f) => s + f.valor, 0);
  const despPrep = porCat('Preparação / Estética') + porCat('Funilaria / Mecânica') + porCat('Documentação / Transferência');
  const despComissao = porCat('Comissão');
  const despFixas = porCat('Despesa Fixa / Loja') + porCat('Impostos') + porCat('Outros');
  const resultadoLiquido = lucroBrutoVendas - despPrep - despComissao - despFixas;

  const linhas = [
    { label: '(+) Receita Bruta de Vendas de Veículos', valor: faturamentoBruto, cor: 'var(--success)', bold: true },
    { label: '(-) Custo de Aquisição dos Veículos Vendidos (CMV)', valor: -cmv, cor: 'var(--muted)' },
    { label: '(=) Margem Bruta Comercial', valor: lucroBrutoVendas, bold: true },
    { label: '(-) Despesas Operacionais de Veículos (Oficina, Estética, Documentação)', valor: -despPrep, cor: 'var(--warning)' },
    { label: '(-) Comissões sobre Vendas', valor: -despComissao, cor: 'var(--warning)' },
    { label: '(-) Despesas Fixas da Loja (Aluguel, Portais de Anúncio, Impostos)', valor: -despFixas, cor: 'var(--danger)' },
    { label: '(=) Resultado Operacional Líquido (DRE)', valor: resultadoLiquido, cor: resultadoLiquido >= 0 ? 'var(--success)' : 'var(--danger)', bold: true },
  ];

  return (
    <div className="card">
      <h3 style={{ marginBottom: 14 }}>Demonstrativo do Resultado do Exercício (DRE Simplificado)</h3>
      {linhas.map((l) => (
        <div key={l.label} className="list-row" style={{ fontWeight: l.bold ? 700 : 400, fontSize: l.bold ? '1rem' : '.92rem' }}>
          <span>{l.label}</span>
          <span style={{ color: l.cor || 'var(--text)' }}>{brl(l.valor)}</span>
        </div>
      ))}
    </div>
  );
}

function FinanceiroModal({ inicial, veiculos, clientes, onClose, onSave, onDelete }) {
  const [f, setF] = useState(inicial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="overlay" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
        <div className="modal-head">
          <h2>{f.id ? `Editar Título #${f.id}` : 'Novo Lançamento Financeiro / Despesa de Veículo'}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Tipo de Lançamento</label>
            <select className="select" value={f.tipo} onChange={set('tipo')}>
              <option value="despesa">Despesa (A Pagar)</option>
              <option value="receita">Receita (A Receber)</option>
            </select>
          </div>
          <div className="field">
            <label>Categoria</label>
            <select className="select" value={f.categoria} onChange={set('categoria')}>
              {CATEGORIAS_FINANCEIRO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select className="select" value={f.status} onChange={set('status')}>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago / Recebido</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>

          <div className="field span-2">
            <label>Descrição do Lançamento *</label>
            <input className="input" required value={f.descricao} onChange={set('descricao')} placeholder="Ex.: Polimento + higienização ou Aluguel da loja" />
          </div>
          <div className="field">
            <label>Valor (R$) *</label>
            <input className="input" type="number" step="0.01" required value={f.valor} onChange={set('valor')} />
          </div>

          <div className="field">
            <label>Data de Vencimento</label>
            <input className="input" type="date" value={f.vencimento ?? ''} onChange={set('vencimento')} />
          </div>
          <div className="field">
            <label>Forma de Pagamento</label>
            <select className="select" value={f.forma_pagamento ?? 'Pix / TED'} onChange={set('forma_pagamento')}>
              {['Pix / TED', 'Boleto', 'Financiamento', 'Cartão', 'Dinheiro', 'Cheque'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Conta Bancária / Caixa</label>
            <input className="input" value={f.conta_bancaria ?? 'Itaú Empresas'} onChange={set('conta_bancaria')} />
          </div>

          <div className="field span-2">
            <label>Vincular a um Veículo do Estoque (compõe o Custo Real do Veículo)</label>
            <select className="select" value={f.veiculo_id ?? ''} onChange={set('veiculo_id')}>
              <option value="">— Sem vínculo (Despesa / Receita geral da loja) —</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>{v.marca} {v.modelo} ({v.placa || v.ano})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cliente / Fornecedor</label>
            <select className="select" value={f.cliente_id ?? ''} onChange={set('cliente_id')}>
              <option value="">— Opcional —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="modal-actions">
          {f.id && (
            <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }}
              onClick={() => confirm('Excluir este lançamento?') && onDelete(f.id)}>
              <Trash2 size={16} />Excluir
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Salvar Lançamento</button>
        </div>
      </form>
    </div>
  );
}
