import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Car, TrendingUp, DollarSign, Users, Handshake, Calendar,
  PlusCircle, FileText, ArrowRight, Sparkles, MessageCircle
} from 'lucide-react';
import { getVeiculos, getOportunidades, getNegociacoes, getFinanceiro, brl, STATUS, ORIGENS_LEAD } from '../store';

const dias = (d) => Math.max(0, Math.round((Date.now() - new Date(d)) / 86400000));

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [vs, setVs] = useState([]);
  const [ops, setOps] = useState([]);
  const [negs, setNegs] = useState([]);
  const [fin, setFin] = useState([]);

  useEffect(() => {
    getVeiculos().then((r) => setVs(Array.isArray(r) ? r : [])).catch(() => setVs([]));
    getOportunidades().then((r) => setOps(Array.isArray(r) ? r : [])).catch(() => setOps([]));
    getNegociacoes().then((r) => setNegs(Array.isArray(r) ? r : [])).catch(() => setNegs([]));
    getFinanceiro().then((r) => setFin(Array.isArray(r) ? r : [])).catch(() => setFin([]));
  }, []);

  const listaVs = Array.isArray(vs) ? vs : [];
  const listaOps = Array.isArray(ops) ? ops : [];
  const listaNegs = Array.isArray(negs) ? negs : [];
  const listaFin = Array.isArray(fin) ? fin : [];

  const emEstoque = listaVs.filter((v) => v && v.status !== 'vendido');
  const vendidos = listaVs.filter((v) => v && v.status === 'vendido');
  const valorEstoque = emEstoque.reduce((s, v) => s + Number(v.preco || 0), 0);
  const lucro = vendidos.reduce((s, v) => s + (Number(v.preco || 0) - Number(v.custo || 0) - Number(v.despesas_veiculo || 0)), 0);
  const giro = emEstoque.length ? Math.round(emEstoque.reduce((s, v) => s + dias(v.entrada), 0) / emEstoque.length) : 0;

  const leadsAtivos = listaOps.filter((o) => o && !['concluido', 'perdido'].includes(o.estagio));
  const negsAtivas = listaNegs.filter((n) => n && ['aberta', 'conferencia'].includes(n.status));
  const saldoCaixa = listaFin.reduce((s, f) => f && f.status === 'pago' ? s + (f.tipo === 'receita' ? Number(f.valor || 0) : -Number(f.valor || 0)) : s, 0);

  const porMarca = Object.entries(emEstoque.reduce((m, v) => {
    const k = (v && v.marca) ? v.marca : 'Outros';
    return { ...m, [k]: (m[k] || 0) + 1 };
  }, {}));
  const max = Math.max(1, ...porMarca.map(([, n]) => n));
  const parados = [...emEstoque].sort((a, b) => new Date(a.entrada || Date.now()) - new Date(b.entrada || Date.now())).slice(0, 4);

  const stats = [
    { label: 'Carros no Pátio', value: emEstoque.length, sub: `${brl(valorEstoque)} disponíveis para venda`, icon: Car, link: '/estoque' },
    { label: 'Interessados (CRM)', value: leadsAtivos.length, sub: `${negsAtivas.length} negociação(ões) em andamento`, icon: Users, link: '/crm' },
    { label: 'Lucro Líquido (Vendas)', value: brl(lucro), sub: `${vendidos.length} veículo(s) vendido(s)`, icon: TrendingUp, link: '/financeiro' },
    { label: 'Saldo em Caixa', value: brl(saldoCaixa), sub: `Tempo médio de pátio: ${giro} dias`, icon: DollarSign, link: '/financeiro' },
  ];

  const guiasPassoAPasso = [
    {
      passo: '1',
      cor: 'hsla(210, 95%, 60%, .18)',
      corTexto: '#60a5fa',
      titulo: 'Cadastrar Carro no Pátio',
      desc: 'Dê entrada em veículo comprado ou consignado, lance despesas de oficina e imprima a folha de parabrisa.',
      link: '/estoque?novo=1',
      cta: 'Novo Carro →'
    },
    {
      passo: '2',
      cor: 'hsla(152, 75%, 48%, .18)',
      corTexto: '#34d399',
      titulo: 'Atender Cliente no Whats',
      desc: 'Registre quem perguntou no WhatsApp, OLX ou Webmotors e agende lembrete de retorno.',
      link: '/crm?novo=1',
      cta: 'Novo Atendimento →'
    },
    {
      passo: '3',
      cor: 'hsla(38, 95%, 58%, .18)',
      corTexto: '#fbbf24',
      titulo: 'Fechar Venda ou Troca',
      desc: 'Monte a proposta com carro na troca, financiamento ou Pix e conclua a venda em 1 clique.',
      link: '/negociacoes?novo=1',
      cta: 'Abrir Venda →'
    },
    {
      passo: '4',
      cor: 'hsla(265, 85%, 65%, .18)',
      corTexto: '#a78bfa',
      titulo: 'Imprimir Contratos & Laudos',
      desc: 'Gere Contratos Oficiais, Checklist de Vistoria CDC, Recibo de Sinal (Arras) e Termo de Transferência ATPV-e.',
      link: '/documentos',
      cta: 'Gerar Documento →'
    },
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Olá, {user.nome.split(' ')[0]} 👋</h1>
          <p>Escolha abaixo o que deseja fazer agora ou acompanhe o resumo da loja.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/crm?novo=1" className="btn"><Users size={16} />Atender Lead</Link>
          <Link to="/estoque?novo=1" className="btn btn-primary" id="btn-ir-estoque"><PlusCircle size={16} />Cadastrar Carro</Link>
        </div>
      </header>

      {/* GUIA PASSO A PASSO PARA LEIGOS */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', fontWeight: 700, color: 'var(--primary-2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        <Sparkles size={14} /> Guia Rápido do Dia a Dia — Clique para iniciar
      </div>
      <section className="guide-grid">
        {guiasPassoAPasso.map((g) => (
          <Link key={g.passo} to={g.link} className="guide-card">
            <div className="guide-step" style={{ background: g.cor, color: g.corTexto }}>
              Passo {g.passo}
            </div>
            <div>
              <h3>{g.titulo}</h3>
              <p style={{ marginTop: 4 }}>{g.desc}</p>
            </div>
            <span style={{ marginTop: 'auto', fontSize: '.8rem', fontWeight: 700, color: g.corTexto, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {g.cta}
            </span>
          </Link>
        ))}
      </section>

      {/* INDICADORES PRINCIPAIS CLICÁVEIS */}
      <section className="stats">
        {stats.map(({ label, value, sub, icon: Icon, link }, i) => (
          <div
            key={label}
            className="card stat"
            style={{ animationDelay: `${i * 60}ms`, cursor: 'pointer' }}
            onClick={() => navigate(link)}
          >
            <div className="stat-label"><Icon size={16} />{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{sub}</span>
              <ArrowRight size={13} />
            </div>
          </div>
        ))}
      </section>

      <section className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ marginBottom: 2 }}>Clientes Aguardando Retorno (CRM)</h3>
              <small style={{ color: 'var(--muted)' }}>Clique para abrir o atendimento ou chamar no WhatsApp</small>
            </div>
            <Link to="/crm" className="btn btn-sm">Ver todos →</Link>
          </div>
          {leadsAtivos.slice(0, 5).map((o) => (
            <div key={o.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => navigate('/crm')}>
              <div>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {o.nome_lead}
                  <span className="badge" style={{ fontSize: '.68rem' }}>{ORIGENS_LEAD[o.origem] || o.origem}</span>
                </div>
                <small style={{ color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                  🚗 {o.veic_modelo ? `${o.veic_marca} ${o.veic_modelo}` : o.veiculo_interesse}
                  {o.troca_veiculo ? ` · 🔄 Troca: ${o.troca_veiculo}` : ''}
                </small>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <strong style={{ color: 'var(--success)' }}>{brl(o.valor_proposta || o.veic_preco)}</strong>
                {o.proxima_acao_data && (
                  <div style={{ fontSize: '.73rem', color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={11} /> {o.proxima_acao_tipo}: {new Date(o.proxima_acao_data).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ marginBottom: 2 }}>Veículos há Mais Tempo no Pátio</h3>
              <small style={{ color: 'var(--muted)' }}>Atenção especial para giro de estoque</small>
            </div>
            <Link to="/estoque" className="btn btn-sm">Abrir Pátio →</Link>
          </div>
          {parados.map((v) => (
            <div key={v.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => navigate('/estoque')}>
              <div>
                <div style={{ fontWeight: 700 }}>{v.marca} {v.modelo} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>({v.ano})</span></div>
                <small style={{ color: 'var(--muted)' }}>
                  {STATUS[v.status]} · <strong style={{ color: dias(v.entrada) > 60 ? '#ef4444' : '#f59e0b' }}>{dias(v.entrada)} dias no pátio {dias(v.entrada) > 60 ? '(Atenção Giro)' : ''}</strong> · Placa {v.placa || '—'}
                </small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>{brl(v.preco)}</strong>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Custo: {brl(v.custo)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Quantidade de Veículos por Marca</h3>
        <div className="bars">
          {porMarca.map(([marca, n], i) => (
            <div key={marca} className="bar-col">
              <strong style={{ fontSize: '.85rem' }}>{n}</strong>
              <div className="bar" style={{ height: `${(n / max) * 100}%`, animationDelay: `${i * 80}ms` }} />
              <span>{marca}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
