import { useState } from 'react';
import { Car, Eye, EyeOff } from 'lucide-react';
import { login } from '../store';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const u = await login(email, senha);
      onLogin(u);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div className="altimus-brand-badge" style={{ width: 42, height: 42, borderRadius: 10 }}>
            <Car size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>
              DGAUTOS
            </div>
            <small style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Gestão Integrada para Revendas</small>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '.9rem', fontWeight: 600, color: '#1a1d23' }}>E-mail</label>
          <input
            id="login-email"
            className="input"
            style={{ background: '#e8f0fe', borderColor: '#1a1d23', padding: '11px 14px', fontSize: '.95rem' }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field" style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '.9rem', fontWeight: 600, color: '#1a1d23' }}>Senha</label>
          <div style={{ position: 'relative' }}>
            <input
              id="login-senha"
              className="input"
              style={{ background: '#e8f0fe', borderColor: '#6c757d', padding: '11px 42px 11px 14px', fontSize: '.95rem' }}
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                color: '#8ce563',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center'
              }}
              title="Mostrar / ocultar senha"
            >
              {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {erro && (
          <p style={{ color: 'var(--danger)', fontSize: '.84rem', marginBottom: 14, background: 'var(--danger-soft)', padding: '8px 12px', borderRadius: 6 }}>
            {erro}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '.88rem', cursor: 'pointer' }}>
            Esqueci minha senha
          </span>
          <button
            id="login-entrar"
            className="btn btn-primary"
            style={{ padding: '10px 28px', fontSize: '.95rem', borderRadius: 8 }}
            disabled={loading}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
