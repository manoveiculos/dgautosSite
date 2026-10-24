import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Users, MessageCircle, Trash2, X, Building2, UserCheck,
  Upload, FileText, CheckCircle2, AlertCircle, Phone, Mail, MapPin, ChevronRight,
  UserPlus, Smartphone
} from 'lucide-react';
import { getClientes, saveCliente, deleteCliente, ORIGENS_LEAD } from '../store';
import { mascaraCpfCnpj, mascaraTelefone, mascaraCep, buscarCep, validarCpfCnpj, buscarCnpj } from '../utils/mascaras';

const EMPTY_CLI = {
  ativo: true,
  is_cliente: true,
  is_fornecedor: false,
  tipo_pessoa: 'PF', // PF | PJ
  sexo: 'Masculino',
  nome: '', // ou Razão Social
  cpf_cnpj: '',
  rg_ie: '',
  apelido: '', // ou Nome Fantasia
  data_nasc: '',
  naturalidade: '',
  nacionalidade: 'BRASILEIRA',
  numero_cnh: '',
  vencimento_cnh: '',
  estado_civil: 'Solteiro(a)',
  cliente_desde: new Date().toISOString().slice(0, 10),
  categoria: '',
  site: '',
  observacoes: '',
  // Endereço
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: 'RIO DO SUL',
  uf: 'SC',
  cidade_estado: 'RIO DO SUL / SC',
  // Contatos
  telefone: '',
  whatsapp: '',
  email: '',
  contatos_adicionais: [],
  origem: 'LOJA',
  // Documentos anexados
  documentos: []
};

const ESTADOS_CIVIS = [
  '- Selecione -',
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'União Estável',
  'Separado(a)'
];

export default function Clientes({ user }) {
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [papel, setPapel] = useState('');
  const [editando, setEditando] = useState(null);
  const [toastSucesso, setToastSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  const carregarDados = () => {
    setCarregando(true);
    getClientes()
      .then((res) => setLista(Array.isArray(res) ? res : []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  };

  useEffect(carregarDados, []);

  const avisoSucesso = (msg) => {
    setToastSucesso(msg);
    setTimeout(() => setToastSucesso(''), 3000);
  };

  const filtrados = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    return arr.filter((c) => {
      if (!c) return false;
      if (papel === 'cliente' && c.is_cliente === false && c.papel !== 'cliente') return false;
      if (papel === 'fornecedor' && c.is_fornecedor === false && c.papel !== 'fornecedor') return false;
      const termo = `${c.nome || ''} ${c.cpf_cnpj || ''} ${c.telefone || ''} ${c.cidade || ''} ${c.email || ''}`.toLowerCase();
      return termo.includes(busca.toLowerCase());
    });
  }, [lista, busca, papel]);

  return (
    <>
      {carregando && <div className="loading-top-bar" />}

      {toastSucesso && (
        <div className="toast-success">
          <CheckCircle2 size={16} />
          <span>{toastSucesso}</span>
        </div>
      )}

      <header className="topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Clientes & Fornecedores
            <span className="badge" style={{ background: '#f3e8ff', color: '#5d35b0', fontSize: '.78rem' }}>
              {filtrados.length} cadastro(s)
            </span>
          </h1>
          <p>Base oficial de pessoas físicas e jurídicas, validação de CPF/CNPJ, auto-preenchimento de CEP e anexos.</p>
        </div>
        <button id="btn-novo-cliente" className="btn btn-primary" onClick={() => setEditando({ ...EMPTY_CLI })}>
          <Plus size={16} />Novo Cadastro
        </button>
      </header>

      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por nome, CPF/CNPJ, telefone ou cidade…"
            value={busca}
            onChange={(e) => setBusca(e.target.value.toUpperCase())}
          />
        </div>
        <select className="select" style={{ maxWidth: 220 }} value={papel} onChange={(e) => setPapel(e.target.value)}>
          <option value="">Todos (Clientes e Fornecedores)</option>
          <option value="cliente">Somente Clientes</option>
          <option value="fornecedor">Somente Fornecedores</option>
        </select>
      </div>

      <div className="card table-wrap" style={{ background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th>Nome / Razão Social</th>
              <th>Tipo</th>
              <th>CPF / CNPJ</th>
              <th>Telefone / WhatsApp</th>
              <th>Cidade / UF</th>
              <th>Origem</th>
              <th>Contato</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                  Nenhum cadastro encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((c) => (
                <tr key={c.id} onClick={() => setEditando({ ...EMPTY_CLI, ...c })} style={{ cursor: 'pointer' }}>
                  <td>
                    <strong>{c.nome}</strong>
                    {c.apelido && <span style={{ fontSize: '.78rem', color: 'var(--muted)', marginLeft: 6 }}>({c.apelido})</span>}
                    {c.email && <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{c.email}</div>}
                  </td>
                  <td>
                    <span className="badge" style={{ background: c.tipo_pessoa === 'PJ' ? '#e0e7ff' : '#f3e8ff', color: c.tipo_pessoa === 'PJ' ? '#3730a3' : '#5d35b0' }}>
                      {c.tipo_pessoa === 'PJ' ? 'Jurídica (PJ)' : 'Física (PF)'}
                    </span>
                  </td>
                  <td><strong>{c.cpf_cnpj || '—'}</strong></td>
                  <td>{c.telefone || c.whatsapp || '—'}</td>
                  <td>{c.cidade ? `${c.cidade}/${c.uf}` : (c.cidade_estado || '—')}</td>
                  <td>{ORIGENS_LEAD[c.origem] || c.origem}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {(c.whatsapp || c.telefone) && (
                      <a
                        href={`https://wa.me/55${String(c.whatsapp || c.telefone).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-success"
                        title="Chamar no WhatsApp"
                      >
                        <MessageCircle size={13} /> Whats
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <ClienteModalAltimus
          inicial={editando}
          onClose={() => setEditando(null)}
          onSave={async (cli) => {
            try {
              setCarregando(true);
              const res = await saveCliente(cli);
              setLista(Array.isArray(res) ? res : []);
              setEditando(null);
              avisoSucesso('✓ Cadastro salvo com sucesso!');
            } catch (err) {
              alert('Erro ao salvar: ' + err.message);
            } finally {
              setCarregando(false);
            }
          }}
          onDelete={async (id, motivo) => {
            try {
              setCarregando(true);
              const res = await deleteCliente(id, motivo, user);
              setLista(Array.isArray(res) ? res : []);
              setEditando(null);
              avisoSucesso('✓ Cadastro excluído com sucesso!');
            } catch (err) {
              alert('Erro ao excluir: ' + err.message);
            } finally {
              setCarregando(false);
            }
          }}
        />
      )}
    </>
  );
}

// ==============================================================================
// FORMULÁRIO COMPLETO DE PESSOAS IDÊNTICO AO ALTIMUS (PRINTS OFICIAIS)
// ==============================================================================
function ClienteModalAltimus({ inicial, onClose, onSave, onDelete, user }) {
  const [f, setF] = useState(inicial);
  const [erroCpfCnpj, setErroCpfCnpj] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const isAdmin = user?.perfil === 'admin' || user?.email === 'admin@dgautos.com.br' || !user;

  // Manipulador genérico que força LETRA MAIÚSCULA em todo o sistema
  const setUpper = (k) => (e) => {
    let val = e.target.value;
    if (k !== 'email') val = String(val).toUpperCase();
    setF((prev) => ({ ...prev, [k]: val }));
  };

  // CONSULTA AUTOMÁTICA DE CNPJ NA RECEITA FEDERAL
  const consultarCnpjReceita = async (digitsCnpj) => {
    const limpo = String(digitsCnpj || f.cpf_cnpj).replace(/\D/g, '');
    if (limpo.length !== 14) return;
    setBuscandoCnpj(true);
    try {
      const empresa = await buscarCnpj(limpo);
      if (empresa) {
        setF((prev) => ({
          ...prev,
          nome: empresa.nome || prev.nome,
          apelido: empresa.apelido || prev.apelido,
          logradouro: empresa.logradouro || prev.logradouro,
          numero: empresa.numero || prev.numero,
          complemento: empresa.complemento || prev.complemento,
          bairro: empresa.bairro || prev.bairro,
          cidade: empresa.cidade || prev.cidade,
          uf: empresa.uf || prev.uf,
          cidade_estado: empresa.cidadeEstado || prev.cidade_estado,
          cep: empresa.cep || prev.cep,
          telefone: empresa.telefone || prev.telefone,
          email: empresa.email || prev.email,
          data_nasc: empresa.data_abertura || prev.data_nasc
        }));
      }
    } catch (e) {
      console.warn('Erro ao consultar CNPJ:', e);
    } finally {
      setBuscandoCnpj(false);
    }
  };

  // MÁSCARA E VALIDAÇÃO DE CPF / CNPJ COM BLOQUEIO SE INCORRETO E CONSULTA CNPJ
  const handleCpfCnpjChange = (e) => {
    const formatado = mascaraCpfCnpj(e.target.value);
    setF((prev) => ({ ...prev, cpf_cnpj: formatado }));

    const digits = formatado.replace(/\D/g, '');
    if (digits.length === 11 || digits.length === 14) {
      const valid = validarCpfCnpj(digits);
      if (!valid.valido) {
        setErroCpfCnpj(valid.mensagem);
      } else {
        setErroCpfCnpj('');
        // SE FOR CNPJ COM 14 DÍGITOS VÁLIDOS, PUXA OS DADOS AUTOMATICAMENTE
        if (f.tipo_pessoa === 'PJ' && digits.length === 14) {
          consultarCnpjReceita(digits);
        }
      }
    } else if (digits.length > 0) {
      setErroCpfCnpj('Dígitos incompletos (CPF: 11 números, CNPJ: 14 números).');
    } else {
      setErroCpfCnpj('');
    }
  };

  // MÁSCARA DE TELEFONE E WHATSAPP
  const handleTelefoneChange = (k) => (e) => {
    const formatado = mascaraTelefone(e.target.value);
    setF((prev) => ({ ...prev, [k]: formatado }));
  };

  // MÁSCARA E BUSCA AUTOMÁTICA DE CEP (VIACEP)
  const handleCepChange = async (e) => {
    const formatado = mascaraCep(e.target.value);
    setF((prev) => ({ ...prev, cep: formatado }));

    const limpo = formatado.replace(/\D/g, '');
    if (limpo.length === 8) {
      setBuscandoCep(true);
      const end = await buscarCep(limpo);
      setBuscandoCep(false);
      if (end) {
        setF((prev) => ({
          ...prev,
          logradouro: end.logradouro,
          bairro: end.bairro,
          cidade: end.cidade,
          uf: end.uf,
          cidade_estado: end.cidadeEstado
        }));
      }
    }
  };

  // UPLOAD DE DOCUMENTOS (PRINT SEÇÃO DOCUMENTOS)
  const handleUploadDocumento = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const novoDoc = {
          nome: file.name.toUpperCase(),
          tamanho: `${Math.round(file.size / 1024)} KB`,
          tipo: file.type,
          data: new Date().toLocaleDateString('pt-BR'),
          url: ev.target.result
        };
        setF((prev) => ({
          ...prev,
          documentos: [...(prev.documentos || []), novoDoc]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removerDocumento = (index) => {
    setF((prev) => ({
      ...prev,
      documentos: (prev.documentos || []).filter((_, idx) => idx !== index)
    }));
  };

  // ADICIONAR MAIS CONTATOS DINAMICAMENTE (SOLICITAÇÃO DO USUÁRIO)
  const adicionarContatoExtra = () => {
    setF((prev) => ({
      ...prev,
      contatos_adicionais: [
        ...(prev.contatos_adicionais || []),
        {
          id: Date.now() + Math.random(),
          tipo: 'Celular',
          numero: '',
          nome: '',
          obs: ''
        }
      ]
    }));
  };

  const removerContatoExtra = (idx) => {
    setF((prev) => ({
      ...prev,
      contatos_adicionais: (prev.contatos_adicionais || []).filter((_, i) => i !== idx)
    }));
  };

  const atualizarContatoExtra = (idx, campo, valor) => {
    setF((prev) => {
      const novos = [...(prev.contatos_adicionais || [])];
      novos[idx] = {
        ...novos[idx],
        [campo]: campo === 'numero' ? mascaraTelefone(valor) : (campo === 'obs' ? valor : String(valor).toUpperCase())
      };
      return { ...prev, contatos_adicionais: novos };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validação estrita de CPF/CNPJ: BLOQUEIA SE ESTIVER ERRADO
    if (f.cpf_cnpj) {
      const digits = String(f.cpf_cnpj).replace(/\D/g, '');
      const valid = validarCpfCnpj(digits);
      if (!valid.valido) {
        setErroCpfCnpj(valid.mensagem);
        alert(`Atenção: ${valid.mensagem}\nCorrija o CPF/CNPJ para poder salvar.`);
        return;
      }
    }

    onSave({
      ...f,
      nome: String(f.nome || '').toUpperCase(),
      cidade: String(f.cidade || 'RIO DO SUL').toUpperCase(),
      uf: String(f.uf || 'SC').toUpperCase(),
      endereco: `${f.logradouro || ''}, ${f.numero || ''} ${f.bairro || ''}`.trim().toUpperCase()
    });
  };

  const isCpfInvalido = Boolean(erroCpfCnpj);

  const handleSolicitarExclusao = () => {
    if (!isAdmin) {
      alert('Acesso negado: Somente administradores têm permissão para excluir cadastros.');
      return;
    }
    const motivo = prompt('ÁREA RESTRITA AO ADMINISTRADOR:\nInforme obrigatoriamente o MOTIVO DA EXCLUSÃO deste cadastro para registro em auditoria:');
    if (motivo === null) return;
    if (!motivo.trim()) {
      alert('Operação cancelada: É obrigatório informar o motivo da exclusão para registro na auditoria.');
      return;
    }
    onDelete(f.id, motivo.trim());
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="card modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{ maxWidth: 1040, maxHeight: '92vh', overflowY: 'auto', padding: 28, borderRadius: 12 }}
      >
        {/* CABEÇALHO DO MODAL LIMPO E MODERNO */}
        <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ede9fe', display: 'grid', placeItems: 'center', color: '#6d28d9' }}>
              <UserCheck size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                {f.id ? `Editar Cadastro — ${f.nome}` : 'Novo Cadastro de Pessoa'}
              </h2>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>
                Informações cadastrais completas, contatos múltiplos, endereço e documentos
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} style={{ borderRadius: '50%' }}><X size={18} /></button>
        </div>

        {/* BARRA SUPERIOR DE CONTROLES: STATUS CHIPS, TIPO SWITCH E SEXO */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20
          }}
        >
          {/* CHIPS DE STATUS (ATIVO, CLIENTE, FORNECEDOR) */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                padding: '6px 14px', borderRadius: 20, fontSize: '.84rem', fontWeight: 700,
                background: f.ativo ? '#ecfdf5' : '#f1f5f9',
                border: f.ativo ? '1px solid #10b981' : '1px solid #cbd5e1',
                color: f.ativo ? '#065f46' : '#64748b',
                transition: 'all .15s ease'
              }}
            >
              <input
                type="checkbox"
                checked={f.ativo}
                onChange={(e) => setF({ ...f, ativo: e.target.checked })}
                style={{ accentColor: '#10b981' }}
              />
              Ativo
            </label>

            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                padding: '6px 14px', borderRadius: 20, fontSize: '.84rem', fontWeight: 700,
                background: f.is_cliente ? '#ede9fe' : '#f1f5f9',
                border: f.is_cliente ? '1px solid #7c3aed' : '1px solid #cbd5e1',
                color: f.is_cliente ? '#5b21b6' : '#64748b',
                transition: 'all .15s ease'
              }}
            >
              <input
                type="checkbox"
                checked={f.is_cliente}
                onChange={(e) => setF({ ...f, is_cliente: e.target.checked, papel: e.target.checked ? 'cliente' : 'fornecedor' })}
                style={{ accentColor: '#7c3aed' }}
              />
              Cliente
            </label>

            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                padding: '6px 14px', borderRadius: 20, fontSize: '.84rem', fontWeight: 700,
                background: f.is_fornecedor ? '#eff6ff' : '#f1f5f9',
                border: f.is_fornecedor ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                color: f.is_fornecedor ? '#1e40af' : '#64748b',
                transition: 'all .15s ease'
              }}
            >
              <input
                type="checkbox"
                checked={f.is_fornecedor}
                onChange={(e) => setF({ ...f, is_fornecedor: e.target.checked })}
                style={{ accentColor: '#3b82f6' }}
              />
              Fornecedor
            </label>
          </div>

          {/* ALTERNADOR DE TIPO DE PESSOA (FÍSICA / JURÍDICA) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tipo:</span>
            <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
              <button
                type="button"
                style={{
                  border: 'none',
                  padding: '5px 16px',
                  borderRadius: 6,
                  fontSize: '.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: f.tipo_pessoa === 'PF' ? '#7c3aed' : 'transparent',
                  color: f.tipo_pessoa === 'PF' ? '#ffffff' : '#475569',
                  boxShadow: f.tipo_pessoa === 'PF' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all .15s ease'
                }}
                onClick={() => setF({ ...f, tipo_pessoa: 'PF' })}
              >
                Física
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  padding: '5px 16px',
                  borderRadius: 6,
                  fontSize: '.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: f.tipo_pessoa === 'PJ' ? '#7c3aed' : 'transparent',
                  color: f.tipo_pessoa === 'PJ' ? '#ffffff' : '#475569',
                  boxShadow: f.tipo_pessoa === 'PJ' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all .15s ease'
                }}
                onClick={() => setF({ ...f, tipo_pessoa: 'PJ' })}
              >
                Jurídica
              </button>
            </div>
          </div>

          {/* ALTERNADOR DE SEXO (SE PF) */}
          {f.tipo_pessoa === 'PF' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Sexo:</span>
              <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
                {['Masculino', 'Feminino', 'Outro'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={{
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: '.80rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: f.sexo === s ? '#7c3aed' : 'transparent',
                      color: f.sexo === s ? '#ffffff' : '#475569',
                      boxShadow: f.sexo === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all .15s ease'
                    }}
                    onClick={() => setF({ ...f, sexo: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* SEÇÃO 1: PRINCIPAL */}
        {/* ==================================================================== */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
              Principal
            </h3>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
            {/* CPF/CNPJ (span 3) */}
            <div style={{ gridColumn: 'span 3' }} className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 700, margin: 0 }}>
                  {f.tipo_pessoa === 'PJ' ? 'CNPJ *' : 'CPF *'}
                  {erroCpfCnpj ? (
                    <span style={{ color: 'var(--danger)', fontSize: '.74rem', marginLeft: 6, fontWeight: 700 }}>
                      ❌ {erroCpfCnpj}
                    </span>
                  ) : f.cpf_cnpj ? (
                    <span style={{ color: 'var(--success)', fontSize: '.74rem', marginLeft: 6, fontWeight: 700 }}>
                      ✓ Válido
                    </span>
                  ) : null}
                </label>
                {f.tipo_pessoa === 'PJ' && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ fontSize: '.70rem', padding: '1px 6px', color: '#6d28d9', borderColor: '#7c3aed', background: '#f5f3ff', fontWeight: 700 }}
                    onClick={() => consultarCnpjReceita()}
                    title="Puxar dados cadastrais da empresa na Receita Federal"
                  >
                    {buscandoCnpj ? 'Buscando...' : '🔍 Buscar CNPJ'}
                  </button>
                )}
              </div>
              <input
                className="input"
                required
                style={{ borderColor: erroCpfCnpj ? 'var(--danger)' : undefined }}
                value={f.cpf_cnpj ?? ''}
                onChange={handleCpfCnpjChange}
                placeholder={f.tipo_pessoa === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
              />
              {buscandoCnpj && (
                <small style={{ color: '#6d28d9', fontSize: '.72rem', fontWeight: 600 }}>
                  Buscando dados da empresa na Receita Federal...
                </small>
              )}
            </div>

            {/* RG/IE (span 3) */}
            <div style={{ gridColumn: 'span 3' }} className="field">
              <label style={{ fontWeight: 600 }}>{f.tipo_pessoa === 'PJ' ? 'Inscrição Estadual' : 'RG'}</label>
              <input className="input" value={f.rg_ie ?? ''} onChange={setUpper('rg_ie')} />
            </div>

            {/* Apelido/Fantasia (span 3) */}
            <div style={{ gridColumn: 'span 3' }} className="field">
              <label style={{ fontWeight: 600 }}>{f.tipo_pessoa === 'PJ' ? 'Nome Fantasia' : 'Apelido'}</label>
              <input className="input" value={f.apelido ?? ''} onChange={setUpper('apelido')} />
            </div>

            {/* Data Nasc / Abertura (span 3) */}
            <div style={{ gridColumn: 'span 3' }} className="field">
              <label style={{ fontWeight: 600 }}>{f.tipo_pessoa === 'PJ' ? 'Data de Abertura' : 'Data de Nascimento'}</label>
              <input type="date" className="input" value={f.data_nasc ?? ''} onChange={setUpper('data_nasc')} />
            </div>

            {/* Nome / Razão Social (span 8) */}
            <div style={{ gridColumn: 'span 8' }} className="field">
              <label style={{ fontWeight: 700 }}>{f.tipo_pessoa === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}</label>
              <input className="input" required value={f.nome ?? ''} onChange={setUpper('nome')} placeholder="NOME COMPLETO" />
            </div>

            {/* Naturalidade (span 4) */}
            {f.tipo_pessoa === 'PF' && (
              <div style={{ gridColumn: 'span 4' }} className="field">
                <label style={{ fontWeight: 600 }}>Naturalidade</label>
                <input className="input" value={f.naturalidade ?? ''} onChange={setUpper('naturalidade')} placeholder="RIO DO SUL - SC" />
              </div>
            )}

            {/* CNH e Vencimento (se PF) */}
            {f.tipo_pessoa === 'PF' && (
              <>
                <div style={{ gridColumn: 'span 3' }} className="field">
                  <label style={{ fontWeight: 600 }}>Número da CNH</label>
                  <input className="input" value={f.numero_cnh ?? ''} onChange={setUpper('numero_cnh')} />
                </div>

                <div style={{ gridColumn: 'span 3' }} className="field">
                  <label style={{ fontWeight: 600 }}>Vencimento da CNH</label>
                  <input type="date" className="input" value={f.vencimento_cnh ?? ''} onChange={setUpper('vencimento_cnh')} />
                </div>

                <div style={{ gridColumn: 'span 3' }} className="field">
                  <label style={{ fontWeight: 600 }}>Estado Civil</label>
                  <select className="select" value={f.estado_civil} onChange={setUpper('estado_civil')}>
                    {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 3' }} className="field">
                  <label style={{ fontWeight: 600 }}>Nacionalidade</label>
                  <input className="input" value={f.nacionalidade ?? 'BRASILEIRA'} onChange={setUpper('nacionalidade')} />
                </div>
              </>
            )}

            {/* Categoria, Cliente Desde e Site */}
            <div style={{ gridColumn: 'span 4' }} className="field">
              <label style={{ fontWeight: 600 }}>Categoria</label>
              <input className="input" value={f.categoria ?? ''} onChange={setUpper('categoria')} placeholder="Ex: VIP, REPASSE, LOJISTA" />
            </div>

            <div style={{ gridColumn: 'span 4' }} className="field">
              <label style={{ fontWeight: 600 }}>Cliente desde</label>
              <input type="date" className="input" value={f.cliente_desde ?? ''} onChange={setUpper('cliente_desde')} />
            </div>

            <div style={{ gridColumn: 'span 4' }} className="field">
              <label style={{ fontWeight: 600 }}>Site / Redes Sociais</label>
              <input className="input" value={f.site ?? ''} onChange={setUpper('site')} placeholder="WWW..." />
            </div>

            {/* Observações */}
            <div style={{ gridColumn: 'span 12' }} className="field">
              <label style={{ fontWeight: 600 }}>Observação</label>
              <textarea
                className="input"
                rows={2}
                value={f.observacoes ?? ''}
                onChange={setUpper('observacoes')}
                placeholder="OBSERVAÇÕES INTERNAS SOBRE O CLIENTE..."
              />
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SEÇÃO 2: ENDEREÇO (VIACEP AUTOMÁTICO) */}
        {/* ==================================================================== */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
              Endereço
            </h3>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
            {/* CEP com Busca Automática ViaCEP */}
            <div style={{ gridColumn: 'span 3' }} className="field">
              <label style={{ fontWeight: 700 }}>
                CEP
                {buscandoCep && <span style={{ fontSize: '.74rem', color: '#5d35b0', marginLeft: 6 }}>Buscando...</span>}
              </label>
              <input
                className="input"
                value={f.cep ?? ''}
                onChange={handleCepChange}
                placeholder="89164-138"
              />
            </div>

            <div style={{ gridColumn: 'span 5' }} className="field">
              <label style={{ fontWeight: 600 }}>Logradouro</label>
              <input
                className="input"
                value={f.logradouro ?? ''}
                onChange={setUpper('logradouro')}
                placeholder="RUA DOM PEDRO II"
              />
            </div>

            <div style={{ gridColumn: 'span 2' }} className="field">
              <label style={{ fontWeight: 600 }}>Número</label>
              <input
                className="input"
                value={f.numero ?? ''}
                onChange={setUpper('numero')}
                placeholder="461"
              />
            </div>

            <div style={{ gridColumn: 'span 2' }} className="field">
              <label style={{ fontWeight: 600 }}>Complemento</label>
              <input
                className="input"
                value={f.complemento ?? ''}
                onChange={setUpper('complemento')}
                placeholder="SALA 01"
              />
            </div>

            <div style={{ gridColumn: 'span 5' }} className="field">
              <label style={{ fontWeight: 600 }}>Bairro</label>
              <input
                className="input"
                value={f.bairro ?? ''}
                onChange={setUpper('bairro')}
                placeholder="CANOAS"
              />
            </div>

            <div style={{ gridColumn: 'span 7' }} className="field">
              <label style={{ fontWeight: 600 }}>Cidade / Estado</label>
              <input
                className="input"
                value={f.cidade_estado ?? (f.cidade ? `${f.cidade} / ${f.uf}` : 'RIO DO SUL / SC')}
                onChange={setUpper('cidade_estado')}
                placeholder="RIO DO SUL / SC"
              />
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SEÇÃO 3: CONTATOS (COM OPÇÃO DE ADICIONAR MAIS CONTATOS) */}
        {/* ==================================================================== */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
              Contatos
            </h3>
            <button
              type="button"
              className="btn btn-sm"
              onClick={adicionarContatoExtra}
              style={{
                background: '#f5f3ff',
                border: '1px solid #7c3aed',
                color: '#6b21a8',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 6
              }}
            >
              <Plus size={14} /> + Adicionar Outro Contato
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
            <div style={{ gridColumn: 'span 4' }} className="field">
              <label style={{ fontWeight: 600 }}>Telefone Principal</label>
              <input
                className="input"
                value={f.telefone ?? ''}
                onChange={handleTelefoneChange('telefone')}
                placeholder="(47) 98846-7855"
              />
            </div>

            <div style={{ gridColumn: 'span 4' }} className="field">
              <label style={{ fontWeight: 600 }}>WhatsApp (somente números ou DDD)</label>
              <input
                className="input"
                value={f.whatsapp ?? ''}
                onChange={handleTelefoneChange('whatsapp')}
                placeholder="(47) 99999-9000"
              />
            </div>

            <div style={{ gridColumn: 'span 4' }} className="field">
              <label style={{ fontWeight: 600 }}>E-mail</label>
              <input
                type="email"
                className="input"
                style={{ textTransform: 'none' }}
                value={f.email ?? ''}
                onChange={(e) => setF({ ...f, email: e.target.value.toLowerCase().trim() })}
                placeholder="contato@cliente.com.br"
              />
            </div>
          </div>

          {/* LISTA DE CONTATOS ADICIONAIS DINÂMICOS */}
          {(f.contatos_adicionais || []).length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Contatos Adicionais ({f.contatos_adicionais.length})
              </div>

              {f.contatos_adicionais.map((cExtra, idx) => (
                <div
                  key={cExtra.id || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(12, 1fr)',
                    gap: 10,
                    alignItems: 'center',
                    background: '#f8fafc',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ gridColumn: 'span 3' }}>
                    <select
                      className="select"
                      style={{ height: 36, fontSize: '.84rem' }}
                      value={cExtra.tipo}
                      onChange={(e) => atualizarContatoExtra(idx, 'tipo', e.target.value)}
                    >
                      <option value="Celular">Celular</option>
                      <option value="WhatsApp Comercial">WhatsApp Comercial</option>
                      <option value="Telefone Fixo">Telefone Fixo</option>
                      <option value="Contato de Recado">Contato de Recado</option>
                      <option value="Cônjuge">Cônjuge</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Sócio / Empresa">Sócio / Empresa</option>
                      <option value="Filho(a) / Parente">Filho(a) / Parente</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 3' }}>
                    <input
                      className="input"
                      style={{ height: 36, fontSize: '.84rem' }}
                      placeholder="Telefone / WhatsApp"
                      value={cExtra.numero}
                      onChange={(e) => atualizarContatoExtra(idx, 'numero', e.target.value)}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 3' }}>
                    <input
                      className="input"
                      style={{ height: 36, fontSize: '.84rem' }}
                      placeholder="Nome / Quem é (ex: Maria)"
                      value={cExtra.nome}
                      onChange={(e) => atualizarContatoExtra(idx, 'nome', e.target.value)}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <input
                      className="input"
                      style={{ height: 36, fontSize: '.84rem' }}
                      placeholder="Obs / Ramal"
                      value={cExtra.obs}
                      onChange={(e) => atualizarContatoExtra(idx, 'obs', e.target.value)}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 1', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removerContatoExtra(idx)}
                      title="Excluir este contato"
                      style={{ height: 36, width: 36, padding: 0, display: 'inline-grid', placeItems: 'center' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* SEÇÃO 4: DOCUMENTOS (DROPZONE TRACEJADA OFICIAL ALTIMUS) */}
        {/* ==================================================================== */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
              Documentos & Anexos
            </h3>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>

          <label className="dropzone-altimus">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={handleUploadDocumento}
            />
            <Upload size={24} style={{ opacity: 0.8 }} />
            <span>Arraste ou selecione arquivos (CNH, RG, Comprovante de Residência, Contrato Social)</span>
          </label>

          {(f.documentos || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {f.documentos.map((doc, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={18} style={{ color: '#5d35b0' }} />
                    <div>
                      <strong style={{ fontSize: '.86rem' }}>{doc.nome}</strong>
                      <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{doc.tamanho} · Anexado em {doc.data}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => removerDocumento(idx)}
                    title="Remover documento"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BARRA INFERIOR DE BOTÕES (GRANDES E FÁCEIS DE CLICAR) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          {f.id && isAdmin ? (
            <button
              type="button"
              className="btn btn-danger"
              style={{ height: 48, padding: '0 24px', fontSize: '.95rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onClick={handleSolicitarExclusao}
              title="Exclusão restrita ao administrador com motivo obrigatório"
            >
              <Trash2 size={16} /> Excluir Cadastro
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 14 }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{ height: 48, minWidth: 140, fontSize: '1rem', fontWeight: 700, padding: '0 28px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCpfInvalido}
              style={{
                height: 48,
                minWidth: 200,
                fontSize: '1.05rem',
                fontWeight: 800,
                padding: '0 36px',
                background: isCpfInvalido ? '#94a3b8' : '#5d35b0',
                color: '#ffffff',
                boxShadow: isCpfInvalido ? 'none' : '0 4px 14px rgba(93, 53, 176, 0.35)',
                cursor: isCpfInvalido ? 'not-allowed' : 'pointer'
              }}
              title={isCpfInvalido ? erroCpfCnpj : 'Salvar cadastro'}
            >
              Salvar Cadastro
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
export { ClienteModalAltimus };
