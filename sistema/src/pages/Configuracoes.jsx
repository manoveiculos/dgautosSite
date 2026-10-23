import { useEffect, useState } from 'react';
import { Building2, Users, ShieldCheck, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { getConfig, saveConfigLoja, createUsuario, updateUsuario, deleteUsuario } from '../store';

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
    cnpj: '35.236.994/0001-24',
    telefone: '(47) 98916-9598',
    whatsapp: '(47) 98916-9598',
    email: 'contato@dgautomoveis.com.br',
    site_url: 'https://dgautos-site.vercel.app',
    endereco: 'Rua Dom Pedro II, 461 - Canoas',
    cidade: 'Rio do Sul',
    uf: 'SC',
    cep: '89164-138',
    termos_garantia: 'Garantia legal de 90 (noventa) dias para motor e câmbio, conforme Art. 26 do Código de Defesa do Consumidor.'
  });
  const [usuarios, setUsuarios] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', senha: '', perfil: 'vendedor' });
  const [loadingAcao, setLoadingAcao] = useState('');
  const [msg, setMsg] = useState('');

  const recarregar = () => {
    setLoadingAcao('Carregando dados...');
    getConfig().then((c) => {
      if (c?.loja) setLoja(c.loja);
      setUsuarios(Array.isArray(c?.usuarios) ? c.usuarios : []);
      setAuditoria(Array.isArray(c?.auditoria) ? c.auditoria : []);
    }).catch((err) => {
      console.warn('Erro ao carregar configurações:', err);
    }).finally(() => {
      setLoadingAcao('');
    });
  };
  useEffect(recarregar, []);

  const salvarLoja = async (e) => {
    e.preventDefault();
    setLoadingAcao('Salvando dados da revenda no Supabase...');
    try {
      const atualizada = await saveConfigLoja(loja);
      setLoja(atualizada);
      setMsg('Dados da revenda salvos com sucesso!');
      alert('✓ Dados da revenda salvos com sucesso no Supabase!');
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Erro ao salvar dados');
    } finally {
      setLoadingAcao('');
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    setLoadingAcao(`Cadastrando usuário ${novoUser.nome}...`);
    try {
      const lista = await createUsuario(novoUser);
      setUsuarios(lista);
      setNovoUser({ nome: '', email: '', senha: '', perfil: 'vendedor' });
      setMsg('Usuário cadastrado com sucesso!');
      setTimeout(() => setMsg(''), 4000);
      alert('✓ Usuário cadastrado com sucesso no Supabase!');
    } catch (err) {
      alert(err.message || 'Erro ao cadastrar usuário');
    } finally {
      setLoadingAcao('');
    }
  };

  const handleMudarPerfil = async (id, novoPerfil, nome) => {
    setLoadingAcao(`Atualizando poderes de ${nome}...`);
    try {
      const lista = await updateUsuario(id, { perfil: novoPerfil });
      setUsuarios(lista);
      setMsg(`Poderes de ${nome} atualizados para ${novoPerfil.toUpperCase()}!`);
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Erro ao atualizar poderes');
    } finally {
      setLoadingAcao('');
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.email === 'admin@dgautos.com.br') {
      alert('O administrador geral principal não pode ser excluído.');
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir o usuário ${u.nome} (${u.email})?`)) return;
    setLoadingAcao(`Excluindo usuário ${u.nome}...`);
    try {
      const lista = await deleteUsuario(u.id);
      setUsuarios(lista);
      setMsg(`Usuário ${u.nome} removido.`);
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Erro ao remover usuário');
    } finally {
      setLoadingAcao('');
    }
  };

  return (
    <>
      {/* Aviso global de carregamento na tela para operações */}
      {loadingAcao && (
        <div className="loading-toast">
          <div className="spinner-sm" />
          <span>{loadingAcao}</span>
        </div>
      )}

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
            <button type="submit" className="btn btn-primary" disabled={Boolean(loadingAcao)}>
              {loadingAcao ? (
                <>
                  <div className="spinner-sm" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Salvar Dados da Loja</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {aba === 'usuarios' && (
        <div className="grid-2">
          <div className="card table-wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Equipe & Permissões ({usuarios.length})</h3>
              {msg && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 500 }}>{msg}</span>}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Poderes / Perfil</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.nome}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="select"
                        style={{ padding: '4px 8px', fontSize: 13, height: 32, minWidth: 150 }}
                        value={u.perfil || 'vendedor'}
                        disabled={Boolean(loadingAcao) || u.email === 'admin@dgautos.com.br'}
                        onChange={(e) => handleMudarPerfil(u.id, e.target.value, u.nome)}
                      >
                        <option value="vendedor">Vendedor (CRM, Estoque)</option>
                        <option value="financeiro">Financeiro</option>
                        <option value="gerente">Gerente</option>
                        <option value="admin">Administrador Geral</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {u.email !== 'admin@dgautos.com.br' ? (
                        <button
                          className="btn btn-sm btn-danger"
                          title="Excluir este usuário"
                          disabled={Boolean(loadingAcao)}
                          onClick={() => handleDeleteUser(u)}
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>PADRÃO</span>
                      )}
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
              <input className="input" required value={novoUser.nome} onChange={(e) => setNovoUser({ ...novoUser, nome: e.target.value })} placeholder="Ex: Lucas Silva" />
            </div>
            <div className="field">
              <label>E-mail de Acesso</label>
              <input className="input" type="email" required value={novoUser.email} onChange={(e) => setNovoUser({ ...novoUser, email: e.target.value })} placeholder="lucas@dgautos.com.br" />
            </div>
            <div className="field">
              <label>Senha Inicial</label>
              <input className="input" type="password" required value={novoUser.senha} onChange={(e) => setNovoUser({ ...novoUser, senha: e.target.value })} placeholder="••••••••" />
            </div>
            <div className="field">
              <label>Perfil de Permissão (Poderes)</label>
              <select className="select" value={novoUser.perfil} onChange={(e) => setNovoUser({ ...novoUser, perfil: e.target.value })}>
                <option value="vendedor">Vendedor (CRM, Estoque, Negociações)</option>
                <option value="financeiro">Financeiro (Caixa, Despesas, Relatórios)</option>
                <option value="gerente">Gerente (Acesso total exceto configs de sistema)</option>
                <option value="admin">Administrador Geral (Acesso irrestrito)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={Boolean(loadingAcao)} style={{ justifyContent: 'center', marginTop: 6 }}>
              {loadingAcao ? (
                <>
                  <div className="spinner-sm" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Cadastrar Usuário</span>
                </>
              )}
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
