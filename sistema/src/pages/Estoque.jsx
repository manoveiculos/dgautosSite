import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Car, X, Trash2, Gauge, Fuel, Calendar, LayoutGrid, List,
  CheckCircle2, AlertTriangle, Wrench, FileText, Image, BookmarkCheck,
  Sparkles, Printer, Handshake, ExternalLink, ShieldCheck, Edit3, ArrowLeft, ArrowRight, Globe
} from 'lucide-react';
import {
  getVeiculos, saveVeiculo, deleteVeiculo, getClientes,
  saveFinanceiro, deleteFinanceiro, brl, dataBr, STATUS, CATEGORIAS_FINANCEIRO
} from '../store';

const OPCIONAIS_PADRAO = [
  'Airbag', 'Airbag duplo / cortina', 'Alarme', 'Ar Condicionado', 'Ar Digital Dual Zone',
  'Bancos de Couro', 'Banco com regulagem elétrica', 'Blindado', 'Câmera de Ré', 'Câmera 360°',
  'Central Multimídia', 'Chave Presencial (Keyless)', 'Computador de bordo', 'Conexão USB / CarPlay',
  'Controle automático de velocidade (Piloto)', 'Controle de tração e estabilidade',
  'Direção Elétrica', 'Faróis Full LED', 'Faróis de neblina', 'Freios ABS',
  'Interface Bluetooth', 'Navegador GPS', 'Paddle Shift (Borboleta)', 'Partida Start/Stop',
  'Rodas de liga leve', 'Sensor de estacionamento dianteiro/traseiro', 'Sensor de chuva',
  'Sensor de ré', 'Som Premium', 'Teto solar', 'Teto panorâmico', 'Tração 4x4',
  'Trava elétrica', 'Vidro elétrico nas 4 portas', 'Volante multifuncional'
];

const DESTAQUES_PADRAO = [
  'Único dono', 'IPVA Pago', 'Licenciado', 'Revisões feitas em concessionária',
  'Manual do Proprietário', 'Chave Reserva', 'Garantia de Fábrica', 'Laudo Cautelar Aprovado',
  'Veículo quitado', 'Veículo em financiamento', 'Veículo de leilão', 'Aceita troca'
];

const PROPRIEDADES = {
  PROPRIO: 'Próprio (Estoque Loja)',
  SOCIEDADE: 'Em Sociedade (Investidores)',
  TERCEIRO_CONSIGNADO: 'Terceiro (Consignado)',
  TERCEIRO_DEMONSTRACAO: 'Terceiro (Demonstração)',
  TERCEIRO_FINANCIAMENTO: 'Terceiro (Financiamento)'
};

const ABAS_VEICULO = [
  { id: 'principal', label: '1. Principal' },
  { id: 'compra_venda', label: '2. Compra e Venda' },
  { id: 'valores', label: '3. Valores e FIPE' },
  { id: 'opcionais', label: '4. Opcionais' },
  { id: 'observacoes', label: '5. Observações' },
  { id: 'pendencias', label: '6. Pendências' },
  { id: 'reservas', label: '7. Reservas' },
  { id: 'documentos', label: '8. Documentos' },
  { id: 'fotos', label: '9. Fotos e Vídeo' },
  { id: 'integracao_site', label: '10. Integração Site' },
];

const EMPTY_VEICULO = {
  codigo_interno: '',
  marca: '',
  modelo: '',
  modelo_complemento: '',
  ano_fabricacao: '2023',
  ano_modelo: '2024',
  ano: '2023/2024',
  km: 0,
  km_entrada: 0,
  km_saida: '',
  cor: 'Branco',
  cor_interna: 'Preto',
  combustivel: 'Flex',
  cambio: 'Automático',
  direcao: 'Elétrica',
  portas: 4,
  potencia: '',
  cilindradas: '',
  categoria_veiculo: 'Carro / SUV / Utilitário',
  placa: '',
  chassi: '',
  renavam: '',
  crv: '',
  numero_motor: '',
  cidade_emplacamento: 'Balneário Camboriú - SC',
  ipva_exercicio: '2026',
  licenciamento_exercicio: '2026',
  dpvat_exercicio: '2026',
  estado_conservacao: 'USADO',
  propriedade: 'PROPRIO',
  repasse: false,
  garantia_fabrica: 'Não',
  situacao_patio: 'Pronto para venda (Showroom)',
  localizacao_patio: 'Showroom Principal',
  status: 'disponivel',
  custo: 0,
  preco: 0,
  valor_minimo: 0,
  valor_troca: 0,
  valor_site: 0,
  publicar_site: true,
  destaque_site: false,
  observacao_site: '',
  url_anuncio_site: '',
  fipe: 0,
  valor_fipe_anterior: 0,
  codigo_fipe: '',
  entrada: new Date().toISOString().slice(0, 10),
  venda: '',
  cliente_entrada_id: '',
  proprietario_atual_id: '',
  cliente_saida_id: '',
  observacao_interna: '',
  observacao_anuncio: '',
  observacao_internet: '',
  observacao_contrato: 'Garantia legal de 90 dias para motor e câmbio.',
  observacao_financiamento: '',
  itens_opcionais: ['Airbag', 'Ar Condicionado', 'Direção Elétrica', 'Trava elétrica', 'Vidro elétrico nas 4 portas'],
  itens_destaques: ['IPVA Pago', 'Manual do Proprietário', 'Chave Reserva', 'Laudo Cautelar Aprovado'],
  pendencias: [
    { id: 1, titulo: 'Laudo Cautelar / Vistoria ECV', obrigatoria: true, concluida: false, data: new Date().toISOString().slice(0, 10) },
    { id: 2, titulo: 'Chave Reserva e Manual no Cofre', obrigatoria: false, concluida: false, data: new Date().toISOString().slice(0, 10) },
    { id: 3, titulo: 'Reconhecimento de Firma / ATPV-e', obrigatoria: true, concluida: false, data: new Date().toISOString().slice(0, 10) },
  ],
  reservas: [],
  investidores: [{ id: 1, nome: 'Motriz Multimarcas (Loja)', percentual: 100 }],
  documentos_anexos: [],
  fotos: [],
  foto: '',
  url_video: '',
  cfop_entrada: '1102 - Compra para comercialização',
  cfop_saida: '5102 - Venda de mercadoria adquirida',
  liberar_nf_compra: true,
  valor_nf_compra: 0,
  liberar_nf_venda: false,
  valor_nf_venda: 0,
  lancamentos_veiculo: [],
};

const diasEmEstoque = (entrada, venda) => {
  const fim = venda ? new Date(venda) : new Date();
  return Math.max(0, Math.round((fim - new Date(entrada || Date.now())) / 86400000));
};

export default function Estoque() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [modo, setModo] = useState('cards'); // cards | tabela
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [propriedade, setPropriedade] = useState('');
  const [cambio, setCambio] = useState('');
  const [editando, setEditando] = useState(null);
  const [fichaImpressao, setFichaImpressao] = useState(null);

  const recarregar = async () => {
    try {
      const [vs, cs] = await Promise.all([getVeiculos(), getClientes()]);
      setLista(vs);
      setClientes(cs);
      if (editando?.id) {
        const atualizado = vs.find((x) => x.id === editando.id);
        if (atualizado) setEditando(atualizado);
      }
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => { recarregar(); }, []);

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setEditando(EMPTY_VEICULO);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtrados = useMemo(() => lista.filter((v) => {
    if (status && v.status !== status) return false;
    if (propriedade && (v.propriedade || 'PROPRIO') !== propriedade) return false;
    if (cambio && v.cambio !== cambio) return false;
    const texto = `${v.marca} ${v.modelo} ${v.modelo_complemento || ''} ${v.placa || ''} ${v.cor || ''} ${v.chassi || ''} ${v.renavam || ''} ${v.codigo_interno || ''}`.toLowerCase();
    return texto.includes(busca.toLowerCase());
  }), [lista, busca, status, propriedade, cambio]);

  const totais = useMemo(() => {
    const ativos = filtrados.filter((v) => v.status !== 'vendido');
    const custoTotal = ativos.reduce((s, v) => s + Number(v.custo || 0) + Number(v.despesas_veiculo || 0), 0);
    const vendaTotal = ativos.reduce((s, v) => s + Number(v.preco || 0), 0);
    return { qtd: ativos.length, custoTotal, vendaTotal, margem: vendaTotal - custoTotal };
  }, [filtrados]);

  if (fichaImpressao) {
    return (
      <div>
        <div className="topbar no-print">
          <div>
            <h1>Ficha de Pátio / Parabrisa — {fichaImpressao.marca} {fichaImpressao.modelo}</h1>
            <p>Pronta para impressão em folha A4 para exposição no veículo.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setFichaImpressao(null)}>← Voltar ao Estoque</button>
            <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} />Imprimir Ficha</button>
          </div>
        </div>
        <div className="doc-preview" style={{ border: '3px solid #111827' }}>
          <div style={{ textAlign: 'center', borderBottom: '3px solid #111827', paddingBottom: 14, marginBottom: 18 }}>
            <h2 style={{ fontSize: '2rem', letterSpacing: '-.02em', textTransform: 'uppercase' }}>
              {fichaImpressao.marca} {fichaImpressao.modelo}
            </h2>
            <div style={{ fontSize: '1.1rem', color: '#374151', fontWeight: 600 }}>
              {fichaImpressao.modelo_complemento} · ANO {fichaImpressao.ano} · {fichaImpressao.combustivel?.toUpperCase()} · CÂMBIO {fichaImpressao.cambio?.toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center', marginBottom: 18 }}>
            <div className="doc-box"><strong>QUILOMETRAGEM</strong><div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{Number(fichaImpressao.km || 0).toLocaleString('pt-BR')} km</div></div>
            <div className="doc-box"><strong>PLACA FINAL</strong><div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{fichaImpressao.placa ? fichaImpressao.placa.slice(-1) : '—'} ({fichaImpressao.placa || '—'})</div></div>
            <div className="doc-box"><strong>COR / PORTAS</strong><div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{fichaImpressao.cor} · {fichaImpressao.portas || 4}P</div></div>
          </div>

          <div className="doc-box" style={{ marginBottom: 18 }}>
            <strong style={{ fontSize: '1rem', display: 'block', marginBottom: 8 }}>OPCIONAIS E ITENS DE SÉRIE:</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: '.9rem' }}>
              {(fichaImpressao.itens_opcionais || String(fichaImpressao.opcionais || '').split(',').filter(Boolean)).map((op, i) => (
                <span key={i}>✓ {op}</span>
              ))}
            </div>
          </div>

          {(fichaImpressao.itens_destaques || []).length > 0 && (
            <div className="doc-box" style={{ marginBottom: 18 }}>
              <strong>DESTAQUES DO VEÍCULO:</strong> {fichaImpressao.itens_destaques.join(' · ')}
            </div>
          )}

          <div style={{ textAlign: 'center', padding: '20px 10px', background: '#111827', color: '#fff', borderRadius: 12, marginTop: 20 }}>
            <div style={{ fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.1em', opacity: .8 }}>Valor à Vista</div>
            <div style={{ fontSize: '2.8rem', fontWeight: 800 }}>{brl(fichaImpressao.preco)}</div>
            {fichaImpressao.valor_troca > 0 && (
              <div style={{ fontSize: '.95rem', opacity: .85 }}>Valor para troca: {brl(fichaImpressao.valor_troca)} · FIPE: {brl(fichaImpressao.fipe)}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (editando) {
    return (
      <VeiculoModal
        inicial={editando}
        clientes={clientes}
        onClose={() => setEditando(null)}
        onSave={async (v) => {
          const r = await saveVeiculo(v);
          setLista(r);
          setEditando(null);
        }}
        onDelete={async (id) => {
          const r = await deleteVeiculo(id);
          setLista(r);
          setEditando(null);
        }}
        onRefresh={recarregar}
        onImprimirFicha={(v) => {
          setEditando(null);
          setFichaImpressao(v);
        }}
        onIrNegociacao={() => {
          setEditando(null);
          navigate('/negociacoes');
        }}
      />
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Estoque de Veículos</h1>
          <p>{filtrados.length} veículo(s) listado(s) · Gestão completa em 9 abas com FIPE, Custos, Pendências e Reservas.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button className={`tab ${modo === 'cards' ? 'active' : ''}`} onClick={() => setModo('cards')}>
              <LayoutGrid size={15} />Vitrine
            </button>
            <button className={`tab ${modo === 'tabela' ? 'active' : ''}`} onClick={() => setModo('tabela')}>
              <List size={15} />Tabela Detalhada
            </button>
          </div>
          <button id="btn-novo-veiculo" className="btn btn-primary" onClick={() => setEditando(EMPTY_VEICULO)}>
            <Plus size={16} />Novo veículo
          </button>
        </div>
      </header>

      <section className="stats">
        <div className="card stat">
          <div className="stat-label"><Car size={15} />Em Estoque (Filtro)</div>
          <div className="stat-value">{totais.qtd}</div>
          <div className="stat-sub">Disponíveis, reservados e consignados</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Custo Total Investido</div>
          <div className="stat-value">{brl(totais.custoTotal)}</div>
          <div className="stat-sub">Aquisição + despesas de pátio</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Valor Total de Venda</div>
          <div className="stat-value">{brl(totais.vendaTotal)}</div>
          <div className="stat-sub">Margem projetada: <strong style={{ color: 'var(--success)' }}>{brl(totais.margem)}</strong></div>
        </div>
      </section>

      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input
            id="busca-estoque"
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Placa, chassi, renavam, marca, modelo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select id="filtro-status" className="select" style={{ maxWidth: 185 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas as posições</option>
          {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 210 }} value={propriedade} onChange={(e) => setPropriedade(e.target.value)}>
          <option value="">Todas as propriedades</option>
          {Object.entries(PROPRIEDADES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 165 }} value={cambio} onChange={(e) => setCambio(e.target.value)}>
          <option value="">Todos os câmbios</option>
          {['Automático', 'Manual', 'CVT', 'Automatizado'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="card empty"><Car size={40} /><p style={{ marginTop: 12 }}>Nenhum veículo encontrado.</p></div>
      ) : modo === 'cards' ? (
        <div className="vehicles">
          {filtrados.map((v, i) => {
            const despesas = Number(v.despesas_veiculo || 0);
            const custoReal = Number(v.custo || 0) + despesas;
            const margemLiquida = Number(v.preco || 0) - custoReal;
            const pendAbertas = (v.pendencias || []).filter((p) => !p.concluida).length;
            const dias = diasEmEstoque(v.entrada, v.venda);
            return (
              <article key={v.id} id={`veiculo-${v.id}`} className="card vehicle" style={{ animationDelay: `${i * 45}ms` }} onClick={() => setEditando(v)}>
                <div className="vehicle-photo">
                  {v.foto ? <img src={v.foto} alt={`${v.marca} ${v.modelo}`} /> : <Car size={48} strokeWidth={1.2} />}
                  <span className={`badge badge-${v.status}`}>{STATUS[v.status]}</span>
                  {pendAbertas > 0 && (
                    <span
                      title={`${pendAbertas} pendência(s) em aberto`}
                      style={{ position: 'absolute', top: 12, right: 12, background: 'hsla(38, 95%, 55%, .95)', color: '#111', padding: '4px 9px', borderRadius: 99, fontSize: '.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, boxShadow: '0 4px 10px rgba(0,0,0,.35)' }}
                    >
                      <AlertTriangle size={12} /> {pendAbertas} pendência(s)
                    </span>
                  )}
                  {v.placa && (
                    <span className="vehicle-plate">
                      {v.placa}
                    </span>
                  )}
                  <span style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(10,14,25,.82)', padding: '3px 9px', borderRadius: 6, fontSize: '.72rem', fontWeight: 600, color: '#e2e8f0' }}>
                    ⏱ {dias} dias no pátio
                  </span>
                </div>

                <div className="vehicle-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                    <div>
                      <h3>{v.marca} {v.modelo}</h3>
                      <div className="vehicle-subtitle">
                        {v.modelo_complemento || `${v.cor} · ${v.combustivel}`} · {PROPRIEDADES[v.propriedade]?.split(' ')[0] || 'Próprio'}
                      </div>
                    </div>
                    <span className="badge" style={{ fontSize: '.68rem', flexShrink: 0 }}>{v.codigo_interno || `#${v.id}`}</span>
                  </div>

                  <div className="vehicle-specs">
                    <div className="vehicle-spec-item">
                      <span>Ano</span>
                      <strong>{v.ano}</strong>
                    </div>
                    <div className="vehicle-spec-item">
                      <span>KM Rodados</span>
                      <strong>{Number(v.km || 0).toLocaleString('pt-BR')}</strong>
                    </div>
                    <div className="vehicle-spec-item">
                      <span>Câmbio</span>
                      <strong>{v.cambio || 'Auto'}</strong>
                    </div>
                  </div>

                  <div className="vehicle-pricing">
                    <div>
                      <span className="vehicle-price-label">Valor de Venda</span>
                      <span className="vehicle-price">{brl(v.preco)}</span>
                      {v.fipe > 0 && <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>Tabela FIPE: {brl(v.fipe)}</div>}
                    </div>
                    <div className="vehicle-profit-box">
                      <span style={{ fontSize: '.66rem', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', fontWeight: 700 }}>Lucro Previsto</span>
                      <strong style={{ fontSize: '.9rem', color: margemLiquida >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {brl(margemLiquida)}
                      </strong>
                      <div style={{ fontSize: '.68rem', color: 'var(--muted)' }}>Custo: {brl(custoReal)}</div>
                    </div>
                  </div>

                  <div className="vehicle-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn btn-sm" onClick={() => setEditando(v)}>
                      <Edit3 size={13} /> Abrir Ficha
                    </button>
                    <button type="button" className="btn btn-sm" title="Imprimir Folha de Parabrisa A4" onClick={() => setFichaImpressao(v)}>
                      <Printer size={13} /> Parabrisa
                    </button>
                    {v.status !== 'vendido' && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate('/negociacoes?novo=1')}>
                        <Handshake size={13} /> Vender
                      </button>
                    )}
                  </div>
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
                <th>Cód / Placa</th>
                <th>Veículo / Versão</th>
                <th>Ano / KM</th>
                <th>Propriedade / Local</th>
                <th>Dias</th>
                <th>Custo Real</th>
                <th>Valor à Vista</th>
                <th>FIPE</th>
                <th>Margem Líq.</th>
                <th>Posição</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((v) => {
                const custoReal = Number(v.custo || 0) + Number(v.despesas_veiculo || 0);
                const margem = Number(v.preco || 0) - custoReal;
                return (
                  <tr key={v.id} onClick={() => setEditando(v)}>
                    <td>
                      <strong>{v.placa || 'S/ PLACA'}</strong>
                      <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{v.codigo_interno || `#${v.id}`}</div>
                    </td>
                    <td>
                      <strong>{v.marca} {v.modelo}</strong>
                      <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{v.cor} · {v.combustivel} · {v.cambio}</div>
                    </td>
                    <td>
                      {v.ano}
                      <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{Number(v.km || 0).toLocaleString('pt-BR')} km</div>
                    </td>
                    <td>
                      {PROPRIEDADES[v.propriedade] || 'Próprio'}
                      <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{v.localizacao_patio || 'Showroom'}</div>
                    </td>
                    <td>{diasEmEstoque(v.entrada, v.venda)}d</td>
                    <td>
                      {brl(custoReal)}
                      {v.despesas_veiculo > 0 && <div style={{ fontSize: '.72rem', color: 'var(--warning)' }}>+{brl(v.despesas_veiculo)} desp.</div>}
                    </td>
                    <td><strong>{brl(v.preco)}</strong></td>
                    <td>{v.fipe ? brl(v.fipe) : '—'}</td>
                    <td>
                      <strong style={{ color: margem >= 0 ? 'var(--success)' : 'var(--danger)' }}>{brl(margem)}</strong>
                    </td>
                    <td><span className={`badge badge-${v.status}`}>{STATUS[v.status]}</span></td>
                    <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" title="Imprimir Ficha de Pátio" onClick={() => setFichaImpressao(v)}>
                        <Printer size={13} />
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

function VeiculoModal({ inicial, clientes, onClose, onSave, onDelete, onRefresh, onImprimirFicha, onIrNegociacao }) {
  const [aba, setAba] = useState('principal');
  const [f, setF] = useState(() => {
    const [aFab, aMod] = String(inicial.ano || '2023/2024').split('/');
    return {
      ...EMPTY_VEICULO,
      ...inicial,
      ano_fabricacao: inicial.ano_fabricacao || aFab || '2023',
      ano_modelo: inicial.ano_modelo || aMod || aFab || '2024',
      itens_opcionais: Array.isArray(inicial.itens_opcionais)
        ? inicial.itens_opcionais
        : String(inicial.opcionais || '').split(',').map((s) => s.trim()).filter(Boolean),
      itens_destaques: Array.isArray(inicial.itens_destaques) ? inicial.itens_destaques : [],
      pendencias: Array.isArray(inicial.pendencias) ? inicial.pendencias : EMPTY_VEICULO.pendencias,
      reservas: Array.isArray(inicial.reservas) ? inicial.reservas : [],
      investidores: Array.isArray(inicial.investidores) && inicial.investidores.length ? inicial.investidores : EMPTY_VEICULO.investidores,
      documentos_anexos: Array.isArray(inicial.documentos_anexos) ? inicial.documentos_anexos : [],
      fotos: Array.isArray(inicial.fotos) ? inicial.fotos : (inicial.foto ? [inicial.foto] : []),
    };
  });

  const [buscaOpcional, setBuscaOpcional] = useState('');
  const [novaPendencia, setNovaPendencia] = useState('');
  const [pendObrigatoria, setPendObrigatoria] = useState(true);
  const [novaReserva, setNovaReserva] = useState({ funcionario: 'Alexandre Gorges', cliente: '', data_limite: '', observacao: '' });
  const [novoSocio, setNovoSocio] = useState({ nome: '', percentual: 50 });
  const [novoDoc, setNovoDoc] = useState({ tipo: 'CRLV Digital', numero: '', status: 'Validado' });
  const [novaFotoUrl, setNovaFotoUrl] = useState('');
  const [novaDespesa, setNovaDespesa] = useState({
    categoria: 'Preparação / Estética',
    descricao: '',
    valor: '',
    status: 'pago'
  });

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const next = { ...f, [k]: val };
    if (k === 'ano_fabricacao' || k === 'ano_modelo') {
      next.ano = `${k === 'ano_fabricacao' ? val : next.ano_fabricacao}/${k === 'ano_modelo' ? val : next.ano_modelo}`;
    }
    setF(next);
  };

  const finalChassi = f.chassi ? String(f.chassi).replace(/\s/g, '').slice(-8) : '—';
  const diasPatio = diasEmEstoque(f.entrada, f.venda);
  const despesasTotal = (f.lancamentos_veiculo || [])
    .filter((l) => l.tipo === 'despesa')
    .reduce((s, l) => s + Number(l.valor || 0), 0);
  const custoTotalReal = Number(f.custo || 0) + despesasTotal;
  const lucroEstimado = Number(f.preco || 0) - custoTotalReal;
  const percMargem = f.preco > 0 ? ((lucroEstimado / Number(f.preco)) * 100).toFixed(1) : '0.0';
  const diffFipe = f.fipe > 0 ? (((Number(f.preco || 0) - Number(f.fipe)) / Number(f.fipe)) * 100).toFixed(1) : null;
  const pendenciasAbertas = (f.pendencias || []).filter((p) => !p.concluida);

  const toggleItemLista = (chave, item) => {
    const atual = f[chave] || [];
    setF({
      ...f,
      [chave]: atual.includes(item) ? atual.filter((x) => x !== item) : [...atual, item]
    });
  };

  const gerarTextoAnuncioAutomatico = () => {
    const ops = (f.itens_opcionais || []).slice(0, 10).join(', ');
    const dest = (f.itens_destaques || []).join(' · ');
    const txt = `${f.marca} ${f.modelo} ${f.modelo_complemento || ''} (${f.ano}) — ${f.combustivel}, câmbio ${f.cambio}, cor ${f.cor}, com ${Number(f.km || 0).toLocaleString('pt-BR')} km.\n\n` +
      (dest ? `Destaques: ${dest}.\n` : '') +
      (ops ? `Principais opcionais: ${ops}.\n\n` : '') +
      `Veículo revisado com garantia, aceitamos seu usado na troca com excelente avaliação e financiamos pelas principais financeiras em até 60x!`;
    setF({
      ...f,
      observacao_anuncio: `${f.marca} ${f.modelo} ${f.ano} ${f.cambio} — ${dest}`,
      observacao_internet: txt
    });
  };

  const handleUploadFotoLocal = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setF((prev) => {
          const novas = [...(prev.fotos || []), reader.result];
          return { ...prev, fotos: novas, foto: prev.foto || novas[0] };
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const lancarDespesaDireta = async () => {
    if (!f.id) return alert('Salve o veículo primeiro antes de lançar despesas vinculadas.');
    if (!novaDespesa.descricao || !novaDespesa.valor) return alert('Informe a descrição e o valor da despesa.');
    await saveFinanceiro({
      tipo: 'despesa',
      categoria: novaDespesa.categoria,
      descricao: `${novaDespesa.descricao} — ${f.marca} ${f.modelo} (${f.placa || ''})`,
      valor: Number(novaDespesa.valor),
      vencimento: new Date().toISOString().slice(0, 10),
      pagamento_data: novaDespesa.status === 'pago' ? new Date().toISOString().slice(0, 10) : null,
      status: novaDespesa.status,
      forma_pagamento: 'Pix / TED',
      conta_bancaria: 'Conta Principal',
      veiculo_id: f.id,
    });
    setNovaDespesa({ categoria: 'Preparação / Estética', descricao: '', valor: '', status: 'pago' });
    await onRefresh();
  };

  return (
    <form
      className="altimus-crud-page"
      onSubmit={(e) => { e.preventDefault(); onSave(f); }}
    >
      {/* TOPO DE PÁGINA INTEIRA (/veiculo/:id) */}
      <div className="altimus-crud-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={onClose}>
            <ArrowLeft size={16} /> Voltar para Estoque
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                {f.id ? `Veículo #${f.id} — ${f.marca} ${f.modelo}` : 'Incluir Novo Veículo no Estoque'}
              </h2>
              <span className={`badge badge-${f.status}`}>{STATUS[f.status]}</span>
              <span className="badge">{diasPatio} dias em estoque</span>
              {pendenciasAbertas.length > 0 && (
                <span className="badge badge-pendente">
                  <AlertTriangle size={12} /> {pendenciasAbertas.length} pendência(s)
                </span>
              )}
            </div>
            <small style={{ color: 'var(--muted)' }}>
              Placa: <strong>{f.placa || '—'}</strong> · Final Chassi: <strong>{finalChassi}</strong> · Custo Real: <strong>{brl(custoTotalReal)}</strong> · Venda: <strong style={{ color: 'var(--success)' }}>{brl(f.preco)}</strong>
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {f.id && (
            <>
              <button type="button" className="btn btn-sm" onClick={() => onImprimirFicha(f)}>
                <Printer size={14} /> Ficha de Parabrisa
              </button>
              <button type="button" className="btn btn-sm" onClick={onIrNegociacao}>
                <Handshake size={14} /> Abrir Venda
              </button>
            </>
          )}
          <button type="submit" className="btn btn-primary">
            ✓ Salvar Veículo
          </button>
        </div>
      </div>

      <div className="altimus-crud-body">
        {/* NAVEGAÇÃO DAS 9 ABAS */}
        <div className="stepper" style={{ marginBottom: 20 }}>
          {ABAS_VEICULO.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`step-btn ${aba === t.id ? 'active' : ''}`}
              onClick={() => setAba(t.id)}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ABA 1: PRINCIPAL */}
        {aba === 'principal' && (
          <div className="form-grid">
            <div className="field">
              <label>Posição no Estoque</label>
              <select className="select" value={f.status} onChange={set('status')}>
                {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Propriedade do Veículo</label>
              <select className="select" value={f.propriedade || 'PROPRIO'} onChange={set('propriedade')}>
                {Object.entries(PROPRIEDADES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Estado de Conservação</label>
              <select className="select" value={f.estado_conservacao || 'USADO'} onChange={set('estado_conservacao')}>
                <option value="USADO">Veículo Usado / Seminovo</option>
                <option value="NOVO">Veículo Zero KM (0 KM)</option>
              </select>
            </div>

            <div className="field">
              <label>Placa (Mercosul / Antiga)</label>
              <input className="input" maxLength={7} style={{ textTransform: 'uppercase', fontWeight: 700 }} value={f.placa ?? ''} onChange={set('placa')} placeholder="ABC1D23" />
            </div>
            <div className="field">
              <label>Chassi (17 dígitos — Final: {finalChassi})</label>
              <input className="input" maxLength={17} style={{ textTransform: 'uppercase' }} value={f.chassi ?? ''} onChange={set('chassi')} />
            </div>
            <div className="field">
              <label>Renavam</label>
              <input className="input" maxLength={11} value={f.renavam ?? ''} onChange={set('renavam')} />
            </div>

            <div className="field">
              <label>Marca *</label>
              <input className="input" required value={f.marca ?? ''} onChange={set('marca')} placeholder="Ex.: Toyota, Honda, Jeep…" />
            </div>
            <div className="field">
              <label>Modelo *</label>
              <input className="input" required value={f.modelo ?? ''} onChange={set('modelo')} placeholder="Ex.: Corolla XEi 2.0" />
            </div>
            <div className="field">
              <label>Complemento / Versão</label>
              <input className="input" value={f.modelo_complemento ?? ''} onChange={set('modelo_complemento')} placeholder="Ex.: 16V Flex Aut." />
            </div>

            <div className="field">
              <label>Ano Fabricação *</label>
              <input className="input" type="number" required value={f.ano_fabricacao ?? ''} onChange={set('ano_fabricacao')} />
            </div>
            <div className="field">
              <label>Ano Modelo *</label>
              <input className="input" type="number" required value={f.ano_modelo ?? ''} onChange={set('ano_modelo')} />
            </div>
            <div className="field">
              <label>KM Atual / Entrada</label>
              <input className="input" type="number" min={0} value={f.km ?? 0} onChange={set('km')} />
            </div>

            <div className="field">
              <label>Cor Externa</label>
              <input className="input" value={f.cor ?? ''} onChange={set('cor')} />
            </div>
            <div className="field">
              <label>Cor Interna / Acabamento</label>
              <input className="input" value={f.cor_interna ?? ''} onChange={set('cor_interna')} placeholder="Ex.: Couro Preto / Caramelo" />
            </div>
            <div className="field">
              <label>Combustível</label>
              <select className="select" value={f.combustivel} onChange={set('combustivel')}>
                {['Flex', 'Gasolina', 'Diesel', 'Híbrido', 'Elétrico', 'Etanol', 'GNV'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Câmbio</label>
              <select className="select" value={f.cambio} onChange={set('cambio')}>
                {['Automático', 'Manual', 'CVT', 'Automatizado / Dualogic / DSG'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Direção</label>
              <select className="select" value={f.direcao || 'Elétrica'} onChange={set('direcao')}>
                {['Elétrica', 'Hidráulica', 'Eletro-hidráulica', 'Mecânica'].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Portas / Potência (CV) / Cilindradas</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <input className="input" type="number" placeholder="Portas" value={f.portas ?? 4} onChange={set('portas')} title="Portas" />
                <input className="input" placeholder="CV" value={f.potencia ?? ''} onChange={set('potencia')} title="Potência (CV)" />
                <input className="input" placeholder="CC" value={f.cilindradas ?? ''} onChange={set('cilindradas')} title="Cilindradas" />
              </div>
            </div>

            <div className="field">
              <label>Nº do CRV / ATPV-e</label>
              <input className="input" value={f.crv ?? ''} onChange={set('crv')} />
            </div>
            <div className="field">
              <label>Nº do Motor</label>
              <input className="input" value={f.numero_motor ?? ''} onChange={set('numero_motor')} />
            </div>
            <div className="field">
              <label>Cidade / UF de Emplacamento</label>
              <input className="input" value={f.cidade_emplacamento ?? ''} onChange={set('cidade_emplacamento')} />
            </div>

            <div className="field">
              <label>IPVA Exercício Pago</label>
              <input className="input" value={f.ipva_exercicio ?? '2026'} onChange={set('ipva_exercicio')} />
            </div>
            <div className="field">
              <label>Licenciamento Exercício</label>
              <input className="input" value={f.licenciamento_exercicio ?? '2026'} onChange={set('licenciamento_exercicio')} />
            </div>
            <div className="field">
              <label>Código Interno / Chaveiro</label>
              <input className="input" value={f.codigo_interno ?? ''} onChange={set('codigo_interno')} placeholder="Ex.: V-105" />
            </div>

            <div className="field">
              <label>Situação do Veículo</label>
              <select className="select" value={f.situacao_patio || 'Pronto para venda (Showroom)'} onChange={set('situacao_patio')}>
                {[
                  'Pronto para venda (Showroom)',
                  'Em preparação / Estética',
                  'Em oficina / Mecânica',
                  'Em funilaria / Pintura',
                  'Aguardando laudo / documentação',
                  'Entregue ao cliente'
                ].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Localização Física</label>
              <select className="select" value={f.localizacao_patio || 'Showroom Principal'} onChange={set('localizacao_patio')}>
                {['Showroom Principal', 'Pátio Externo', 'Filial / Loja 2', 'Oficina de Terceiro', 'Em posse do Proprietário (Consignado)'].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Repasse / Garantia de Fábrica</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', height: 42 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text)' }}>
                  <input type="checkbox" checked={!!f.repasse} onChange={set('repasse')} /> Veículo de Repasse
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: INFORMAÇÕES DA COMPRA, VENDA E SOCIEDADE */}
        {aba === 'compra_venda' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
              <h3 style={{ fontSize: '.98rem', marginBottom: 12 }}>Informações da Compra / Entrada no Estoque</h3>
              <div className="form-grid">
                <div className="field">
                  <label>Cliente / Fornecedor de Entrada</label>
                  <select className="select" value={f.cliente_entrada_id ?? ''} onChange={set('cliente_entrada_id')}>
                    <option value="">— Selecionar fornecedor / cliente —</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.cpf_cnpj || c.telefone})</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Proprietário Atual (Documento / Consignante)</label>
                  <select className="select" value={f.proprietario_atual_id ?? ''} onChange={set('proprietario_atual_id')}>
                    <option value="">— A própria revenda —</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Data de Entrada no Estoque</label>
                  <input className="input" type="date" value={f.entrada ?? ''} onChange={set('entrada')} />
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
              <h3 style={{ fontSize: '.98rem', marginBottom: 12 }}>Informações da Venda / Saída</h3>
              <div className="form-grid">
                <div className="field">
                  <label>Cliente Comprador (Saída)</label>
                  <select className="select" value={f.cliente_saida_id ?? ''} onChange={set('cliente_saida_id')}>
                    <option value="">— Não vendido / Em estoque —</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Data da Venda / Saída</label>
                  <input className="input" type="date" value={f.venda ?? ''} onChange={set('venda')} />
                </div>
                <div className="field">
                  <label>KM de Saída / Entrega</label>
                  <input className="input" type="number" value={f.km_saida ?? ''} onChange={set('km_saida')} />
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
              <h3 style={{ fontSize: '.98rem', marginBottom: 10 }}>Sociedade / Investidores do Veículo (Divisão de Lucro)</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  className="input"
                  placeholder="Nome do sócio / investidor…"
                  value={novoSocio.nome}
                  onChange={(e) => setNovoSocio({ ...novoSocio, nome: e.target.value })}
                />
                <input
                  className="input"
                  type="number"
                  style={{ maxWidth: 130 }}
                  placeholder="% Part."
                  value={novoSocio.percentual}
                  onChange={(e) => setNovoSocio({ ...novoSocio, percentual: Number(e.target.value) })}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (!novoSocio.nome) return;
                    setF({ ...f, investidores: [...(f.investidores || []), { id: Date.now(), ...novoSocio }] });
                    setNovoSocio({ nome: '', percentual: 25 });
                  }}
                >
                  <Plus size={15} />Adicionar
                </button>
              </div>
              {(f.investidores || []).map((inv, idx) => (
                <div key={idx} className="list-row">
                  <span><strong>{inv.nome}</strong></span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="badge badge-consignado">{inv.percentual}% de participação</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setF({ ...f, investidores: f.investidores.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 3: VALORES, FIPE E DESPESAS DO VEÍCULO */}
        {aba === 'valores' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="stats" style={{ marginBottom: 0 }}>
              <div className="card stat">
                <div className="stat-label">Custo de Entrada + Despesas</div>
                <div className="stat-value">{brl(custoTotalReal)}</div>
                <div className="stat-sub">Compra: {brl(f.custo)} · Oficina/Doc: {brl(despesasTotal)}</div>
              </div>
              <div className="card stat">
                <div className="stat-label">Preço de Venda (À Vista)</div>
                <div className="stat-value">{brl(f.preco)}</div>
                <div className="stat-sub">Mínimo autorizado: {brl(f.valor_minimo || f.preco)}</div>
              </div>
              <div className="card stat">
                <div className="stat-label">Lucro Líquido Estimado</div>
                <div className="stat-value" style={{ color: lucroEstimado >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {brl(lucroEstimado)} ({percMargem}%)
                </div>
                <div className="stat-sub">
                  {diffFipe !== null ? `Relação FIPE: ${diffFipe > 0 ? `+${diffFipe}% acima` : `${diffFipe}% abaixo`} da FIPE` : 'Informe a FIPE abaixo'}
                </div>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Valor de Entrada / Compra (R$)</label>
                <input className="input" type="number" value={f.custo ?? 0} onChange={set('custo')} />
              </div>
              <div className="field">
                <label>Valor Mínimo de Venda (R$)</label>
                <input className="input" type="number" value={f.valor_minimo ?? 0} onChange={set('valor_minimo')} />
              </div>
              <div className="field">
                <label>Valor de Venda À Vista (R$) *</label>
                <input className="input" type="number" required value={f.preco ?? 0} onChange={set('preco')} />
              </div>

              <div className="field">
                <label>Valor para Troca (R$)</label>
                <input className="input" type="number" value={f.valor_troca ?? 0} onChange={set('valor_troca')} />
              </div>
              <div className="field">
                <label>Valor Anunciado no Site / Portais (R$)</label>
                <input className="input" type="number" value={f.valor_site ?? f.preco ?? 0} onChange={set('valor_site')} />
              </div>
              <div className="field">
                <label>Código FIPE</label>
                <input className="input" value={f.codigo_fipe ?? ''} onChange={set('codigo_fipe')} placeholder="002111-3" />
              </div>

              <div className="field">
                <label>Valor Tabela FIPE Mês Atual (R$)</label>
                <input className="input" type="number" value={f.fipe ?? 0} onChange={set('fipe')} />
              </div>
              <div className="field">
                <label>Valor Tabela FIPE Mês Anterior (R$)</label>
                <input className="input" type="number" value={f.valor_fipe_anterior ?? 0} onChange={set('valor_fipe_anterior')} />
              </div>
              <div className="field" style={{ justifyContent: 'end' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const base = Number(f.preco || f.custo || 100000);
                    const fipeCalc = Math.round(base * 1.015);
                    setF({
                      ...f,
                      fipe: fipeCalc,
                      valor_fipe_anterior: Math.round(fipeCalc * 1.006),
                      valor_minimo: f.valor_minimo || Math.round(base * 0.96),
                      valor_troca: f.valor_troca || Math.round(base * 1.03),
                      valor_site: f.valor_site || base,
                    });
                  }}
                >
                  <Sparkles size={15} />Sugerir Precificação & FIPE
                </button>
              </div>
            </div>

            {/* RECEITAS E DESPESAS DO VEÍCULO (DIRETO NA ABA) */}
            <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
              <h3 style={{ fontSize: '.98rem', marginBottom: 10 }}>
                Receitas e Despesas Vinculadas ao Veículo ({brl(despesasTotal)})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr auto', gap: 8, marginBottom: 12 }}>
                <select className="select" value={novaDespesa.categoria} onChange={(e) => setNovaDespesa({ ...novaDespesa, categoria: e.target.value })}>
                  {CATEGORIAS_FINANCEIRO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  className="input"
                  placeholder="Ex.: Polimento, Troca de óleo, Laudo Cautelar, Funilaria para-choque…"
                  value={novaDespesa.descricao}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, descricao: e.target.value })}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Valor (R$)"
                  value={novaDespesa.valor}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, valor: e.target.value })}
                />
                <select className="select" value={novaDespesa.status} onChange={(e) => setNovaDespesa({ ...novaDespesa, status: e.target.value })}>
                  <option value="pago">Pago</option>
                  <option value="pendente">A Pagar</option>
                </select>
                <button type="button" className="btn btn-primary" onClick={lancarDespesaDireta}>
                  <Plus size={15} />Lançar
                </button>
              </div>

              {(f.lancamentos_veiculo || []).length === 0 ? (
                <small style={{ color: 'var(--muted)' }}>Nenhuma despesa ou receita lançada para este veículo.</small>
              ) : (
                (f.lancamentos_veiculo || []).map((l) => (
                  <div key={l.id} className="list-row">
                    <div>
                      <strong>{l.descricao}</strong>
                      <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{l.categoria} · Venc.: {dataBr(l.vencimento)} · {l.status.toUpperCase()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ color: l.tipo === 'receita' ? 'var(--success)' : 'var(--danger)' }}>
                        {l.tipo === 'receita' ? '+' : '-'} {brl(l.valor)}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={async () => {
                          await deleteFinanceiro(l.id);
                          await onRefresh();
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ABA 4: OPCIONAIS E DESTAQUES OLX/PORTAIS */}
        {aba === 'opcionais' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: '.98rem' }}>Itens de Série e Opcionais ({(f.itens_opcionais || []).length} selecionados)</h3>
                  <small style={{ color: 'var(--muted)' }}>Clique nos itens abaixo ou aplique um pacote rápido de opcionais.</small>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, itens_opcionais: [...OPCIONAIS_PADRAO] })}>
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setF({
                      ...f,
                      itens_opcionais: ['Airbag', 'Alarme', 'Ar Condicionado', 'Direção Elétrica', 'Freios ABS', 'Trava elétrica', 'Vidro elétrico nas 4 portas', 'Central Multimídia', 'Câmera de Ré', 'Sensor de ré', 'Rodas de liga leve']
                    })}
                  >
                    Pacote Completo Padrão
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, itens_opcionais: [] })}>
                    Limpar
                  </button>
                </div>
              </div>

              <input
                className="input"
                style={{ marginBottom: 12 }}
                placeholder="Filtrar opcional (ex: teto solar, couro, 4x4)…"
                value={buscaOpcional}
                onChange={(e) => setBuscaOpcional(e.target.value)}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {OPCIONAIS_PADRAO
                  .filter((op) => op.toLowerCase().includes(buscaOpcional.toLowerCase()))
                  .map((op) => {
                    const ativo = (f.itens_opcionais || []).includes(op);
                    return (
                      <button
                        key={op}
                        type="button"
                        onClick={() => toggleItemLista('itens_opcionais', op)}
                        className="btn btn-sm"
                        style={{
                          background: ativo ? 'var(--primary)' : '#ffffff',
                          borderColor: ativo ? 'var(--primary)' : 'var(--border-strong)',
                          color: ativo ? '#ffffff' : 'var(--text)'
                        }}
                      >
                        {ativo ? '✓ ' : '+ '}{op}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
              <h3 style={{ fontSize: '.98rem', marginBottom: 10 }}>Informações Adicionais & Destaques para Portais (OLX / Webmotors)</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DESTAQUES_PADRAO.map((d) => {
                  const ativo = (f.itens_destaques || []).includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleItemLista('itens_destaques', d)}
                      className="btn btn-sm"
                      style={{
                        background: ativo ? 'var(--success)' : '#ffffff',
                        borderColor: ativo ? 'var(--success)' : 'var(--border-strong)',
                        color: ativo ? '#ffffff' : 'var(--text)'
                      }}
                    >
                      {ativo ? '✓ ' : '+ '}{d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ABA 5: OBSERVAÇÕES & ANÚNCIO */}
        {aba === 'observacoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ color: 'var(--muted)' }}>Textos separados por finalidade (Interna, Ficha de Pátio, Portais de Internet e Contrato).</small>
              <button type="button" className="btn btn-sm btn-primary" onClick={gerarTextoAnuncioAutomatico}>
                <Sparkles size={14} />Gerar Descrição Automática para Anúncio
              </button>
            </div>

            <div className="form-grid">
              <div className="field span-3">
                <label>Observação Interna (Visível somente para a loja — segredos, cofre, detalhes de oficina)</label>
                <textarea className="input" rows={2} value={f.observacao_interna ?? ''} onChange={set('observacao_interna')} />
              </div>
              <div className="field span-3">
                <label>Observação para Internet / Portais (OLX, Webmotors, iCarros, Site)</label>
                <textarea className="input" rows={4} value={f.observacao_internet ?? ''} onChange={set('observacao_internet')} />
              </div>
              <div className="field span-3">
                <label>Observação para Ficha de Anúncio / Parabrisa</label>
                <textarea className="input" rows={2} value={f.observacao_anuncio ?? ''} onChange={set('observacao_anuncio')} />
              </div>
              <div className="field span-2">
                <label>Observação para Contrato de Negociação</label>
                <textarea className="input" rows={2} value={f.observacao_contrato ?? ''} onChange={set('observacao_contrato')} />
              </div>
              <div className="field">
                <label>Observação para Financiamento</label>
                <textarea className="input" rows={2} value={f.observacao_financiamento ?? ''} onChange={set('observacao_financiamento')} />
              </div>
            </div>
          </div>
        )}

        {/* ABA 6: PENDÊNCIAS DO VEÍCULO */}
        {aba === 'pendencias' && (
          <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
            <h3 style={{ fontSize: '.98rem', marginBottom: 10 }}>Checklist e Pendências do Veículo</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <input
                className="input"
                placeholder="Nova pendência (ex: Segredo de roda, 2ª via ATPV-e, Quitar multa Detran)…"
                value={novaPendencia}
                onChange={(e) => setNovaPendencia(e.target.value)}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: '.84rem' }}>
                <input type="checkbox" checked={pendObrigatoria} onChange={(e) => setPendObrigatoria(e.target.checked)} /> Obrigatória p/ venda
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!novaPendencia.trim()) return;
                  setF({
                    ...f,
                    pendencias: [
                      ...(f.pendencias || []),
                      { id: Date.now(), titulo: novaPendencia.trim(), obrigatoria: pendObrigatoria, concluida: false, data: new Date().toISOString().slice(0, 10) }
                    ]
                  });
                  setNovaPendencia('');
                }}
              >
                <Plus size={15} />Adicionar
              </button>
            </div>

            {(f.pendencias || []).map((p, idx) => (
              <div key={p.id || idx} className="list-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!p.concluida}
                    onChange={(e) => {
                      const copia = [...f.pendencias];
                      copia[idx] = { ...copia[idx], concluida: e.target.checked };
                      setF({ ...f, pendencias: copia });
                    }}
                  />
                  <span style={{ textDecoration: p.concluida ? 'line-through' : 'none', color: p.concluida ? 'var(--muted)' : 'var(--text)', fontWeight: 500 }}>
                    {p.titulo}
                  </span>
                  {p.obrigatoria && <span className="badge badge-despesa">Obrigatória</span>}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge ${p.concluida ? 'badge-pago' : 'badge-pendente'}`}>
                    {p.concluida ? 'Resolvida' : 'Em aberto'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setF({ ...f, pendencias: f.pendencias.filter((_, i) => i !== idx) })}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ABA 7: HISTÓRICO DE RESERVAS */}
        {aba === 'reservas' && (
          <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
            <h3 style={{ fontSize: '.98rem', marginBottom: 10 }}>Controle e Histórico de Reservas do Veículo</h3>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="field">
                <label>Funcionário / Vendedor</label>
                <input className="input" value={novaReserva.funcionario} onChange={(e) => setNovaReserva({ ...novaReserva, funcionario: e.target.value })} />
              </div>
              <div className="field">
                <label>Cliente Interessado</label>
                <input className="input" placeholder="Nome do cliente…" value={novaReserva.cliente} onChange={(e) => setNovaReserva({ ...novaReserva, cliente: e.target.value })} />
              </div>
              <div className="field">
                <label>Data Limite da Reserva</label>
                <input className="input" type="date" value={novaReserva.data_limite} onChange={(e) => setNovaReserva({ ...novaReserva, data_limite: e.target.value })} />
              </div>
              <div className="field span-2">
                <label>Observação / Sinal Recebido</label>
                <input className="input" placeholder="Ex.: Sinal de R$ 1.500 no Pix até aprovação da ficha" value={novaReserva.observacao} onChange={(e) => setNovaReserva({ ...novaReserva, observacao: e.target.value })} />
              </div>
              <div className="field" style={{ justifyContent: 'end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (!novaReserva.cliente || !novaReserva.data_limite) return alert('Informe o cliente e a data limite da reserva.');
                    setF({
                      ...f,
                      status: 'reservado',
                      reservas: [{ id: Date.now(), ...novaReserva, status: 'Pendente' }, ...(f.reservas || [])]
                    });
                    setNovaReserva({ funcionario: 'Alexandre Gorges', cliente: '', data_limite: '', observacao: '' });
                  }}
                >
                  <BookmarkCheck size={15} />Reservar Veículo
                </button>
              </div>
            </div>

            {(f.reservas || []).length === 0 ? (
              <small style={{ color: 'var(--muted)' }}>Nenhuma reserva registrada para este veículo.</small>
            ) : (
              (f.reservas || []).map((r, idx) => (
                <div key={r.id || idx} className="list-row">
                  <div>
                    <strong>Cliente: {r.cliente}</strong> · <small>Vendedor: {r.funcionario}</small>
                    <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Limite: {dataBr(r.data_limite)} · {r.observacao}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${r.status === 'Pendente' ? 'badge-reservado' : 'badge-vendido'}`}>{r.status}</span>
                    {r.status === 'Pendente' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          const copia = [...f.reservas];
                          copia[idx] = { ...copia[idx], status: 'Histórico (Baixada)' };
                          setF({ ...f, status: 'disponivel', reservas: copia });
                        }}
                      >
                        Baixar Reserva
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA 8: DOCUMENTOS & FISCAL */}
        {aba === 'documentos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
              <h3 style={{ fontSize: '.98rem', marginBottom: 12 }}>Configuração Fiscal / NF-e (Entrada & Saída)</h3>
              <div className="form-grid">
                <div className="field">
                  <label>CFOP / Natureza de Entrada</label>
                  <input className="input" value={f.cfop_entrada ?? ''} onChange={set('cfop_entrada')} />
                </div>
                <div className="field">
                  <label>Valor Nota Fiscal de Compra (R$)</label>
                  <input className="input" type="number" value={f.valor_nf_compra || f.custo || 0} onChange={set('valor_nf_compra')} />
                </div>
                <div className="field">
                  <label>CFOP / Natureza de Saída</label>
                  <input className="input" value={f.cfop_saida ?? ''} onChange={set('cfop_saida')} />
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--color-neutral-80)' }}>
              <h3 style={{ fontSize: '.98rem', marginBottom: 10 }}>Documentação, Laudo Cautelar e Certidões do Veículo</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr auto', gap: 8, marginBottom: 12 }}>
                <select className="select" value={novoDoc.tipo} onChange={(e) => setNovoDoc({ ...novoDoc, tipo: e.target.value })}>
                  {['CRLV Digital', 'ATPV-e / Recibo', 'Laudo Cautelar', 'Consulta Detran / Multas', 'Nota Fiscal Entrada', 'Procuração'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input className="input" placeholder="Número / Código / Protocolo…" value={novoDoc.numero} onChange={(e) => setNovoDoc({ ...novoDoc, numero: e.target.value })} />
                <input className="input" placeholder="Situação (ex: Aprovado / PDF Ok)" value={novoDoc.status} onChange={(e) => setNovoDoc({ ...novoDoc, status: e.target.value })} />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setF({
                      ...f,
                      documentos_anexos: [...(f.documentos_anexos || []), { id: Date.now(), ...novoDoc, data: new Date().toISOString().slice(0, 10) }]
                    });
                    setNovoDoc({ tipo: 'CRLV Digital', numero: '', status: 'Validado' });
                  }}
                >
                  <Plus size={15} />Registrar
                </button>
              </div>
              {(f.documentos_anexos || []).map((d, idx) => (
                <div key={d.id || idx} className="list-row">
                  <div>
                    <strong>{d.tipo}</strong> — Nº {d.numero || '—'}
                    <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Data: {dataBr(d.data)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="badge badge-pago">{d.status}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setF({ ...f, documentos_anexos: f.documentos_anexos.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 9: FOTOS & VÍDEO YOUTUBE */}
        {aba === 'fotos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-grid">
              <div className="field">
                <label>Enviar Fotos do Computador (JPG, PNG, WEBP)</label>
                <input className="input" type="file" accept="image/*" multiple onChange={handleUploadFotoLocal} />
              </div>
              <div className="field">
                <label>Ou Adicionar Foto por URL</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" placeholder="https://…" value={novaFotoUrl} onChange={(e) => setNovaFotoUrl(e.target.value)} />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (!novaFotoUrl.trim()) return;
                      const novas = [...(f.fotos || []), novaFotoUrl.trim()];
                      setF({ ...f, fotos: novas, foto: f.foto || novas[0] });
                      setNovaFotoUrl('');
                    }}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Link do Vídeo no YouTube</label>
                <input className="input" placeholder="https://www.youtube.com/watch?v=…" value={f.url_video ?? ''} onChange={set('url_video')} />
              </div>
            </div>

            {(f.fotos || []).length === 0 ? (
              <div className="card empty">Nenhuma foto adicionada ainda. Envie fotos do computador ou cole uma URL acima.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                {f.fotos.map((url, idx) => (
                  <div key={idx} className="card" style={{ padding: 8 }}>
                    <img src={url} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${f.foto === url ? 'btn-primary' : ''}`}
                        onClick={() => setF({ ...f, foto: url })}
                      >
                        {f.foto === url ? '★ Capa' : 'Definir Capa'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          const restantes = f.fotos.filter((_, i) => i !== idx);
                          setF({ ...f, fotos: restantes, foto: f.foto === url ? (restantes[0] || '') : f.foto });
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA 10: INTEGRAÇÃO COM SITE & PORTAIS */}
        {aba === 'integracao_site' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={20} /> Publicação no Site Oficial & Portais
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>
                    Controle em tempo real da exibição deste veículo no site da loja (DG Automóveis) e nos feeds integrados.
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className={`badge ${f.publicar_site !== false ? 'badge-disponivel' : 'badge-vendido'}`}>
                    {f.publicar_site !== false ? '● Publicado no Site' : '○ Oculto no Site'}
                  </span>
                  {f.destaque_site && (
                    <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                      ★ Destaque na Home
                    </span>
                  )}
                </div>
              </div>

              <div className="form-grid">
                <div className="field span-2" style={{ background: '#ffffff', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: '.95rem' }}>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                      checked={f.publicar_site !== false}
                      onChange={(e) => setF({ ...f, publicar_site: e.target.checked })}
                    />
                    <span>Publicar este veículo no Site Oficial (DG Automóveis)</span>
                  </label>
                  <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4, marginLeft: 28 }}>
                    Quando marcado, o veículo entra automaticamente no feed JSON e XML do site. Se desmarcado, fica visível apenas internamente na loja.
                  </small>
                </div>

                <div className="field" style={{ background: '#ffffff', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: '.95rem' }}>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                      checked={!!f.destaque_site}
                      onChange={(e) => setF({ ...f, destaque_site: e.target.checked })}
                    />
                    <span>Exibir na Vitrine / Destaques da Home</span>
                  </label>
                  <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4, marginLeft: 28 }}>
                    Aparece no carrossel de ofertas especiais e novidades na página inicial da DG Automóveis.
                  </small>
                </div>

                <div className="field">
                  <label>Valor Anunciado no Site (R$)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      type="number"
                      placeholder="Valor no site"
                      value={f.valor_site || f.preco || 0}
                      onChange={set('valor_site')}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      title="Copiar valor à vista"
                      onClick={() => setF({ ...f, valor_site: Number(f.preco || 0) })}
                    >
                      Copiar Preço
                    </button>
                  </div>
                  <small style={{ color: 'var(--muted)' }}>Valor padrão de vitrine: {brl(f.preco)}</small>
                </div>

                <div className="field span-2">
                  <label>Chamada Promocional / Destaque do Veículo no Site</label>
                  <input
                    className="input"
                    placeholder="Ex: Teto Solar + Couro + Baixa KM (Impecável!)"
                    value={f.observacao_site ?? ''}
                    onChange={set('observacao_site')}
                  />
                  <small style={{ color: 'var(--muted)' }}>Frase de impacto que aparece nos cards de destaque da DG Automóveis.</small>
                </div>

                <div className="field span-3">
                  <label>Texto Completo para a Ficha do Veículo na Web</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={f.observacao_internet ?? ''}
                    onChange={set('observacao_internet')}
                    placeholder="Descrição completa exibida na página de detalhes do veículo no site..."
                  />
                </div>
              </div>
            </div>

            {/* CARD DE DIAGNÓSTICO E LINK DIRETO DO VEÍCULO */}
            <div className="card" style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
              <h4 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExternalLink size={16} /> Link e Status de Entrega para o Site
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                <div style={{ background: 'var(--color-neutral-80)', padding: 12, borderRadius: 8 }}>
                  <small style={{ color: 'var(--muted)', display: 'block' }}>Fotos cadastradas</small>
                  <strong style={{ fontSize: '1.1rem' }}>{(f.fotos || []).length} fotos</strong>
                </div>
                <div style={{ background: 'var(--color-neutral-80)', padding: 12, borderRadius: 8 }}>
                  <small style={{ color: 'var(--muted)', display: 'block' }}>Opcionais selecionados</small>
                  <strong style={{ fontSize: '1.1rem' }}>{(f.itens_opcionais || []).length} itens</strong>
                </div>
                <div style={{ background: 'var(--color-neutral-80)', padding: 12, borderRadius: 8 }}>
                  <small style={{ color: 'var(--muted)', display: 'block' }}>Tabela FIPE Vinculada</small>
                  <strong style={{ fontSize: '1.1rem' }}>{f.fipe > 0 ? brl(f.fipe) : 'Não vinculada'}</strong>
                </div>
              </div>

              {f.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f1f5f9', padding: '10px 14px', borderRadius: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.85rem', color: '#475569', fontWeight: 600 }}>Link no Site Oficial:</span>
                  <code style={{ fontSize: '.82rem', background: '#ffffff', padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {`https://dgautomoveis.com.br/estoque/${String(f.marca || '').toLowerCase()}-${String(f.modelo || '').toLowerCase()}-${f.id}`.replace(/[^a-z0-9\/-]+/g, '-')}
                  </code>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      const url = `https://dgautomoveis.com.br/estoque/${String(f.marca || '').toLowerCase()}-${String(f.modelo || '').toLowerCase()}-${f.id}`.replace(/[^a-z0-9\/-]+/g, '-');
                      navigator.clipboard?.writeText(url);
                      alert('Link copiado para a área de transferência!');
                    }}
                  >
                    Copiar Link
                  </button>
                  <a
                    href="https://dgautomoveis.com.br"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                  >
                    <ExternalLink size={14} /> Abrir Site
                  </a>
                </div>
              ) : (
                <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
                  Salve o veículo primeiro para gerar o link individual permanente no site.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="altimus-crud-footer">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {f.id && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => confirm('Excluir este veículo permanentemente?') && onDelete(f.id)}
            >
              <Trash2 size={16} />Excluir
            </button>
          )}
          {ABAS_VEICULO.findIndex((a) => a.id === aba) > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                const idx = ABAS_VEICULO.findIndex((a) => a.id === aba);
                if (idx > 0) setAba(ABAS_VEICULO[idx - 1].id);
              }}
            >
              <ArrowLeft size={15} /> Aba Anterior
            </button>
          )}
          {ABAS_VEICULO.findIndex((a) => a.id === aba) < ABAS_VEICULO.length - 1 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                const idx = ABAS_VEICULO.findIndex((a) => a.id === aba);
                if (idx < ABAS_VEICULO.length - 1) setAba(ABAS_VEICULO[idx + 1].id);
              }}
            >
              Próxima Aba <ArrowRight size={15} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn" onClick={onClose}>Fechar / Voltar</button>
          <button id="btn-salvar-veiculo" type="submit" className="btn btn-primary">✓ Salvar Ficha do Veículo</button>
        </div>
      </div>
    </form>
  );
}
