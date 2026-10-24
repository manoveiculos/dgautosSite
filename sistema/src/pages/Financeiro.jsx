import { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Filter, Calendar, CheckCircle2, Trash2, X, ChevronDown,
  ArrowUpCircle, ArrowDownCircle, Wallet, Car, BarChart3, Users, Download,
  Printer, DollarSign, AlertCircle, ChevronRight, Bookmark, UserPlus
} from 'lucide-react';
import {
  getFinanceiro, saveFinanceiro, baixarFinanceiro, deleteFinanceiro, pagarComissao,
  getVeiculos, getClientes, saveCliente, getNegociacoes, getUsuarios,
  brl, dataBr, CATEGORIAS_FINANCEIRO, STATUS
} from '../store';
import { ClienteModalAltimus } from './Clientes';

const REVE_PADRAO = ['DG Automóveis'];

const EMPTY_FIN = {
  id: null,
  revenda: 'DG Automóveis',
  tipo: 'despesa', // despesa | receita
  emissao: new Date().toISOString().slice(0, 10),
  vencimento: new Date().toISOString().slice(0, 10),
  cliente_id: '',
  cliente_nome: '',
  numero_documento: '',
  veiculo_id: '',
  veiculo_desc: '',
  descricao: '',
  forma_pagamento: 'Pix / TED',
  categoria: 'Preparação / Estética',
  conta: 'Itaú Empresas',
  conta_financeira: 'Conta Corrente Principal',
  valor: '',
  status: 'pendente', // pendente | pago
  quitado: false,
  valor_quitacao: '',
  data_quitacao: '',
  agendado: false,
  observacao: ''
};

export default function Financeiro({ user }) {
  const [lista, setLista] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [negociacoes, setNegociacoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [visualizacao, setVisualizacao] = useState('contas'); // contas | novo_titulo | comissoes | lucro_veiculos | dre
  const [selecionados, setSelecionados] = useState([]);
  const [modalAvancada, setModalAvancada] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [toastSucesso, setToastSucesso] = useState('');

  // Modal de cadastro rápido de pessoa quando não encontrar
  const [modalPessoa, setModalPessoa] = useState(null);

  // Filtros da barra principal (Print 2 Altimus)
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroDescricao, setFiltroDescricao] = useState('');
  const [filtroVeiculo, setFiltroVeiculo] = useState('');
  const [filtroVencimento, setFiltroVencimento] = useState('');

  // Filtros da pesquisa avançada (Print 4 Altimus)
  const [filtroAvancado, setFiltroAvancado] = useState({
    revenda: '',
    tipo: '',
    id: '',
    data_emissao: '',
    data_quitacao: '',
    status_titulo: '',
    etiqueta: '',
    forma_pagamento: '',
    valor_min: '',
    valor_max: ''
  });

  const [editando, setEditando] = useState(null);

  const avisoSucesso = (msg) => {
    setToastSucesso(msg);
    setTimeout(() => setToastSucesso(''), 3000);
  };

  const recarregar = async () => {
    try {
      setLoadingMsg('Carregando dados financeiros...');
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

  // FILTRAGEM DE TÍTULOS (ESTILO ALTIMUS)
  const filtrados = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    return arr.filter((item) => {
      if (!item) return false;

      if (filtroCliente) {
        const cTerm = filtroCliente.toLowerCase();
        const cliMatch = (item.cliente_nome || '').toLowerCase().includes(cTerm);
        if (!cliMatch) return false;
      }

      if (filtroDescricao) {
        const dTerm = filtroDescricao.toLowerCase();
        const descMatch = (item.descricao || '').toLowerCase().includes(dTerm);
        if (!descMatch) return false;
      }

      if (filtroVeiculo) {
        const vTerm = filtroVeiculo.toLowerCase();
        const veicText = `${item.veic_marca || ''} ${item.veic_modelo || ''} ${item.veic_placa || ''}`.toLowerCase();
        if (!veicText.includes(vTerm)) return false;
      }

      if (filtroVencimento && item.vencimento !== filtroVencimento) {
        return false;
      }

      if (filtroAvancado.tipo && item.tipo !== filtroAvancado.tipo) return false;
      if (filtroAvancado.id && String(item.id) !== String(filtroAvancado.id)) return false;
      if (filtroAvancado.etiqueta && item.categoria !== filtroAvancado.etiqueta) return false;
      if (filtroAvancado.forma_pagamento && item.forma_pagamento !== filtroAvancado.forma_pagamento) return false;

      if (filtroAvancado.status_titulo === 'sem_baixa' && item.status === 'pago') return false;
      if (filtroAvancado.status_titulo === 'com_baixa' && item.status !== 'pago') return false;

      if (filtroAvancado.valor_min && Number(item.valor) < Number(filtroAvancado.valor_min)) return false;
      if (filtroAvancado.valor_max && Number(item.valor) > Number(filtroAvancado.valor_max)) return false;

      return true;
    });
  }, [lista, filtroCliente, filtroDescricao, filtroVeiculo, filtroVencimento, filtroAvancado]);

  // TOTAIS DAS CONTAS SELECIONADAS (RODAPÉ ALTIMUS)
  const totaisSelecionados = useMemo(() => {
    const itens = filtrados.filter((f) => selecionados.includes(f.id));
    const aReceber = itens.filter((f) => f.tipo === 'receita' && f.status !== 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const aPagar = itens.filter((f) => f.tipo === 'despesa' && f.status !== 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const total = itens.reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const quitadas = itens.filter((f) => f.status === 'pago').reduce((s, f) => s + (Number(f.valor) || 0), 0);
    return { aReceber, aPagar, total, quitadas };
  }, [filtrados, selecionados]);

  const toggleSelecionarTudo = () => {
    if (selecionados.length === filtrados.length) {
      setSelecionados([]);
    } else {
      setSelecionados(filtrados.map((f) => f.id));
    }
  };

  const toggleSelecionar = (id) => {
    setSelecionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleQuitarSelecionados = async () => {
    if (selecionados.length === 0) return;
    if (!confirm(`Confirmar a quitação de ${selecionados.length} conta(s) selecionada(s)?`)) return;
    try {
      setLoadingMsg('Quitando contas selecionadas...');
      for (const id of selecionados) {
        await baixarFinanceiro(id);
      }
      await recarregar();
      setSelecionados([]);
      avisoSucesso('✓ Contas quitadas com sucesso!');
    } catch (e) {
      alert('Erro ao quitar: ' + e.message);
    } finally {
      setLoadingMsg('');
    }
  };

  const handleExcluirSelecionados = async () => {
    if (selecionados.length === 0) return;
    if (!confirm(`Deseja excluir ${selecionados.length} conta(s) selecionada(s)?`)) return;
    try {
      setLoadingMsg('Excluindo contas...');
      for (const id of selecionados) {
        await deleteFinanceiro(id);
      }
      await recarregar();
      setSelecionados([]);
      avisoSucesso('✓ Contas excluídas com sucesso!');
    } catch (e) {
      alert('Erro ao excluir: ' + e.message);
    } finally {
      setLoadingMsg('');
    }
  };

  const abrirNovoTitulo = () => {
    setEditando({ ...EMPTY_FIN });
    setVisualizacao('novo_titulo');
  };

  const abrirEdicaoTitulo = (item) => {
    setEditando({
      ...EMPTY_FIN,
      ...item,
      quitado: item.status === 'pago',
      cliente_nome: item.cliente_nome || '',
      veiculo_desc: item.veic_modelo ? `${item.veic_marca || ''} ${item.veic_modelo} (${item.veic_placa || ''})` : ''
    });
    setVisualizacao('novo_titulo');
  };

  const salvarTitulo = async (dados) => {
    if (!dados.cliente_nome?.trim()) {
      alert('O campo Cliente/Fornecedor é obrigatório.');
      return;
    }
    if (!dados.descricao?.trim()) {
      alert('O campo Descrição é obrigatório.');
      return;
    }
    if (!dados.valor || Number(dados.valor) <= 0) {
      alert('Informe um Valor total válido.');
      return;
    }

    try {
      setLoadingMsg('Salvando conta no banco...');

      let clienteIdFinal = dados.cliente_id;
      if (!clienteIdFinal && dados.cliente_nome?.trim()) {
        const achado = clientes.find((c) => c.nome.toLowerCase() === dados.cliente_nome.trim().toLowerCase());
        if (achado) {
          clienteIdFinal = achado.id;
        } else {
          const novosClientes = await saveCliente({
            nome: dados.cliente_nome.trim().toUpperCase(),
            tipo_pessoa: 'PF',
            papel: dados.tipo === 'despesa' ? 'fornecedor' : 'cliente',
            cidade: 'RIO DO SUL',
            uf: 'SC'
          });
          clienteIdFinal = novosClientes.savedItem?.id || novosClientes[0]?.id || null;
        }
      }

      let descFinal = dados.descricao.trim().toUpperCase();
      if (dados.numero_documento?.trim()) {
        descFinal = `${descFinal} (DOC: ${dados.numero_documento.trim().toUpperCase()})`;
      }

      const payload = {
        id: dados.id,
        tipo: dados.tipo || 'despesa',
        categoria: dados.categoria || 'Outros',
        descricao: descFinal,
        valor: Number(dados.valor),
        vencimento: dados.vencimento,
        status: dados.quitado ? 'pago' : 'pendente',
        pagamento_data: dados.quitado ? (dados.data_quitacao || new Date().toISOString().slice(0, 10)) : null,
        forma_pagamento: dados.forma_pagamento || 'Pix / TED',
        conta_bancaria: dados.conta || 'Conta Principal',
        veiculo_id: dados.veiculo_id || null,
        cliente_id: clienteIdFinal,
        cliente_nome: dados.cliente_nome.trim().toUpperCase()
      };

      await saveFinanceiro(payload);
      await recarregar();
      setVisualizacao('contas');
      setEditando(null);
      avisoSucesso('✓ Conta a pagar/receber salva com sucesso!');
    } catch (err) {
      alert('Erro ao salvar conta: ' + err.message);
    } finally {
      setLoadingMsg('');
    }
  };

  const excluirTitulo = async (id) => {
    if (!confirm('Deseja realmente excluir este título financeiro?')) return;
    try {
      setLoadingMsg('Excluindo título...');
      await deleteFinanceiro(id);
      await recarregar();
      setVisualizacao('contas');
      setEditando(null);
      avisoSucesso('✓ Título excluído com sucesso!');
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setLoadingMsg('');
    }
  };

  return (
    <>
      {loadingMsg && <div className="loading-top-bar" />}

      {toastSucesso && (
        <div className="toast-success">
          <CheckCircle2 size={16} />
          <span>{toastSucesso}</span>
        </div>
      )}

      {/* MODAL DE CADASTRO RÁPIDO DE PESSOA QUANDO NÃO ENCONTRAR */}
      {modalPessoa && (
        <ClienteModalAltimus
          inicial={modalPessoa}
          onClose={() => setModalPessoa(null)}
          onSave={async (cli) => {
            try {
              setLoadingMsg('Cadastrando pessoa...');
              const novos = await saveCliente(cli);
              const salvo = novos.savedItem || novos[0];
              setClientes(novos);
              setModalPessoa(null);
              avisoSucesso(`✓ ${cli.nome} cadastrado com sucesso!`);

              // Se estivermos editando um título, já vincula esse cliente nele
              if (editando) {
                setEditando((prev) => ({
                  ...prev,
                  cliente_id: salvo?.id || '',
                  cliente_nome: cli.nome
                }));
              }
            } catch (e) {
              alert('Erro ao cadastrar pessoa: ' + e.message);
            } finally {
              setLoadingMsg('');
            }
          }}
        />
      )}

      {/* TELA DE CADASTRO / EDIÇÃO DE TÍTULO (PRINT 3 ALTIMUS) */}
      {visualizacao === 'novo_titulo' && editando && (
        <NovoTituloForm
          inicial={editando}
          veiculos={veiculos}
          clientes={clientes}
          onClose={() => { setVisualizacao('contas'); setEditando(null); }}
          onSave={salvarTitulo}
          onDelete={excluirTitulo}
          onAbrirCadastroPessoa={(nomeDigitado) => {
            setModalPessoa({
              nome: String(nomeDigitado || '').toUpperCase(),
              tipo_pessoa: 'PF',
              papel: editando.tipo === 'despesa' ? 'fornecedor' : 'cliente',
              is_cliente: editando.tipo !== 'despesa',
              is_fornecedor: editando.tipo === 'despesa',
              ativo: true,
              cidade: 'RIO DO SUL',
              uf: 'SC'
            });
          }}
        />
      )}

      {/* TELA DE LISTAGEM DE CONTAS A PAGAR / RECEBER (PRINT 2 ALTIMUS) */}
      {visualizacao === 'contas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Breadcrumb Altimus */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem', color: 'var(--muted)' }}>
              <span>Financeiro</span>
              <ChevronRight size={14} />
              <strong style={{ color: 'var(--text)' }}>Contas a Pagar/Receber</strong>
              <Bookmark size={15} style={{ color: '#5d35b0', cursor: 'pointer' }} />
            </div>

            {/* Alternador de Módulos Financeiros */}
            <div className="tabs" style={{ margin: 0 }}>
              <button className="tab active" onClick={() => setVisualizacao('contas')}>
                <Wallet size={15} />Contas a Pagar/Receber
              </button>
              <button className="tab" onClick={() => setVisualizacao('comissoes')}>
                <Users size={15} />Comissões
              </button>
              <button className="tab" onClick={() => setVisualizacao('lucro_veiculos')}>
                <Car size={15} />Lucro por Veículo
              </button>
              <button className="tab" onClick={() => setVisualizacao('dre')}>
                <BarChart3 size={15} />DRE
              </button>
            </div>
          </div>

          {/* BARRA DE FILTROS SUPERIOR (PRINT 2 ALTIMUS) */}
          <div className="card" style={{ padding: '10px 14px', background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1.2', minWidth: 200 }}>
              <label style={{ fontSize: '.72rem', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Cliente/Fornecedor</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 30, height: 36, fontSize: '.84rem' }}
                  placeholder="Nome ou CPF/CNPJ do c..."
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div style={{ flex: '1.2', minWidth: 180 }}>
              <label style={{ fontSize: '.72rem', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Descrição</label>
              <input
                className="input"
                style={{ height: 36, fontSize: '.84rem' }}
                placeholder="Descrição"
                value={filtroDescricao}
                onChange={(e) => setFiltroDescricao(e.target.value.toUpperCase())}
              />
            </div>

            <div style={{ position: 'relative', flex: '1.2', minWidth: 200 }}>
              <label style={{ fontSize: '.72rem', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Veículo</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 30, height: 36, fontSize: '.84rem' }}
                  placeholder="Pesquise por placa, chas..."
                  value={filtroVeiculo}
                  onChange={(e) => setFiltroVeiculo(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div style={{ flex: '1', minWidth: 150 }}>
              <label style={{ fontSize: '.72rem', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Data vencimento</label>
              <input
                type="date"
                className="input"
                style={{ height: 36, fontSize: '.84rem' }}
                value={filtroVencimento}
                onChange={(e) => setFiltroVencimento(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-icon"
                title="Pesquisa Avançada"
                onClick={() => setModalAvancada(true)}
                style={{ height: 36, width: 36, borderColor: '#5d35b0', color: '#5d35b0' }}
              >
                <Filter size={16} />
              </button>
              <button
                type="button"
                className="btn btn-icon"
                title="Limpar Filtros"
                onClick={() => {
                  setFiltroCliente('');
                  setFiltroDescricao('');
                  setFiltroVeiculo('');
                  setFiltroVencimento('');
                  setFiltroAvancado({
                    revenda: '', tipo: '', id: '', data_emissao: '', data_quitacao: '',
                    status_titulo: '', etiqueta: '', forma_pagamento: '', valor_min: '', valor_max: ''
                  });
                }}
                style={{ height: 36, width: 36 }}
              >
                ...
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={abrirNovoTitulo}
                style={{ height: 36, background: '#4a148c', color: '#ffffff', fontWeight: 700, padding: '0 16px' }}
              >
                Novo
              </button>
            </div>
          </div>

          {/* TABELA DE CONTAS (PRINT 2 ALTIMUS) */}
          <div className="card table-wrap" style={{ background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={filtrados.length > 0 && selecionados.length === filtrados.length}
                      onChange={toggleSelecionarTudo}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>ID ↑</th>
                  <th>Vencimento ↑</th>
                  <th>Cliente/Fornecedor</th>
                  <th>Descrição</th>
                  <th>Valor ↑↓</th>
                  <th>Valor quitação ↑↓</th>
                  <th>Data quitação ↑</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '.9rem' }}>
                      Não foram encontradas informações nessa pesquisa.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((item) => {
                    const sel = selecionados.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => abrirEdicaoTitulo(item)}
                        style={{ cursor: 'pointer', background: sel ? '#f3e8ff' : 'transparent' }}
                      >
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => toggleSelecionar(item.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td><strong>#{item.id}</strong></td>
                        <td>{dataBr(item.vencimento)}</td>
                        <td>
                          <strong>{item.cliente_nome || '—'}</strong>
                          {item.veic_modelo && (
                            <div style={{ fontSize: '.74rem', color: 'var(--muted)', marginTop: 2 }}>
                              🚗 {item.veic_marca} {item.veic_modelo} ({item.veic_placa})
                            </div>
                          )}
                        </td>
                        <td>
                          <span>{item.descricao}</span>
                          <span className={`badge badge-${item.tipo}`} style={{ marginLeft: 8, fontSize: '.68rem' }}>
                            {item.tipo === 'receita' ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: item.tipo === 'receita' ? 'var(--success)' : 'var(--text)' }}>
                            {brl(item.valor)}
                          </strong>
                        </td>
                        <td>
                          {item.status === 'pago' ? (
                            <strong style={{ color: 'var(--success)' }}>{brl(item.valor)}</strong>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {item.status === 'pago' ? (
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                              {dataBr(item.pagamento_data || item.vencimento)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* BARRA INFERIOR DE TOTAIS E AÇÕES EM LOTE (PRINT 2 ALTIMUS) */}
          <div className="card" style={{ padding: '12px 18px', background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', gap: 20, fontSize: '.84rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
              <div>
                Selecionados a receber: <strong style={{ color: 'var(--success)' }}>{brl(totaisSelecionados.aReceber)}</strong>
              </div>
              <div>
                Selecionados a pagar: <strong style={{ color: 'var(--danger)' }}>{brl(totaisSelecionados.aPagar)}</strong>
              </div>
              <div>
                Soma das contas selecionadas: <strong>Total: {brl(totaisSelecionados.total)} | Quitadas total: {brl(totaisSelecionados.quitadas)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={selecionados.length === 0}
                onClick={handleExcluirSelecionados}
              >
                Renegociar / Excluir
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ background: '#5d35b0', color: '#ffffff', fontWeight: 600 }}
                disabled={selecionados.length === 0}
                onClick={handleQuitarSelecionados}
              >
                Quitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OUTRAS ABAS (COMISSÕES, LUCRO POR CARRO, DRE) */}
      {visualizacao === 'comissoes' && (
        <div>
          <button className="btn btn-sm" style={{ marginBottom: 14 }} onClick={() => setVisualizacao('contas')}>
            ← Voltar para Contas a Pagar/Receber
          </button>
          <ComissoesView
            lista={lista}
            veiculos={veiculos}
            clientes={clientes}
            negociacoes={negociacoes}
            usuarios={usuarios}
            recarregar={recarregar}
            avisoSucesso={avisoSucesso}
            setLoadingMsg={setLoadingMsg}
          />
        </div>
      )}

      {visualizacao === 'lucro_veiculos' && (
        <div>
          <button className="btn btn-sm" style={{ marginBottom: 14 }} onClick={() => setVisualizacao('contas')}>
            ← Voltar para Contas a Pagar/Receber
          </button>
          <LucroVeiculosView
            veiculos={veiculos}
            onNovaDespesa={(v) => {
              setEditando({
                ...EMPTY_FIN,
                tipo: 'despesa',
                categoria: 'Preparação / Estética',
                veiculo_id: v.id,
                veiculo_desc: `${v.marca} ${v.modelo} (${v.placa || ''})`.toUpperCase(),
                descricao: `PREPARAÇÃO / MANUTENÇÃO — ${v.marca} ${v.modelo} (${v.placa || ''})`.toUpperCase()
              });
              setVisualizacao('novo_titulo');
            }}
          />
        </div>
      )}

      {visualizacao === 'dre' && (
        <div>
          <button className="btn btn-sm" style={{ marginBottom: 14 }} onClick={() => setVisualizacao('contas')}>
            ← Voltar para Contas a Pagar/Receber
          </button>
          <DreView lista={lista} veiculos={veiculos} negociacoes={negociacoes} />
        </div>
      )}

      {/* MODAL DE PESQUISA AVANÇADA (PRINT 4 ALTIMUS) */}
      {modalAvancada && (
        <div className="overlay" onClick={() => setModalAvancada(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 840 }}>
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <h2 style={{ fontSize: '1.05rem', margin: 0, color: '#4a148c' }}>Pesquisa avançada</h2>
              <button type="button" className="btn btn-icon" onClick={() => setModalAvancada(false)}><X size={18} /></button>
            </div>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Revendas</label>
                <select
                  className="select"
                  value={filtroAvancado.revenda}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, revenda: e.target.value })}
                >
                  <option value="">- Selecione -</option>
                  {REVE_PADRAO.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Tipo</label>
                <select
                  className="select"
                  value={filtroAvancado.tipo}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, tipo: e.target.value })}
                >
                  <option value="">- Selecione -</option>
                  <option value="despesa">Despesa (A Pagar)</option>
                  <option value="receita">Receita (A Receber)</option>
                </select>
              </div>

              <div className="field">
                <label>ID</label>
                <input
                  className="input"
                  placeholder="ID do título"
                  value={filtroAvancado.id}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, id: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Data de emissão</label>
                <input
                  type="date"
                  className="input"
                  value={filtroAvancado.data_emissao}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, data_emissao: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Data de quitação</label>
                <input
                  type="date"
                  className="input"
                  value={filtroAvancado.data_quitacao}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, data_quitacao: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Status do título</label>
                <select
                  className="select"
                  value={filtroAvancado.status_titulo}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, status_titulo: e.target.value })}
                >
                  <option value="">Todos</option>
                  <option value="sem_baixa">Sem baixa (Pendente)</option>
                  <option value="com_baixa">Com baixa (Quitado)</option>
                </select>
              </div>

              <div className="field">
                <label>Forma de pagamento</label>
                <select
                  className="select"
                  value={filtroAvancado.forma_pagamento}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, forma_pagamento: e.target.value })}
                >
                  <option value="">- Selecione -</option>
                  {['Pix / TED', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Financiamento', 'Cheque'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Etiquetas</label>
                <select
                  className="select"
                  value={filtroAvancado.etiqueta}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, etiqueta: e.target.value })}
                >
                  <option value="">- Selecione -</option>
                  {CATEGORIAS_FINANCEIRO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Valor mínimo (R$)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0,00"
                  value={filtroAvancado.valor_min}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, valor_min: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Valor máximo (R$)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0,00"
                  value={filtroAvancado.valor_max}
                  onChange={(e) => setFiltroAvancado({ ...filtroAvancado, valor_max: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFiltroAvancado({
                    revenda: '', tipo: '', id: '', data_emissao: '', data_quitacao: '',
                    status_titulo: '', etiqueta: '', forma_pagamento: '', valor_min: '', valor_max: ''
                  });
                  setModalAvancada(false);
                }}
              >
                Limpar & Fechar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#5d35b0' }}
                onClick={() => setModalAvancada(false)}
              >
                Pesquisar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==============================================================================
// FORMULÁRIO COMPLETO DO TÍTULO FINANCEIRO (PRINT 3 ALTIMUS)
// ==============================================================================
function NovoTituloForm({ inicial, veiculos, clientes, onClose, onSave, onDelete, onAbrirCadastroPessoa }) {
  const [f, setF] = useState(inicial);
  const [buscaCli, setBuscaCli] = useState(inicial.cliente_nome || '');
  const [dropdownCliAberto, setDropdownCliAberto] = useState(false);

  const [buscaVeic, setBuscaVeic] = useState(inicial.veiculo_desc || '');
  const [dropdownVeicAberto, setDropdownVeicAberto] = useState(false);

  const setUpper = (k) => (e) => setF({ ...f, [k]: String(e.target.value).toUpperCase() });

  const clientesSugeridos = useMemo(() => {
    if (!buscaCli) return clientes.slice(0, 8);
    const termo = buscaCli.toLowerCase();
    return clientes.filter((c) => (c.nome || '').toLowerCase().includes(termo) || (c.cpf_cnpj || '').includes(termo)).slice(0, 8);
  }, [clientes, buscaCli]);

  const veiculosSugeridos = useMemo(() => {
    if (!buscaVeic) return veiculos.slice(0, 8);
    const termo = buscaVeic.toLowerCase();
    return veiculos.filter((v) =>
      `${v.marca || ''} ${v.modelo || ''} ${v.placa || ''} ${v.chassi || ''}`.toLowerCase().includes(termo)
    ).slice(0, 8);
  }, [veiculos, buscaVeic]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...f,
      cliente_nome: buscaCli.toUpperCase(),
      veiculo_desc: buscaVeic.toUpperCase()
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb Altimus */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.92rem', color: 'var(--muted)' }}>
        <span>Financeiro</span>
        <ChevronRight size={14} />
        <span>Contas a Pagar/Receber</span>
        <ChevronRight size={14} />
        <strong style={{ color: 'var(--text)' }}>{f.id ? `Editar Conta #${f.id}` : 'Nova Conta a Pagar/Receber'}</strong>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 24, background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 18px 0', color: 'var(--text)' }}>
          Principal
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
          {/* LINHA 1: OPERAÇÃO, REVENDA E DATAS */}
          <div style={{ gridColumn: 'span 3' }} className="field">
            <label style={{ fontWeight: 700, color: 'var(--text)' }}>Operação *</label>
            <select className="select" required value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              <option value="despesa">Despesa (A Pagar)</option>
              <option value="receita">Receita (A Receber)</option>
            </select>
          </div>

          <div style={{ gridColumn: 'span 3' }} className="field">
            <label style={{ fontWeight: 700, color: 'var(--text)' }}>Revendas *</label>
            <select className="select" required value={f.revenda} onChange={(e) => setF({ ...f, revenda: e.target.value })}>
              {REVE_PADRAO.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: 'span 3' }} className="field">
            <label style={{ fontWeight: 600 }}>Emissão *</label>
            <input type="date" required className="input" value={f.emissao} onChange={(e) => setF({ ...f, emissao: e.target.value })} />
          </div>

          <div style={{ gridColumn: 'span 3' }} className="field">
            <label style={{ fontWeight: 600 }}>Vencimento *</label>
            <input type="date" required className="input" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />
          </div>

          {/* LINHA 2: CLIENTE/FORNECEDOR (OBRIGATÓRIO) + VEÍCULO (OPCIONAL) */}
          <div style={{ gridColumn: 'span 6', position: 'relative' }} className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>Cliente / Fornecedor *</label>
              <button
                type="button"
                className="btn btn-sm"
                style={{ fontSize: '.72rem', padding: '2px 8px', background: '#faf5ff', borderColor: '#7c3aed', color: '#6b21a8', fontWeight: 600 }}
                onClick={() => onAbrirCadastroPessoa(buscaCli)}
              >
                <UserPlus size={12} /> + Cadastrar Pessoa
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                className="input"
                required
                style={{ paddingLeft: 36 }}
                placeholder="Pesquise por nome, CPF/CNPJ ou digite um novo fornecedor..."
                value={buscaCli}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setBuscaCli(val);
                  setDropdownCliAberto(true);
                  setF({ ...f, cliente_id: '', cliente_nome: val });
                }}
                onFocus={() => setDropdownCliAberto(true)}
              />
              {buscaCli && (
                <button
                  type="button"
                  style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                  onClick={() => { setBuscaCli(''); setF({ ...f, cliente_id: '', cliente_nome: '' }); }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Dropdown com os clientes cadastrados + Botão de cadastrar novo se não encontrar */}
            {dropdownCliAberto && (
              <div
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#ffffff', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto'
                }}
              >
                {clientesSugeridos.map((c) => (
                  <div
                    key={c.id}
                    style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '.86rem' }}
                    onClick={() => {
                      setBuscaCli(c.nome);
                      setF({ ...f, cliente_id: c.id, cliente_nome: c.nome });
                      setDropdownCliAberto(false);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3e8ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <strong>{c.nome}</strong>
                    <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>
                      {c.cpf_cnpj ? `Doc: ${c.cpf_cnpj}` : ''} {c.telefone ? `· Tel: ${c.telefone}` : ''}
                    </div>
                  </div>
                ))}

                {/* BOTÃO CLARO PARA CADASTRAR PESSOA IMEDIATAMENTE */}
                {buscaCli.trim().length > 0 && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#faf5ff',
                      borderTop: '2px solid #e9d5ff',
                      cursor: 'pointer',
                      color: '#6b21a8',
                      fontSize: '.88rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                    onClick={() => {
                      onAbrirCadastroPessoa(buscaCli);
                      setDropdownCliAberto(false);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3e8ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#faf5ff'}
                  >
                    <Plus size={16} />
                    <span>+ Não encontrou? Cadastrar "{buscaCli.toUpperCase()}" agora</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* VEÍCULO (OPCIONAL — VINCULA AO ESTOQUE) */}
          <div style={{ gridColumn: 'span 6', position: 'relative' }} className="field">
            <label style={{ fontWeight: 600, color: 'var(--text)' }}>
              Veículo <span style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 400 }}>(Opcional — vincular custo/receita ao carro)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder="Pesquise por placa, chassi, modelo ou digite..."
                value={buscaVeic}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setBuscaVeic(val);
                  setDropdownVeicAberto(true);
                  setF({ ...f, veiculo_id: '', veiculo_desc: val });
                }}
                onFocus={() => setDropdownVeicAberto(true)}
              />
              {buscaVeic && (
                <button
                  type="button"
                  style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                  onClick={() => { setBuscaVeic(''); setF({ ...f, veiculo_id: '', veiculo_desc: '' }); }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {dropdownVeicAberto && veiculosSugeridos.length > 0 && (
              <div
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#ffffff', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto'
                }}
              >
                {veiculosSugeridos.map((v) => (
                  <div
                    key={v.id}
                    style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '.86rem' }}
                    onClick={() => {
                      const desc = `${v.marca} ${v.modelo} (${v.placa || v.ano})`.toUpperCase();
                      setBuscaVeic(desc);
                      setF({ ...f, veiculo_id: v.id, veiculo_desc: desc });
                      setDropdownVeicAberto(false);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3e8ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <strong>{v.marca} {v.modelo}</strong> ({v.ano}) — Placa: <strong>{v.placa || 'Sem placa'}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LINHA 3: DESCRIÇÃO DO TÍTULO + ETIQUETAS/CATEGORIA */}
          <div style={{ gridColumn: 'span 8' }} className="field">
            <label style={{ fontWeight: 700, color: 'var(--text)' }}>Descrição do Lançamento *</label>
            <input
              className="input"
              required
              placeholder="Ex: REVISÃO MECÂNICA, POLIMENTO, PEÇAS, COMISSÃO, VENDA..."
              value={f.descricao}
              onChange={setUpper('descricao')}
            />
          </div>

          <div style={{ gridColumn: 'span 4' }} className="field">
            <label style={{ fontWeight: 600 }}>Etiquetas / Categoria</label>
            <select className="select" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {CATEGORIAS_FINANCEIRO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* LINHA 4: VALOR TOTAL, FORMA DE PAGAMENTO, CONTA E STATUS */}
          <div style={{ gridColumn: 'span 3' }} className="field">
            <label style={{ fontWeight: 700, color: 'var(--text)' }}>Valor total * (R$)</label>
            <input
              type="number"
              step="0.01"
              required
              className="input"
              style={{ fontSize: '1.05rem', fontWeight: 700, color: f.tipo === 'despesa' ? '#dc2626' : '#16a34a' }}
              placeholder="0,00"
              value={f.valor}
              onChange={(e) => setF({ ...f, valor: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: 'span 3' }} className="field">
            <label style={{ fontWeight: 600 }}>Forma de pagamento</label>
            <select className="select" value={f.forma_pagamento} onChange={(e) => setF({ ...f, forma_pagamento: e.target.value })}>
              {['Pix / TED', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Financiamento', 'Cheque'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: 'span 3' }} className="field">
            <label style={{ fontWeight: 600 }}>Conta</label>
            <input
              className="input"
              placeholder="Itaú Empresas / Loja..."
              value={f.conta ?? 'Itaú Empresas'}
              onChange={setUpper('conta')}
            />
          </div>

          <div style={{ gridColumn: 'span 3', display: 'flex', gap: 16, alignItems: 'center', marginTop: 22 }} className="field">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.88rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={f.quitado}
                onChange={(e) => setF({ ...f, quitado: e.target.checked, status: e.target.checked ? 'pago' : 'pendente' })}
              />
              Quitado
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.88rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={f.agendado}
                onChange={(e) => setF({ ...f, agendado: e.target.checked })}
              />
              Agendado
            </label>
          </div>

          {/* LINHA 5: OBSERVAÇÃO */}
          <div style={{ gridColumn: 'span 12' }} className="field">
            <label style={{ fontWeight: 600 }}>Observação</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Observações complementares..."
              value={f.observacao ?? ''}
              onChange={setUpper('observacao')}
            />
          </div>
        </div>

        {/* BARRA INFERIOR DE BOTÕES (PRINT 3 ALTIMUS) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {f.id ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onDelete(f.id)}
            >
              Excluir
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn" onClick={onClose}>
              Fechar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#5d35b0', color: '#ffffff', fontWeight: 700, padding: '0 24px' }}
            >
              Salvar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ==============================================================================
// VISÃO DE COMISSÕES DE VENDEDORES
// ==============================================================================
function ComissoesView({ lista, veiculos, clientes, negociacoes, usuarios, recarregar, avisoSucesso, setLoadingMsg }) {
  const [filtroVendedor, setFiltroVendedor] = useState('');

  const relatorio = useMemo(() => {
    const comissoesPagas = lista.filter((f) => f.tipo === 'despesa' && f.categoria === 'Comissão' && f.status === 'pago');
    const negsValidas = negociacoes.filter((n) => n.status !== 'cancelada');

    return negsValidas.map((n) => {
      const veic = veiculos.find((v) => v.id === n.veiculo_id) || {};
      const cli = clientes.find((c) => c.id === n.cliente_id) || {};
      const despVeic = Number(veic.despesas_veiculo || 0);
      const custoTotalLoja = Number(veic.custo || 0) + despVeic;
      const valorVenda = Number(n.valor_veiculo || veic.preco || 0);
      const lucroBrutoCarro = valorVenda - custoTotalLoja;

      let comissao = Number(n.comissao_vendedor || 0);
      if (comissao === 0 && lucroBrutoCarro > 0) {
        comissao = Math.round(lucroBrutoCarro * 0.10);
      }

      const jaPaga = comissoesPagas.some((f) => Number(f.negociacao_id) === Number(n.id) || f.descricao?.includes(`Venda #${n.id}`));
      const vendObj = usuarios.find((u) => u.id === n.vendedor_id);
      const vendedorNome = vendObj?.nome || n.vendedor_nome || 'Equipe DG Autos';

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
        status_comissao: jaPaga ? 'pago' : 'pendente'
      };
    });
  }, [negociacoes, veiculos, clientes, usuarios, lista]);

  const filtrados = useMemo(() => {
    return relatorio.filter((c) => !filtroVendedor || c.vendedor_nome === filtroVendedor);
  }, [relatorio, filtroVendedor]);

  const handlePagar = async (item) => {
    if (!confirm(`Confirmar o pagamento de comissão de ${brl(item.comissao_valor)} para ${item.vendedor_nome}?`)) return;
    try {
      setLoadingMsg('Registrando pagamento no caixa...');
      await pagarComissao({
        negociacao_id: item.negociacao_id,
        valor: item.comissao_valor,
        vendedor_nome: item.vendedor_nome,
        veiculo_desc: item.veiculo_desc
      });
      await recarregar();
      avisoSucesso('✓ Comissão paga e registrada no caixa!');
    } catch (e) {
      alert('Erro ao pagar: ' + e.message);
    } finally {
      setLoadingMsg('');
    }
  };

  return (
    <div className="card table-wrap" style={{ background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Comissões da Equipe de Vendas</h3>
        <select className="select" style={{ maxWidth: 220 }} value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}>
          <option value="">Todos os Vendedores</option>
          {usuarios.map((u) => <option key={u.id} value={u.nome}>{u.nome}</option>)}
        </select>
      </div>

      <table className="table" style={{ margin: 0 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th>Data</th>
            <th>Negociação</th>
            <th>Vendedor</th>
            <th>Veículo</th>
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
          {filtrados.length === 0 ? (
            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>Nenhuma comissão encontrada.</td></tr>
          ) : (
            filtrados.map((c, i) => (
              <tr key={i}>
                <td>{dataBr(c.data)}</td>
                <td><strong>#{c.negociacao_id}</strong></td>
                <td><strong>{c.vendedor_nome}</strong></td>
                <td>{c.veiculo_desc}</td>
                <td>{c.cliente_nome}</td>
                <td>{brl(c.valor_venda)}</td>
                <td style={{ color: 'var(--muted)' }}>{brl(c.custo_loja)}</td>
                <td><strong style={{ color: c.lucro_bruto >= 0 ? 'var(--success)' : 'var(--danger)' }}>{brl(c.lucro_bruto)}</strong></td>
                <td><strong style={{ color: 'var(--primary)' }}>{brl(c.comissao_valor)}</strong></td>
                <td>
                  <span className={`badge ${c.status_comissao === 'pago' ? 'badge-success' : 'badge-warning'}`}>
                    {c.status_comissao === 'pago' ? '✓ Paga' : '⏳ Pendente'}
                  </span>
                </td>
                <td>
                  {c.status_comissao !== 'pago' && (
                    <button className="btn btn-sm btn-primary" onClick={() => handlePagar(c)} style={{ background: '#5d35b0' }}>
                      Pagar
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ==============================================================================
// VISÃO DE LUCRO REAL POR VEÍCULO
// ==============================================================================
function LucroVeiculosView({ veiculos, onNovaDespesa }) {
  return (
    <div className="card table-wrap" style={{ background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table className="table" style={{ margin: 0 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
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
            const perc = custoTotal > 0 ? ((lucroReal / custoTotal) * 100).toFixed(1) : 0;
            return (
              <tr key={v.id}>
                <td>
                  <strong>{v.marca} {v.modelo}</strong>
                  <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{v.ano} · Placa {v.placa || '—'}</div>
                </td>
                <td><span className={`badge badge-${v.status}`}>{STATUS[v.status] || v.status}</span></td>
                <td>{brl(v.custo)}</td>
                <td style={{ color: desp > 0 ? 'var(--warning)' : 'var(--muted)' }}>{brl(desp)}</td>
                <td><strong>{brl(custoTotal)}</strong></td>
                <td><strong>{brl(v.preco)}</strong></td>
                <td><strong style={{ color: lucroReal >= 0 ? 'var(--success)' : 'var(--danger)' }}>{brl(lucroReal)}</strong></td>
                <td><span style={{ fontWeight: 700, color: lucroReal >= 0 ? 'var(--success)' : 'var(--danger)' }}>{perc}%</span></td>
                <td>
                  <button className="btn btn-sm" onClick={() => onNovaDespesa(v)}>
                    + Despesa
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ==============================================================================
// VISÃO DRE GERENCIAL DA LOJA
// ==============================================================================
function DreView({ lista, veiculos, negociacoes }) {
  const vendidos = veiculos.filter((v) => v.status === 'vendido');
  const negsConcluidas = negociacoes.filter((n) => n.status === 'concluida');

  const faturamentoVendas = negsConcluidas.length > 0
    ? negsConcluidas.reduce((s, n) => s + Number(n.valor_veiculo || 0), 0)
    : vendidos.reduce((s, v) => s + Number(v.preco || 0), 0);

  const cmv = vendidos.reduce((s, v) => s + Number(v.custo || 0), 0);
  const lucroBrutoVendas = faturamentoVendas - cmv;

  const porCat = (cat) => lista.filter((f) => f.tipo === 'despesa' && f.categoria === cat).reduce((s, f) => s + Number(f.valor || 0), 0);
  const despPrep = porCat('Preparação / Estética') + porCat('Funilaria / Mecânica') + porCat('Documentação / Transferência');
  const despComissao = porCat('Comissão') || negsConcluidas.reduce((s, n) => s + Number(n.comissao_vendedor || 0), 0);
  const despFixas = porCat('Despesa Fixa / Loja') + porCat('Impostos') + porCat('Outros');
  const totalDesp = despPrep + despComissao + despFixas;
  const resultadoLiquido = lucroBrutoVendas - totalDesp;

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
    <div className="card" style={{ padding: 24, background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Demonstrativo do Resultado do Exercício (DRE Altimus)</h2>
          <small style={{ color: 'var(--muted)' }}>Apuração contábil e operacional oficial do lucro real da revenda.</small>
        </div>
        <button className="btn" onClick={() => window.print()}>
          <Printer size={15} />Imprimir DRE
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {linhas.map((l) => (
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
