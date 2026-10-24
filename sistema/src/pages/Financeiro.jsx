import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, ArrowUpCircle, ArrowDownCircle, Wallet, CheckCircle2,
  Trash2, X, Car, BarChart3, Wrench, Users, Download, Printer, DollarSign,
  TrendingUp, Calendar, AlertCircle
} from 'lucide-react';
import {
  getFinanceiro, saveFinanceiro, baixarFinanceiro, deleteFinanceiro, pagarComissao,
  getVeiculos, getClientes, getNegociacoes, getUsuarios,
  brl, dataBr, CATEGORIAS_FINANCEIRO, STATUS
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
  cliente_id: '',
  negociacao_id: ''
};

export default function Financeiro({ user }) {
  const [lista, setLista] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [negociacoes, setNegociacoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [aba, setAba] = useState('titulos'); // titulos | comissoes | lucro_veiculos | dre
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroPeriodoDre, setFiltroPeriodoDre] = useState('mes_atual');
  const [editando, setEditando] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');

  const recarregar = async () => {
    try {
      setLoadingMsg('Carregando dados financeiros e comissões...');
      const [resFin, resVeic, resCli, resNegs, resUs] = await Promise.all([
        getFinanceiro(),
        getVeiculos(),
        getClientes(),
        getNegociacoes(),
        getUsuarios()
      ]);
      setLista(Array.isArray(resFin) ? resFin : []);
      setVeiculos(Array.isArray(resVeic) ? resVeic : []);
      setClientes(Array.isArray(resCli) ? resCli : []);
      setNegociacoes(Array.isArray(resNegs) ? resNegs : []);
      setUsuarios(Array.isArray(resUs) ? resUs : []);
    } catch (e) {
      console.warn('Erro ao carregar financeiro:', e);
    } finally {
      setLoadingMsg('');
    }
  };

  useEffect(() => {
    recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    return arr.filter((f) => {
      if (!f) return false;
      if (filtroTipo && f.tipo !== filtroTipo) return false;
      if (filtroStatus && f.status !== filtroStatus) return false;
      const termo = `${f.descricao || ''} ${f.categoria || ''} ${f.veic_modelo || ''} ${f.veic_placa || ''} ${f.cliente_nome || ''}`.toLowerCase();
      return termo.includes(busca.toLowerCase());
    });
  }, [lista, busca, filtroTipo, filtroStatus]);

  const resumoGeral = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    const recPagas = arr.filter((f) => f.tipo === 'receita' && f.status === 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const despPagas = arr.filter((f) => f.tipo === 'despesa' && f.status === 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const aReceber = arr.filter((f) => f.tipo === 'receita' && f.status !== 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const aPagar = arr.filter((f) => f.tipo === 'despesa' && f.status !== 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    return { recPagas, despPagas, saldo: recPagas - despPagas, aReceber, aPagar };
  }, [lista]);

  // RELATÓRIO DE COMISSÕES DE VENDEDORES
  const relatorioComissoes = useMemo(() => {
    const comissoesPagasNoFin = lista.filter((f) => f.tipo === 'despesa' && f.categoria === 'Comissão' && f.status === 'pago');
    const negsValidas = negociacoes.filter((n) => n.status !== 'cancelada');

    return negsValidas.map((n) => {
      const veic = veiculos.find((v) => v.id === n.veiculo_id) || {};
      const cli = clientes.find((c) => c.id === n.cliente_id) || {};
      const despVeic = Number(veic.despesas_veiculo || 0);
      const custoTotalLoja = Number(veic.custo || 0) + despVeic;
      const valorVenda = Number(n.valor_veiculo || veic.preco || 0);
      const lucroBrutoCarro = valorVenda - custoTotalLoja;

      // Se comissao_vendedor já estiver preenchida no contrato, usa ela; senão calcula 10% sobre o lucro ou R$ 800 padrão
      let comissao = Number(n.comissao_vendedor || 0);
      if (comissao === 0 && lucroBrutoCarro > 0) {
        comissao = Math.round(lucroBrutoCarro * 0.10); // 10% sobre o lucro
      }

      // Verifica se já existe despesa de comissão vinculada paga
      const jaPaga = comissoesPagasNoFin.some((f) => Number(f.negociacao_id) === Number(n.id) || f.descricao?.includes(`Venda #${n.id}`));

      // Vendedor: prioriza nome do vendedor_id, depois nome no CRM ou usuário
      const vendObj = usuarios.find((u) => u.id === n.vendedor_id);
      const vendedorNome = vendObj?.nome || n.vendedor_nome || n.responsavel || 'Equipe DG Autos';

      return {
        negociacao_id: n.id,
        data: n.data_negociacao || n.criado_em?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        vendedor_nome: vendedorNome,
        veiculo_desc: `${n.veic_marca || veic.marca || ''} ${n.veic_modelo || veic.modelo || ''} (${n.veic_placa || veic.placa || 'Sem placa'})`.trim(),
        cliente_nome: n.cliente_nome || cli.nome || 'Cliente não identificado',
        valor_venda: valorVenda,
        custo_loja: custoTotalLoja,
        lucro_bruto: lucroBrutoCarro,
        comissao_valor: comissao,
        status_comissao: jaPaga ? 'pago' : 'pendente',
        negociacao_status: n.status
      };
    });
  }, [negociacoes, veiculos, clientes, usuarios, lista]);

  const comissoesFiltradas = useMemo(() => {
    return relatorioComissoes.filter((c) => {
      if (filtroVendedor && c.vendedor_nome !== filtroVendedor) return false;
      if (busca) {
        const termo = `${c.vendedor_nome} ${c.veiculo_desc} ${c.cliente_nome} #${c.negociacao_id}`.toLowerCase();
        if (!termo.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [relatorioComissoes, filtroVendedor, busca]);

  const resumoComissoes = useMemo(() => {
    const totalGerado = comissoesFiltradas.reduce((s, c) => s + c.comissao_valor, 0);
    const totalPago = comissoesFiltradas.filter((c) => c.status_comissao === 'pago').reduce((s, c) => s + c.comissao_valor, 0);
    const saldoPendente = totalGerado - totalPago;
    const totalVendas = comissoesFiltradas.length;
    return { totalGerado, totalPago, saldoPendente, totalVendas };
  }, [comissoesFiltradas]);

  const handlePagarComissao = async (item) => {
    if (!confirm(`Confirmar o pagamento de comissão de ${brl(item.comissao_valor)} para ${item.vendedor_nome} (Venda #${item.negociacao_id})?`)) {
      return;
    }
    try {
      setLoadingMsg('Registrando pagamento da comissão no financeiro...');
      await pagarComissao({
        negociacao_id: item.negociacao_id,
        valor: item.comissao_valor,
        vendedor_nome: item.vendedor_nome,
        veiculo_desc: item.veiculo_desc
      });
      await recarregar();
      alert('✓ Comissão paga com sucesso! Lançamento de despesa registrado no caixa.');
    } catch (e) {
      alert('Erro ao pagar comissão: ' + e.message);
    } finally {
      setLoadingMsg('');
    }
  };

  const exportarCsv = (nomeArquivo, cabecalho, linhas) => {
    const conteudo = `\uFEFF${cabecalho}\n${linhas.join('\n')}`;
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${nomeArquivo}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {loadingMsg && (
        <div className="loading-toast" style={{ position: 'fixed', bottom: 20, right: 20, background: '#1e293b', color: '#fff', padding: '12px 20px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <div className="spinner-sm" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }}></div>
          <span>{loadingMsg}</span>
        </div>
      )}

      <header className="topbar">
        <div>
          <h1>Financeiro, Comissões de Vendedores & DRE</h1>
          <p>Controle financeiro integrado: contas a pagar/receber, conciliação por carro, comissões de equipe e DRE gerencial.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button className={`tab ${aba === 'titulos' ? 'active' : ''}`} onClick={() => setAba('titulos')}>
              <Wallet size={15} />Títulos Financeiros
            </button>
            <button className={`tab ${aba === 'comissoes' ? 'active' : ''}`} onClick={() => setAba('comissoes')}>
              <Users size={15} />Comissões de Vendedores
            </button>
            <button className={`tab ${aba === 'lucro_veiculos' ? 'active' : ''}`} onClick={() => setAba('lucro_veiculos')}>
              <Car size={15} />Lucro Real por Veículo
            </button>
            <button className={`tab ${aba === 'dre' ? 'active' : ''}`} onClick={() => setAba('dre')}>
              <BarChart3 size={15} />DRE da Loja
            </button>
          </div>
          <button id="btn-novo-lancamento" className="btn btn-primary" onClick={() => setEditando(EMPTY_FIN)}>
            <Plus size={16} />Novo Lançamento
          </button>
        </div>
      </header>

      {/* CARDS RESUMO DO TOPO */}
      {aba !== 'comissoes' ? (
        <section className="stats">
          <div className="card stat">
            <div className="stat-label"><ArrowUpCircle size={16} style={{ color: 'var(--success)' }} />Receitas Recebidas</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{brl(resumoGeral.recPagas)}</div>
            <div className="stat-sub">A receber: {brl(resumoGeral.aReceber)}</div>
          </div>
          <div className="card stat">
            <div className="stat-label"><ArrowDownCircle size={16} style={{ color: 'var(--danger)' }} />Despesas Pagas</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{brl(resumoGeral.despPagas)}</div>
            <div className="stat-sub">A pagar: {brl(resumoGeral.aPagar)}</div>
          </div>
          <div className="card stat">
            <div className="stat-label"><Wallet size={16} />Saldo de Caixa Realizado</div>
            <div className="stat-value" style={{ color: resumoGeral.saldo >= 0 ? 'var(--text)' : 'var(--danger)' }}>{brl(resumoGeral.saldo)}</div>
            <div className="stat-sub">Fluxo líquido em conta</div>
          </div>
        </section>
      ) : (
        <section className="stats">
          <div className="card stat">
            <div className="stat-label"><DollarSign size={16} style={{ color: 'var(--primary)' }} />Comissões Geradas</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{brl(resumoComissoes.totalGerado)}</div>
            <div className="stat-sub">{resumoComissoes.totalVendas} vendas computadas</div>
          </div>
          <div className="card stat">
            <div className="stat-label"><CheckCircle2 size={16} style={{ color: 'var(--success)' }} />Comissões Já Pagas</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{brl(resumoComissoes.totalPago)}</div>
            <div className="stat-sub">Baixadas no caixa da loja</div>
          </div>
          <div className="card stat">
            <div className="stat-label"><AlertCircle size={16} style={{ color: 'var(--warning)' }} />Saldo a Pagar</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{brl(resumoComissoes.saldoPendente)}</div>
            <div className="stat-sub">Pendente para a equipe</div>
          </div>
        </section>
      )}

      {/* ABA 1: TÍTULOS FINANCEIROS */}
      {aba === 'titulos' && (
        <>
          <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
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
            <button
              className="btn"
              onClick={() => {
                const cab = 'Vencimento;Tipo;Categoria;Descricao;Veiculo;Valor;Status;FormaPagamento;Conta';
                const lins = filtrados.map((f) =>
                  `"${f.vencimento}";"${f.tipo}";"${f.categoria}";"${f.descricao}";"${f.veic_modelo || ''} ${f.veic_placa || ''}";"${f.valor}";"${f.status}";"${f.forma_pagamento || ''}";"${f.conta_bancaria || ''}"`
                );
                exportarCsv('titulos_financeiros', cab, lins);
              }}
              title="Exportar planilha CSV"
            >
              <Download size={15} />Exportar CSV
            </button>
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
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
                      Nenhum título encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((f) => (
                    <tr key={f.id} onClick={() => setEditando(f)} style={{ cursor: 'pointer' }}>
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
                        {f.status !== 'pago' ? (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={async () => {
                              try {
                                setLoadingMsg('Dando baixa no título...');
                                setLista(await baixarFinanceiro(f.id));
                              } finally {
                                setLoadingMsg('');
                              }
                            }}
                          >
                            <CheckCircle2 size={13} />Baixar
                          </button>
                        ) : (
                          <span style={{ fontSize: '.76rem', color: 'var(--success)', fontWeight: 600 }}>Pago</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ABA 2: COMISSÕES DE VENDEDORES (ESPECIFICAÇÃO ALTIMUS) */}
      {aba === 'comissoes' && (
        <>
          <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder="Buscar vendedor, veículo, cliente, contrato..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <select className="select" style={{ maxWidth: 220 }} value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}>
              <option value="">Todos os Vendedores</option>
              {usuarios.map((u) => <option key={u.id} value={u.nome}>{u.nome}</option>)}
            </select>
            <button
              className="btn"
              onClick={() => {
                const cab = 'Data;NegociacaoId;Vendedor;Veiculo;Cliente;ValorVenda;CustoLoja;LucroBruto;Comissao;Status';
                const lins = comissoesFiltradas.map((c) =>
                  `"${c.data}";"${c.negociacao_id}";"${c.vendedor_nome}";"${c.veiculo_desc}";"${c.cliente_nome}";"${c.valor_venda}";"${c.custo_loja}";"${c.lucro_bruto}";"${c.comissao_valor}";"${c.status_comissao}"`
                );
                exportarCsv('comissoes_vendedores', cab, lins);
              }}
              title="Exportar relatório de comissões em CSV"
            >
              <Download size={15} />Exportar Comissões CSV
            </button>
          </div>

          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Negociação #</th>
                  <th>Vendedor</th>
                  <th>Veículo Negociado</th>
                  <th>Cliente</th>
                  <th>Valor Venda</th>
                  <th>Custo Loja</th>
                  <th>Lucro do Veículo</th>
                  <th>Comissão</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {comissoesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
                      Nenhuma venda / comissão encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  comissoesFiltradas.map((c, idx) => (
                    <tr key={idx}>
                      <td>{dataBr(c.data)}</td>
                      <td><strong>#{c.negociacao_id}</strong></td>
                      <td>
                        <strong>{c.vendedor_nome}</strong>
                      </td>
                      <td>{c.veiculo_desc || '—'}</td>
                      <td>{c.cliente_nome}</td>
                      <td><strong>{brl(c.valor_venda)}</strong></td>
                      <td style={{ color: 'var(--muted)' }}>{brl(c.custo_loja)}</td>
                      <td>
                        <strong style={{ color: c.lucro_bruto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {brl(c.lucro_bruto)}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--primary)', fontSize: '.94rem' }}>
                          {brl(c.comissao_valor)}
                        </strong>
                      </td>
                      <td>
                        <span className={`badge ${c.status_comissao === 'pago' ? 'badge-success' : 'badge-warning'}`}>
                          {c.status_comissao === 'pago' ? '✓ Paga' : '⏳ Pendente'}
                        </span>
                      </td>
                      <td>
                        {c.status_comissao !== 'pago' ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handlePagarComissao(c)}
                            title="Lançar pagamento no caixa da loja"
                          >
                            <DollarSign size={13} />Pagar
                          </button>
                        ) : (
                          <span style={{ fontSize: '.76rem', color: 'var(--success)', fontWeight: 600 }}>Quitada</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ABA 3: LUCRO LÍQUIDO REAL POR VEÍCULO */}
      {aba === 'lucro_veiculos' && (
        <>
          <div className="toolbar" style={{ justifyContent: 'space-between' }}>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.84rem' }}>
              Cálculo analítico do Lucro Líquido Real por unidade: <strong>Preço Venda - Custo Entrada - Despesas Oficina/Doc - Comissão Vendedor</strong>.
            </p>
            <button
              className="btn btn-sm"
              onClick={() => {
                const cab = 'Veiculo;Placa;Ano;Status;CustoEntrada;DespesasOficina;CustoTotalLoja;PrecoVenda;LucroLiquidoReal;MargemPercentual';
                const lins = veiculos.map((v) => {
                  const desp = Number(v.despesas_veiculo || 0);
                  const custoTotal = Number(v.custo || 0) + desp;
                  const lucro = Number(v.preco || 0) - custoTotal;
                  const perc = custoTotal > 0 ? ((lucro / custoTotal) * 100).toFixed(1) : 0;
                  return `"${v.marca} ${v.modelo}";"${v.placa || ''}";"${v.ano}";"${v.status}";"${v.custo}";"${desp}";"${custoTotal}";"${v.preco}";"${lucro}";"${perc}%"`;
                });
                exportarCsv('lucro_veiculos', cab, lins);
              }}
            >
              <Download size={14} />Exportar Relatório
            </button>
          </div>

          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Status</th>
                  <th>Custo Aquisição</th>
                  <th>Despesas Oficina/Doc</th>
                  <th>Custo Total Loja</th>
                  <th>Preço Venda</th>
                  <th>Lucro Líquido Real</th>
                  <th>Margem %</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {veiculos.map((v) => {
                  const desp = Number(v.despesas_veiculo || 0);
                  const custoTotal = Number(v.custo || 0) + desp;
                  const lucroReal = Number(v.preco || 0) - custoTotal;
                  const percMargem = custoTotal > 0 ? ((lucroReal / custoTotal) * 100).toFixed(1) : 0;
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
                        <span style={{ fontWeight: 700, color: lucroReal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {percMargem}%
                        </span>
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
        </>
      )}

      {/* ABA 4: DRE GERENCIAL DA LOJA */}
      {aba === 'dre' && (
        <DrePainel
          lista={lista}
          veiculos={veiculos}
          negociacoes={negociacoes}
          filtroPeriodo={filtroPeriodoDre}
          setFiltroPeriodo={setFiltroPeriodoDre}
        />
      )}

      {editando && (
        <FinanceiroModal
          inicial={editando}
          veiculos={veiculos}
          clientes={clientes}
          onClose={() => setEditando(null)}
          onSave={async (fin) => {
            try {
              setLoadingMsg('Salvando lançamento financeiro...');
              await saveFinanceiro(fin);
              await recarregar();
              setEditando(null);
            } catch (err) {
              alert('Erro ao salvar lançamento: ' + err.message);
            } finally {
              setLoadingMsg('');
            }
          }}
          onDelete={async (id) => {
            try {
              setLoadingMsg('Excluindo lançamento...');
              await deleteFinanceiro(id);
              await recarregar();
              setEditando(null);
            } catch (err) {
              alert('Erro ao excluir: ' + err.message);
            } finally {
              setLoadingMsg('');
            }
          }}
        />
      )}
    </>
  );
}

function DrePainel({ lista, veiculos, negociacoes, filtroPeriodo, setFiltroPeriodo }) {
  const vendidos = veiculos.filter((v) => v.status === 'vendido');
  const negsConcluidas = negociacoes.filter((n) => n.status === 'concluida');

  // Faturamento bruto
  const faturamentoVendas = negsConcluidas.length > 0
    ? negsConcluidas.reduce((s, n) => s + Number(n.valor_veiculo || 0), 0)
    : vendidos.reduce((s, v) => s + Number(v.preco || 0), 0);

  // CMV (Custo das mercadorias vendidas)
  const cmv = vendidos.reduce((s, v) => s + Number(v.custo || 0), 0);
  const lucroBrutoVendas = faturamentoVendas - cmv;

  const porCat = (cat) => lista.filter((f) => f.tipo === 'despesa' && f.categoria === cat).reduce((s, f) => s + Number(f.valor || 0), 0);
  const despPrep = porCat('Preparação / Estética') + porCat('Funilaria / Mecânica') + porCat('Documentação / Transferência');
  const despComissao = porCat('Comissão') || negsConcluidas.reduce((s, n) => s + Number(n.comissao_vendedor || 0), 0);
  const despFixas = porCat('Despesa Fixa / Loja') + porCat('Impostos') + porCat('Outros');
  const totalDespesasOperacionais = despPrep + despComissao + despFixas;
  const resultadoLiquido = lucroBrutoVendas - totalDespesasOperacionais;
  const margemLiquidaPerc = faturamentoVendas > 0 ? ((resultadoLiquido / faturamentoVendas) * 100).toFixed(1) : 0;

  const linhas = [
    { label: '(+) Receita Bruta de Vendas de Veículos', valor: faturamentoVendas, cor: 'var(--success)', bold: true },
    { label: '(-) Custo de Aquisição dos Veículos Vendidos (CMV)', valor: -cmv, cor: 'var(--muted)' },
    { label: '(=) Margem Bruta Comercial', valor: lucroBrutoVendas, bold: true },
    { label: '(-) Despesas Diretas com Veículos (Oficina, Mecânica, Estética, Documentação)', valor: -despPrep, cor: 'var(--warning)' },
    { label: '(-) Comissões de Vendas Pagas e Devidas aos Vendedores', valor: -despComissao, cor: 'var(--warning)' },
    { label: '(-) Despesas Fixas e Administrativas (Aluguel, Luz, Portais Webmotors/OLX, Sistemas)', valor: -despFixas, cor: 'var(--danger)' },
    { label: '(=) Resultado Operacional Líquido (DRE da Loja)', valor: resultadoLiquido, cor: resultadoLiquido >= 0 ? 'var(--success)' : 'var(--danger)', bold: true },
  ];

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Demonstrativo do Resultado do Exercício (DRE Gerencial Altimus)</h2>
          <small style={{ color: 'var(--muted)' }}>Estrutura gerencial padrão para apuração do lucro real da revenda de veículos.</small>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="select" style={{ maxWidth: 180 }} value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
            <option value="mes_atual">Mês Atual</option>
            <option value="mes_anterior">Mês Anterior</option>
            <option value="ano_atual">Ano Todo (2026)</option>
          </select>
          <button className="btn" onClick={() => window.print()} title="Imprimir DRE">
            <Printer size={15} />Imprimir DRE
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="card stat" style={{ background: 'var(--color-neutral-80)' }}>
          <div className="stat-label">Margem Líquida %</div>
          <div className="stat-value" style={{ color: resultadoLiquido >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {margemLiquidaPerc}%
          </div>
          <div className="stat-sub">Sobre o faturamento bruto</div>
        </div>
        <div className="card stat" style={{ background: 'var(--color-neutral-80)' }}>
          <div className="stat-label">Veículos Vendidos</div>
          <div className="stat-value">{vendidos.length || negsConcluidas.length}</div>
          <div className="stat-sub">Carros entregues no período</div>
        </div>
        <div className="card stat" style={{ background: 'var(--color-neutral-80)' }}>
          <div className="stat-label">Ticket Médio de Venda</div>
          <div className="stat-value">
            {brl((vendidos.length || negsConcluidas.length) > 0 ? faturamentoVendas / (vendidos.length || negsConcluidas.length) : 0)}
          </div>
          <div className="stat-sub">Preço médio por veículo</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {linhas.map((l, i) => (
          <div
            key={l.label}
            className="list-row"
            style={{
              padding: '12px 16px',
              background: l.bold ? '#f8fafc' : '#ffffff',
              borderBottom: '1px solid var(--border)',
              fontWeight: l.bold ? 700 : 400,
              fontSize: l.bold ? '1rem' : '.92rem'
            }}
          >
            <span>{l.label}</span>
            <span style={{ color: l.cor || 'var(--text)', fontSize: l.bold ? '1.05rem' : '.95rem' }}>
              {brl(l.valor)}
            </span>
          </div>
        ))}
      </div>
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

        <div className="modal-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
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
