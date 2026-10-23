import { useState } from 'react';
import { Car, Eye, EyeOff, KeyRound, MessageCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { login, recuperarSenhaAuto } from '../store';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados do Modal de Recuperação de Senha
  const [modalRecuperar, setModalRecuperar] = useState(false);
  const [recEmail, setRecEmail] = useState('');
  const [recValidacao, setRecValidacao] = useState('');
  const [recNovaSenha, setRecNovaSenha] = useState('');
  const [recErro, setRecErro] = useState('');
  const [recLoading, setRecLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setSucesso('');
    try {
      const u = await login(email, senha);
      onLogin(u);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperarSubmit = async (e) => {
    e.preventDefault();
    setRecLoading(true);
    setRecErro('');
    try {
      await recuperarSenhaAuto(recEmail, recValidacao, recNovaSenha);
      setEmail(recEmail);
      setSenha(recNovaSenha);
      setSucesso('✓ Senha redefinida com sucesso! Você já pode entrar com sua nova senha.');
      setModalRecuperar(false);
      setRecEmail('');
      setRecValidacao('');
      setRecNovaSenha('');
      alert('✓ Sua senha foi alterada com sucesso no Supabase! Faça login agora.');
    } catch (err) {
      setRecErro(err.message || 'Falha ao redefinir senha.');
    } finally {
      setRecLoading(false);
    }
  };

  const abrirWhatsappAdmin = () => {
    const alvoEmail = recEmail || email || 'meu e-mail';
    const texto = `Olá Administrador da DG Automóveis! Esqueci minha senha do sistema e preciso de redefinição de acesso para o meu e-mail: ${alvoEmail}`;
    const url = `https://wa.me/5547989169598?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
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

        {sucesso && (
          <p style={{ color: '#166534', fontSize: '.88rem', marginBottom: 14, background: '#dcfce7', padding: '10px 14px', borderRadius: 6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} /> {sucesso}
          </p>
        )}

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
            placeholder="seu@dgautos.com.br"
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
              placeholder="••••••••"
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
                color: '#6e0ad6',
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
          <button
            type="button"
            onClick={() => {
              setRecEmail(email);
              setRecErro('');
              setModalRecuperar(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '.88rem',
              cursor: 'pointer',
              padding: 0
            }}
          >
            Esqueci minha senha
          </button>
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

      {/* MODAL RECUPERAÇÃO DE SENHA */}
      {modalRecuperar && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460 }}>
            <h3 style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={20} style={{ color: 'var(--primary)' }} />
              Recuperação & Redefinição de Senha
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
              Para sua segurança, informe seu e-mail cadastrado e o dado de confirmação da revenda para redefinir sua senha imediatamente.
            </p>

            {recErro && (
              <p style={{ color: 'var(--danger)', fontSize: '.84rem', marginBottom: 14, background: 'var(--danger-soft)', padding: '8px 12px', borderRadius: 6 }}>
                {recErro}
              </p>
            )}

            <form onSubmit={handleRecuperarSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>Seu E-mail Cadastrado</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={recEmail}
                  onChange={(e) => setRecEmail(e.target.value)}
                  placeholder="Ex: alexandre@dgautos.com.br"
                />
              </div>

              <div className="field">
                <label>Confirmação de Segurança (CNPJ ou WhatsApp da Loja)</label>
                <input
                  className="input"
                  required
                  value={recValidacao}
                  onChange={(e) => setRecValidacao(e.target.value)}
                  placeholder="Ex: 35.236.994/0001-24 ou (47) 98916-9598"
                />
                <small style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                  Informe o CNPJ da loja ou número de WhatsApp cadastrado da DG Automóveis.
                </small>
              </div>

              <div className="field">
                <label>Nova Senha de Acesso</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={4}
                  value={recNovaSenha}
                  onChange={(e) => setRecNovaSenha(e.target.value)}
                  placeholder="Digite sua nova senha (mínimo 4 dígitos)"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setModalRecuperar(false)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={recLoading}
                  style={{ flex: 1.5, justifyContent: 'center' }}
                >
                  {recLoading ? 'Salvando...' : 'Redefinir Minha Senha'}
                </button>
              </div>
            </form>

            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Prefere suporte direto da diretoria?
              </p>
              <button
                type="button"
                className="btn"
                onClick={abrirWhatsappAdmin}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: '#22c55e',
                  color: '#ffffff',
                  borderColor: '#16a34a',
                  fontWeight: 600
                }}
              >
                <MessageCircle size={16} /> Solicitar via WhatsApp do Administrador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
