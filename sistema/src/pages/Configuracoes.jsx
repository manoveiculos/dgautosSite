import { useEffect, useState } from 'react';
import { Building2, Users, ShieldCheck, Plus, Trash2, Save } from 'lucide-react';
import { getConfig, saveConfigLoja, createUsuario, deleteUsuario } from '../store';

export default function Configuracoes({ user }) {
  const emailAtual = (user?.email || '').trim().toLowerCase();
  if (emailAtual !== 'admin@dgautos.com.br') {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '40px auto' }}>
        <h2 style={{ color: '#ef4444', marginBottom: 12 }}>Acesso Restrito ao Administrador Geral</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Esta área contém dados fiscais, razão social e gerenciamento de equipe da empresa. 
          O acesso é restrito exclusivamente ao login oficial <strong>admin@dgautos.com.br</strong>.
        </p>
      </div>
    );
  }

  const [aba, setAba] = useState('loja'); // loja | usuarios | auditoria
  const [loja, setLoja] = useState({
    razao_social: 'DG Automóveis Comércio de Veículos Ltda',
    nome_fantasia: 'DG Automóveis',
    cnpj: '12.345.678/0001-90',
    telefone: '(47) 3333-4444',
    whatsapp: '(47) 99999-8888',
    email: 'contato@dgautomoveis.com.br',
    site_url: 'https://dgautomoveis.com.br',
    endereco: 'Av. Brasil, 1500 - Centro',
    cidade: 'Balneário Camboriú',
    uf: 'SC',
    cep: '88330-000',
    termos_garantia: 'Garantia legal de 90 (noventa) dias para motor e câmbio, conforme Art. 26 do Código de Defesa do Consumidor.'
  });
  const [usuarios, setUsuarios] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', senha: '', perfil: 'vendedor' });
  const [msg, setMsg] = useState('');

  const recarregar = () => {
    getConfig().then((c) => {
      if (c?.loja) setLoja(c.loja);
      setUsuarios(Array.isArray(c?.usuarios) ? c.usuarios : []);
      setAuditoria(Array.isArray(c?.auditoria) ? c.auditoria : []);
    }).catch(() => {});
  };
  useEffect(recarregar, []);

  const salvarLoja = async (e) => {
    e.preventDefault();
    try {
      const atualizada = await saveConfigLoja(loja);
      setLoja(atualizada);
      setMsg('Dados da revenda salvos com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      const lista = await createUsuario(novoUser);
      setUsuarios(lista);
      setNovoUser({ nome: '', email: '', senha: '', perfil: 'vendedor' });
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Configurações & Administração</h1>
          <p>Dados da revenda (usados nos contratos), equipe de usuários e trilha de auditoria.</p>
        </div>
        <div className="tabs">
          <button className={`tab ${aba === 'loja' ? 'active' : ''}`} onClick={() => setAba('loja')}>
            <Building2 size={15} />Dados da Revenda
          </button>
          <button className={`tab ${aba === 'usuarios' ? 'active' : ''}`} onClick={() => setAba('usuarios')}>
            <Users size={15} />Usuários & Vendedores
          </button>
          <button className={`tab ${aba === 'auditoria' ? 'active' : ''}`} onClick={() => setAba('auditoria')}>
            <ShieldCheck size={15} />Log de Auditoria
          </button>
        </div>
      </header>

      {aba === 'loja' && loja && (
        <form className="card" onSubmit={salvarLoja}>
          <h3 style={{ marginBottom: 16 }}>Identificação da Revenda e Cláusulas Padrão</h3>
          <div className="form-grid">
            <div className="field span-2">
              <label>Razão Social</label>
              <input className="input" value={loja.razao_social || ''} onChange={(e) => setLoja({ ...loja, razao_social: e.target.value })} />
            </div>
            <div className="field">
              <label>Nome Fantasia</label>
              <input className="input" value={loja.nome_fantasia || ''} onChange={(e) => setLoja({ ...loja, nome_fantasia: e.target.value })} />
            </div>
            <div className="field">
              <label>CNPJ</label>
              <input className="input" value={loja.cnpj || ''} onChange={(e) => setLoja({ ...loja, cnpj: e.target.value })} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input className="input" value={loja.telefone || ''} onChange={(e) => setLoja({ ...loja, telefone: e.target.value })} />
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <input className="input" value={loja.whatsapp || ''} onChange={(e) => setLoja({ ...loja, whatsapp: e.target.value })} />
            </div>
            <div className="field span-2">
              <label>Endereço Completo</label>
              <input className="input" value={loja.endereco || ''} onChange={(e) => setLoja({ ...loja, endereco: e.target.value })} />
            </div>
            <div className="field">
              <label>Cidade</label>
              <input className="input" value={loja.cidade || ''} onChange={(e) => setLoja({ ...loja, cidade: e.target.value })} />
            </div>
            <div className="field">
              <label>UF</label>
              <input className="input" maxLength={2} value={loja.uf || 'SC'} onChange={(e) => setLoja({ ...loja, uf: e.target.value })} />
            </div>
            <div className="field">
              <label>CEP</label>
              <input className="input" value={loja.cep || ''} onChange={(e) => setLoja({ ...loja, cep: e.target.value })} />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input className="input" value={loja.email || ''} onChange={(e) => setLoja({ ...loja, email: e.target.value })} />
            </div>
            <div className="field span-3">
              <label>Texto Padrão de Garantia nos Contratos</label>
              <textarea className="input" rows={3} value={loja.termos_garantia || ''} onChange={(e) => setLoja({ ...loja, termos_garantia: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            {msg && <span style={{ color: 'var(--success)', marginRight: 'auto', fontWeight: 500 }}>{msg}</span>}
            <button type="submit" className="btn btn-primary"><Save size={16} />Salvar Dados da Loja</button>
          </div>
        </form>
      )}

      {aba === 'usuarios' && (
        <div className="grid-2">
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.nome}</strong></td>
                    <td>{u.email}</td>
                    <td><span className="badge badge-consignado">{u.perfil.toUpperCase()}</span></td>
                    <td>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={async () => {
                          if (!confirm(`Remover usuário ${u.nome}?`)) return;
                          try { setUsuarios(await deleteUsuario(u.id)); } catch (e) { alert(e.message); }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form className="card" onSubmit={addUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3>Novo Usuário / Vendedor</h3>
            <div className="field">
              <label>Nome Completo</label>
              <input className="input" required value={novoUser.nome} onChange={(e) => setNovoUser({ ...novoUser, nome: e.target.value })} />
            </div>
            <div className="field">
              <label>E-mail de Acesso</label>
              <input className="input" type="email" required value={novoUser.email} onChange={(e) => setNovoUser({ ...novoUser, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Senha Inicial</label>
              <input className="input" type="password" required value={novoUser.senha} onChange={(e) => setNovoUser({ ...novoUser, senha: e.target.value })} />
            </div>
            <div className="field">
              <label>Perfil de Permissão</label>
              <select className="select" value={novoUser.perfil} onChange={(e) => setNovoUser({ ...novoUser, perfil: e.target.value })}>
                <option value="vendedor">Vendedor (CRM, Estoque, Negociações)</option>
                <option value="financeiro">Financeiro</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Administrador Geral</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: 6 }}>
              <Plus size={16} />Cadastrar Usuário
            </button>
          </form>
        </div>
      )}

      {aba === 'auditoria' && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Módulo / Tabela</th>
                <th>Registro ID</th>
              </tr>
            </thead>
            <tbody>
              {auditoria.map((a) => (
                <tr key={a.id}>
                  <td>{a.data}</td>
                  <td><strong>{a.usuario_nome || `ID #${a.usuario_id}`}</strong></td>
                  <td><span className="badge badge-pendente">{a.acao}</span></td>
                  <td>{a.tabela}</td>
                  <td>#{a.registro_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
