import React from 'react';

/**
 * Rede de segurança global. Se qualquer erro de renderização/commit do React
 * escapar (ex.: removeChild NotFoundError causado por extensão/tradução do
 * navegador), mostramos uma tela de recuperação de marca em vez de deixar o
 * #root vazio (tela preta) — assim o visitante nunca fica sem saída.
 *
 * Fallback usa estilos inline e translate="no" de propósito: precisa renderizar
 * de forma confiável mesmo que o CSS não carregue ou a tradução esteja ativa.
 */
type Props = { children: React.ReactNode };
type State = { hasError: boolean };

const TEL = '47989169598'; // (47) 98916-9598 — linha da DG Automóveis

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Log para depuração; reporta ao GTM/dataLayer se existir.
    console.error('[ErrorBoundary] app crash:', error, info);
    try {
      (window as any).dataLayer?.push({ event: 'app_error', error: String(error) });
    } catch { /* noop */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        translate="no"
        className="notranslate"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: 24,
          textAlign: 'center',
          background: '#0a0a0a',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <img
          src="/logo-dg.png"
          alt="DG Automóveis"
          style={{ height: 40, width: 'auto', objectFit: 'contain', marginBottom: 4 }}
        />
        <h1 style={{ fontSize: 22, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', lineHeight: 1.1, margin: 0 }}>
          Tivemos uma instabilidade
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', maxWidth: 340, lineHeight: 1.5, margin: 0 }}>
          Recarregue a página para continuar sua avaliação — é rápido e seus dados
          não se perdem. Se preferir, fale direto com a nossa equipe de compras.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            padding: '16px 28px',
            width: '100%',
            maxWidth: 340,
            background: '#ED1C24',
            color: '#fff',
            fontWeight: 900,
            fontSize: 15,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            border: 'none',
            borderRadius: 16,
            cursor: 'pointer',
          }}
        >
          Recarregar e continuar
        </button>
        <a
          href={`tel:+55${TEL}`}
          style={{
            padding: '14px 28px',
            width: '100%',
            maxWidth: 340,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.75)',
            fontWeight: 700,
            fontSize: 14,
            textTransform: 'uppercase',
            borderRadius: 16,
            textDecoration: 'none',
          }}
        >
          Ligar: (47) 98916-9598
        </a>
      </div>
    );
  }
}
