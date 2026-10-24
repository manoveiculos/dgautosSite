import { useEffect, useState } from 'react';
import {
  Building2, Users, ShieldCheck, Plus, Trash2, Save, Loader2, KeyRound,
  Landmark, DollarSign, Wallet, Phone, Mail, CheckCircle2
} from 'lucide-react';
import {
  getConfig, saveConfigLoja, createUsuario, updateUsuario, deleteUsuario, alterarSenhaUsuario,
  getContasBancarias, saveContaBancaria, deleteContaBancaria,
  getFinanceiras, saveFinanceira, deleteFinanceira
} from '../store';
import { mascaraMoeda, desformatarMoeda, mascaraTelefone } from '../utils/mascaras';

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

  const [aba, setAba] = useState('loja'); // loja | contas | financeiras | usuarios | auditoria
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
  const [usuarioEditandoSenha, setUsuarioEditandoSenha] = useState(null);
  const [novaSenhaInput, setNovaSenhaInput] = useState('');
  const [loadingAcao, setLoadingAcao] = useState('');
  const [msg, setMsg] = useState('');

  // CONTAS BANCÁRIAS E CAIXAS FÍSICOS
  const [contas, setContas] = useState([]);
  const [novaConta, setNovaConta] = useState({
    nome: '',
    tipo: 'banco',
    banco: 'Itaú',
    agencia: '',
    conta: '',
    titular: 'DG AUTOMÓVEIS',
    saldo_inicial: ''
  });

  // FINANCEIRAS DE FINANCIAMENTO
  const [financeiras, setFinanceiras] = useState([]);
  const [novaFin, setNovaFin] = useState({
    nome: '',
    operador: '',
    telefone: '',
    email: '',
    retorno_padrao: '2.0%'
  });

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

    setContas(getContasBancarias());
    setFinanceiras(getFinanceiras());
  };
  useEffect(recarregar, []);

  const handleSalvarConta = (e) => {
    e.preventDefault();
    if (!novaConta.nome.trim()) return;
    const atualizadas = saveContaBancaria({
      ...novaConta,
      saldo_inicial: desformatarMoeda(novaConta.saldo_inicial)
    });
    setContas(atualizadas);
    setNovaConta({ nome: '', tipo: 'banco', banco: 'Itaú', agencia: '', conta: '', titular: 'DG AUTOMÓVEIS', saldo_inicial: '' });
    setMsg('✓ Conta cadastrada com sucesso!');
    setTimeout(() => setMsg(''), 4000);
  };

  const handleExcluirConta = (id, nome) => {
    if (!confirm(`Deseja remover a conta/caixa "${nome}"?`)) return;
    const atualizadas = deleteContaBancaria(id);
    setContas(atualizadas);
    setMsg(`✓ Conta "${nome}" removida.`);
    setTimeout(() => setMsg(''), 4000);
  };

  const handleSalvarFinanceira = (e) => {
    e.preventDefault();
    if (!novaFin.nome.trim()) return;
    const atualizadas = saveFinanceira(novaFin);
    setFinanceiras(atualizadas);
    setNovaFin({ nome: '', operador: '', telefone: '', email: '', retorno_padrao: '2.0%' });
    setMsg('✓ Financeira cadastrada com sucesso!');
    setTimeout(() => setMsg(''), 4000);
  };

  const handleExcluirFinanceira = (id, nome) => {
    if (!confirm(`Deseja remover a financeira "${nome}"?`)) return;
    const atualizadas = deleteFinanceira(id);
    setFinanceiras(atualizadas);
    setMsg(`✓ Financeira "${nome}" removida.`);
    setTimeout(() => setMsg(''), 4000);
  };

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

  const handleSalvarSenhaUsuario = async (e) => {
    e.preventDefault();
    if (!usuarioEditandoSenha) return;
    setLoadingAcao(`Atualizando senha de ${usuarioEditandoSenha.nome}...`);
    try {
      await alterarSenhaUsuario(usuarioEditandoSenha.id, novaSenhaInput);
      setMsg(`✓ Senha de ${usuarioEditandoSenha.nome} alterada com sucesso!`);
      alert(`✓ Senha de ${usuarioEditandoSenha.nome} alterada com sucesso no Supabase!`);
      setUsuarioEditandoSenha(null);
      setNovaSenhaInput('');
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Erro ao alterar senha');
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
          <p>Dados da revenda, contas bancárias, financeiras parceiras, equipe e auditoria.</p>
        </div>
        <div className="tabs">
          <button className={`tab ${aba === 'loja' ? 'active' : ''}`} onClick={() => setAba('loja')}>
            <Building2 size={15} />Dados da Revenda
          </button>
          <button className={`tab ${aba === 'contas' ? 'active' : ''}`} onClick={() => setAba('contas')}>
            <Landmark size={15} />Contas & Caixas Físicos
          </button>
          <button className={`tab ${aba === 'financeiras' ? 'active' : ''}`} onClick={() => setAba('financeiras')}>
            <DollarSign size={15} />Financeiras & Financiamento
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

      {/* ABA: CONTAS BANCÁRIAS E CAIXAS FÍSICOS */}
      {aba === 'contas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {msg && <div style={{ color: 'var(--success)', fontWeight: 700, background: '#ecfdf5', padding: '10px 16px', borderRadius: 8, border: '1px solid #10b981' }}>{msg}</div>}

          <div className="card table-wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0 }}>Contas Bancárias e Caixas Cadastrados ({contas.length})</h3>
                <small style={{ color: 'var(--muted)' }}>Disponíveis para lançamentos financeiros, recebimentos e controle de fluxo</small>
              </div>
            </div>

            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Nome da Conta / Caixa</th>
                  <th>Tipo</th>
                  <th>Banco / Instituição</th>
                  <th>Agência</th>
                  <th>Conta Corrente</th>
                  <th>Titular</th>
                  <th style={{ textAlign: 'center', width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.nome}</strong>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: c.tipo === 'caixa' ? '#fef3c7' : '#ede9fe',
                        color: c.tipo === 'caixa' ? '#92400e' : '#6d28d9',
                        fontWeight: 700
                      }}>
                        {c.tipo === 'caixa' ? '💵 Caixa Físico' : '🏦 Conta Bancária'}
                      </span>
                    </td>
                    <td>{c.banco || (c.tipo === 'caixa' ? 'Interno Loja' : '—')}</td>
                    <td>{c.agencia || '—'}</td>
                    <td>{c.conta || '—'}</td>
                    <td>{c.titular || 'DG AUTOMÓVEIS'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        title={`Remover conta ${c.nome}`}
                        onClick={() => handleExcluirConta(c.id, c.nome)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FORMULÁRIO PARA CADASTRAR NOVA CONTA OU CAIXA */}
          <form className="card" onSubmit={handleSalvarConta}>
            <h3 style={{ margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} style={{ color: '#7c3aed' }} />
              + Cadastrar Nova Conta Bancária ou Caixa Físico
            </h3>
            <div className="form-grid">
              <div className="field span-2">
                <label>Nome Identificador da Conta / Caixa *</label>
                <input
                  className="input"
                  required
                  placeholder="Ex: BANCO SANTANDER EMPRESAS ou CAIXA GAVETA 01"
                  value={novaConta.nome}
                  onChange={(e) => setNovaConta({ ...novaConta, nome: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="field">
                <label>Tipo de Conta</label>
                <select
                  className="select"
                  value={novaConta.tipo}
                  onChange={(e) => setNovaConta({ ...novaConta, tipo: e.target.value })}
                >
                  <option value="banco">🏦 Conta Bancária (Banco)</option>
                  <option value="caixa">💵 Caixa Físico (Loja / Gaveta / Cofre)</option>
                </select>
              </div>

              <div className="field">
                <label>Instituição / Banco</label>
                <input
                  className="input"
                  placeholder="Ex: 033 - Santander ou Caixa Loja"
                  value={novaConta.banco}
                  onChange={(e) => setNovaConta({ ...novaConta, banco: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="field">
                <label>Agência</label>
                <input
                  className="input"
                  placeholder="0000"
                  value={novaConta.agencia}
                  onChange={(e) => setNovaConta({ ...novaConta, agencia: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="field">
                <label>Número da Conta</label>
                <input
                  className="input"
                  placeholder="00000-0"
                  value={novaConta.conta}
                  onChange={(e) => setNovaConta({ ...novaConta, conta: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="field span-2">
                <label>Titular da Conta</label>
                <input
                  className="input"
                  value={novaConta.titular}
                  onChange={(e) => setNovaConta({ ...novaConta, titular: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn btn-primary" style={{ background: '#5d35b0', color: '#fff', fontWeight: 700, padding: '0 24px' }}>
                <Save size={16} /> Salvar Nova Conta
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ABA: FINANCEIRAS E BANCOS DE FINANCIAMENTO */}
      {aba === 'financeiras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {msg && <div style={{ color: 'var(--success)', fontWeight: 700, background: '#ecfdf5', padding: '10px 16px', borderRadius: 8, border: '1px solid #10b981' }}>{msg}</div>}

          <div className="card table-wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0 }}>Financeiras Parceiras Homologadas ({financeiras.length})</h3>
                <small style={{ color: 'var(--muted)' }}>Instituições financeiras que operam aprovação de crédito e financiamentos de veículos</small>
              </div>
            </div>

            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Financeira / Banco</th>
                  <th>Operador / Contato</th>
                  <th>Telefone / WhatsApp</th>
                  <th>E-mail de Retorno</th>
                  <th>Retorno Padrão</th>
                  <th style={{ textAlign: 'center', width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {financeiras.map((fin) => (
                  <tr key={fin.id}>
                    <td>
                      <strong>{fin.nome}</strong>
                    </td>
                    <td>{fin.operador || '—'}</td>
                    <td>{fin.telefone || '—'}</td>
                    <td>{fin.email || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: '#ecfdf5', color: '#065f46', fontWeight: 700 }}>
                        {fin.retorno_padrao || '2.0%'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        title={`Remover financeira ${fin.nome}`}
                        onClick={() => handleExcluirFinanceira(fin.id, fin.nome)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FORMULÁRIO PARA CADASTRAR NOVA FINANCEIRA */}
          <form className="card" onSubmit={handleSalvarFinanceira}>
            <h3 style={{ margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} style={{ color: '#7c3aed' }} />
              + Cadastrar Nova Financeira de Financiamento
            </h3>
            <div className="form-grid">
              <div className="field span-2">
                <label>Nome da Financeira / Banco *</label>
                <input
                  className="input"
                  required
                  placeholder="Ex: BANCO DAYCOVAL ou CREDIAL FINANCIAMENTOS"
                  value={novaFin.nome}
                  onChange={(e) => setNovaFin({ ...novaFin, nome: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="field">
                <label>Nome do Operador / Gerente de Conta</label>
                <input
                  className="input"
                  placeholder="Ex: MARCOS SANTOS"
                  value={novaFin.operador}
                  onChange={(e) => setNovaFin({ ...novaFin, operador: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="field">
                <label>Telefone / WhatsApp do Operador</label>
                <input
                  className="input"
                  placeholder="(47) 90000-0000"
                  value={novaFin.telefone}
                  onChange={(e) => setNovaFin({ ...novaFin, telefone: mascaraTelefone(e.target.value) })}
                />
              </div>

              <div className="field span-2">
                <label>E-mail para Envio de Contratos e Retorno</label>
                <input
                  type="email"
                  className="input"
                  style={{ textTransform: 'none' }}
                  placeholder="operador@financeira.com.br"
                  value={novaFin.email}
                  onChange={(e) => setNovaFin({ ...novaFin, email: e.target.value.toLowerCase().trim() })}
                />
              </div>

              <div className="field">
                <label>Retorno / Comissão Padrão</label>
                <input
                  className="input"
                  placeholder="Ex: 2.5%"
                  value={novaFin.retorno_padrao}
                  onChange={(e) => setNovaFin({ ...novaFin, retorno_padrao: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn btn-primary" style={{ background: '#5d35b0', color: '#fff', fontWeight: 700, padding: '0 24px' }}>
                <Save size={16} /> Salvar Financeira
              </button>
            </div>
          </form>
        </div>
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
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          title={`Alterar senha de ${u.nome}`}
                          disabled={Boolean(loadingAcao)}
                          onClick={() => {
                            setUsuarioEditandoSenha(u);
                            setNovaSenhaInput('');
                          }}
                          style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <KeyRound size={13} /> Senha
                        </button>
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
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '0 4px' }}>PADRÃO</span>
                        )}
                      </div>
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

      {usuarioEditandoSenha && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={18} style={{ color: 'var(--primary)' }} />
              Alterar Senha do Usuário
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              Defina a nova senha para <strong>{usuarioEditandoSenha.nome}</strong> ({usuarioEditandoSenha.email}).
            </p>
            <form onSubmit={handleSalvarSenhaUsuario}>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Nova Senha</label>
                <input
                  className="input"
                  type="password"
                  autoFocus
                  required
                  minLength={4}
                  value={novaSenhaInput}
                  onChange={(e) => setNovaSenhaInput(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setUsuarioEditandoSenha(null);
                    setNovaSenhaInput('');
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={Boolean(loadingAcao) || !novaSenhaInput}>
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
