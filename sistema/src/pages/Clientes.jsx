import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Users, MessageCircle, Trash2, X, Building2, UserCheck,
  Upload, FileText, CheckCircle2, AlertCircle, Phone, Mail, MapPin, ChevronRight
} from 'lucide-react';
import { getClientes, saveCliente, deleteCliente, ORIGENS_LEAD } from '../store';
import { mascaraCpfCnpj, mascaraTelefone, mascaraCep, buscarCep, validarCpfCnpj } from '../utils/mascaras';

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

export default function Clientes() {
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
          onDelete={async (id) => {
            if (!confirm('Deseja realmente excluir este cadastro?')) return;
            try {
              setCarregando(true);
              const res = await deleteCliente(id);
              setLista(Array.isArray(res) ? res : []);
              setEditando(null);
              avisoSucesso('✓ Cadastro excluído!');
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
function ClienteModalAltimus({ inicial, onClose, onSave, onDelete }) {
  const [f, setF] = useState(inicial);
  const [erroCpfCnpj, setErroCpfCnpj] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Manipulador genérico que força LETRA MAIÚSCULA em todo o sistema
  const setUpper = (k) => (e) => {
    let val = e.target.value;
    if (k !== 'email') val = String(val).toUpperCase();
    setF((prev) => ({ ...prev, [k]: val }));
  };

  // MÁSCARA E VALIDAÇÃO DE CPF / CNPJ COM BLOQUEIO SE INCORRETO
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

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="card modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{ maxWidth: 960, maxHeight: '92vh', overflowY: 'auto', padding: 24 }}
      >
        <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <h2>{f.id ? `Editar Cadastro — ${f.nome}` : 'Novo Cadastro de Pessoa (Altimus)'}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* ==================================================================== */}
        {/* SEÇÃO 1: PRINCIPAL (PRINT 3 ALTIMUS) */}
        {/* ==================================================================== */}
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 14px 0', color: 'var(--text)' }}>
            Principal
          </h3>

          <div className="form-grid">
            {/* Linha 1: Checkboxes e Radios */}
            <div className="field span-2" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={f.ativo}
                  onChange={(e) => setF({ ...f, ativo: e.target.checked })}
                />
                Ativo
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={f.is_cliente}
                  onChange={(e) => setF({ ...f, is_cliente: e.target.checked, papel: e.target.checked ? 'cliente' : 'fornecedor' })}
                />
                Cliente
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={f.is_fornecedor}
                  onChange={(e) => setF({ ...f, is_fornecedor: e.target.checked })}
                />
                Fornecedor
              </label>
            </div>

            <div className="field" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--muted)' }}>Tipo:</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '.86rem' }}>
                <input
                  type="radio"
                  name="tipo_pessoa"
                  checked={f.tipo_pessoa === 'PF'}
                  onChange={() => setF({ ...f, tipo_pessoa: 'PF' })}
                />
                Física
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '.86rem' }}>
                <input
                  type="radio"
                  name="tipo_pessoa"
                  checked={f.tipo_pessoa === 'PJ'}
                  onChange={() => setF({ ...f, tipo_pessoa: 'PJ' })}
                />
                Jurídica
              </label>
            </div>

            {f.tipo_pessoa === 'PF' && (
              <div className="field" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--muted)' }}>Sexo:</span>
                {['Masculino', 'Feminino', 'Outro'].map((s) => (
                  <label key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '.84rem' }}>
                    <input
                      type="radio"
                      name="sexo"
                      checked={f.sexo === s}
                      onChange={() => setF({ ...f, sexo: s })}
                    />
                    {s}
                  </label>
                ))}
              </div>
            )}

            {/* Linha 2: CPF/CNPJ, RG/IE, Apelido */}
            <div className="field span-2">
              <label>
                {f.tipo_pessoa === 'PJ' ? 'CNPJ *' : 'CPF *'}
                {erroCpfCnpj ? (
                  <span style={{ color: 'var(--danger)', fontSize: '.76rem', marginLeft: 8, fontWeight: 700 }}>
                    ❌ {erroCpfCnpj}
                  </span>
                ) : f.cpf_cnpj ? (
                  <span style={{ color: 'var(--success)', fontSize: '.76rem', marginLeft: 8, fontWeight: 700 }}>
                    ✓ Válido
                  </span>
                ) : null}
              </label>
              <input
                className="input"
                required
                style={{ borderColor: erroCpfCnpj ? 'var(--danger)' : undefined }}
                value={f.cpf_cnpj ?? ''}
                onChange={handleCpfCnpjChange}
                placeholder={f.tipo_pessoa === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
              />
            </div>

            <div className="field">
              <label>{f.tipo_pessoa === 'PJ' ? 'Inscrição Estadual' : 'RG'}</label>
              <input className="input" value={f.rg_ie ?? ''} onChange={setUpper('rg_ie')} />
            </div>

            <div className="field">
              <label>{f.tipo_pessoa === 'PJ' ? 'Nome Fantasia' : 'Apelido'}</label>
              <input className="input" value={f.apelido ?? ''} onChange={setUpper('apelido')} />
            </div>

            {/* Linha 3: Nome / Razão Social e Data de Nascimento */}
            <div className="field span-3">
              <label>{f.tipo_pessoa === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}</label>
              <input className="input" required value={f.nome ?? ''} onChange={setUpper('nome')} placeholder="NOME COMPLETO" />
            </div>

            <div className="field">
              <label>{f.tipo_pessoa === 'PJ' ? 'Data de Abertura' : 'Data de Nascimento'}</label>
              <input type="date" className="input" value={f.data_nasc ?? ''} onChange={setUpper('data_nasc')} />
            </div>

            {/* Linha 4: Naturalidade, Nacionalidade, CNH */}
            {f.tipo_pessoa === 'PF' && (
              <>
                <div className="field">
                  <label>Naturalidade</label>
                  <input className="input" value={f.naturalidade ?? ''} onChange={setUpper('naturalidade')} placeholder="RIO DO SUL - SC" />
                </div>

                <div className="field">
                  <label>Nacionalidade</label>
                  <input className="input" value={f.nacionalidade ?? 'BRASILEIRA'} onChange={setUpper('nacionalidade')} />
                </div>

                <div className="field">
                  <label>Número da CNH</label>
                  <input className="input" value={f.numero_cnh ?? ''} onChange={setUpper('numero_cnh')} />
                </div>

                <div className="field">
                  <label>Vencimento da CNH</label>
                  <input type="date" className="input" value={f.vencimento_cnh ?? ''} onChange={setUpper('vencimento_cnh')} />
                </div>
              </>
            )}

            {/* Linha 5: Estado Civil, Cliente Desde, Categoria, Site */}
            {f.tipo_pessoa === 'PF' && (
              <div className="field">
                <label>Estado civil</label>
                <select className="select" value={f.estado_civil} onChange={setUpper('estado_civil')}>
                  {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>Cliente desde</label>
              <input type="date" className="input" value={f.cliente_desde ?? ''} onChange={setUpper('cliente_desde')} />
            </div>

            <div className="field">
              <label>Categoria</label>
              <input className="input" value={f.categoria ?? ''} onChange={setUpper('categoria')} placeholder="Ex: VIP, REPASSE, LOJISTA" />
            </div>

            <div className="field">
              <label>Site / Redes</label>
              <input className="input" value={f.site ?? ''} onChange={setUpper('site')} placeholder="WWW..." />
            </div>

            {/* Linha 6: Observação */}
            <div className="field span-4">
              <label>Observação</label>
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
        {/* SEÇÃO 2: ENDEREÇO (PRINTS 1 E 2 ALTIMUS - VIA CEP AUTOMÁTICO) */}
        {/* ==================================================================== */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 14px 0', color: 'var(--text)' }}>
            Endereço
          </h3>

          <div className="form-grid">
            {/* CEP com Busca Automática ViaCEP */}
            <div className="field">
              <label>
                CEP
                {buscandoCep && <span style={{ fontSize: '.74rem', color: '#5d35b0', marginLeft: 6 }}>Buscando endereço...</span>}
              </label>
              <input
                className="input"
                value={f.cep ?? ''}
                onChange={handleCepChange}
                placeholder="89164-138"
              />
            </div>

            <div className="field span-2">
              <label>Logradouro</label>
              <input
                className="input"
                value={f.logradouro ?? ''}
                onChange={setUpper('logradouro')}
                placeholder="RUA DOM PEDRO II"
              />
            </div>

            <div className="field">
              <label>Número</label>
              <input
                className="input"
                value={f.numero ?? ''}
                onChange={setUpper('numero')}
                placeholder="461"
              />
            </div>

            <div className="field span-2">
              <label>Complemento</label>
              <input
                className="input"
                value={f.complemento ?? ''}
                onChange={setUpper('complemento')}
                placeholder="SALA 01, APTO..."
              />
            </div>

            <div className="field">
              <label>Bairro</label>
              <input
                className="input"
                value={f.bairro ?? ''}
                onChange={setUpper('bairro')}
                placeholder="CANOAS"
              />
            </div>

            <div className="field">
              <label>Cidade / Estado</label>
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
        {/* SEÇÃO 3: CONTATOS (PRINT COM MÁSCARAS PADRÃO) */}
        {/* ==================================================================== */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 14px 0', color: 'var(--text)' }}>
            Contatos
          </h3>

          <div className="form-grid">
            <div className="field">
              <label>Telefone Principal</label>
              <input
                className="input"
                value={f.telefone ?? ''}
                onChange={handleTelefoneChange('telefone')}
                placeholder="(47) 98846-7855"
              />
            </div>

            <div className="field">
              <label>WhatsApp (somente números ou DDD)</label>
              <input
                className="input"
                value={f.whatsapp ?? ''}
                onChange={handleTelefoneChange('whatsapp')}
                placeholder="(47) 99999-9000"
              />
            </div>

            <div className="field span-2">
              <label>E-mail</label>
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
        </div>

        {/* ==================================================================== */}
        {/* SEÇÃO 4: DOCUMENTOS (PRINT ÁREA TRACEJADA OFICIAL ALTIMUS) */}
        {/* ==================================================================== */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 14px 0', color: 'var(--text)' }}>
            Documentos
          </h3>

          <label className="dropzone-altimus">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={handleUploadDocumento}
            />
            <Upload size={24} style={{ opacity: 0.8 }} />
            <span>Arraste ou selecione um arquivo (CNH, RG, Comprovante de Residência, Contrato Social)</span>
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

        {/* ==================================================================== */}
        {/* BARRA INFERIOR DE BOTÕES */}
        {/* ==================================================================== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
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
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCpfInvalido}
              style={{
                background: isCpfInvalido ? '#94a3b8' : '#5d35b0',
                color: '#ffffff',
                fontWeight: 700,
                padding: '0 24px',
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
