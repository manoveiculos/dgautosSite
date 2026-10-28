import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Car, X, Trash2, Gauge, Fuel, Calendar, LayoutGrid, List,
  CheckCircle2, AlertTriangle, Wrench, FileText, Image, BookmarkCheck,
  Sparkles, Printer, Handshake, ExternalLink, ShieldCheck, Edit3, ArrowLeft, ArrowRight, Globe,
  Download, Eye, Upload, Settings, ShieldAlert, FileDown, ChevronDown, GripVertical, Clock, DollarSign, Building2
} from 'lucide-react';
import {
  getVeiculos, saveVeiculo, deleteVeiculo, getClientes,
  saveFinanceiro, deleteFinanceiro, brl, dataBr, STATUS, CATEGORIAS_FINANCEIRO
} from '../store';
import { buscarPlaca, mascaraPlaca, buscarFipeMesAnterior } from '../utils/mascaras';

const GRUPOS_OPCIONAIS = [
  {
    nome: 'Segurança',
    itens: [
      'Airbag', 'Airbag duplo / cortina', 'Alarme', 'Controle de tração e estabilidade',
      'Freios ABS', 'Sensor de estacionamento dianteiro/traseiro', 'Sensor de ré',
      'Câmera de Ré', 'Câmera 360°', 'Faróis Full LED', 'Faróis de neblina', 'Blindado'
    ]
  },
  {
    nome: 'Conforto & Conveniência',
    itens: [
      'Ar Condicionado', 'Ar Digital Dual Zone', 'Bancos de Couro', 'Banco com regulagem elétrica',
      'Chave Presencial (Keyless)', 'Direção Elétrica', 'Partida Start/Stop',
      'Controle automático de velocidade (Piloto)', 'Teto solar', 'Teto panorâmico',
      'Trava elétrica', 'Vidro elétrico nas 4 portas', 'Volante multifuncional', 'Sensor de chuva'
    ]
  },
  {
    nome: 'Tecnologia & Som',
    itens: [
      'Central Multimídia', 'Conexão USB / CarPlay', 'Interface Bluetooth', 'Navegador GPS',
      'Som Premium', 'Computador de bordo'
    ]
  },
  {
    nome: 'Performance & Estilo',
    itens: [
      'Rodas de liga leve', 'Tração 4x4', 'Paddle Shift (Borboleta)'
    ]
  }
];

const OPCIONAIS_PADRAO = GRUPOS_OPCIONAIS.flatMap((g) => g.itens);

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

const ETAPAS_PREPARACAO = [
  { id: 'entrada', label: '1. Entrada / Vistoria', cor: '#0284c7', icon: '📥' },
  { id: 'mecanica', label: '2. Mecânica & Revisão', cor: '#d97706', icon: '🔧' },
  { id: 'funilaria', label: '3. Funilaria / Pintura', cor: '#dc2626', icon: '🎨' },
  { id: 'estetica', label: '4. Higienização & Polimento', cor: '#8b5cf6', icon: '✨' },
  { id: 'showroom', label: '5. Showroom (Pronto)', cor: '#16a34a', icon: '📸' }
];

const getEtapaVeiculo = (v) => {
  if (v.etapa_preparacao) return v.etapa_preparacao;
  const sit = (v.situacao_patio || '').toLowerCase();
  if (sit.includes('oficina') || sit.includes('mecânica') || sit.includes('revisão')) return 'mecanica';
  if (sit.includes('funilaria') || sit.includes('pintura') || sit.includes('martelinho')) return 'funilaria';
  if (sit.includes('higienização') || sit.includes('polimento') || sit.includes('estética') || sit.includes('lav')) return 'estetica';
  if (sit.includes('entrada') || sit.includes('vistoria') || sit.includes('preparação')) return 'entrada';
  if (v.status === 'disponivel') return 'showroom';
  return 'entrada';
};

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
  cidade_emplacamento: 'Rio do Sul - SC',
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
  fipe_mes_atual: '',
  fipe_mes_anterior: '',
  fipe_opcoes: [],
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
  investidores: [{ id: 1, nome: 'DG Automóveis (Loja)', percentual: 100 }],
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

export default function Estoque({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [modo, setModo] = useState('cards'); // cards | tabela
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [propriedade, setPropriedade] = useState('');
  const [cambio, setCambio] = useState('');
  const [filtroTempoPatio, setFiltroTempoPatio] = useState('');
  const [editando, setEditando] = useState(null);
  const [fichaImpressao, setFichaImpressao] = useState(null);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [menuAbertoId, setMenuAbertoId] = useState(null);
  const [carregandoEstoque, setCarregandoEstoque] = useState(false);

  const recarregar = async () => {
    setCarregandoEstoque(true);
    try {
      const [vs, cs] = await Promise.all([getVeiculos(), getClientes()]);
      const listaArray = Array.isArray(vs) ? vs : [];
      const clientesArray = Array.isArray(cs) ? cs : [];
      setLista(listaArray);
      setClientes(clientesArray);
      if (editando?.id) {
        const atualizado = listaArray.find((x) => x.id === editando.id);
        if (atualizado) setEditando(atualizado);
      }
    } catch (e) {
      console.warn('Erro ao carregar estoque:', e);
    } finally {
      setCarregandoEstoque(false);
    }
  };

  const handleTogglePublicarSite = async (v, e) => {
    if (e) e.stopPropagation();
    const novoStatus = v.publicar_site === false ? true : false;
    try {
      const atualizados = await saveVeiculo({ ...v, publicar_site: novoStatus });
      setLista(Array.isArray(atualizados) ? atualizados : []);
    } catch (err) {
      console.warn('Erro ao atualizar status do site:', err);
    }
  };

  const handleMoverEtapa = async (veiculo, novaEtapa, e) => {
    if (e) e.stopPropagation();
    const etapaObj = ETAPAS_PREPARACAO.find((et) => et.id === novaEtapa);
    const atualizado = {
      ...veiculo,
      etapa_preparacao: novaEtapa,
      situacao_patio: etapaObj ? etapaObj.label : veiculo.situacao_patio,
      status: novaEtapa === 'showroom' ? 'disponivel' : (veiculo.status === 'vendido' ? 'vendido' : 'em_preparacao')
    };
    try {
      const r = await saveVeiculo(atualizado);
      setLista(Array.isArray(r) ? r : []);
    } catch (err) {
      alert('Erro ao mover veículo: ' + err.message);
    }
  };

  useEffect(() => { recarregar(); }, []);

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setEditando(EMPTY_VEICULO);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtrados = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    return arr.filter((v) => {
      if (status && v.status !== status) return false;
      if (propriedade && (v.propriedade || 'PROPRIO') !== propriedade) return false;
      if (cambio && v.cambio !== cambio) return false;
      if (filtroTempoPatio) {
        const d = diasEmEstoque(v.entrada, v.venda);
        if (filtroTempoPatio === 'ate30' && d > 30) return false;
        if (filtroTempoPatio === '31a60' && (d <= 30 || d > 60)) return false;
        if (filtroTempoPatio === '61a90' && (d <= 60 || d > 90)) return false;
        if (filtroTempoPatio === 'mais90' && d <= 90) return false;
      }
      const texto = `${v.marca || ''} ${v.modelo || ''} ${v.modelo_complemento || ''} ${v.placa || ''} ${v.cor || ''} ${v.chassi || ''} ${v.renavam || ''} ${v.codigo_interno || ''}`.toLowerCase();
      return texto.includes(busca.toLowerCase());
    });
  }, [lista, busca, status, propriedade, cambio, filtroTempoPatio]);

  const totais = useMemo(() => {
    const ativos = filtrados.filter((v) => v.status !== 'vendido');
    const custoTotal = ativos.reduce((s, v) => s + Number(v.custo || 0) + Number(v.despesas_veiculo || 0), 0);
    const vendaTotal = ativos.reduce((s, v) => s + Number(v.preco || 0), 0);
    const totalDias = ativos.reduce((s, v) => s + diasEmEstoque(v.entrada, v.venda), 0);
    const mediaDias = ativos.length ? Math.round(totalDias / ativos.length) : 0;
    const criticosQtd = ativos.filter((v) => diasEmEstoque(v.entrada, v.venda) > 60).length;
    return { qtd: ativos.length, custoTotal, vendaTotal, margem: vendaTotal - custoTotal, mediaDias, criticosQtd };
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
        user={user}
        onClose={() => setEditando(null)}
        onSave={async (v) => {
          try {
            const r = await saveVeiculo(v);
            setLista(Array.isArray(r) ? r : []);
            setEditando(null);
            alert(`✓ Veículo ${v.marca} ${v.modelo} salvo com sucesso no banco de dados!`);
          } catch (err) {
            alert('Erro ao salvar veículo: ' + err.message);
          }
        }}
        onCancelarVeiculo={async (v, motivo) => {
          if (user?.perfil !== 'admin') {
            alert('Ação bloqueada: Por compliance legal, a exclusão de veículos e contratos é estritamente proibida. Apenas administradores podem cancelar um veículo mediante distrato formal de contrato.');
            return;
          }
          const veicCancelado = {
            ...v,
            status: 'cancelado',
            situacao_patio: `Cancelado / Contrato Distratado (${motivo || 'Sem motivo informado'})`,
            observacao_interna: `${v.observacao_interna || ''}\n[CANCELADO POR ADMIN em ${new Date().toLocaleString('pt-BR')} - Motivo: ${motivo}]`.trim()
          };
          const r = await saveVeiculo(veicCancelado);
          setLista(r);
          setEditando(null);
          alert('Veículo cancelado com sucesso no estoque. O registro e contrato foram mantidos no histórico para fins fiscais.');
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
      {carregandoEstoque && (
        <div className="loading-toast">
          <div className="spinner-sm" />
          <span>Carregando estoque e fotos...</span>
        </div>
      )}
      <header className="topbar">
        <div>
          <h1>Estoque de Veículos</h1>
          <p>{filtrados.length} veículo(s) listado(s) · Entrada rigorosa por Contrato (Compra / Consignação), FIPE e Consulta DETRAN-SC.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs">
            <button className={`tab ${modo === 'cards' ? 'active' : ''}`} onClick={() => setModo('cards')}>
              <LayoutGrid size={15} />Vitrine
            </button>
            <button className={`tab ${modo === 'tabela' ? 'active' : ''}`} onClick={() => setModo('tabela')}>
              <List size={15} />Tabela Detalhada
            </button>
            <button className={`tab ${modo === 'preparacao' ? 'active' : ''}`} onClick={() => setModo('preparacao')}>
              <Wrench size={15} />Fluxo de Preparação (Kanban)
            </button>
          </div>
          <button
            id="btn-novo-veiculo-contrato"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
            onClick={() => setModalEntrada(true)}
          >
            <FileText size={16} />+ Entrada por Contrato
          </button>
        </div>
      </header>

      {/* MODAL DE ENTRADA OBRIGATÓRIA VIA CONTRATO */}
      {modalEntrada && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
          onClick={() => setModalEntrada(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 580,
              width: '100%',
              background: '#ffffff',
              borderRadius: 14,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Entrada de Veículo no Estoque</h3>
              </div>
              <button type="button" className="btn btn-icon" onClick={() => setModalEntrada(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '.88rem', color: 'var(--muted)', marginBottom: 18, lineHeight: 1.5 }}>
              Por conformidade jurídica e fiscal, <strong>nenhum veículo ingressa no estoque sem contrato formal</strong>. Selecione a operação de entrada correspondente:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Opção 1: Compra para Estoque */}
              <button
                type="button"
                className="card"
                style={{
                  textAlign: 'left',
                  padding: 16,
                  cursor: 'pointer',
                  border: '2px solid var(--border)',
                  borderRadius: 10,
                  transition: 'all .2s ease',
                  background: 'var(--color-neutral-80)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                onClick={() => {
                  setModalEntrada(false);
                  navigate('/negociacoes?novo=1&tipo=compra');
                }}
              >
                <div style={{ background: 'var(--primary)', color: '#fff', padding: 12, borderRadius: 8 }}>
                  <Handshake size={22} />
                </div>
                <div>
                  <strong style={{ fontSize: '1rem', display: 'block', color: 'var(--text)' }}>
                    1. Contrato de Compra para Estoque (Aquisição Loja)
                  </strong>
                  <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                    Aquisição de veículo próprio pela DG Automóveis (com minuta de 9 cláusulas e quitação).
                  </span>
                </div>
              </button>

              {/* Opção 2: Consignação */}
              <button
                type="button"
                className="card"
                style={{
                  textAlign: 'left',
                  padding: 16,
                  cursor: 'pointer',
                  border: '2px solid var(--border)',
                  borderRadius: 10,
                  transition: 'all .2s ease',
                  background: 'var(--color-neutral-80)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                onClick={() => {
                  setModalEntrada(false);
                  navigate('/negociacoes?novo=1&tipo=consignacao');
                }}
              >
                <div style={{ background: '#059669', color: '#fff', padding: 12, borderRadius: 8 }}>
                  <FileText size={22} />
                </div>
                <div>
                  <strong style={{ fontSize: '1rem', display: 'block', color: 'var(--text)' }}>
                    2. Contrato de Consignação (Veículo de Terceiro)
                  </strong>
                  <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                    Veículo de cliente consignado para venda (com tabela de despesas e autorização de pátio).
                  </span>
                </div>
              </button>

              {/* Opção 3: Cadastro Direto (Apenas Administrador) */}
              <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                {user?.perfil === 'admin' ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ width: '100%', justifyContent: 'center', color: 'var(--muted)' }}
                    onClick={() => {
                      setModalEntrada(false);
                      setEditando(EMPTY_VEICULO);
                    }}
                  >
                    ⚡ Cadastro Direto / Inventário Inicial (Exclusivo Administrador)
                  </button>
                ) : (
                  <div style={{ fontSize: '.76rem', color: 'var(--muted)', textAlign: 'center' }}>
                    🔒 O cadastro manual direto é restrito a administradores. Vendedores devem cadastrar via Contrato de Compra ou Consignação.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="card stat">
          <div className="stat-label"><Clock size={15} />Tempo Médio de Pátio</div>
          <div className="stat-value" style={{ color: totais.mediaDias > 60 ? '#ef4444' : totais.mediaDias > 30 ? '#f59e0b' : '#10b981' }}>
            {totais.mediaDias} dias
          </div>
          <div className="stat-sub">
            {totais.criticosQtd > 0 ? (
              <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠️ {totais.criticosQtd} carro(s) &gt; 60 dias no pátio</span>
            ) : (
              <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Estoque com giro excelente</span>
            )}
          </div>
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
        <select className="select" style={{ maxWidth: 205 }} value={filtroTempoPatio} onChange={(e) => setFiltroTempoPatio(e.target.value)}>
          <option value="">Todos os tempos de giro</option>
          <option value="ate30">🟢 Até 30 dias (Giro Rápido)</option>
          <option value="31a60">🟡 31 a 60 dias (Giro Médio)</option>
          <option value="61a90">🟠 61 a 90 dias (Alerta Giro)</option>
          <option value="mais90">🔴 Mais de 90 dias (Pátio Crítico)</option>
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
            const corGiro = dias <= 30 ? '#10b981' : dias <= 60 ? '#f59e0b' : dias <= 90 ? '#f97316' : '#ef4444';
            const labelGiro = dias <= 30 ? 'Giro Rápido' : dias <= 60 ? 'Giro Médio' : dias <= 90 ? 'Alerta Giro' : 'Pátio Crítico (+90d)';
            return (
              <article key={v.id} id={`veiculo-${v.id}`} className="card vehicle" style={{ animationDelay: `${i * 45}ms` }} onClick={() => setEditando(v)}>
                <div className="vehicle-photo">
                  {v.foto ? <img src={v.foto} alt={`${v.marca} ${v.modelo}`} /> : <Car size={48} strokeWidth={1.2} />}
                  <span className={`badge badge-${v.status}`}>{STATUS[v.status]}</span>
                  
                  {/* TOGGLE PUBLICAR / RETIRAR DO SITE COM 1 CLIQUE */}
                  <button
                    type="button"
                    onClick={(e) => handleTogglePublicarSite(v, e)}
                    title={v.publicar_site !== false ? 'Veículo PUBLICADO no site DG. Clique para RETIRAR do site.' : 'Veículo OCULTO. Clique para PUBLICAR no site DG agora.'}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      background: v.publicar_site !== false ? 'hsla(142, 70%, 42%, .95)' : 'rgba(15, 23, 42, .88)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,.25)',
                      borderRadius: 20,
                      padding: '4px 10px',
                      fontSize: '.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      boxShadow: '0 4px 12px rgba(0,0,0,.35)',
                      zIndex: 3,
                      transition: 'all .15s ease'
                    }}
                  >
                    <Globe size={12} />
                    {v.publicar_site !== false ? 'Site: Publicado' : 'Site: Oculto'}
                  </button>

                  {pendAbertas > 0 && (
                    <span
                      title={`${pendAbertas} pendência(s) em aberto`}
                      style={{ position: 'absolute', top: 44, right: 10, background: 'hsla(38, 95%, 55%, .95)', color: '#111', padding: '3px 8px', borderRadius: 99, fontSize: '.70rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, boxShadow: '0 4px 10px rgba(0,0,0,.35)', zIndex: 2 }}
                    >
                      <AlertTriangle size={11} /> {pendAbertas} pendência(s)
                    </span>
                  )}
                  {v.placa && (
                    <span className="vehicle-plate">
                      {v.placa}
                    </span>
                  )}
                  <span style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(10,14,25,.90)', padding: '3px 9px', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, color: '#ffffff', borderLeft: `4px solid ${corGiro}`, display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: corGiro, display: 'inline-block' }} />
                    ⏱ {dias}d · {labelGiro}
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

                  <div className="vehicle-actions" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                    <button type="button" className="btn btn-sm" onClick={() => setEditando(v)}>
                      <Edit3 size={13} /> Abrir Ficha
                    </button>
                    {v.placa && v.renavam && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        title="Consulta Dossiê DETRAN-SC"
                        onClick={() => {
                          const urlDetran = `https://servicos.detran.sc.gov.br/consulta-dossie-veiculo?placa=${encodeURIComponent(v.placa.trim().toUpperCase())}&renavam=${encodeURIComponent(v.renavam.trim())}`;
                          window.open(urlDetran, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <Search size={13} /> DETRAN
                      </button>
                    )}
                    {v.status !== 'vendido' && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate('/negociacoes?novo=1')}>
                        <Handshake size={13} /> Vender
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm"
                      title="Menu de Opções do Veículo"
                      onClick={() => setMenuAbertoId(menuAbertoId === v.id ? null : v.id)}
                    >
                      <Settings size={14} />
                    </button>

                    {menuAbertoId === v.id && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: '100%',
                          marginBottom: 8,
                          background: '#ffffff',
                          borderRadius: 10,
                          boxShadow: '0 10px 25px rgba(0,0,0,.25)',
                          border: '1px solid var(--border)',
                          padding: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          zIndex: 100,
                          minWidth: 210
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setMenuAbertoId(null);
                            setFichaImpressao(v);
                          }}
                        >
                          <Printer size={13} /> Ficha de Parabrisa A4
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setMenuAbertoId(null);
                            navigate(`/negociacoes?busca=${encodeURIComponent(v.placa || v.modelo)}`);
                          }}
                        >
                          <Handshake size={13} /> Negociações Associadas
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setMenuAbertoId(null);
                            navigate(`/crm?busca=${encodeURIComponent(v.modelo)}`);
                          }}
                        >
                          <Car size={13} /> Oportunidades do CRM
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setMenuAbertoId(null);
                            navigate(`/documentos?veiculo=${v.id}&modelo=checklist_vistoria`);
                          }}
                        >
                          <FileText size={13} /> 📋 Checklist de Vistoria
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setMenuAbertoId(null);
                            navigate(`/documentos?veiculo=${v.id}&modelo=recibo_sinal`);
                          }}
                        >
                          <DollarSign size={13} /> 💵 Recibo de Sinal & Reserva
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setMenuAbertoId(null);
                            navigate(`/documentos?veiculo=${v.id}&modelo=autorizacao_transf`);
                          }}
                        >
                          <ShieldCheck size={13} /> 📑 Termo Transf. (ATPV-e)
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setMenuAbertoId(null);
                            navigate(`/documentos?veiculo=${v.id}`);
                          }}
                        >
                          <FileText size={13} /> Todas Minutas & Contratos
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={(e) => {
                            setMenuAbertoId(null);
                            handleTogglePublicarSite(v, e);
                          }}
                        >
                          <Globe size={13} /> {v.publicar_site !== false ? 'Retirar do Site DG' : 'Publicar no Site DG'}
                        </button>
                        {v.placa && v.renavam && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              const urlDetran = `https://servicos.detran.sc.gov.br/consulta-dossie-veiculo?placa=${encodeURIComponent(v.placa.trim().toUpperCase())}&renavam=${encodeURIComponent(v.renavam.trim())}`;
                              window.open(urlDetran, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            <Search size={13} /> Consulta DETRAN-SC
                          </button>
                        )}
                        {user?.perfil === 'admin' && v.status !== 'cancelado' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              const motivo = prompt(`Informe o motivo do cancelamento formal do veículo #${v.id} (${v.marca} ${v.modelo}):`);
                              if (!motivo) return;
                              saveVeiculo({
                                ...v,
                                status: 'cancelado',
                                situacao_patio: `Cancelado / Contrato Distratado (${motivo})`,
                                observacao_interna: `${v.observacao_interna || ''}\n[CANCELADO POR ADMIN em ${new Date().toLocaleString('pt-BR')} - Motivo: ${motivo}]`.trim()
                              }).then((atualizados) => {
                                setLista(atualizados);
                                alert('Veículo cancelado com sucesso no estoque. Histórico mantido para auditoria fiscal.');
                              });
                            }}
                          >
                            <Trash2 size={13} /> Cancelar Veículo (Admin)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : modo === 'tabela' ? (
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
                <th>Site DG</th>
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
                    <td>
                      {(() => {
                        const d = diasEmEstoque(v.entrada, v.venda);
                        const c = d <= 30 ? '#10b981' : d <= 60 ? '#f59e0b' : d <= 90 ? '#f97316' : '#ef4444';
                        const lbl = d <= 30 ? 'Giro Rápido' : d <= 60 ? 'Giro Médio' : d <= 90 ? 'Atenção' : 'Crítico';
                        return (
                          <span className="badge" style={{ background: `${c}18`, color: c, border: `1px solid ${c}55`, fontWeight: 700, fontSize: '.70rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                            {d}d · {lbl}
                          </span>
                        );
                      })()}
                    </td>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`badge ${v.publicar_site !== false ? 'badge-disponivel' : 'badge-vendido'}`}
                        style={{ cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '.72rem' }}
                        title={v.publicar_site !== false ? 'Publicado no site DG. Clique para Ocultar.' : 'Oculto do site. Clique para Publicar.'}
                        onClick={(e) => handleTogglePublicarSite(v, e)}
                      >
                        <Globe size={11} />
                        {v.publicar_site !== false ? 'Publicado' : 'Oculto'}
                      </button>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, position: 'relative' }}>
                      <button className="btn btn-sm" title="Imprimir Ficha de Pátio" onClick={() => setFichaImpressao(v)}>
                        <Printer size={13} />
                      </button>
                      {v.placa && v.renavam && (
                        <button
                          className="btn btn-sm"
                          title="Consulta Dossiê DETRAN-SC"
                          onClick={() => {
                            const urlDetran = `https://servicos.detran.sc.gov.br/consulta-dossie-veiculo?placa=${encodeURIComponent(v.placa.trim().toUpperCase())}&renavam=${encodeURIComponent(v.renavam.trim())}`;
                            window.open(urlDetran, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <Search size={13} />
                        </button>
                      )}
                      <button
                        className="btn btn-sm"
                        title="Opções do Veículo"
                        onClick={() => setMenuAbertoId(menuAbertoId === v.id ? null : v.id)}
                      >
                        <Settings size={13} />
                      </button>

                      {menuAbertoId === v.id && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: 4,
                            background: '#ffffff',
                            borderRadius: 10,
                            boxShadow: '0 10px 25px rgba(0,0,0,.25)',
                            border: '1px solid var(--border)',
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            zIndex: 100,
                            minWidth: 200
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              setEditando(v);
                            }}
                          >
                            <Edit3 size={13} /> Abrir Ficha
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              navigate(`/negociacoes?busca=${encodeURIComponent(v.placa || v.modelo)}`);
                            }}
                          >
                            <Handshake size={13} /> Negociações
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              navigate(`/crm?busca=${encodeURIComponent(v.modelo)}`);
                            }}
                          >
                            <Car size={13} /> CRM / Leads
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              navigate('/documentos');
                            }}
                          >
                            <FileText size={13} /> Contratos
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={(e) => {
                              setMenuAbertoId(null);
                              handleTogglePublicarSite(v, e);
                            }}
                          >
                            <Globe size={13} /> {v.publicar_site !== false ? 'Retirar do Site DG' : 'Publicar no Site DG'}
                          </button>
                          {user?.perfil === 'admin' && v.status !== 'cancelado' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              style={{ justifyContent: 'flex-start' }}
                              onClick={() => {
                                setMenuAbertoId(null);
                                const motivo = prompt(`Informe o motivo do cancelamento formal do veículo #${v.id}:`);
                                if (!motivo) return;
                                saveVeiculo({
                                  ...v,
                                  status: 'cancelado',
                                  situacao_patio: `Cancelado / Contrato Distratado (${motivo})`,
                                  observacao_interna: `${v.observacao_interna || ''}\n[CANCELADO POR ADMIN em ${new Date().toLocaleString('pt-BR')} - Motivo: ${motivo}]`.trim()
                                }).then((atualizados) => {
                                  setLista(atualizados);
                                  alert('Veículo cancelado com sucesso no estoque.');
                                });
                              }}
                            >
                              <Trash2 size={13} /> Cancelar Veículo (Admin)
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ========================================================================= */
        /* FLUXO DE PREPARAÇÃO DE PÁTIO (KANBAN ALTIMUS) */
        /* ========================================================================= */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, alignItems: 'start' }}>
          {ETAPAS_PREPARACAO.map((etapa, idxEtapa) => {
            const veiculosNaEtapa = filtrados.filter((v) => getEtapaVeiculo(v) === etapa.id);
            return (
              <div
                key={etapa.id}
                style={{
                  background: 'var(--color-neutral-80)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minHeight: 480
                }}
              >
                {/* CABEÇALHO DA ETAPA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `3px solid ${etapa.cor}`, paddingBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1.1rem' }}>{etapa.icon}</span>
                    <strong style={{ fontSize: '.88rem', color: 'var(--text)' }}>{etapa.label}</strong>
                  </div>
                  <span className="badge" style={{ background: etapa.cor, color: '#fff', fontWeight: 800, fontSize: '.72rem', borderRadius: 99 }}>
                    {veiculosNaEtapa.length}
                  </span>
                </div>

                {/* LISTAGEM DOS CARDS DESTA ETAPA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {veiculosNaEtapa.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)', fontSize: '.8rem', fontStyle: 'italic' }}>
                      Nenhum veículo nesta etapa.
                    </div>
                  ) : (
                    veiculosNaEtapa.map((v) => {
                      const dias = diasEmEstoque(v.entrada, v.venda);
                      const corGiro = dias <= 30 ? '#10b981' : dias <= 60 ? '#f59e0b' : dias <= 90 ? '#f97316' : '#ef4444';
                      const despTotal = Number(v.despesas_veiculo || 0);

                      return (
                        <div
                          key={v.id}
                          className="card"
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            background: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            boxShadow: '0 2px 6px rgba(0,0,0,.04)',
                            transition: 'all .15s ease'
                          }}
                          onClick={() => setEditando(v)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                            <div>
                              <strong style={{ fontSize: '.9rem', display: 'block' }}>{v.marca} {v.modelo}</strong>
                              <span style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{v.ano} · {v.cor}</span>
                            </div>
                            <span className="badge" style={{ fontSize: '.68rem', fontWeight: 700 }}>
                              {v.placa || 'S/ PLACA'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.76rem', background: '#f8fafc', padding: '6px 8px', borderRadius: 6 }}>
                            <span style={{ color: corGiro, fontWeight: 700 }}>⏱ {dias}d no pátio</span>
                            <span style={{ color: despTotal > 0 ? '#d97706' : 'var(--muted)', fontWeight: 600 }}>
                              {despTotal > 0 ? `Desp: ${brl(despTotal)}` : 'Sem desp.'}
                            </span>
                          </div>

                          <div style={{ fontSize: '.72rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={12} /> {v.localizacao_patio || 'Showroom DG'}
                          </div>

                          {/* BOTÕES DE AVANÇO / RETROCESSO DE ETAPA */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #f1f5f9', marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                            {idxEtapa > 0 ? (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ padding: '2px 8px', fontSize: '.72rem' }}
                                title={`Voltar para ${ETAPAS_PREPARACAO[idxEtapa - 1].label}`}
                                onClick={(e) => handleMoverEtapa(v, ETAPAS_PREPARACAO[idxEtapa - 1].id, e)}
                              >
                                ← Voltar
                              </button>
                            ) : <div />}

                            {idxEtapa < ETAPAS_PREPARACAO.length - 1 ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ padding: '2px 8px', fontSize: '.72rem' }}
                                title={`Avançar para ${ETAPAS_PREPARACAO[idxEtapa + 1].label}`}
                                onClick={(e) => handleMoverEtapa(v, ETAPAS_PREPARACAO[idxEtapa + 1].id, e)}
                              >
                                Avançar →
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`badge ${v.publicar_site !== false ? 'badge-disponivel' : 'badge-vendido'}`}
                                style={{ cursor: 'pointer', border: 'none', padding: '3px 7px', fontSize: '.7rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={(e) => handleTogglePublicarSite(v, e)}
                              >
                                <Globe size={10} /> {v.publicar_site !== false ? 'Publicado' : 'Oculto'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function VeiculoModal({ inicial, clientes, onClose, onSave, onCancelarVeiculo, onRefresh, onImprimirFicha, onIrNegociacao, user }) {
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
  const [salvando, setSalvando] = useState(false);
  const [loadingFotos, setLoadingFotos] = useState('');
  const [novaDespesa, setNovaDespesa] = useState({
    categoria: 'Preparação / Estética',
    descricao: '',
    valor: '',
    status: 'pago'
  });
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [msgPlaca, setMsgPlaca] = useState('');

  const handleConsultarPlacaAuto = async (placaDig) => {
    const limpo = String(placaDig || f.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (limpo.length !== 7) return;

    setBuscandoPlaca(true);
    setMsgPlaca('🔍 Consultando dados, procedência e FIPE...');
    try {
      const v = await buscarPlaca(limpo);
      if (v) {
        setF((prev) => {
          const anoFab = v.ano_fabricacao ? String(v.ano_fabricacao).slice(0, 4) : (v.ano ? String(v.ano).slice(0, 4) : prev.ano_fabricacao);
          const anoMod = v.ano_modelo ? String(v.ano_modelo).slice(-4) : (v.ano ? String(v.ano).slice(-4) : prev.ano_modelo);
          const fipeNum = v.fipe_num || (v.fipeValor ? Number(String(v.fipeValor).replace(/[^\d]/g, '')) / 100 : prev.fipe);
          return {
            ...prev,
            placa: limpo,
            marca: v.marca || prev.marca,
            modelo: v.modelo || prev.modelo,
            modelo_complemento: v.versao || prev.modelo_complemento,
            ano_fabricacao: anoFab || prev.ano_fabricacao,
            ano_modelo: anoMod || prev.ano_modelo,
            ano: `${anoFab || prev.ano_fabricacao}/${anoMod || prev.ano_modelo}`,
            cor: v.cor || prev.cor,
            combustivel: v.combustivel || prev.combustivel,
            chassi: v.chassi || prev.chassi,
            renavam: v.renavam || prev.renavam,
            cidade_emplacamento: v.cidade_emplacamento || prev.cidade_emplacamento,
            fipe: fipeNum,
            valor_fipe_anterior: v.valor_fipe_anterior || prev.valor_fipe_anterior,
            codigo_fipe: v.codigo_fipe || prev.codigo_fipe,
            fipe_mes_atual: v.fipe_mes_atual || prev.fipe_mes_atual,
            fipe_mes_anterior: v.fipe_mes_anterior || prev.fipe_mes_anterior,
            fipe_opcoes: Array.isArray(v.fipe_opcoes) ? v.fipe_opcoes : []
          };
        });
        setMsgPlaca(`✓ ${v.marca} ${v.modelo} preenchido via API Nacional!`);
        setTimeout(() => setMsgPlaca(''), 5000);
      } else {
        setMsgPlaca('Placa não encontrada na base nacional.');
        setTimeout(() => setMsgPlaca(''), 4000);
      }
    } catch (err) {
      console.warn('Erro ao consultar placa:', err);
      setMsgPlaca('');
    } finally {
      setBuscandoPlaca(false);
    }
  };

  const handleSelecionarFipeOpcaoEstoque = async (codigoEscolhido) => {
    const opcao = (f.fipe_opcoes || []).find((o) => o.codigo_fipe === codigoEscolhido);
    if (!opcao) return;
    const novoValorAtual = opcao.valor_num || (Number(String(opcao.texto_valor || '').replace(/[^\d]/g, '')) / 100);
    setF((prev) => ({
      ...prev,
      codigo_fipe: opcao.codigo_fipe,
      modelo_complemento: opcao.texto_modelo || prev.modelo_complemento,
      fipe: novoValorAtual,
      fipe_mes_atual: opcao.mes_referencia || prev.fipe_mes_atual,
    }));

    try {
      const resAnt = await buscarFipeMesAnterior(opcao.codigo_fipe, f.ano_modelo || f.ano, opcao.referencia_fipe);
      if (resAnt && resAnt.valor_num) {
        setF((prev) => ({
          ...prev,
          valor_fipe_anterior: resAnt.valor_num,
          fipe_mes_anterior: resAnt.mes_anterior || prev.fipe_mes_anterior
        }));
      }
    } catch {}
  };

  const handlePlacaChange = (e) => {
    const val = mascaraPlaca(e.target.value);
    setF((prev) => ({ ...prev, placa: val }));
    if (val.length === 7) {
      handleConsultarPlacaAuto(val);
    }
  };

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
  const custoPatioEstimado = Math.round(Number(f.custo || 0) * (0.01 / 30) * diasPatio);
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

  const comprimirImagem = (file, maxWidth = 1280, maxHeight = 960, quality = 0.8) => {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      if (typeof file === 'string') return resolve(file);

      // Timeout de segurança absoluto: nunca deixa a Promise travar o carregamento
      const timer = setTimeout(() => {
        try {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        } catch {
          resolve(null);
        }
      }, 4000);

      try {
        const objectUrl = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => {
          clearTimeout(timer);
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(objectUrl);
              return resolve(null);
            }
            ctx.drawImage(img, 0, 0, width, height);
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            URL.revokeObjectURL(objectUrl);
            resolve(dataUrl);
          } catch (err) {
            URL.revokeObjectURL(objectUrl);
            // Fallback FileReader
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }
        };
        img.onerror = () => {
          clearTimeout(timer);
          URL.revokeObjectURL(objectUrl);
          // Fallback para leitura direta do arquivo
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        };
        img.src = objectUrl;
      } catch (err) {
        clearTimeout(timer);
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      }
    });
  };

  const handleUploadFotoLocal = async (e) => {
    const rawFiles = e.target?.files || e.dataTransfer?.files || [];
    const files = Array.from(rawFiles);
    if (!files.length) return;

    setLoadingFotos(`Iniciando carregamento de ${files.length} foto(s)...`);
    const validas = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setLoadingFotos(`Carregando e otimizando foto ${i + 1} de ${files.length}...`);
        try {
          const res = await comprimirImagem(files[i]);
          if (res) validas.push(res);
        } catch (err) {
          console.warn('Erro ao processar imagem:', err);
        }
      }

      if (validas.length > 0) {
        setF((prev) => {
          const fotosAtuais = Array.isArray(prev.fotos) ? prev.fotos : [];
          const novas = [...fotosAtuais, ...validas];
          return {
            ...prev,
            fotos: novas,
            foto: prev.foto || novas[0]
          };
        });
      }
    } catch (err) {
      console.warn('Erro geral ao processar fotos:', err);
    } finally {
      setLoadingFotos('');
      if (e.target && e.target.value !== undefined) {
        e.target.value = '';
      }
    }
  };

  const [arrastandoIdx, setArrastandoIdx] = useState(null);

  const moverFoto = (origem, destino) => {
    if (origem === destino || destino < 0 || destino >= (f.fotos || []).length) return;
    const novas = [...(f.fotos || [])];
    const [removido] = novas.splice(origem, 1);
    novas.splice(destino, 0, removido);
    setF({ ...f, fotos: novas, foto: novas[0] });
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
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvando(true);
        try {
          await onSave(f);
        } finally {
          setSalvando(false);
        }
      }}
    >
      {(salvando || loadingFotos) && (
        <div className="loading-toast">
          <div className="spinner-sm" />
          <span>{salvando ? 'Gravando ficha do veículo e fotos no banco de dados...' : loadingFotos}</span>
        </div>
      )}
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

        {/* ABA 1: PRINCIPAL - RESUMO DIRETO & CONSULTA DETRAN-SC */}
        {aba === 'principal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* CARD CONSULTA DETRAN-SC */}
            <div
              className="card"
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14,
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
              }}
            >
              <div>
                <span style={{ fontSize: '.76rem', textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8', fontWeight: 700, display: 'block' }}>
                  Consulta Oficial de Procedência e Débitos
                </span>
                <strong style={{ fontSize: '1.15rem', color: '#ffffff' }}>
                  Dossiê Completo do Veículo no DETRAN-SC
                </strong>
                <div style={{ fontSize: '.84rem', color: '#cbd5e1', marginTop: 3 }}>
                  Placa: <strong>{f.placa || 'Não informada'}</strong> · Renavam: <strong>{f.renavam || 'Não informado'}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 700,
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37,99,235,.4)'
                  }}
                  onClick={() => {
                    if (!f.placa || !f.renavam) {
                      alert('Por favor, informe a Placa e o Renavam do veículo para abrir a consulta oficial no DETRAN-SC.');
                      return;
                    }
                    const urlDetran = `https://servicos.detran.sc.gov.br/consulta-dossie-veiculo?placa=${encodeURIComponent(f.placa.trim().toUpperCase())}&renavam=${encodeURIComponent(f.renavam.trim())}`;
                    window.open(urlDetran, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <Search size={16} /> DETRAN-SC ↗
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: '#d97706',
                    color: '#ffffff',
                    fontWeight: 700,
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(217,119,6,.4)'
                  }}
                  onClick={() => {
                    window.open('https://www.autolook.com.br/', '_blank', 'noopener,noreferrer');
                  }}
                  title="Abrir Autolook para consulta de histórico completo, leilão, sinistro e gravames"
                >
                  <ShieldAlert size={16} /> Consulta Leilão (Autolook) ↗
                </button>
              </div>
            </div>

            {/* CAMPOS PRINCIPAIS RESUMIDOS */}
            <div className="card" style={{ background: 'var(--color-neutral-80)', padding: 18 }}>
              <h3 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                1. Identificação Rápida do Veículo
              </h3>
              <div className="form-grid">
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>Placa *</label>
                    {buscandoPlaca && (
                      <span style={{ fontSize: '.72rem', color: '#6d28d9', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <div className="spinner-sm" style={{ width: 12, height: 12 }} /> Consultando API...
                      </span>
                    )}
                  </div>
                  <input
                    className="input"
                    maxLength={7}
                    style={{
                      textTransform: 'uppercase',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      letterSpacing: '.08em',
                      borderColor: buscandoPlaca ? '#7c3aed' : undefined,
                      boxShadow: buscandoPlaca ? '0 0 0 2px rgba(124,58,237,.2)' : undefined
                    }}
                    value={f.placa ?? ''}
                    onChange={handlePlacaChange}
                    onBlur={(e) => {
                      if (e.target.value.length === 7) handleConsultarPlacaAuto(e.target.value);
                    }}
                    placeholder="ABC1D23"
                  />
                  {msgPlaca && (
                    <div style={{ fontSize: '.74rem', color: msgPlaca.startsWith('✓') ? 'var(--success)' : '#6d28d9', fontWeight: 700, marginTop: 4 }}>
                      {msgPlaca}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>Renavam *</label>
                  <input
                    className="input"
                    maxLength={11}
                    style={{ fontWeight: 700 }}
                    value={f.renavam ?? ''}
                    onChange={set('renavam')}
                    placeholder="11 dígitos"
                  />
                </div>
                <div className="field">
                  <label>Chassi (Final: {finalChassi})</label>
                  <input
                    className="input"
                    maxLength={17}
                    style={{ textTransform: 'uppercase' }}
                    value={f.chassi ?? ''}
                    onChange={set('chassi')}
                    placeholder="17 caracteres"
                  />
                </div>

                {/* SELETOR INTERATIVO QUANDO EXISTE MAIS DE UMA VERSÃO NA FIPE */}
                {Array.isArray(f.fipe_opcoes) && f.fipe_opcoes.length > 1 && (
                  <div style={{
                    gridColumn: 'span 3',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1.5px solid #6366f1',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 4
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ fontSize: '.88rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={16} /> Encontradas {f.fipe_opcoes.length} versões na Tabela FIPE para este modelo. Selecione a correta:
                      </strong>
                      <span style={{ fontSize: '.72rem', color: '#4f46e5', fontWeight: 700 }}>
                        Código selecionado: {f.codigo_fipe || '-'}
                      </span>
                    </div>
                    <select
                      className="select"
                      value={f.codigo_fipe || ''}
                      onChange={(e) => handleSelecionarFipeOpcaoEstoque(e.target.value)}
                      style={{ fontWeight: 700, borderColor: '#6366f1', background: '#ffffff', color: '#1e1b4b' }}
                    >
                      {f.fipe_opcoes.map((op, idx) => (
                        <option key={op.codigo_fipe || idx} value={op.codigo_fipe}>
                          {op.texto_modelo} — {op.texto_valor} (FIPE: {op.codigo_fipe})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ background: 'var(--color-neutral-80)', padding: 18 }}>
              <h3 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                2. Características do Veículo
              </h3>
              <div className="form-grid">
                <div className="field">
                  <label>Marca *</label>
                  <input className="input" required value={f.marca ?? ''} onChange={set('marca')} placeholder="Ex: Toyota, Honda, Jeep…" />
                </div>
                <div className="field">
                  <label>Modelo *</label>
                  <input className="input" required value={f.modelo ?? ''} onChange={set('modelo')} placeholder="Ex: Corolla, Civic, Compass…" />
                </div>
                <div className="field">
                  <label>Versão / Complemento</label>
                  <input className="input" value={f.modelo_complemento ?? ''} onChange={set('modelo_complemento')} placeholder="Ex: XEi 2.0 16V Flex Aut." />
                </div>

                <div className="field">
                  <label>Ano Fabricação / Modelo</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input className="input" type="number" placeholder="Fab" value={f.ano_fabricacao ?? ''} onChange={set('ano_fabricacao')} title="Ano Fabricação" />
                    <input className="input" type="number" placeholder="Mod" value={f.ano_modelo ?? ''} onChange={set('ano_modelo')} title="Ano Modelo" />
                  </div>
                </div>
                <div className="field">
                  <label>KM Rodados (Hodômetro)</label>
                  <input className="input" type="number" min={0} value={f.km ?? 0} onChange={set('km')} />
                </div>
                <div className="field">
                  <label>Câmbio</label>
                  <select className="select" value={f.cambio} onChange={set('cambio')}>
                    {['Automático', 'Manual', 'CVT', 'Automatizado / DSG'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label>Combustível</label>
                  <select className="select" value={f.combustivel} onChange={set('combustivel')}>
                    {['Flex', 'Gasolina', 'Diesel', 'Híbrido', 'Elétrico'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Cor Externa</label>
                  <input className="input" value={f.cor ?? ''} onChange={set('cor')} placeholder="Ex: Branco, Preto, Prata…" />
                </div>
                <div className="field">
                  <label>Cidade / UF de Emplacamento</label>
                  <input className="input" value={f.cidade_emplacamento ?? 'Rio do Sul - SC'} onChange={set('cidade_emplacamento')} />
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--color-neutral-80)', padding: 18 }}>
              <h3 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                3. Posição no Pátio & Comercial
              </h3>
              <div className="form-grid">
                <div className="field">
                  <label>Posição no Estoque</label>
                  <select className="select" value={f.status} onChange={set('status')}>
                    {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Propriedade</label>
                  <select className="select" value={f.propriedade || 'PROPRIO'} onChange={set('propriedade')}>
                    {Object.entries(PROPRIEDADES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Situação no Pátio</label>
                  <select className="select" value={f.situacao_patio || 'Pronto para venda (Showroom)'} onChange={set('situacao_patio')}>
                    {['Pronto para venda (Showroom)', 'Em preparação / Estética', 'Em oficina / Mecânica', 'Aguardando laudo / documentação', 'Entregue ao cliente'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Valor de Venda (R$)</label>
                  <input
                    className="input"
                    type="number"
                    style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--success)' }}
                    value={f.preco || 0}
                    onChange={set('preco')}
                  />
                </div>
                <div className="field">
                  <label>Custo de Aquisição (R$)</label>
                  <input className="input" type="number" value={f.custo || 0} onChange={set('custo')} />
                </div>
                <div className="field">
                  <label>Código Interno / Chaveiro</label>
                  <input className="input" value={f.codigo_interno ?? ''} onChange={set('codigo_interno')} placeholder="Ex: V-105" />
                </div>
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
            <div className="stats" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
              <div className="card stat">
                <div className="stat-label"><Clock size={14} /> Giro e Custo de Pátio</div>
                <div className="stat-value" style={{ color: diasPatio > 60 ? '#ef4444' : diasPatio > 30 ? '#f59e0b' : '#10b981' }}>
                  {diasPatio} dias
                </div>
                <div className="stat-sub">
                  Custo capital (~1% a.m.): <strong style={{ color: '#ef4444' }}>{brl(custoPatioEstimado)}</strong>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Valor de Entrada / Compra (R$)</label>
                <input className="input" type="number" value={f.custo ?? 0} onChange={set('custo')} />
                <small style={{ color: 'var(--muted)', fontSize: '.74rem' }}>
                  Custo Loja total (+ despesas): <strong style={{ color: 'var(--text)' }}>{brl(custoTotalReal)}</strong>
                </small>
              </div>

              <div className="field">
                <label>Valor Mínimo de Venda (R$)</label>
                <input className="input" type="number" value={f.valor_minimo ?? 0} onChange={set('valor_minimo')} />
                {custoTotalReal > 0 && f.valor_minimo > 0 && (
                  <small style={{ color: (f.valor_minimo - custoTotalReal) >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '.74rem', fontWeight: 600 }}>
                    Margem: {brl(f.valor_minimo - custoTotalReal)} ({(((f.valor_minimo - custoTotalReal) / custoTotalReal) * 100).toFixed(1)}% s/ custo)
                  </small>
                )}
              </div>

              <div className="field">
                <label>Valor de Venda À Vista (R$) *</label>
                <input className="input" type="number" required value={f.preco ?? 0} onChange={set('preco')} />
                {custoTotalReal > 0 && f.preco > 0 && (
                  <small style={{ color: (f.preco - custoTotalReal) >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '.74rem', fontWeight: 600 }}>
                    Margem: {brl(f.preco - custoTotalReal)} ({(((f.preco - custoTotalReal) / custoTotalReal) * 100).toFixed(1)}% s/ custo)
                  </small>
                )}
              </div>

              <div className="field">
                <label>Valor para Troca (R$)</label>
                <input className="input" type="number" value={f.valor_troca ?? 0} onChange={set('valor_troca')} />
                {custoTotalReal > 0 && f.valor_troca > 0 && (
                  <small style={{ color: (f.valor_troca - custoTotalReal) >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '.74rem', fontWeight: 600 }}>
                    Margem: {brl(f.valor_troca - custoTotalReal)} ({(((f.valor_troca - custoTotalReal) / custoTotalReal) * 100).toFixed(1)}% s/ custo)
                  </small>
                )}
              </div>

              <div className="field">
                <label>Valor Anunciado no Site / Portais (R$)</label>
                <input className="input" type="number" value={f.valor_site ?? f.preco ?? 0} onChange={set('valor_site')} />
                {custoTotalReal > 0 && (f.valor_site || f.preco) > 0 && (
                  <small style={{ color: ((f.valor_site || f.preco) - custoTotalReal) >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '.74rem', fontWeight: 600 }}>
                    Margem: {brl((f.valor_site || f.preco) - custoTotalReal)} ({((((f.valor_site || f.preco) - custoTotalReal) / custoTotalReal) * 100).toFixed(1)}% s/ custo)
                  </small>
                )}
              </div>

              {/* SELETOR INTERATIVO QUANDO EXISTE MAIS DE UMA VERSÃO NA FIPE */}
              {Array.isArray(f.fipe_opcoes) && f.fipe_opcoes.length > 1 && (
                <div style={{
                  gridColumn: 'span 3',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1.5px solid #6366f1',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 6
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: '.88rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={16} /> Encontradas {f.fipe_opcoes.length} versões na Tabela FIPE para este modelo. Selecione a correta:
                    </strong>
                    <span style={{ fontSize: '.72rem', color: '#4f46e5', fontWeight: 700 }}>
                      Código selecionado: {f.codigo_fipe || '-'}
                    </span>
                  </div>
                  <select
                    className="select"
                    value={f.codigo_fipe || ''}
                    onChange={(e) => handleSelecionarFipeOpcaoEstoque(e.target.value)}
                    style={{ fontWeight: 700, borderColor: '#6366f1', background: '#ffffff', color: '#1e1b4b' }}
                  >
                    {f.fipe_opcoes.map((op, idx) => (
                      <option key={op.codigo_fipe || idx} value={op.codigo_fipe}>
                        {op.texto_modelo} — {op.texto_valor} (FIPE: {op.codigo_fipe})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* CARDS COMPARATIVOS FIPE MÊS ATUAL E MÊS ANTERIOR */}
              {(f.fipe > 0 || f.valor_fipe_anterior > 0) && (
                <div style={{
                  gridColumn: 'span 3',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                  marginTop: 2,
                  marginBottom: 8
                }}>
                  <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1.5px solid #10b981',
                    borderRadius: 10,
                    padding: '10px 14px',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.08)'
                  }}>
                    <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      Tabela FIPE Mês Atual ({f.fipe_mes_atual || 'Mês Atual'})
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#047857', marginTop: 2 }}>
                      {brl(f.fipe || 0)}
                    </div>
                    {f.codigo_fipe && <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>Cód. FIPE: {f.codigo_fipe}</div>}
                  </div>

                  <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1.5px solid #64748b',
                    borderRadius: 10,
                    padding: '10px 14px',
                    boxShadow: '0 2px 8px rgba(100,116,139,0.08)'
                  }}>
                    <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      Tabela FIPE Mês Anterior ({f.fipe_mes_anterior || 'Mês Anterior'})
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#334155', marginTop: 2 }}>
                      {brl(f.valor_fipe_anterior || 0)}
                    </div>
                    <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>Histórico de referência</div>
                  </div>

                  {f.fipe > 0 && f.valor_fipe_anterior > 0 && (
                    <div style={{
                      background: (f.fipe >= f.valor_fipe_anterior) ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1.5px solid ${(f.fipe >= f.valor_fipe_anterior) ? '#10b981' : '#ef4444'}`,
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: '.72rem', fontWeight: 700, color: (f.fipe >= f.valor_fipe_anterior) ? '#047857' : '#b91c1c', textTransform: 'uppercase' }}>
                        Variação Mensal FIPE
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: (f.fipe >= f.valor_fipe_anterior) ? '#047857' : '#b91c1c', marginTop: 2 }}>
                        {f.fipe >= f.valor_fipe_anterior ? '▲ +' : '▼ '}{brl(f.fipe - f.valor_fipe_anterior)} ({(((f.fipe - f.valor_fipe_anterior) / f.valor_fipe_anterior) * 100).toFixed(2)}%)
                      </div>
                      <div style={{ fontSize: '.68rem', opacity: .8, marginTop: 2 }}>
                        {f.fipe >= f.valor_fipe_anterior ? 'Veículo valorizou no mercado' : 'Desvalorização no período'}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                <small style={{ color: 'var(--muted)', fontSize: '.74rem' }}>Histórico do mês anterior para comparação de mercado</small>
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
                style={{ marginBottom: 16 }}
                placeholder="Filtrar opcional por nome (ex: teto solar, couro, 4x4, câmera)…"
                value={buscaOpcional}
                onChange={(e) => setBuscaOpcional(e.target.value)}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {GRUPOS_OPCIONAIS.map((grupo) => {
                  const itensFiltrados = grupo.itens.filter((op) => op.toLowerCase().includes(buscaOpcional.toLowerCase()));
                  if (itensFiltrados.length === 0) return null;
                  const todosMarcados = grupo.itens.every((op) => (f.itens_opcionais || []).includes(op));
                  return (
                    <div key={grupo.nome} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>
                          {grupo.nome}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ fontSize: '.72rem', padding: '3px 8px' }}
                          onClick={() => {
                            const atuais = f.itens_opcionais || [];
                            if (todosMarcados) {
                              setF({ ...f, itens_opcionais: atuais.filter((x) => !grupo.itens.includes(x)) });
                            } else {
                              const uniao = Array.from(new Set([...atuais, ...grupo.itens]));
                              setF({ ...f, itens_opcionais: uniao });
                            }
                          }}
                        >
                          {todosMarcados ? 'Desmarcar grupo' : 'Marcar grupo'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {itensFiltrados.map((op) => {
                          const ativo = (f.itens_opcionais || []).includes(op);
                          return (
                            <button
                              key={op}
                              type="button"
                              onClick={() => toggleItemLista('itens_opcionais', op)}
                              className="btn btn-sm"
                              style={{
                                background: ativo ? 'var(--primary)' : '#f8fafc',
                                borderColor: ativo ? 'var(--primary)' : 'var(--border)',
                                color: ativo ? '#ffffff' : 'var(--text)',
                                fontSize: '.78rem',
                                padding: '4px 10px'
                              }}
                            >
                              {ativo ? '✓ ' : '+ '}{op}
                            </button>
                          );
                        })}
                      </div>
                    </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                    Documentos do Carro (Upload de PDF e Imagens)
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>
                    Anexe CRLV Digital, ATPV-e, Laudo Cautelar, Notas Fiscais e Dossiê em PDF ou JPG/PNG para armazenamento e impressão.
                  </small>
                </div>
              </div>

              {/* FORMULÁRIO DE ANEXO DE ARQUIVO */}
              <div
                style={{
                  background: '#ffffff',
                  border: '2px dashed var(--border)',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, alignItems: 'end' }}>
                  <div className="field">
                    <label>Tipo de Documento</label>
                    <select className="select" value={novoDoc.tipo} onChange={(e) => setNovoDoc({ ...novoDoc, tipo: e.target.value })}>
                      {[
                        'CRLV Digital (Documento do Carro)',
                        'ATPV-e / Recibo de Transferência',
                        'Laudo Cautelar / Vistoria ECV',
                        'Dossiê de Multas / DETRAN-SC',
                        'Nota Fiscal de Entrada / Faturamento',
                        'Contrato Assinado de Compra/Consignação',
                        'Procuração Pública / Substabelecimento',
                        'Comprovante de Quitação / Gravame'
                      ].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Número / Identificação / Protocolo</label>
                    <input
                      className="input"
                      placeholder="Ex: 2026/099182 ou Código de Segurança"
                      value={novoDoc.numero}
                      onChange={(e) => setNovoDoc({ ...novoDoc, numero: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Selecionar Arquivo (PDF ou Imagem)</label>
                    <input
                      type="file"
                      className="input"
                      accept="application/pdf,image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                        const isImg = file.type.startsWith('image/');
                        if (!isPdf && !isImg) {
                          alert('Formato inválido. Por favor envie arquivos em PDF ou Imagens (JPG, PNG).');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const docNovo = {
                            id: Date.now(),
                            tipo: novoDoc.tipo,
                            numero: novoDoc.numero || file.name,
                            status: 'Validado',
                            data: new Date().toISOString().slice(0, 10),
                            nome_arquivo: file.name,
                            tipo_arquivo: isPdf ? 'pdf' : 'imagem',
                            tamanho_kb: Math.round(file.size / 1024),
                            arquivo_base64: reader.result
                          };
                          setF((prev) => ({
                            ...prev,
                            documentos_anexos: [docNovo, ...(prev.documentos_anexos || [])]
                          }));
                          setNovoDoc({ tipo: 'CRLV Digital (Documento do Carro)', numero: '', status: 'Validado' });
                          e.target.value = '';
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* LISTAGEM DE DOCUMENTOS ANEXADOS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(f.documentos_anexos || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--muted)', background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <FileText size={32} strokeWidth={1.5} style={{ marginBottom: 6, opacity: .6 }} />
                    <p style={{ margin: 0, fontSize: '.9rem' }}>Nenhum documento anexado ainda para este veículo.</p>
                    <small>Carregue o CRLV digital, ATPV-e ou laudo nos formatos PDF ou Imagem acima.</small>
                  </div>
                ) : (
                  (f.documentos_anexos || []).map((d, idx) => (
                    <div
                      key={d.id || idx}
                      className="list-row"
                      style={{
                        background: '#ffffff',
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {d.tipo_arquivo === 'imagem' && d.arquivo_base64 ? (
                          <img
                            src={d.arquivo_base64}
                            alt={d.tipo}
                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              background: d.tipo_arquivo === 'pdf' ? '#fee2e2' : '#e0e7ff',
                              color: d.tipo_arquivo === 'pdf' ? '#dc2626' : '#4338ca',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 6,
                              fontWeight: 800,
                              fontSize: '.75rem'
                            }}
                          >
                            {d.tipo_arquivo === 'pdf' ? 'PDF' : 'DOC'}
                          </div>
                        )}
                        <div>
                          <strong style={{ fontSize: '.92rem', color: 'var(--text)' }}>{d.tipo}</strong>
                          {d.numero && <span style={{ fontSize: '.84rem', color: 'var(--muted)' }}> — Nº {d.numero}</span>}
                          <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 2 }}>
                            {d.nome_arquivo ? <span>Arquivo: <code>{d.nome_arquivo}</code> · </span> : null}
                            {d.tamanho_kb ? `${d.tamanho_kb} KB · ` : ''}
                            Adicionado em {dataBr(d.data)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge badge-pago">{d.status || 'Validado'}</span>
                        {d.arquivo_base64 && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              title="Visualizar documento em tela cheia"
                              onClick={() => {
                                const win = window.open();
                                if (win) {
                                  if (d.tipo_arquivo === 'pdf') {
                                    win.document.write(`<title>${d.nome_arquivo || d.tipo}</title><iframe src="${d.arquivo_base64}" style="border:none; width:100%; height:100vh;"></iframe>`);
                                  } else {
                                    win.document.write(`<title>${d.nome_arquivo || d.tipo}</title><body style="margin:0; background:#0f172a; display:flex; align-items:center; justify-content:center; min-height:100vh;"><img src="${d.arquivo_base64}" style="max-width:96vw; max-height:96vh; object-fit:contain; border-radius:8px; box-shadow:0 15px 35px rgba(0,0,0,.6);" /></body>`);
                                  }
                                }
                              }}
                            >
                              <Eye size={13} /> Ver
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              title="Baixar arquivo para o computador"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = d.arquivo_base64;
                                a.download = d.nome_arquivo || `${String(d.tipo).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${d.tipo_arquivo === 'pdf' ? 'pdf' : 'jpg'}`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                            >
                              <Download size={13} /> Baixar
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          title="Remover documento anexo"
                          onClick={() => {
                            if (!confirm(`Remover o documento "${d.tipo}"?`)) return;
                            setF({ ...f, documentos_anexos: f.documentos_anexos.filter((_, i) => i !== idx) });
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
          </div>
        )}

        {/* ABA 9: FOTOS & VÍDEO YOUTUBE (DRAG AND DROP PARA ORDEM NO SITE) */}
        {aba === 'fotos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* BANNER INFORMATIVO DRAG AND DROP */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: '#16a34a', color: '#ffffff', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GripVertical size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: '.95rem', color: '#166534', display: 'block' }}>
                    Organização da Sequência de Fotos no Site DG Automóveis
                  </strong>
                  <div style={{ fontSize: '.82rem', color: '#15803d', marginTop: 2 }}>
                    A <strong>Foto #1 (Capa)</strong> é a imagem principal no site e vitrines. <strong>Clique e arraste</strong> qualquer foto para organizar a sequência exata de exibição, ou use as setas ◀ ▶.
                  </div>
                </div>
              </div>
              <span className="badge" style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, padding: '6px 12px', fontSize: '.82rem' }}>
                {(f.fotos || []).length} fotos ordenadas
              </span>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Adicionar Fotos do Computador</label>
                <label
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', height: 42, width: '100%', fontWeight: 700 }}
                >
                  <Upload size={16} /> Selecionar Fotos (JPG, PNG, WEBP)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleUploadFotoLocal}
                  />
                </label>
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

            {loadingFotos && (
              <div
                style={{
                  background: '#ede9fe',
                  border: '1px solid #c4b5fd',
                  borderRadius: 10,
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  color: '#5b21b6',
                  fontWeight: 700,
                  fontSize: '.9rem'
                }}
              >
                <div className="spinner-sm" style={{ borderColor: '#6d28d9', borderTopColor: 'transparent', width: 20, height: 20 }} />
                <span>{loadingFotos}</span>
              </div>
            )}

            {(f.fotos || []).length === 0 ? (
              <label
                style={{
                  border: '2px dashed #7c3aed',
                  background: '#f5f3ff',
                  borderRadius: 14,
                  padding: '52px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all .2s ease',
                  boxShadow: '0 4px 18px rgba(124,58,237,.06)'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleUploadFotoLocal(e);
                }}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleUploadFotoLocal}
                />
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ede9fe', display: 'grid', placeItems: 'center', color: '#6d28d9', boxShadow: '0 4px 12px rgba(109,40,217,.15)' }}>
                  <Upload size={32} />
                </div>
                <div>
                  <strong style={{ fontSize: '1.12rem', color: '#5b21b6', display: 'block', marginBottom: 6 }}>
                    Clique aqui para carregar as fotos do veículo
                  </strong>
                  <span style={{ fontSize: '.88rem', color: '#6d28d9', display: 'block', maxWidth: 460, margin: '0 auto' }}>
                    Ou arraste fotos do computador para cá. Carregamento e otimização automáticos de todas as imagens.
                  </span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#7c3aed', color: '#ffffff', fontWeight: 800, padding: '10px 22px', borderRadius: 8, fontSize: '.9rem', boxShadow: '0 4px 12px rgba(124,58,237,.3)' }}>
                  <Plus size={16} /> Selecionar Fotos Agora
                </div>
              </label>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
                {f.fotos.map((url, idx) => (
                  <div
                    key={idx}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                      setArrastandoIdx(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDragEnd={() => setArrastandoIdx(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const origem = Number(e.dataTransfer.getData('text/plain'));
                      if (!isNaN(origem) && origem !== idx) {
                        moverFoto(origem, idx);
                      }
                      setArrastandoIdx(null);
                    }}
                    className="card"
                    style={{
                      padding: 8,
                      position: 'relative',
                      cursor: 'grab',
                      borderRadius: 10,
                      border: arrastandoIdx === idx ? '2px dashed var(--primary)' : idx === 0 ? '2px solid #2563eb' : '1px solid var(--border)',
                      boxShadow: idx === 0 ? '0 4px 14px rgba(37,99,235,.22)' : 'none',
                      opacity: arrastandoIdx === idx ? 0.35 : 1,
                      transition: 'all .15s ease',
                      userSelect: 'none',
                      background: '#ffffff'
                    }}
                    title="Clique e arraste para reordenar a sequência no site"
                  >
                    {/* BADGE DA POSIÇÃO NO SITE */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 14,
                        left: 14,
                        background: idx === 0 ? '#2563eb' : 'rgba(15,23,42,.88)',
                        color: '#fff',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: '.74rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 2px 8px rgba(0,0,0,.45)',
                        zIndex: 2
                      }}
                    >
                      <GripVertical size={12} />
                      {idx === 0 ? '★ Capa (#1)' : `#${idx + 1}`}
                    </div>

                    <img
                      src={url}
                      alt={`Foto ${idx + 1}`}
                      style={{ width: '100%', height: 135, objectFit: 'cover', borderRadius: 8, pointerEvents: 'none', display: 'block' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 4 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={idx === 0}
                          style={{ padding: '4px 8px', opacity: idx === 0 ? .4 : 1 }}
                          title="Mover foto para a esquerda / posição anterior"
                          onClick={() => moverFoto(idx, idx - 1)}
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={idx === (f.fotos || []).length - 1}
                          style={{ padding: '4px 8px', opacity: idx === (f.fotos || []).length - 1 ? .4 : 1 }}
                          title="Mover foto para a direita / próxima posição"
                          onClick={() => moverFoto(idx, idx + 1)}
                        >
                          ▶
                        </button>
                      </div>

                      {idx !== 0 ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ fontSize: '.72rem', padding: '4px 8px' }}
                          title="Tornar esta a 1ª foto (Capa do Veículo)"
                          onClick={() => moverFoto(idx, 0)}
                        >
                          Definir Capa
                        </button>
                      ) : (
                        <span style={{ fontSize: '.72rem', color: '#2563eb', fontWeight: 800 }}>
                          Foto Capa
                        </span>
                      )}

                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        style={{ padding: '4px 8px' }}
                        title="Excluir esta foto"
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
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Globe size={20} /> Publicação no Site Oficial & Portais
                  </h3>
                  <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                    Controle em tempo real da exibição deste veículo no site da loja (DG Automóveis) e nos feeds integrados.
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* BOTAO SWITCH GRANDE DE PUBLICAR / RETIRAR DO SITE */}
                  <button
                    type="button"
                    className={`btn ${f.publicar_site !== false ? 'btn-success' : 'btn-danger'}`}
                    style={{ fontWeight: 800 }}
                    onClick={() => setF({ ...f, publicar_site: f.publicar_site === false ? true : false })}
                  >
                    <Globe size={15} />
                    {f.publicar_site !== false ? '✓ Publicado no Site (Clique para Ocultar)' : '🚫 Oculto do Site (Clique para Publicar)'}
                  </button>
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
          {f.id && f.status !== 'cancelado' && (
            <button
              type="button"
              className="btn btn-danger"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => {
                if (user?.perfil !== 'admin') {
                  alert('Ação bloqueada: Por compliance legal, a exclusão de veículos e contratos é terminantemente proibida. Para cancelar este veículo do estoque, solicite a um Administrador o cancelamento formal do contrato.');
                  return;
                }
                const motivo = prompt(`Informe o motivo do cancelamento formal deste veículo #${f.id} (${f.marca} ${f.modelo}) / Distrato de Contrato:`);
                if (!motivo) return;
                onCancelarVeiculo(f, motivo);
              }}
            >
              <Trash2 size={15} /> Cancelar Veículo (Apenas Admin)
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
          <button type="button" className="btn" onClick={onClose} disabled={salvando}>Fechar / Voltar</button>
          <button
            id="btn-salvar-veiculo"
            type="submit"
            className="btn btn-primary"
            disabled={salvando || Boolean(loadingFotos)}
            style={{ minWidth: 220, justifyContent: 'center' }}
          >
            {salvando ? (
              <>
                <div className="spinner-sm" />
                <span>Gravando Veículo...</span>
              </>
            ) : (
              <>✓ Salvar Ficha do Veículo</>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
