import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Handshake, CheckCircle2, FileText, Trash2, X, Car, DollarSign, RefreshCw, LayoutGrid, List, Edit3,
  UserPlus, ShieldAlert, ShieldCheck, AlertTriangle, ExternalLink
} from 'lucide-react';
import {
  getNegociacoes, saveNegociacao, concluirNegociacao, deleteNegociacao,
  getClientes, saveCliente, getVeiculos, brl, dataBr
} from '../store';
import { ClienteModalAltimus, EMPTY_CLI } from './Clientes';
import { buscarPlaca, mascaraPlaca } from '../utils/mascaras';

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

const STATUS_VEICULO = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
  em_preparacao: 'Em preparação',
  cancelado: 'Cancelado'
};
const STATUS = STATUS_VEICULO;

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
  const [loadingAcao, setLoadingAcao] = useState('');

  const recarregar = () => {
    setLoadingAcao('Carregando negociações...');
    Promise.all([
      getNegociacoes().then((res) => setLista(Array.isArray(res) ? res : [])),
      getClientes().then((res) => setClientes(Array.isArray(res) ? res : [])),
      getVeiculos().then((res) => setVeiculos(Array.isArray(res) ? res : []))
    ]).catch(() => {}).finally(() => setLoadingAcao(''));
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
          let negFinal = { ...neg };
          if (!negFinal.cliente_id && negFinal.cliente_nome) {
            try {
              const resCli = await saveCliente({
                nome: negFinal.cliente_nome,
                cpf_cnpj: negFinal.cliente_cpf_cnpj || '',
                telefone: negFinal.cliente_telefone || '',
                email: negFinal.cliente_email || '',
                cep: negFinal.cliente_cep || '',
                endereco: negFinal.cliente_endereco || '',
                cidade: negFinal.cliente_cidade || 'Rio do Sul',
                uf: negFinal.cliente_uf || 'SC',
                origem: negFinal.canal_venda || 'LOJA'
              });
              if (resCli?.savedItem?.id) {
                negFinal.cliente_id = resCli.savedItem.id;
              } else if (Array.isArray(resCli) && resCli.length) {
                const criado = resCli.find((c) => c.nome?.trim().toLowerCase() === negFinal.cliente_nome?.trim().toLowerCase()) || resCli[0];
                if (criado) negFinal.cliente_id = criado.id;
              }
            } catch (err) {
              console.warn('Erro ao salvar cliente inline:', err);
            }
          }
          await saveNegociacao(negFinal);
          recarregar();
          setEditando(null);
          alert('✓ Negociação e Contrato salvos com sucesso!');
        }}
        onDelete={async (id) => {
          await deleteNegociacao(id);
          recarregar();
          setEditando(null);
          alert('✓ Negociação excluída com sucesso!');
        }}
        onConcluir={async (neg) => {
          let negFinal = { ...neg };
          if (!negFinal.cliente_id && negFinal.cliente_nome) {
            try {
              const resCli = await saveCliente({
                nome: negFinal.cliente_nome,
                cpf_cnpj: negFinal.cliente_cpf_cnpj || '',
                telefone: negFinal.cliente_telefone || '',
                email: negFinal.cliente_email || '',
                cep: negFinal.cliente_cep || '',
                endereco: negFinal.cliente_endereco || '',
                cidade: negFinal.cliente_cidade || 'Rio do Sul',
                uf: negFinal.cliente_uf || 'SC',
                origem: negFinal.canal_venda || 'LOJA'
              });
              if (resCli?.savedItem?.id) negFinal.cliente_id = resCli.savedItem.id;
            } catch {}
          }
          const listaAtualizada = await saveNegociacao(negFinal);
          const idAlvo = negFinal.id || listaAtualizada[0]?.id;
          if (idAlvo) await concluirNegociacao(idAlvo);
          recarregar();
          setEditando(null);
          alert('✓ Venda concluída e fechada com sucesso!');
        }}
        onCancelarNegociacao={async (neg, motivo) => {
          const isAdmin = user?.perfil === 'admin' || user?.email?.toLowerCase() === 'admin@dgautos.com.br';
          if (!isAdmin) {
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
          alert('✓ Negociação/Contrato cancelado com sucesso.');
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
      {loadingAcao && (
        <div className="loading-toast">
          <div className="spinner-sm" />
          <span>{loadingAcao}</span>
        </div>
      )}
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

                <div className="vehicle-specs" style={{ gridTemplateColumns: n.troca_modelo && n.tipo !== 'compra' ? '1fr 1fr' : '1fr' }}>
                  <div className="vehicle-spec-item" style={{ textAlign: 'left', padding: '8px 10px' }}>
                    <span>{n.tipo === 'compra' ? '📥 Carro Adquirido (Entrada no Estoque)' : '🚗 Carro Vendido (Saída)'}</span>
                    <strong style={{ fontSize: '.86rem' }}>
                      {n.veic_modelo ? `${n.veic_marca} ${n.veic_modelo}` : (n.troca_modelo ? `${n.troca_marca} ${n.troca_modelo}` : 'A selecionar')}
                    </strong>
                    {(n.veic_placa || (n.tipo === 'compra' && n.troca_placa)) && <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Placa: {n.veic_placa || n.troca_placa}</div>}
                  </div>
                  {n.tipo !== 'compra' && n.troca_modelo && (
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
                  {(n.status === 'cancelada' || user?.perfil === 'admin' || user?.email?.toLowerCase() === 'admin@dgautos.com.br') && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      title="Excluir negociação permanentemente"
                      onClick={async () => {
                        if (!confirm(`Tem certeza que deseja excluir a Negociação #${n.id} permanentemente do sistema?`)) return;
                        await deleteNegociacao(n.id);
                        recarregar();
                        alert('✓ Negociação excluída com sucesso!');
                      }}
                    >
                      <Trash2 size={13} /> Excluir
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
                      {n.veic_modelo ? `${n.veic_marca} ${n.veic_modelo}` : (n.troca_modelo ? `${n.troca_marca} ${n.troca_modelo}` : '—')}
                      {(n.veic_placa || (n.tipo === 'compra' && n.troca_placa)) && <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Placa: {n.veic_placa || n.troca_placa}</div>}
                    </td>
                    <td>
                      {n.tipo === 'compra' ? (
                        <span className="badge badge-disponivel" style={{ fontSize: '.74rem' }}>Compra p/ Estoque</span>
                      ) : n.troca_modelo ? (
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
                      {(n.status === 'cancelada' || user?.perfil === 'admin' || user?.email?.toLowerCase() === 'admin@dgautos.com.br') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          title="Excluir negociação permanentemente"
                          onClick={async () => {
                            if (!confirm(`Tem certeza que deseja excluir a Negociação #${n.id} permanentemente do sistema?`)) return;
                            await deleteNegociacao(n.id);
                            recarregar();
                            alert('✓ Negociação excluída com sucesso!');
                          }}
                        >
                          <Trash2 size={13} />Excluir
                        </button>
                      )}
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

function NegociacaoWizardModal({ inicial, clientes, veiculos, onClose, onSave, onDelete, onConcluir, onCancelarNegociacao, onContrato, user }) {
  const [passo, setPasso] = useState(0);
  const clienteInicial = clientes.find((c) => String(c.id) === String(inicial.cliente_id));

  const [f, setF] = useState({
    ...inicial,
    cliente_nome: inicial.cliente_nome || clienteInicial?.nome || '',
    cliente_cpf_cnpj: inicial.cliente_cpf_cnpj || clienteInicial?.cpf_cnpj || '',
    cliente_telefone: inicial.cliente_telefone || clienteInicial?.telefone || clienteInicial?.whatsapp || '',
    cliente_email: inicial.cliente_email || clienteInicial?.email || '',
    cliente_cep: inicial.cliente_cep || clienteInicial?.cep || '',
    cliente_cidade: inicial.cliente_cidade || clienteInicial?.cidade || '',
    cliente_uf: inicial.cliente_uf || clienteInicial?.uf || 'SC',
    cliente_endereco: inicial.cliente_endereco || clienteInicial?.endereco || '',
    canal_venda: inicial.canal_venda || clienteInicial?.origem || 'LOJA',
    pagamentos: Array.isArray(inicial.pagamentos) && inicial.pagamentos.length
      ? inicial.pagamentos
      : [{ forma: 'Pix / TED', financeira: 'À vista', parcelas: 1, valor: Number(inicial.valor_veiculo) || 0 }]
  });

  const [salvandoNeg, setSalvandoNeg] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState(inicial.cliente_nome || clienteInicial?.nome || '');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const [clienteParaCadastrar, setClienteParaCadastrar] = useState(null);
  const [buscandoPlacaTroca, setBuscandoPlacaTroca] = useState(false);
  const [msgPlacaTroca, setMsgPlacaTroca] = useState('');

  const handleConsultarPlacaTroca = async (placaDig) => {
    const limpo = String(placaDig || f.troca_placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (limpo.length !== 7) return;

    setBuscandoPlacaTroca(true);
    setMsgPlacaTroca('🔍 Consultando dados do veículo pela placa...');
    try {
      const v = await buscarPlaca(limpo);
      if (v) {
        setF((prev) => {
          const anoFab = v.ano ? String(v.ano).slice(0, 4) : '';
          const anoMod = v.ano_modelo ? String(v.ano_modelo).slice(-4) : (v.ano ? String(v.ano).slice(-4) : '');
          const anoCompleto = anoFab && anoMod ? `${anoFab}/${anoMod}` : (v.ano || prev.troca_ano);
          return {
            ...prev,
            troca_placa: limpo,
            troca_marca: v.marca || prev.troca_marca,
            troca_modelo: `${v.modelo || ''} ${v.versao || ''}`.trim() || prev.troca_modelo,
            troca_ano: anoCompleto || prev.troca_ano,
            troca_cor: v.cor || prev.troca_cor,
            fipe: v.fipeValor ? Number(String(v.fipeValor).replace(/[^\d]/g, '')) / 100 : prev.fipe
          };
        });
        setMsgPlacaTroca(`✓ ${v.marca} ${v.modelo} preenchido via API!`);
        setTimeout(() => setMsgPlacaTroca(''), 5000);
      } else {
        setMsgPlacaTroca('Placa não encontrada na base nacional.');
        setTimeout(() => setMsgPlacaTroca(''), 4000);
      }
    } catch (err) {
      console.warn('Erro ao consultar placa:', err);
      setMsgPlacaTroca('');
    } finally {
      setBuscandoPlacaTroca(false);
    }
  };

  const handleTrocaPlacaChange = (e) => {
    const val = mascaraPlaca(e.target.value);
    setF((prev) => ({ ...prev, troca_placa: val }));
    if (val.length === 7) {
      handleConsultarPlacaTroca(val);
    }
  };

  const buscarCep = async (cepVal) => {
    const limpo = String(cepVal || '').replace(/\D/g, '');
    if (limpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setF((prev) => ({
            ...prev,
            cliente_cep: limpo.replace(/(\d{5})(\d{3})/, '$1-$2'),
            cliente_cidade: data.localidade || prev.cliente_cidade,
            cliente_uf: data.uf || prev.cliente_uf,
            cliente_endereco: `${data.logradouro || ''}${data.bairro ? ` - ${data.bairro}` : ''}`.trim() || prev.cliente_endereco
          }));
        }
      } catch {}
    }
  };

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
  const somaPagamentos = (Array.isArray(f.pagamentos) ? f.pagamentos : []).reduce((s, p) => s + (Number(p?.valor) || 0), 0);
  const diferenca = valorLiquido - somaPagamentos;

  const sincronizarTrocaNoPagamento = () => {
    const valTroca = Number(f.troca_valor) || 0;
    if (valTroca <= 0) {
      alert('Informe o valor avaliado do veículo de troca antes de sincronizar.');
      return;
    }
    const outros = (Array.isArray(f.pagamentos) ? f.pagamentos : []).filter((p) => p.forma !== 'Veículo na Troca');
    const restante = Math.max(0, valorLiquido - valTroca);
    setF({
      ...f,
      pagamentos: [
        { forma: 'Veículo na Troca', financeira: `${f.troca_marca || ''} ${f.troca_modelo || ''} ${f.troca_placa || ''}`.trim() || 'Veículo Usado', parcelas: 1, valor: valTroca },
        ...(outros.length ? outros.map((p, i) => i === 0 ? { ...p, valor: restante } : p) : [{ forma: 'Pix / TED', financeira: 'Saldo', parcelas: 1, valor: restante }])
      ]
    });
  };

  const updatePag = (idx, key, val) => {
    const copia = [...(Array.isArray(f.pagamentos) ? f.pagamentos : [])];
    copia[idx] = { ...copia[idx], [key]: val };
    setF({ ...f, pagamentos: copia });
  };

  const addPag = () => setF({
    ...f,
    pagamentos: [...(Array.isArray(f.pagamentos) ? f.pagamentos : []), { forma: 'Financiamento', financeira: 'Banco / Financeira', parcelas: 36, valor: Math.max(0, diferenca) }]
  });

  const rmPag = (idx) => setF({ ...f, pagamentos: (Array.isArray(f.pagamentos) ? f.pagamentos : []).filter((_, i) => i !== idx) });

  const veicSelecionado = (Array.isArray(veiculos) ? veiculos : []).find((v) => String(v?.id) === String(f.veiculo_id));
  const margemEstimada = veicSelecionado
    ? valorLiquido - Number(veicSelecionado.custo || 0) - Number(veicSelecionado.despesas_veiculo || 0) - Number(f.comissao_vendedor || 0)
    : 0;

  return (
    <form
      className="altimus-crud-page"
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvandoNeg(true);
        try {
          await onSave(f);
        } finally {
          setSalvandoNeg(false);
        }
      }}
    >
      {salvandoNeg && (
        <div className="loading-toast">
          <div className="spinner-sm" />
          <span>Salvando negociação e gerando contratos...</span>
        </div>
      )}
      <div className="altimus-crud-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn" onClick={onClose} disabled={salvandoNeg}>← Voltar para Lista</button>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {f.id ? `Contrato / Negociação #${f.id}` : 'Nova Negociação & Contrato'}
          </h2>
          <span className={`badge badge-${f.status}`}>{STATUS_NEG[f.status] || f.status}</span>
        </div>
        <button type="submit" className="btn btn-primary" disabled={salvandoNeg}>
          {salvandoNeg ? (
            <>
              <div className="spinner-sm" />
              <span>Salvando...</span>
            </>
          ) : (
            <>✓ Salvar Proposta</>
          )}
        </button>
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
            </div>

            {/* SEÇÃO DE CLIENTE COM BUSCA, AUTO-COMPLETE E CADASTRO INLINE */}
            <div className="card" style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 10, background: '#fafbfc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '.92rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                  Cliente
                </span>
                {f.cliente_id ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.78rem' }}>
                    <CheckCircle2 size={13} /> Cliente Vinculado (ID #{f.cliente_id})
                  </span>
                ) : f.cliente_nome ? (
                  <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.78rem' }}>
                    + Novo Cadastro Inline (Salvo no banco ao confirmar)
                  </span>
                ) : null}
              </div>

              <div className="form-grid">
                {/* Linha 1: Input de Busca com Dropdown + Origem */}
                <div className="field span-2" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>Cliente *</label>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: '#ede9fe',
                        color: '#6d28d9',
                        fontWeight: 700,
                        border: '1px solid #c4b5fd',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 10px',
                        fontSize: '.78rem',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setClienteParaCadastrar({
                          ...EMPTY_CLI,
                          nome: (buscaCliente || '').toUpperCase()
                        });
                        setModalNovoCliente(true);
                      }}
                    >
                      <UserPlus size={14} /> + Cadastrar Novo Cliente
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)', pointerEvents: 'none' }} />
                    <input
                      className="input"
                      required
                      style={{ paddingLeft: 38, fontWeight: f.cliente_id ? 700 : 400 }}
                      placeholder="Digite nome ou CPF/CNPJ"
                      value={buscaCliente}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBuscaCliente(val);
                        setDropdownAberto(true);
                        setF((prev) => ({
                          ...prev,
                          cliente_nome: val,
                          cliente_id: val.trim() === (clienteInicial?.nome || '').trim() ? prev.cliente_id : null
                        }));
                      }}
                      onFocus={() => setDropdownAberto(true)}
                    />
                    {buscaCliente && (
                      <button
                        type="button"
                        style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                        onClick={() => {
                          setBuscaCliente('');
                          setF((prev) => ({
                            ...prev,
                            cliente_id: null,
                            cliente_nome: '',
                            cliente_cpf_cnpj: '',
                            cliente_telefone: '',
                            cliente_email: '',
                            cliente_cep: '',
                            cliente_cidade: '',
                            cliente_uf: 'SC',
                            cliente_endereco: ''
                          }));
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown de sugestões do banco */}
                  {dropdownAberto && buscaCliente.trim().length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        background: '#ffffff',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        maxHeight: 240,
                        overflowY: 'auto',
                        marginTop: 4
                      }}
                    >
                      {clientes
                        .filter((c) => {
                          const q = buscaCliente.toLowerCase();
                          return (c.nome || '').toLowerCase().includes(q) ||
                                 (c.cpf_cnpj || '').includes(q) ||
                                 (c.telefone || '').includes(q);
                        })
                        .slice(0, 10)
                        .map((c) => (
                          <div
                            key={c.id}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseDown={() => {
                              setF((prev) => ({
                                ...prev,
                                cliente_id: c.id,
                                cliente_nome: c.nome,
                                cliente_cpf_cnpj: c.cpf_cnpj || '',
                                cliente_telefone: c.telefone || c.whatsapp || '',
                                cliente_email: c.email || '',
                                cliente_cep: c.cep || '',
                                cliente_cidade: c.cidade || '',
                                cliente_uf: c.uf || 'SC',
                                cliente_endereco: c.endereco || '',
                                canal_venda: c.origem || prev.canal_venda
                              }));
                              setBuscaCliente(c.nome);
                              setDropdownAberto(false);
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '.88rem', color: 'var(--text)' }}>{c.nome}</strong>
                              <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>
                                {c.cpf_cnpj ? `CPF/CNPJ: ${c.cpf_cnpj}` : 'Sem documento'} {c.telefone ? `· Tel: ${c.telefone}` : ''} {c.cidade ? `· ${c.cidade}/${c.uf || 'SC'}` : ''}
                              </div>
                            </div>
                            <span className="badge badge-success" style={{ fontSize: '.7rem' }}>Selecionar</span>
                          </div>
                        ))}

                      <div
                        style={{
                          padding: '10px 14px',
                          background: '#f8fafc',
                          cursor: 'pointer',
                          fontSize: '.82rem',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                        onMouseDown={() => {
                          setClienteParaCadastrar({
                            ...EMPTY_CLI,
                            nome: (buscaCliente || '').toUpperCase()
                          });
                          setModalNovoCliente(true);
                          setDropdownAberto(false);
                        }}
                      >
                        <Plus size={14} /> Cadastrar novo cliente "{buscaCliente}"
                      </div>
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>Origem de cliente</label>
                  <select className="select" value={f.canal_venda ?? 'LOJA'} onChange={set('canal_venda')}>
                    {['LOJA', 'WHATSAPP', 'OLX', 'WEBMOTORS', 'INSTAGRAM', 'CHAVES_NA_MAO', 'ICARROS', 'SITE_PROPRIO', 'INDICAÇÃO'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Linha 2: CPF/CNPJ, Telefone, E-mail */}
                <div className="field">
                  <label>CPF / CNPJ</label>
                  <input
                    className="input"
                    placeholder="000.000.000-00"
                    value={f.cliente_cpf_cnpj ?? ''}
                    onChange={set('cliente_cpf_cnpj')}
                  />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input
                    className="input"
                    placeholder="(47) 99999-9999"
                    value={f.cliente_telefone ?? ''}
                    onChange={set('cliente_telefone')}
                  />
                </div>
                <div className="field">
                  <label>E-mail</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="cliente@email.com"
                    value={f.cliente_email ?? ''}
                    onChange={set('cliente_email')}
                  />
                </div>

                {/* Linha 3: CEP, Cidade/UF, Endereço */}
                <div className="field">
                  <label>CEP</label>
                  <input
                    className="input"
                    placeholder="00000-000"
                    value={f.cliente_cep ?? ''}
                    onChange={(e) => {
                      set('cliente_cep')(e);
                      buscarCep(e.target.value);
                    }}
                    onBlur={(e) => buscarCep(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Cidade / UF</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 6 }}>
                    <input
                      className="input"
                      placeholder="Cidade"
                      value={f.cliente_cidade ?? ''}
                      onChange={set('cliente_cidade')}
                    />
                    <input
                      className="input"
                      placeholder="SC"
                      maxLength={2}
                      style={{ textTransform: 'uppercase' }}
                      value={f.cliente_uf ?? 'SC'}
                      onChange={set('cliente_uf')}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Endereço</label>
                  <input
                    className="input"
                    placeholder="Rua, número, bairro..."
                    value={f.cliente_endereco ?? ''}
                    onChange={set('cliente_endereco')}
                  />
                </div>
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
                    {(Array.isArray(veiculos) ? veiculos : []).filter(Boolean).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.marca || ''} {v.modelo || ''} ({v.ano || '—'}) — Placa {v.placa || '—'} — Preço: {brl(v.preco || 0)} [{STATUS?.[v?.status] || v?.status || 'Disponível'}]
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ margin: 0 }}>Placa (Troca)</label>
                          {buscandoPlacaTroca ? (
                            <span style={{ fontSize: '.72rem', color: '#6d28d9', fontWeight: 700 }}>Buscando...</span>
                          ) : (
                            f.troca_placa && f.troca_placa.length === 7 && (
                              <button
                                type="button"
                                onClick={() => handleConsultarPlacaTroca(f.troca_placa)}
                                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                              >
                                🔄 Buscar API
                              </button>
                            )
                          )}
                        </div>
                        <input
                          className="input"
                          maxLength={7}
                          value={f.troca_placa ?? ''}
                          onChange={handleTrocaPlacaChange}
                          onBlur={(e) => {
                            if (e.target.value.length === 7) handleConsultarPlacaTroca(e.target.value);
                          }}
                          style={{ textTransform: 'uppercase', fontWeight: 700 }}
                          placeholder="ABC1D23"
                        />
                        {msgPlacaTroca && (
                          <div style={{ fontSize: '.74rem', color: msgPlacaTroca.startsWith('✓') ? 'var(--success)' : '#6d28d9', fontWeight: 700, marginTop: 4 }}>
                            {msgPlacaTroca}
                          </div>
                        )}
                      </div>
                      <div className="field">
                        <label>KM Hodômetro (Troca) *</label>
                        <input className="input" type="number" value={f.troca_km ?? 0} onChange={set('troca_km')} placeholder="Hodômetro conferido" />
                      </div>
                      <div className="field span-2">
                        <label>Valor Avaliado na Troca (R$)</label>
                        <input className="input" type="number" value={f.troca_valor ?? 0} onChange={set('troca_valor')} />
                      </div>

                      {/* LEMBRETE OBRIGATÓRIO DE PROCEDÊNCIA: DETRAN E AUTOLOOK */}
                      <div
                        style={{
                          gridColumn: 'span 3',
                          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                          color: '#ffffff',
                          borderRadius: 10,
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          marginTop: 6,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
                            <strong style={{ fontSize: '.92rem', color: '#ffffff' }}>
                              Lembrete de Procedência: Consulte DETRAN e Leilão antes de fechar a troca!
                            </strong>
                          </div>
                          <span style={{ fontSize: '.78rem', color: '#cbd5e1' }}>
                            Verifique débitos, gravames e histórico completo no leilão antes de avaliar o veículo de entrada.
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: '#2563eb', color: '#fff', fontWeight: 700, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.8rem', padding: '7px 14px', borderRadius: 6 }}
                            onClick={() => {
                              const p = (f.troca_placa || '').trim().toUpperCase();
                              const url = `https://servicos.detran.sc.gov.br/consulta-dossie-veiculo?placa=${encodeURIComponent(p)}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            title="Abrir Consulta Oficial DETRAN-SC"
                          >
                            <Search size={14} /> DETRAN-SC ↗
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: '#d97706', color: '#fff', fontWeight: 700, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.8rem', padding: '7px 14px', borderRadius: 6 }}
                            onClick={() => {
                              window.open('https://www.autolook.com.br/', '_blank', 'noopener,noreferrer');
                            }}
                            title="Abrir Autolook para consulta completa de Leilão, Sinistro e Gravames"
                          >
                            <ShieldCheck size={14} /> Consulta Leilão (Autolook) ↗
                          </button>
                        </div>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label style={{ margin: 0 }}>Placa *</label>
                        {buscandoPlacaTroca ? (
                          <span style={{ fontSize: '.72rem', color: '#6d28d9', fontWeight: 700 }}>Buscando...</span>
                        ) : (
                          f.troca_placa && f.troca_placa.length === 7 && (
                            <button
                              type="button"
                              onClick={() => handleConsultarPlacaTroca(f.troca_placa)}
                              style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                            >
                              🔄 Buscar API
                            </button>
                          )
                        )}
                      </div>
                      <input
                        className="input"
                        maxLength={7}
                        style={{ textTransform: 'uppercase', fontWeight: 700 }}
                        value={f.troca_placa ?? ''}
                        onChange={handleTrocaPlacaChange}
                        onBlur={(e) => {
                          if (e.target.value.length === 7) handleConsultarPlacaTroca(e.target.value);
                        }}
                        placeholder="ABC1D23"
                      />
                      {msgPlacaTroca && (
                        <div style={{ fontSize: '.74rem', color: msgPlacaTroca.startsWith('✓') ? 'var(--success)' : '#6d28d9', fontWeight: 700, marginTop: 4 }}>
                          {msgPlacaTroca}
                        </div>
                      )}
                    </div>
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
                      <label>KM Hodômetro Atual *</label>
                      <input className="input" type="number" value={f.troca_km ?? 0} onChange={set('troca_km')} />
                    </div>
                    <div className="field span-2">
                      <label>Valor de {f.tipo === 'compra' ? 'Compra (R$)' : 'Avaliação (R$)'} *</label>
                      <input className="input" type="number" value={f.valor_veiculo ?? f.troca_valor ?? 0} onChange={(e) => setF({ ...f, valor_veiculo: Number(e.target.value), troca_valor: Number(e.target.value) })} />
                    </div>

                    {/* LEMBRETE OBRIGATÓRIO DE PROCEDÊNCIA: DETRAN E AUTOLOOK NA COMPRA */}
                    <div
                      style={{
                        gridColumn: 'span 3',
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        color: '#ffffff',
                        borderRadius: 10,
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                        marginTop: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
                          <strong style={{ fontSize: '.92rem', color: '#ffffff' }}>
                            Lembrete de Procedência: Consulte DETRAN e Leilão antes de comprar!
                          </strong>
                        </div>
                        <span style={{ fontSize: '.78rem', color: '#cbd5e1' }}>
                          Verifique débitos, multas, gravames, sinistros e leilão oficial com os botões rápidos.
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: '#2563eb', color: '#fff', fontWeight: 700, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.8rem', padding: '7px 14px', borderRadius: 6 }}
                          onClick={() => {
                            const p = (f.troca_placa || '').trim().toUpperCase();
                            const url = `https://servicos.detran.sc.gov.br/consulta-dossie-veiculo?placa=${encodeURIComponent(p)}`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          title="Abrir Consulta Oficial DETRAN-SC"
                        >
                          <Search size={14} /> DETRAN-SC ↗
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: '#d97706', color: '#fff', fontWeight: 700, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.8rem', padding: '7px 14px', borderRadius: 6 }}
                          onClick={() => {
                            window.open('https://www.autolook.com.br/', '_blank', 'noopener,noreferrer');
                          }}
                          title="Abrir Autolook para consulta completa de Leilão, Sinistro e Gravames"
                        >
                          <ShieldCheck size={14} /> Consulta Leilão (Autolook) ↗
                        </button>
                      </div>
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
                const isAdmin = user?.perfil === 'admin' || user?.email?.toLowerCase() === 'admin@dgautos.com.br';
                if (!isAdmin) {
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
          {f.id && (f.status === 'cancelada' || user?.perfil === 'admin' || user?.email?.toLowerCase() === 'admin@dgautos.com.br') && (
            <button
              type="button"
              className="btn btn-danger"
              style={{ background: '#dc2626', color: '#fff' }}
              onClick={async () => {
                if (!confirm(`Tem certeza que deseja excluir permanentemente a Negociação #${f.id}?`)) return;
                if (onDelete) await onDelete(f.id);
              }}
            >
              <Trash2 size={16} /> Excluir Negociação
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
          <button type="button" className="btn" onClick={onClose} disabled={salvandoNeg}>Fechar</button>
          <button type="submit" className="btn btn-primary" disabled={salvandoNeg}>
            {salvandoNeg ? (
              <>
                <div className="spinner-sm" />
                <span>Salvando...</span>
              </>
            ) : (
              <>✓ Salvar Proposta</>
            )}
          </button>
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

      {modalNovoCliente && clienteParaCadastrar && (
        <ClienteModalAltimus
          inicial={clienteParaCadastrar}
          user={user}
          onClose={() => {
            setModalNovoCliente(false);
            setClienteParaCadastrar(null);
          }}
          onSave={async (cli) => {
            try {
              const res = await saveCliente(cli);
              const lista = Array.isArray(res) ? res : [];
              const novo = res.savedItem || lista.find((c) => (cli.cpf_cnpj && c.cpf_cnpj === cli.cpf_cnpj) || c.nome === cli.nome) || cli;

              setF((prev) => ({
                ...prev,
                cliente_id: novo.id,
                cliente_nome: novo.nome,
                cliente_cpf_cnpj: novo.cpf_cnpj || '',
                cliente_telefone: novo.telefone || novo.whatsapp || '',
                cliente_email: novo.email || '',
                cliente_cep: novo.cep || '',
                cliente_cidade: novo.cidade || '',
                cliente_uf: novo.uf || 'SC',
                cliente_endereco: novo.endereco || '',
                canal_venda: novo.origem || prev.canal_venda
              }));
              setBuscaCliente(novo.nome);
              setModalNovoCliente(false);
              setClienteParaCadastrar(null);
            } catch (err) {
              alert('Erro ao salvar cliente: ' + err.message);
            }
          }}
          onDelete={() => {}}
        />
      )}
    </form>
  );
}
