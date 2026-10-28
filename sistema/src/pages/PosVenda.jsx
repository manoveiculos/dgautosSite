import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert, ShieldCheck, Plus, Search, Calendar, CheckCircle2,
  AlertTriangle, Wrench, Printer, Trash2, X, Phone, User, Car,
  FileText, Clock, ExternalLink, ArrowRight, MessageCircle
} from 'lucide-react';
import {
  getChamadosGarantia, saveChamadoGarantia, deleteChamadoGarantia,
  getVeiculos, getClientes, getNegociacoes, getConfig,
  brl, dataBr
} from '../store';

const STATUS_GARANTIA = {
  aberto: 'Aguardando Análise',
  em_reparo: 'Em Reparo / Oficina',
  concluido: 'Concluído / Quitado',
  improcedente: 'Improcedente (Desgaste Natural)'
};

const SISTEMAS_VEICULO = [
  'Motor (Bloco, Cabeçote, Lubrificação)',
  'Câmbio / Transmissão / Embreagem',
  'Suspensão, Molas & Amortecedores',
  'Sistema de Freios (Pastilhas, Discos)',
  'Ar Condicionado & Ventilação',
  'Sistema Elétrico, Bateria & Alternador',
  'Arrefecimento & Radiador',
  'Direção Hidráulica / Elétrica',
  'Acabamento, Vidros & Fechaduras',
  'Outros'
];

export default function PosVenda({ user }) {
  const [chamados, setChamados] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [negociacoes, setNegociacoes] = useState([]);
  const [loja, setLoja] = useState(null);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroSistema, setFiltroSistema] = useState('');
  const [editando, setEditando] = useState(null);
  const [imprimindoTermo, setImprimindoTermo] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = async () => {
    try {
      const [chs, vs, cs, ns, cfg] = await Promise.all([
        getChamadosGarantia(),
        getVeiculos(),
        getClientes(),
        getNegociacoes(),
        getConfig()
      ]);
      setChamados(Array.isArray(chs) ? chs : []);
      setVeiculos(Array.isArray(vs) ? vs : []);
      setClientes(Array.isArray(cs) ? cs : []);
      setNegociacoes(Array.isArray(ns) ? ns : []);
      if (cfg?.loja) setLoja(cfg.loja);
    } catch (e) {
      console.warn('Erro ao carregar pós-venda:', e);
    }
  };

  useEffect(() => {
    recarregar();
  }, []);

  // Cálculos de dias desde a venda para verificação do CDC (90 dias)
  const calcularVigencia = (dataVenda) => {
    if (!dataVenda) return { dias: 0, coberto: true, texto: 'Sem data de venda' };
    const diff = Math.max(0, Math.round((Date.now() - new Date(dataVenda)) / 86400000));
    const coberto = diff <= 90;
    return {
      dias: diff,
      coberto,
      texto: coberto ? `🟢 Dia ${diff} de 90 (Garantia Legal Ativa)` : `🔴 Expirada há ${diff - 90} dia(s)`
    };
  };

  const filtrados = useMemo(() => {
    return chamados.filter((c) => {
      if (filtroStatus && c.status !== filtroStatus) return false;
      if (filtroSistema && c.sistema !== filtroSistema) return false;
      const t = `${c.cliente_nome || ''} ${c.veiculo_desc || ''} ${c.placa || ''} ${c.protocolo || ''}`.toLowerCase();
      return t.includes(busca.toLowerCase());
    });
  }, [chamados, busca, filtroStatus, filtroSistema]);

  const totais = useMemo(() => {
    const abertos = chamados.filter((c) => ['aberto', 'em_reparo'].includes(c.status)).length;
    const concluidos = chamados.filter((c) => c.status === 'concluido').length;
    const custoTotal = chamados.reduce((s, c) => s + Number(c.custo_reparo || 0), 0);
    return { abertos, concluidos, custoTotal, total: chamados.length };
  }, [chamados]);

  const handleSalvar = async (ch) => {
    setSalvando(true);
    try {
      const atualizados = await saveChamadoGarantia(ch);
      setChamados(atualizados);
      setEditando(null);
      alert('✓ Ocorrência de pós-venda gravada com sucesso!');
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta ocorrência de garantia?')) return;
    try {
      const atualizados = await deleteChamadoGarantia(id);
      setChamados(atualizados);
      alert('✓ Ocorrência excluída com sucesso.');
    } catch (e) {
      alert('Erro ao excluir: ' + e.message);
    }
  };

  // ============================================================================
  // IMPRESSÃO OFICIAL: TERMO DE ENCERRAMENTO E QUITAÇÃO DE GARANTIA (A4)
  // ============================================================================
  if (imprimindoTermo) {
    const ch = imprimindoTermo;
    const cidEmp = loja?.cidade || 'Rio do Sul';
    const sigEmp = loja?.uf || 'SC';

    return (
      <div>
        <div className="topbar no-print" style={{ marginBottom: 16 }}>
          <div>
            <h1>Termo de Encerramento e Quitação de Garantia — DG Automóveis</h1>
            <p>Documento oficial emitido para assinatura do cliente após conclusão do reparo.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setImprimindoTermo(null)}>← Voltar ao Pós-Venda</button>
            <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} />Imprimir Termo A4</button>
          </div>
        </div>

        <div className="doc-preview" style={{ background: '#ffffff', color: '#111827', padding: '36px 42px', fontSize: '.92rem', lineHeight: 1.6 }}>
          {/* CABEÇALHO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111827', paddingBottom: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <img src="/logo-dg.png" alt="DG Automóveis" style={{ height: 50, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                  {loja?.nome_fantasia || 'DG AUTOMÓVEIS'}
                </h2>
                <div style={{ fontSize: '.80rem', color: '#4b5563' }}>
                  {loja?.razao_social || 'DG Automóveis Comércio de Veículos Ltda'} · CNPJ: {loja?.cnpj || '35.236.994/0001-24'}<br />
                  {loja?.endereco || 'Rua Dom Pedro II, 461 - Canoas'} — {cidEmp}/{sigEmp} · Tel: {loja?.telefone || '(47) 98916-9598'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '.84rem' }}>
              <strong>TERMO DE GARANTIA Nº #{ch.protocolo || ch.id}</strong><br />
              Data de Entrega: {new Date().toLocaleDateString('pt-BR')}<br />
              <span className="badge badge-success" style={{ fontSize: '.72rem', textTransform: 'uppercase' }}>Reparo Finalizado</span>
            </div>
          </div>

          <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
            TERMO DE RECEBIMENTO, TESTE E QUITAÇÃO DE REPARO EM GARANTIA LEGAL
          </h3>

          <div className="doc-box" style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 16 }}>
            <strong>DADOS DO VEÍCULO:</strong> {ch.veiculo_desc} · Placa: <strong>{ch.placa || '—'}</strong> · KM Atual de Entrega: <strong>{Number(ch.km_retorno || ch.km_entrada || 0).toLocaleString('pt-BR')} km</strong><br />
            <strong>PROPRIETÁRIO(A) / CLIENTE:</strong> <strong>{ch.cliente_nome}</strong> · Telefone: {ch.cliente_telefone || '—'}
          </div>

          <div style={{ fontSize: '.88rem', lineHeight: 1.8, marginBottom: 16 }}>
            <p>
              Pelo presente instrumento, o(a) <strong>CLIENTE</strong> acima qualificado(a) declara para os devidos fins de direito que:
            </p>
            <p>
              1. Deixou sob os cuidados da <strong>DG AUTOMÓVEIS</strong> o veículo acima discriminado para análise e realização de intervenção técnica decorrente da garantia legal de 90 dias (CDC Art. 26), referente à seguinte queixa: <em>"{ch.reclamacao}"</em>.
            </p>
            <p>
              2. Foi efetuada a devida inspeção e reparação pela oficina credenciada <strong>{ch.oficina_nome || 'Oficina Credenciada DG'}</strong>, tendo sido realizados os seguintes serviços / substituições:
              <br /><strong>Serviços / Peças:</strong> <u>{ch.servicos_executados || 'Revisão, reparo e testes de rodagem completos dos componentes afetados.'}</u>
            </p>
            <p>
              3. O(A) CLIENTE realizou teste prático de rodagem nesta data, constatando o perfeito e integral funcionamento do veículo e dos componentes reparados, recebendo o bem devidamente limpo e em perfeitas condições de uso e tráfego.
            </p>
            <p>
              4. Dá a mais ampla, geral, rasa e irrevogável quitação quanto aos serviços e itens objeto desta ordem de garantia, nada mais tendo a reclamar a qualquer título sobre o fato gerador deste chamado.
            </p>
          </div>

          {/* DATA E ASSINATURAS */}
          <div style={{ marginTop: 35, paddingTop: 16, borderTop: '1px solid #cbd5e1' }}>
            <p style={{ textAlign: 'right', margin: '0 0 30px 0', fontSize: '.88rem' }}>
              <strong>{cidEmp}/{sigEmp}</strong>, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
              <div style={{ textAlign: 'center', borderTop: '1px solid #111827', paddingTop: 8 }}>
                <strong>{ch.cliente_nome}</strong><br />
                <span style={{ fontSize: '.78rem', color: '#4b5563' }}>Assinatura do Cliente Comprador</span>
              </div>
              <div style={{ textAlign: 'center', borderTop: '1px solid #111827', paddingTop: 8 }}>
                <strong>{loja?.nome_fantasia || 'DG AUTOMÓVEIS'}</strong><br />
                <span style={{ fontSize: '.78rem', color: '#4b5563' }}>Responsável Técnico / Pós-Venda</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Pós-Venda & Garantia Legal (90 Dias CDC)</h1>
          <p>Gestão de ocorrências pós-entrega, agendamento em oficinas credenciadas, orçamentos e termos de quitação.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setEditando({
            protocolo: `GAR-${Math.floor(1000 + Math.random() * 9000)}`,
            data_abertura: new Date().toISOString().slice(0, 10),
            veiculo_id: '',
            veiculo_desc: '',
            placa: '',
            data_venda: '',
            cliente_nome: '',
            cliente_telefone: '',
            km_entrada: 0,
            km_retorno: 0,
            sistema: 'Motor (Bloco, Cabeçote, Lubrificação)',
            reclamacao: '',
            parecer_tecnico: '',
            oficina_nome: 'Oficina Mecânica Parceira',
            custo_reparo: 0,
            responsavel_custo: 'Loja',
            servicos_executados: '',
            status: 'aberto'
          })}
        >
          <Plus size={16} /> + Novo Chamado de Garantia
        </button>
      </header>

      {/* CARDS DE ESTATÍSTICAS */}
      <section className="stats">
        <div className="card stat">
          <div className="stat-label"><Clock size={16} />Chamados em Andamento</div>
          <div className="stat-value" style={{ color: totais.abertos > 0 ? '#f59e0b' : 'var(--text)' }}>
            {totais.abertos}
          </div>
          <div className="stat-sub">Aguardando oficina ou em reparo</div>
        </div>

        <div className="card stat">
          <div className="stat-label"><CheckCircle2 size={16} />Casos Resolvidos</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            {totais.concluidos}
          </div>
          <div className="stat-sub">Termo de quitação emitido</div>
        </div>

        <div className="card stat">
          <div className="stat-label"><Wrench size={16} />Custo Total em Garantias</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>
            {brl(totais.custoTotal)}
          </div>
          <div className="stat-sub">Investido em oficinas parceiras</div>
        </div>
      </section>

      {/* BARRA DE FILTROS */}
      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por cliente, placa, modelo ou protocolo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <select className="select" style={{ maxWidth: 220 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todas as Situações</option>
          {Object.entries(STATUS_GARANTIA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>

        <select className="select" style={{ maxWidth: 250 }} value={filtroSistema} onChange={(e) => setFiltroSistema(e.target.value)}>
          <option value="">Todos os Sistemas</option>
          {SISTEMAS_VEICULO.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* TABELA DE CHAMADOS */}
      {filtrados.length === 0 ? (
        <div className="card empty">
          <ShieldCheck size={48} strokeWidth={1.2} />
          <p style={{ marginTop: 12, fontWeight: 600 }}>Nenhum chamado de garantia registrado.</p>
          <small style={{ color: 'var(--muted)' }}>Clique em "+ Novo Chamado de Garantia" para registrar uma ocorrência.</small>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Protocolo / Data</th>
                <th>Veículo / Placa</th>
                <th>Cliente</th>
                <th>Vigência CDC (90d)</th>
                <th>Sistema Afetado</th>
                <th>Oficina & Custo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const vig = calcularVigencia(c.data_venda);
                return (
                  <tr key={c.id || c.protocolo} onClick={() => setEditando(c)}>
                    <td>
                      <strong>#{c.protocolo}</strong>
                      <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{dataBr(c.data_abertura)}</div>
                    </td>
                    <td>
                      <strong>{c.veiculo_desc}</strong>
                      <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>Placa: {c.placa || '—'}</div>
                    </td>
                    <td>
                      <strong>{c.cliente_nome}</strong>
                      {c.cliente_telefone && (
                        <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>
                          📞 {c.cliente_telefone}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ fontSize: '.72rem', background: vig.coberto ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)', color: vig.coberto ? '#059669' : '#dc2626', border: `1px solid ${vig.coberto ? '#10b98150' : '#ef444450'}` }}>
                        {vig.texto}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '.84rem', fontWeight: 600 }}>{c.sistema?.split('(')[0]}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '.84rem', fontWeight: 700 }}>{brl(c.custo_reparo || 0)}</div>
                      <small style={{ color: 'var(--muted)' }}>{c.oficina_nome || 'A definir'}</small>
                    </td>
                    <td>
                      <span className={`badge ${c.status === 'concluido' ? 'badge-success' : c.status === 'em_reparo' ? 'badge-warning' : c.status === 'improcedente' ? 'badge-danger' : ''}`}>
                        {STATUS_GARANTIA[c.status] || c.status}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        title="Imprimir Termo Oficial de Encerramento e Quitação"
                        onClick={() => setImprimindoTermo(c)}
                      >
                        <Printer size={13} /> Termo
                      </button>

                      {c.cliente_telefone && (
                        <a
                          className="btn btn-sm"
                          style={{ color: '#16a34a', borderColor: '#16a34a' }}
                          title="Chamar no WhatsApp"
                          href={`https://wa.me/55${c.cliente_telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${c.cliente_nome}! Aqui é da DG Automóveis sobre a garantia do seu veículo (${c.veiculo_desc}).`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle size={13} />
                        </a>
                      )}

                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        title="Excluir Ocorrência"
                        onClick={() => handleExcluir(c.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE CHAMADO */}
      {editando && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setEditando(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>
                  {editando.id ? `Editar Chamado de Garantia #${editando.protocolo}` : 'Novo Chamado de Pós-Venda & Garantia'}
                </h2>
                <small style={{ color: 'var(--muted)' }}>Registro oficial de intervenção técnica sob o Código de Defesa do Consumidor.</small>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setEditando(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSalvar(editando); }}>
              {/* VINCULAÇÃO DE VEÍCULO / VENDA */}
              <div className="card" style={{ background: 'var(--color-neutral-80)', padding: 12, marginBottom: 14 }}>
                <label style={{ fontSize: '.84rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Vincular Veículo Vendido / Negociação Concluída
                </label>
                <select
                  className="select select-sm"
                  value={editando.veiculo_id || ''}
                  onChange={(e) => {
                    const veicId = e.target.value;
                    const v = veiculos.find((x) => String(x.id) === String(veicId));
                    const neg = negociacoes.find((n) => String(n.veiculo_id) === String(veicId));

                    setEditando((prev) => ({
                      ...prev,
                      veiculo_id: veicId,
                      veiculo_desc: v ? `${v.marca} ${v.modelo} (${v.ano})` : prev.veiculo_desc,
                      placa: v?.placa || prev.placa,
                      data_venda: neg?.data_fechamento || neg?.data_negociacao || v?.venda || prev.data_venda,
                      cliente_nome: neg?.cliente_nome || prev.cliente_nome,
                      cliente_telefone: neg?.cliente_telefone || prev.cliente_telefone,
                      km_entrada: Number(v?.km || 0)
                    }));
                  }}
                >
                  <option value="">-- Selecione o veículo vendido ou preencha manualmente abaixo --</option>
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      #{v.id} — {v.marca} {v.modelo} ({v.ano}) · Placa: {v.placa || 'Sem placa'} [{v.status?.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Descrição do Veículo</label>
                  <input
                    className="input input-sm"
                    required
                    value={editando.veiculo_desc}
                    onChange={(e) => setEditando({ ...editando, veiculo_desc: e.target.value })}
                    placeholder="Ex: Jeep Compass Longitude 2.0"
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Placa do Veículo</label>
                  <input
                    className="input input-sm"
                    value={editando.placa}
                    onChange={(e) => setEditando({ ...editando, placa: e.target.value.toUpperCase() })}
                    placeholder="ABC1D23"
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Data da Venda / Entrega</label>
                  <input
                    type="date"
                    className="input input-sm"
                    value={editando.data_venda}
                    onChange={(e) => setEditando({ ...editando, data_venda: e.target.value })}
                  />
                </div>
              </div>

              {/* DADOS DO CLIENTE */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Nome do Cliente Comprador</label>
                  <input
                    className="input input-sm"
                    required
                    value={editando.cliente_nome}
                    onChange={(e) => setEditando({ ...editando, cliente_nome: e.target.value })}
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Telefone / WhatsApp</label>
                  <input
                    className="input input-sm"
                    value={editando.cliente_telefone}
                    onChange={(e) => setEditando({ ...editando, cliente_telefone: e.target.value })}
                    placeholder="(47) 99999-9999"
                  />
                </div>
              </div>

              {/* DETALHES TÉCNICOS DO DEFEITO */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Sistema / Componente Reclamado</label>
                  <select
                    className="select select-sm"
                    value={editando.sistema}
                    onChange={(e) => setEditando({ ...editando, sistema: e.target.value })}
                  >
                    {SISTEMAS_VEICULO.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>KM Atual do Veículo</label>
                  <input
                    type="number"
                    className="input input-sm"
                    value={editando.km_entrada}
                    onChange={(e) => setEditando({ ...editando, km_entrada: Number(e.target.value) || 0 })}
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Situação / Status</label>
                  <select
                    className="select select-sm"
                    value={editando.status}
                    onChange={(e) => setEditando({ ...editando, status: e.target.value })}
                  >
                    {Object.entries(STATUS_GARANTIA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Reclamação do Cliente (Sintoma apresentado)</label>
                <textarea
                  className="input input-sm"
                  rows={2}
                  required
                  placeholder="Ex: Cliente relata barulho metálico na dianteira ao passar por desníveis e ruído na 2ª marcha..."
                  value={editando.reclamacao}
                  onChange={(e) => setEditando({ ...editando, reclamacao: e.target.value })}
                />
              </div>

              {/* OFICINA E ORÇAMENTO */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 14, background: 'var(--color-neutral-80)', padding: 12, borderRadius: 8 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Oficina Parceira Designada</label>
                  <input
                    className="input input-sm"
                    value={editando.oficina_nome}
                    onChange={(e) => setEditando({ ...editando, oficina_nome: e.target.value })}
                    placeholder="Ex: Auto Mecânica Canoas"
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Custo do Conserto (R$)</label>
                  <input
                    type="number"
                    className="input input-sm"
                    value={editando.custo_reparo}
                    onChange={(e) => setEditando({ ...editando, custo_reparo: Number(e.target.value) || 0 })}
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Responsável</label>
                  <select
                    className="select select-sm"
                    value={editando.responsavel_custo}
                    onChange={(e) => setEditando({ ...editando, responsavel_custo: e.target.value })}
                  >
                    <option value="Loja">DG Automóveis (Loja)</option>
                    <option value="Oficina">Oficina (Retorno)</option>
                    <option value="Cliente">Cliente (Desgaste)</option>
                    <option value="Fabrica">Garantia Fábrica</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label style={{ fontSize: '.78rem', fontWeight: 700 }}>Serviços Executados & Peças Trocadas (para constar no Termo)</label>
                <textarea
                  className="input input-sm"
                  rows={2}
                  placeholder="Ex: Substituição das buchas da bandeja dianteira e troca do óleo do câmbio..."
                  value={editando.servicos_executados}
                  onChange={(e) => setEditando({ ...editando, servicos_executados: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Gravando...' : 'Salvar Ocorrência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
