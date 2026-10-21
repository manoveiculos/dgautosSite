import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Users, MessageCircle, Trash2, X, Building2, UserCheck } from 'lucide-react';
import { getClientes, saveCliente, deleteCliente, ORIGENS_LEAD } from '../store';

const EMPTY_CLI = {
  tipo_pessoa: 'PF', papel: 'cliente', nome: '', cpf_cnpj: '', rg_ie: '',
  data_nasc: '', telefone: '', whatsapp: '', email: '', cep: '',
  endereco: '', cidade: 'Rio do Sul', uf: 'SC', origem: 'WHATSAPP', observacoes: ''
};

export default function Clientes() {
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [papel, setPapel] = useState('');
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    getClientes().then((res) => setLista(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const filtrados = useMemo(() => {
    const arr = Array.isArray(lista) ? lista : [];
    return arr.filter((c) => {
      if (!c) return false;
      if (papel && c.papel !== papel && c.papel !== 'ambos') return false;
      return `${c.nome || ''} ${c.cpf_cnpj || ''} ${c.telefone || ''} ${c.cidade || ''} ${c.email || ''}`
        .toLowerCase().includes(busca.toLowerCase());
    });
  }, [lista, busca, papel]);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Clientes & Fornecedores</h1>
          <p>{filtrados.length} cadastro(s) ativo(s) na base da loja.</p>
        </div>
        <button id="btn-novo-cliente" className="btn btn-primary" onClick={() => setEditando(EMPTY_CLI)}>
          <Plus size={16} />Novo cadastro
        </button>
      </header>

      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar nome, CPF/CNPJ, telefone, cidade…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select className="select" style={{ maxWidth: 200 }} value={papel} onChange={(e) => setPapel(e.target.value)}>
          <option value="">Todos (Clientes e Fornecedores)</option>
          <option value="cliente">Somente Clientes</option>
          <option value="fornecedor">Somente Fornecedores</option>
        </select>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nome / Razão Social</th>
              <th>Tipo / Papel</th>
              <th>CPF / CNPJ</th>
              <th>Telefone / WhatsApp</th>
              <th>Cidade / UF</th>
              <th>Origem</th>
              <th>Contato</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} onClick={() => setEditando(c)}>
                <td>
                  <strong>{c.nome}</strong>
                  {c.email && <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{c.email}</div>}
                </td>
                <td>
                  <span className="badge badge-consignado">{c.tipo_pessoa} · {c.papel.toUpperCase()}</span>
                </td>
                <td>{c.cpf_cnpj || '—'}</td>
                <td>{c.telefone || c.whatsapp || '—'}</td>
                <td>{c.cidade ? `${c.cidade}/${c.uf}` : '—'}</td>
                <td>{ORIGENS_LEAD[c.origem] || c.origem}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {(c.whatsapp || c.telefone) && (
                    <a
                      href={`https://wa.me/55${String(c.whatsapp || c.telefone).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-success"
                    >
                      <MessageCircle size={13} />WhatsApp
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <ClienteModal
          inicial={editando}
          onClose={() => setEditando(null)}
          onSave={async (cli) => {
            const res = await saveCliente(cli);
            setLista(Array.isArray(res) ? res : []);
            setEditando(null);
            alert('✓ Cliente/Fornecedor salvo com sucesso!');
          }}
          onDelete={async (id) => {
            const res = await deleteCliente(id);
            setLista(Array.isArray(res) ? res : []);
            setEditando(null);
            alert('✓ Cadastro excluído com sucesso!');
          }}
        />
      )}
    </>
  );
}

function ClienteModal({ inicial, onClose, onSave, onDelete }) {
  const [f, setF] = useState(inicial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="overlay" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
        <div className="modal-head">
          <h2>{f.id ? `Editar Cadastro — ${f.nome}` : 'Novo Cliente / Fornecedor'}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Pessoa Física / Jurídica</label>
            <select className="select" value={f.tipo_pessoa} onChange={set('tipo_pessoa')}>
              <option value="PF">Pessoa Física (PF)</option>
              <option value="PJ">Pessoa Jurídica (PJ)</option>
            </select>
          </div>
          <div className="field">
            <label>Relação com a Loja</label>
            <select className="select" value={f.papel} onChange={set('papel')}>
              <option value="cliente">Cliente / Comprador</option>
              <option value="fornecedor">Fornecedor / Prestador</option>
              <option value="ambos">Ambos (Cliente e Fornecedor)</option>
            </select>
          </div>
          <div className="field">
            <label>Origem do Cliente</label>
            <select className="select" value={f.origem ?? 'MANUAL'} onChange={set('origem')}>
              {Object.entries(ORIGENS_LEAD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          <div className="field span-2">
            <label>{f.tipo_pessoa === 'PJ' ? 'Razão Social / Nome Fantasia *' : 'Nome Completo *'}</label>
            <input className="input" required value={f.nome} onChange={set('nome')} />
          </div>
          <div className="field">
            <label>{f.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}</label>
            <input className="input" value={f.cpf_cnpj ?? ''} onChange={set('cpf_cnpj')} placeholder={f.tipo_pessoa === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'} />
          </div>

          <div className="field">
            <label>{f.tipo_pessoa === 'PJ' ? 'Inscrição Estadual' : 'RG'}</label>
            <input className="input" value={f.rg_ie ?? ''} onChange={set('rg_ie')} />
          </div>
          <div className="field">
            <label>Telefone Principal</label>
            <input className="input" value={f.telefone ?? ''} onChange={set('telefone')} placeholder="(47) 99999-0000" />
          </div>
          <div className="field">
            <label>WhatsApp (somente números ou DDD)</label>
            <input className="input" value={f.whatsapp ?? ''} onChange={set('whatsapp')} placeholder="47999990000" />
          </div>

          <div className="field span-2">
            <label>E-mail</label>
            <input className="input" type="email" value={f.email ?? ''} onChange={set('email')} />
          </div>
          <div className="field">
            <label>Data de Nascimento</label>
            <input className="input" type="date" value={f.data_nasc ?? ''} onChange={set('data_nasc')} />
          </div>

          <div className="field">
            <label>CEP</label>
            <input className="input" value={f.cep ?? ''} onChange={set('cep')} placeholder="88330-000" />
          </div>
          <div className="field span-2">
            <label>Endereço Completo (Rua, Número, Bairro, Complemento)</label>
            <input className="input" value={f.endereco ?? ''} onChange={set('endereco')} />
          </div>

          <div className="field span-2">
            <label>Cidade</label>
            <input className="input" value={f.cidade ?? ''} onChange={set('cidade')} />
          </div>
          <div className="field">
            <label>UF</label>
            <input className="input" maxLength={2} value={f.uf ?? 'SC'} onChange={set('uf')} />
          </div>

          <div className="field span-3">
            <label>Observações / Perfil de Compra / Restrições</label>
            <textarea className="input" rows={3} value={f.observacoes ?? ''} onChange={set('observacoes')} />
          </div>
        </div>

        <div className="modal-actions">
          {f.id && (
            <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }}
              onClick={() => confirm('Excluir este cadastro?') && onDelete(f.id)}>
              <Trash2 size={16} />Excluir
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Salvar Cadastro</button>
        </div>
      </form>
    </div>
  );
}
