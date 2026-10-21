import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import BolaoPage from './components/bolao/BolaoPage.tsx';
import BolaoAdminPage from './components/bolao/BolaoAdminPage.tsx';
import TransparenciaPage from './components/bolao/TransparenciaPage.tsx';
import RadarPage from './components/bolao/RadarPage.tsx';
import VendasRapidasPage from './components/vendas/VendasRapidasPage.tsx';
import ConsignacaoPage from './components/consignacao/ConsignacaoPage.tsx';
import RepassePage from './components/repasse/RepassePage.tsx';
import RepasseAdminPage from './components/repasse/RepasseAdminPage.tsx';
import RepassePublicoPage from './components/repasse/RepassePublicoPage.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { initAttribution } from './lib/attribution.ts';
import './index.css';

import FinanciamentoPage from './components/financiamento/FinanciamentoPage.tsx';
import VenderCarroPage from './components/vendas/VenderCarroPage.tsx';
import AManosPage from './components/institucional/AManosPage.tsx';
import DuvidasPage from './components/institucional/DuvidasPage.tsx';
import ContatoPage from './components/institucional/ContatoPage.tsx';
import PoliticaPrivacidadePage from './components/institucional/PoliticaPrivacidadePage.tsx';
import NotFoundPage from './components/institucional/NotFoundPage.tsx';
import ComparatorPage from './components/tools/ComparatorPage.tsx';
import VeiculoDetailPage from './components/estoque/VeiculoDetailPage.tsx';
import HomePage from './components/home/HomePage.tsx';
import EstoquePage from './components/estoque/EstoquePage.tsx';
import HavalPresentation from './components/HavalPresentation.tsx';

import { useState, useEffect } from 'react';
import { setupInstantLinkInterceptor, navigate } from './lib/router.ts';

// Lê utm/gclid/fbclid/ttclid e o referrer antes de qualquer render, para toda
// captura de lead — inclusive as parciais — sair com a origem do anúncio junto.
initAttribution();
setupInstantLinkInterceptor();

function Router() {
  const [currentPath, setCurrentPath] = useState(
    () => window.location.pathname.replace(/\/$/, '') || '/'
  );

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.replace(/\/$/, '') || '/';
      setCurrentPath(path);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const path = currentPath;

  if (path.startsWith('/estoque/') || path.startsWith('/veiculo/')) {
    const slug = path.replace(/^\/(estoque|veiculo)\//, '');
    if (slug) {
      return <VeiculoDetailPage slug={slug} />;
    }
  }

  if (path === '/comparar') {
    return <ComparatorPage />;
  }

  if (path === '/haval-h6-gt' || path === '/haval-teste') {
    return <HavalPresentation />;
  }

  if (path === '/financiamento') {
    return <FinanciamentoPage />;
  }

  if (path === '/vender-meu-carro') {
    return <VenderCarroPage />;
  }

  if (path === '/a-dg' || path === '/a-manos') {
    return <AManosPage />;
  }

  if (path === '/duvidas') {
    return <DuvidasPage />;
  }

  if (path === '/contato') {
    return <ContatoPage />;
  }

  if (path === '/politica-de-privacidade') {
    return <PoliticaPrivacidadePage />;
  }

  if (path === '/bolao') {
    return <BolaoPage />;
  }

  if (path === '/bolao-admin-manos') {
    return <BolaoAdminPage />;
  }

  if (path === '/bolao-transparencia') {
    return <TransparenciaPage />;
  }

  if (path === '/radar-dg' || path === '/radar-manos') {
    return <RadarPage />;
  }

  if (path === '/vendasrapidas') {
    navigate('/vender-meu-carro', { replace: true });
    return null;
  }

  if (path === '/consignacao') {
    return <ConsignacaoPage />;
  }

  if (path === '/repasses-dg' || path === '/repasse-dg' || path === '/repasse-publico' || path === '/repassesmanos' || path === '/repasses-manos') {
    return <RepassePublicoPage />;
  }

  if (path === '/repasse-admin' || path === '/repasse/admin') {
    return <RepasseAdminPage />;
  }

  if (path === '/repasse' || path === '/repasses' || path === '/veiculos-repasse') {
    return <RepassePage />;
  }

  if (path === '/') {
    return <HomePage />;
  }

  if (path === '/estoque') {
    return <EstoquePage />;
  }

  if (path === '/funil') {
    return <App />;
  }

  // 404 handler for unknown routes
  return <NotFoundPage />;
}

const container = document.getElementById('root')!;
// Remove o bloco de emergência do index.html (telefone/WhatsApp/endereço) antes
// de montar. Explícito de propósito: o fallback só deve aparecer quando o React
// nunca chega a rodar.
container.innerHTML = '';

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  </StrictMode>,
);
