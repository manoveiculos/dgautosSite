import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Phone, MessageCircle, Calendar, Car, Tag, ArrowRight,
  CheckCircle2, Clock, User, Trash2, X, Send, Handshake, LayoutGrid, List
} from 'lucide-react';
import {
  getOportunidades, saveOportunidade, moveOportunidadeEstagio, deleteOportunidade,
  getVeiculos, getClientes, saveCliente, saveNegociacao,
  brl, ESTAGIOS_CRM, ORIGENS_LEAD, ETIQUETAS_CRM, TIPOS_ACAO_CRM, MOTIVOS_CONCLUSAO
} from '../store';

const EMPTY_OP = {
  nome_lead: '', telefone: '', email: '', cliente_id: '', veiculo_id: '',
  veiculo_interesse: '', troca_veiculo: '', valor_proposta: '',
  origem: 'WHATSAPP', estagio: 'pendente', etiquetas: ['Quente'],
  proxima_acao_tipo: 'Contato', proxima_acao_data: '', motivo_conclusao: '', historico: []
};

export default function Crm({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lista, setLista] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [modo, setModo] = useState('kanban'); // kanban | lista | acoes
  const [busca, setBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');
  const [estagioMobile, setEstagioMobile] = useState(''); // '' = todos
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    getOportunidades().then((res) => setLista(Array.isArray(res) ? res : [])).catch(() => {});
    getVeiculos().then((res) => setVeiculos(Array.isArray(res) ? res : [])).catch(() => {});
    getClientes().then((res) => setClientes(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setEditando(EMPTY_OP);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtradas = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    return arr.filter((o) => {
      if (!o) return false;
      if (filtroOrigem && o.origem !== filtroOrigem) return false;
      if (filtroEtiqueta && !(o.etiquetas || []).includes(filtroEtiqueta)) return false;
      const termo = `${o.nome_lead || ''} ${o.telefone || ''} ${o.veiculo_interesse || ''} ${o.veic_modelo || ''} ${o.troca_veiculo || ''}`.toLowerCase();
      return termo.includes(busca.toLowerCase());
    });
  }, [lista, busca, filtroOrigem, filtroEtiqueta]);

  const acoesPendentes = useMemo(() => {
    const arr = Array.isArray(filtradas) ? filtradas : [];
    return arr.filter((o) => o?.proxima_acao_data && !['concluido', 'perdido'].includes(o.estagio))
      .sort((a, b) => new Date(a.proxima_acao_data) - new Date(b.proxima_acao_data));
  }, [filtradas]);

  const mover = async (op, novoEstagio) => {
    let motivo = op.motivo_conclusao;
    if (novoEstagio === 'concluido') motivo = 'Vendido';
    if (novoEstagio === 'perdido' && !motivo) {
      motivo = prompt('Motivo do arquivamento/perda (ex: Somente pesquisando, Cliente com Restrição, Valor incompatível):', 'Somente pesquisando') || 'Somente pesquisando';
    }
    const res = await moveOportunidadeEstagio(op.id, novoEstagio, motivo);
    setLista(res);
  };

  const converterEmNegociacao = async (op) => {
    try {
      let clienteId = op.cliente_id;
      if (!clienteId) {
        const novosClientes = await saveCliente({
          tipo_pessoa: 'PF',
          papel: 'cliente',
          nome: op.nome_lead,
          telefone: op.telefone,
          whatsapp: op.telefone,
          email: op.email,
          origem: op.origem,
          observacoes: `Gerado a partir da Oportunidade CRM #${op.id}`
        });
        setClientes(novosClientes);
        clienteId = novosClientes[0]?.id;
      }
      const veic = veiculos.find((v) => v.id === Number(op.veiculo_id));
      const precoBase = Number(op.valor_proposta) || veic?.preco || 0;
      await saveNegociacao({
        tipo: op.troca_veiculo ? 'troca' : 'venda',
        status: 'aberta',
        cliente_id: clienteId,
        veiculo_id: op.veiculo_id || null,
        canal_venda: op.origem.replace('PORTAL_', ''),
        valor_veiculo: precoBase,
        desconto: 0,
        troca_modelo: op.troca_veiculo || '',
        pagamentos: [{ forma: 'Pix / TED', financeira: 'A definir', parcelas: 1, valor: precoBase }],
        observacoes: `Originado do CRM Lead: ${op.nome_lead}. ${op.troca_veiculo ? `Troca informada: ${op.troca_veiculo}` : ''}`
      });
      await moveOportunidadeEstagio(op.id, 'negociacao', null);
      navigate('/negociacoes');
    } catch (e) {
      alert(e.message);
    }
  };

  const corEtiqueta = (label) => ETIQUETAS_CRM.find((e) => e.label === label)?.cor || '#6366f1';

  return (
    <>
      <header className="topbar">
        <div>
          <h1>CRM — Atendimento de Interessados</h1>
          <p>Acompanhe clientes do WhatsApp, OLX, Webmotors e loja física passo a passo até a venda.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button className={`tab ${modo === 'kanban' ? 'active' : ''}`} onClick={() => setModo('kanban')}>
              <LayoutGrid size={15} />Quadro
            </button>
            <button className={`tab ${modo === 'lista' ? 'active' : ''}`} onClick={() => setModo('lista')}>
              <List size={15} />Lista ({filtradas.length})
            </button>
            <button className={`tab ${modo === 'acoes' ? 'active' : ''}`} onClick={() => setModo('acoes')}>
              <Clock size={15} />Retornos ({acoesPendentes.length})
            </button>
          </div>
          <button id="btn-nova-oportunidade" className="btn btn-primary" onClick={() => setEditando(EMPTY_OP)}>
            <Plus size={16} />Novo Interessado
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Nome do cliente, WhatsApp, carro de interesse…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select className="select" style={{ maxWidth: 210 }} value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)}>
          <option value="">Todos os canais (Whats, OLX…)</option>
          {Object.entries(ORIGENS_LEAD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 200 }} value={filtroEtiqueta} onChange={(e) => setFiltroEtiqueta(e.target.value)}>
          <option value="">Todas as temperaturas</option>
          {ETIQUETAS_CRM.map((e) => <option key={e.label} value={e.label}>{e.label}</option>)}
        </select>
      </div>

      {modo === 'kanban' && (
        <>
          {/* SELETOR RÁPIDO DE ETAPA PARA CELULAR / TELAS MENORES */}
          <div className="mobile-stage-pills">
            <button
              type="button"
              className={`stage-pill ${estagioMobile === '' ? 'active' : ''}`}
              onClick={() => setEstagioMobile('')}
            >
              Todas ({filtradas.length})
            </button>
            {ESTAGIOS_CRM.map((est) => {
              const qtd = filtradas.filter((o) => o.estagio === est.id).length;
              return (
                <button
                  key={est.id}
                  type="button"
                  className={`stage-pill ${estagioMobile === est.id ? 'active' : ''}`}
                  onClick={() => setEstagioMobile(est.id)}
                >
                  {est.label} ({qtd})
                </button>
              );
            })}
          </div>

          <div className="kanban">
            {ESTAGIOS_CRM.filter((est) => !estagioMobile || est.id === estagioMobile).map((est) => {
              const cards = filtradas.filter((o) => o.estagio === est.id);
              const somaCol = cards.reduce((s, o) => s + (Number(o.valor_proposta) || Number(o.veic_preco) || 0), 0);
              return (
                <div key={est.id} className="kanban-col">
                  <div className="kanban-head" style={{ borderBottomColor: est.cor }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: est.cor }} />
                      {est.label}
                    </span>
                    <span className="kanban-count">{cards.length}</span>
                  </div>
                  <small style={{ color: 'var(--muted)', padding: '0 6px', fontSize: '.76rem' }}>
                    Total na etapa: <strong style={{ color: 'var(--text)' }}>{brl(somaCol)}</strong>
                  </small>

                  {cards.map((o) => (
                    <article key={o.id} className="kanban-card" onClick={() => setEditando(o)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                        <div>
                          <strong style={{ fontSize: '.96rem', display: 'block', lineHeight: 1.25 }}>{o.nome_lead}</strong>
                          {o.telefone && (
                            <small style={{ color: 'var(--muted)', fontSize: '.76rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Phone size={11} /> {o.telefone}
                            </small>
                          )}
                        </div>
                        <span className="badge" style={{ fontSize: '.68rem', flexShrink: 0 }}>
                          {ORIGENS_LEAD[o.origem] || o.origem}
                        </span>
                      </div>

                      {(o.etiquetas || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {o.etiquetas.map((t) => (
                            <span key={t} className="tag-pill" style={{ background: corEtiqueta(t) }}>{t}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--color-neutral-80)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: '.68rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                          Interesse do Cliente
                        </span>
                        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '.86rem' }}>
                          🚗 {o.veic_modelo ? `${o.veic_marca} ${o.veic_modelo}` : (o.veiculo_interesse || 'Veículo a definir')}
                        </span>
                        {o.troca_veiculo && (
                          <small style={{ color: 'var(--primary-2)', fontWeight: 600 }}>🔄 Dá na troca: {o.troca_veiculo}</small>
                        )}
                        {(o.valor_proposta > 0 || o.veic_preco > 0) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                            <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Valor / Proposta:</span>
                            <strong style={{ color: 'var(--success)', fontSize: '.92rem' }}>
                              {brl(o.valor_proposta || o.veic_preco)}
                            </strong>
                          </div>
                        )}
                      </div>

                      {o.proxima_acao_data && (
                        <div style={{ fontSize: '.76rem', padding: '6px 9px', borderRadius: 8, background: 'hsla(38, 95%, 60%, .14)', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          <Calendar size={13} />
                          Lembrete ({o.proxima_acao_tipo}): {new Date(o.proxima_acao_data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)', gap: 6, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {o.telefone && (
                            <a
                              href={`https://wa.me/55${String(o.telefone).replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${o.nome_lead.split(' ')[0]}, tudo bem? Aqui é da revenda sobre o ${o.veic_modelo || o.veiculo_interesse || 'veículo'}!`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-sm btn-success"
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle size={13} /> Whats
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            title="Transformar em Venda / Negociação"
                            onClick={() => converterEmNegociacao(o)}
                          >
                            <Handshake size={13} /> Vender
                          </button>
                        </div>
                        <select
                          className="select"
                          title="Mudar etapa do atendimento"
                          style={{ width: 'auto', padding: '5px 8px', fontSize: '.74rem' }}
                          value={o.estagio}
                          onChange={(e) => mover(o, e.target.value)}
                        >
                          {ESTAGIOS_CRM.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {modo === 'lista' && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Lead / Cliente</th>
                <th>Origem</th>
                <th>Veículo de Interesse</th>
                <th>Troca</th>
                <th>Proposta</th>
                <th>Estágio</th>
                <th>Próxima Ação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o) => (
                <tr key={o.id} onClick={() => setEditando(o)}>
                  <td>
                    <strong>{o.nome_lead}</strong>
                    <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{o.telefone || o.email}</div>
                  </td>
                  <td>{ORIGENS_LEAD[o.origem] || o.origem}</td>
                  <td>{o.veic_modelo ? `${o.veic_marca} ${o.veic_modelo}` : (o.veiculo_interesse || '—')}</td>
                  <td>{o.troca_veiculo || '—'}</td>
                  <td><strong>{brl(o.valor_proposta || o.veic_preco)}</strong></td>
                  <td>
                    <span className="badge" style={{ background: `${ESTAGIOS_CRM.find((s) => s.id === o.estagio)?.cor}22`, color: ESTAGIOS_CRM.find((s) => s.id === o.estagio)?.cor }}>
                      {ESTAGIOS_CRM.find((s) => s.id === o.estagio)?.label}
                    </span>
                  </td>
                  <td>
                    {o.proxima_acao_data
                      ? `${o.proxima_acao_tipo} em ${new Date(o.proxima_acao_data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                      : '—'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-sm btn-primary" onClick={() => converterEmNegociacao(o)}>
                      <Handshake size={14} />Gerar Negociação
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modo === 'acoes' && (
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Agenda de Retornos, Visitas e Test-drives</h3>
          {acoesPendentes.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Nenhuma ação pendente agendada.</p>
          ) : (
            acoesPendentes.map((o) => (
              <div key={o.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => setEditando(o)}>
                <div>
                  <strong>{o.proxima_acao_tipo}: {o.nome_lead}</strong>
                  <div style={{ fontSize: '.83rem', color: 'var(--muted)' }}>
                    Veículo: {o.veic_modelo ? `${o.veic_marca} ${o.veic_modelo}` : o.veiculo_interesse} · Tel: {o.telefone}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge badge-pendente">
                    <Calendar size={13} />
                    {new Date(o.proxima_acao_data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); converterEmNegociacao(o); }}>
                    <Handshake size={14} />Negociar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {editando && (
        <OportunidadeModal
          inicial={editando}
          user={user}
          veiculos={veiculos}
          clientes={clientes}
          onClose={() => setEditando(null)}
          onSave={async (op) => {
            try {
              const r = await saveOportunidade(op);
              setLista(Array.isArray(r) ? r : []);
              setEditando(null);
              alert('✓ Oportunidade salva com sucesso no CRM!');
            } catch (err) {
              alert('Erro ao salvar oportunidade: ' + err.message);
            }
          }}
          onDelete={async (id) => {
            try {
              const r = await deleteOportunidade(id);
              setLista(Array.isArray(r) ? r : []);
              setEditando(null);
              alert('✓ Oportunidade excluída com sucesso do CRM!');
            } catch (err) {
              alert('Erro ao excluir: ' + err.message);
            }
          }}
          onNegociar={converterEmNegociacao}
        />
      )}
    </>
  );
}

function OportunidadeModal({ inicial, user, veiculos, clientes, onClose, onSave, onDelete, onNegociar }) {
  const [f, setF] = useState({
    ...inicial,
    etiquetas: Array.isArray(inicial.etiquetas) ? inicial.etiquetas : [],
    historico: Array.isArray(inicial.historico) ? inicial.historico : [],
  });
  const [novaNota, setNovaNota] = useState('');
  const [tipoNota, setTipoNota] = useState('Contato');

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const toggleEtiqueta = (label) => {
    const atual = f.etiquetas || [];
    setF({
      ...f,
      etiquetas: atual.includes(label) ? atual.filter((x) => x !== label) : [...atual, label]
    });
  };

  const addHistorico = () => {
    if (!novaNota.trim()) return;
    const item = {
      data: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      autor: user?.nome || 'Vendedor',
      tipo: tipoNota,
      texto: novaNota.trim()
    };
    setF({ ...f, historico: [item, ...(f.historico || [])] });
    setNovaNota('');
  };

  const selecionarVeiculo = (e) => {
    const id = e.target.value;
    const v = veiculos.find((x) => String(x.id) === String(id));
    setF({
      ...f,
      veiculo_id: id,
      veiculo_interesse: v ? `${v.marca} ${v.modelo} ${v.ano}` : f.veiculo_interesse,
      valor_proposta: f.valor_proposta || (v ? v.preco : '')
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
        <div className="modal-head">
          <h2>{f.id ? `Oportunidade #${f.id} — ${f.nome_lead}` : 'Nova Oportunidade (CRM)'}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-grid">
          <div className="field span-2">
            <label>Nome do Lead / Cliente *</label>
            <input className="input" required value={f.nome_lead} onChange={set('nome_lead')} placeholder="Ex.: Marcos Vinícius Andrade" />
          </div>
          <div className="field">
            <label>Origem do Lead (Portais / Canais)</label>
            <select className="select" value={f.origem} onChange={set('origem')}>
              {Object.entries(ORIGENS_LEAD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Telefone / WhatsApp</label>
            <input className="input" value={f.telefone ?? ''} onChange={set('telefone')} placeholder="(47) 99999-0000" />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" value={f.email ?? ''} onChange={set('email')} placeholder="cliente@email.com" />
          </div>
          <div className="field">
            <label>Vincular a Cliente Cadastrado</label>
            <select className="select" value={f.cliente_id ?? ''} onChange={(e) => {
              const cli = clientes.find((c) => String(c.id) === e.target.value);
              setF({
                ...f,
                cliente_id: e.target.value,
                nome_lead: cli ? cli.nome : f.nome_lead,
                telefone: cli ? (cli.whatsapp || cli.telefone) : f.telefone,
                email: cli ? cli.email : f.email
              });
            }}>
              <option value="">— Selecionar se já cadastrado —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.cpf_cnpj || c.telefone})</option>)}
            </select>
          </div>

          <div className="field span-2">
            <label>Veículo do Estoque (Interesse)</label>
            <select className="select" value={f.veiculo_id ?? ''} onChange={selecionarVeiculo}>
              <option value="">— Selecionar veículo em estoque —</option>
              {veiculos.filter((v) => v.status !== 'vendido' || v.id === f.veiculo_id).map((v) => (
                <option key={v.id} value={v.id}>{v.marca} {v.modelo} ({v.ano}) — {brl(v.preco)} [{v.placa}]</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Valor da Proposta (R$)</label>
            <input className="input" type="number" value={f.valor_proposta ?? ''} onChange={set('valor_proposta')} />
          </div>

          <div className="field span-2">
            <label>Descrição livre do interesse (caso procure modelo fora de estoque)</label>
            <input className="input" value={f.veiculo_interesse ?? ''} onChange={set('veiculo_interesse')} placeholder="Ex.: SUV Automático até R$ 130 mil" />
          </div>
          <div className="field">
            <label>Veículo na Troca (Avaliação)</label>
            <input className="input" value={f.troca_veiculo ?? ''} onChange={set('troca_veiculo')} placeholder="Ex.: Civic LXR 2016 (~R$ 72k)" />
          </div>

          <div className="field">
            <label>Estágio do Atendimento</label>
            <select className="select" value={f.estagio} onChange={set('estagio')}>
              {ESTAGIOS_CRM.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Próxima Ação</label>
            <select className="select" value={f.proxima_acao_tipo ?? 'Contato'} onChange={set('proxima_acao_tipo')}>
              {TIPOS_ACAO_CRM.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Data/Hora da Próxima Ação</label>
            <input className="input" type="datetime-local" value={(f.proxima_acao_data || '').slice(0, 16)} onChange={set('proxima_acao_data')} />
          </div>

          {['concluido', 'perdido'].includes(f.estagio) && (
            <div className="field span-3">
              <label>Motivo de Conclusão / Arquivamento</label>
              <select className="select" value={f.motivo_conclusao ?? ''} onChange={set('motivo_conclusao')}>
                <option value="">Selecione o motivo…</option>
                {MOTIVOS_CONCLUSAO.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          <div className="field span-3">
            <label>Etiquetas de Atendimento</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {ETIQUETAS_CRM.map((et) => {
                const ativo = (f.etiquetas || []).includes(et.label);
                return (
                  <button
                    key={et.label}
                    type="button"
                    onClick={() => toggleEtiqueta(et.label)}
                    className="tag-pill"
                    style={{
                      background: ativo ? et.cor : 'transparent',
                      border: `1px solid ${et.cor}`,
                      color: ativo ? '#fff' : 'var(--text)',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: '.78rem'
                    }}
                  >
                    {ativo ? '✓ ' : '+ '}{et.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Histórico de Interações / Anotações */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>Histórico de Atendimento / Anotações</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select className="select" style={{ maxWidth: 150 }} value={tipoNota} onChange={(e) => setTipoNota(e.target.value)}>
              {TIPOS_ACAO_CRM.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              className="input"
              placeholder="Registrar ligação, proposta enviada, visita ou observação…"
              value={novaNota}
              onChange={(e) => setNovaNota(e.target.value)}
            />
            <button type="button" className="btn btn-primary" onClick={addHistorico}>
              <Send size={15} />Registrar
            </button>
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(f.historico || []).length === 0 ? (
              <small style={{ color: 'var(--muted)' }}>Nenhuma interação registrada ainda.</small>
            ) : (
              f.historico.map((h, idx) => (
                <div key={idx} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-neutral-80)', border: '1px solid var(--border)', fontSize: '.84rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '.75rem', marginBottom: 3 }}>
                    <span><strong>{h.tipo}</strong> por {h.autor}</span>
                    <span>{h.data}</span>
                  </div>
                  <div>{h.texto}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-actions">
          {f.id && (
            <>
              <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }}
                onClick={() => confirm('Excluir esta oportunidade?') && onDelete(f.id)}>
                <Trash2 size={16} />Excluir
              </button>
              <button type="button" className="btn btn-success" onClick={() => onNegociar(f)}>
                <Handshake size={16} />Converter em Negociação
              </button>
            </>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Salvar Oportunidade</button>
        </div>
      </form>
    </div>
  );
}
