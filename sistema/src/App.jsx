import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Car, LayoutDashboard, LogOut, Users, Handshake, Wallet,
  FileText, Settings, Contact, Menu, X, PlusCircle, Building2, Globe, KeyRound, Calculator
} from 'lucide-react';
import { getUser, logout, alterarSenhaUsuario } from './store';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import Crm from './pages/Crm';
import Clientes from './pages/Clientes';
import Negociacoes from './pages/Negociacoes';
import Financeiro from './pages/Financeiro';
import Documentos from './pages/Documentos';
import Configuracoes from './pages/Configuracoes';
import IntegracaoSite from './pages/IntegracaoSite';
import SimuladorFinanciamentoModal from './components/SimuladorFinanciamentoModal';

function Shell({ user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalMinhaSenha, setModalMinhaSenha] = useState(false);
  const [modalSimulador, setModalSimulador] = useState(false);
  const [novaMinhaSenha, setNovaMinhaSenha] = useState('');
  const [salvandoMinhaSenha, setSalvandoMinhaSenha] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const handleMenuToggle = () => {
    if (window.innerWidth <= 960) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  const emailAtual = (user?.email || '').trim().toLowerCase();
  const nomeAtual = (user?.nome || '').trim().toLowerCase();
  const isAdminMaster = user?.perfil === 'admin' ||
    emailAtual === 'admin@dgautos.com.br' ||
    emailAtual === 'douglasaraujooficial@live.com' ||
    emailAtual.includes('alexan') ||
    nomeAtual.includes('alexan');

  return (
    <div className={`altimus-wrapper ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* TOPBAR FIXA PADRÃO AUTOS 360 · MOTRIZ */}
      <header className="altimus-topbar">
        <div className="altimus-topbar-left">
          <button
            type="button"
            className="altimus-menu-toggle"
            onClick={handleMenuToggle}
            title="Recolher / Expandir Menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <NavLink to="/" className="altimus-brand">
            <div className="altimus-brand-badge">
              <Car size={18} />
            </div>
            <div>
              DGAUTOS
              <small>Gestão de Veículos & CRM</small>
            </div>
          </NavLink>
        </div>

        {/* ATALHOS RÁPIDOS DE 1 CLIQUE NO TOPO */}
        <div className="altimus-topbar-center">
          <div className="altimus-shortcut-bar">
            <button
              type="button"
              className="altimus-shortcut-btn primary"
              onClick={() => navigate('/estoque?novo=1')}
            >
              <PlusCircle size={15} /> + Novo Veículo
            </button>
            <button
              type="button"
              className="altimus-shortcut-btn"
              onClick={() => navigate('/crm?novo=1')}
            >
              <Users size={15} /> + Oportunidade CRM
            </button>
            <button
              type="button"
              className="altimus-shortcut-btn"
              onClick={() => navigate('/negociacoes?novo=1')}
            >
              <Handshake size={15} /> + Nova Negociação
            </button>
            <button
              type="button"
              className="altimus-shortcut-btn"
              onClick={() => navigate('/documentos')}
            >
              <FileText size={15} /> Emitir Contrato
            </button>
            <button
              type="button"
              className="altimus-shortcut-btn"
              style={{ color: '#0284c7', fontWeight: 700 }}
              onClick={() => setModalSimulador(true)}
              title="Simulador de Financiamento & Coeficientes de Bancos com Retorno"
            >
              <Calculator size={15} /> ⚡ Simular Financiamento
            </button>
          </div>
        </div>

        <div className="altimus-topbar-right">
          <div className="altimus-store-pill">
            <Building2 size={14} style={{ color: 'var(--primary)' }} />
            <span>DG Automóveis</span>
          </div>

          <div className="altimus-user-box">
            <div className="altimus-avatar">
              {user.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ lineHeight: 1.2 }} className="hide-sm">
              <div style={{ fontWeight: 700, fontSize: '.82rem' }}>{user.nome.split(' ')[0]}</div>
              <small style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{user.cargo}</small>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => { setModalMinhaSenha(true); setNovaMinhaSenha(''); }}
              title="Alterar minha senha de acesso"
              style={{ marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <KeyRound size={13} /> Senha
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onLogout}
              title="Sair do sistema"
              style={{ marginLeft: 4 }}
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* OVERLAY MOBILE */}
      <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />

      {/* MENU LATERAL ESQUERDO */}
      <aside className={`altimus-sidebar ${mobileOpen ? 'open' : ''}`}>
        <nav className="nav">
          <div className="nav-group-label">Principal</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            <span className="nav-label">Dashboard</span>
          </NavLink>

          <div className="nav-group-label">Comercial & Pátio</div>
          <NavLink to="/estoque" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Car size={18} />
            <span className="nav-label">Estoque de Veículos</span>
          </NavLink>
          <NavLink to="/crm" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={18} />
            <span className="nav-label">CRM / Oportunidades</span>
          </NavLink>
          <NavLink to="/negociacoes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Handshake size={18} />
            <span className="nav-label">Negociações</span>
          </NavLink>
          <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Contact size={18} />
            <span className="nav-label">Clientes / Fornecedores</span>
          </NavLink>

          <div className="nav-group-label">Gestão & Fiscal</div>
          <NavLink to="/financeiro" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wallet size={18} />
            <span className="nav-label">Financeiro & DRE</span>
          </NavLink>
          <NavLink to="/documentos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={18} />
            <span className="nav-label">Minutas e Contratos</span>
          </NavLink>
          {isAdminMaster && (
            <NavLink to="/configuracoes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={18} />
              <span className="nav-label">Configurações</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer-text" style={{ padding: '12px', borderTop: '1px solid var(--border)', fontSize: '.75rem', color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)', display: 'block' }}>{user.nome}</strong>
          <span>{user.email}</span>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/estoque" element={<Estoque user={user} />} />
          <Route path="/crm" element={<Crm user={user} />} />
          <Route path="/clientes" element={<Clientes user={user} />} />
          <Route path="/negociacoes" element={<Negociacoes user={user} />} />
          <Route path="/integracao-site" element={<Navigate to="/configuracoes?tab=site" replace />} />
          <Route path="/financeiro" element={<Financeiro user={user} />} />
          <Route path="/documentos" element={<Documentos user={user} />} />
          <Route path="/configuracoes" element={isAdminMaster ? <Configuracoes user={user} /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {/* BARRA INFERIOR MOBILE */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={19} />
          <span>Início</span>
        </NavLink>
        <NavLink to="/estoque" className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}>
          <Car size={19} />
          <span>Estoque</span>
        </NavLink>
        <NavLink to="/crm" className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}>
          <Users size={19} />
          <span>CRM</span>
        </NavLink>
        <NavLink to="/negociacoes" className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}>
          <Handshake size={19} />
          <span>Vendas</span>
        </NavLink>
        <button type="button" className="mobile-nav-btn" onClick={() => setMobileOpen(true)}>
          <Menu size={19} />
          <span>Mais</span>
        </button>
      </nav>

      {modalMinhaSenha && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={18} style={{ color: 'var(--primary)' }} />
              Alterar Minha Senha
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              Olá, <strong>{user.nome}</strong> ({user.email}). Digite sua nova senha abaixo.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSalvandoMinhaSenha(true);
              try {
                await alterarSenhaUsuario(user.id || user.email, novaMinhaSenha);
                alert('✓ Sua senha foi atualizada com sucesso no banco de dados!');
                setModalMinhaSenha(false);
                setNovaMinhaSenha('');
              } catch (err) {
                alert(err.message || 'Erro ao alterar senha.');
              } finally {
                setSalvandoMinhaSenha(false);
              }
            }}>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Nova Senha</label>
                <input
                  className="input"
                  type="password"
                  autoFocus
                  required
                  minLength={4}
                  value={novaMinhaSenha}
                  onChange={(e) => setNovaMinhaSenha(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setModalMinhaSenha(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvandoMinhaSenha || !novaMinhaSenha}>
                  {salvandoMinhaSenha ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIMULADOR GLOBAL DE FINANCIAMENTO & RETORNO DE LOJA */}
      <SimuladorFinanciamentoModal
        isOpen={modalSimulador}
        onClose={() => setModalSimulador(false)}
      />
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ background: '#ffffff', padding: 32, borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,.08)', maxWidth: 480, width: '100%', border: '1px solid #e2e8f0' }}>
            <h2 style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>DG AUTOS — Carregando Painel</h2>
            <p style={{ color: '#64748b', fontSize: '.88rem', marginBottom: 20, lineHeight: 1.5 }}>
              Ocorreu uma reinicialização de sessão. Clique abaixo para atualizar o painel.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '.95rem', fontWeight: 700 }}
              onClick={() => {
                localStorage.removeItem('dgautos_sessao');
                window.location.reload();
              }}
            >
              Recarregar Painel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState(() => getUser());

  return (
    <ErrorBoundary>
      {!user ? <Login onLogin={setUser} /> : <Shell user={user} onLogout={() => { logout(); setUser(null); }} />}
    </ErrorBoundary>
  );
}
