import { useEffect, useState } from 'react';
import {
  Globe, Copy, Check, ExternalLink, RefreshCw, Server, Send,
  FileCode, Layers, ShieldCheck, CheckCircle2, AlertCircle, ArrowUpRight, Zap
} from 'lucide-react';
import { getIntegracaoSite, saveIntegracaoSite, regerarTokenSite, getVeiculos, saveOportunidade, brl } from '../store';

export default function IntegracaoSite({ user, embedded = false }) {
  const emailAtual = (user?.email || '').trim().toLowerCase();
  const nomeAtual = (user?.nome || '').trim().toLowerCase();
  const isAuthorized = (
    user?.perfil === 'admin' ||
    emailAtual === 'admin@dgautos.com.br' ||
    emailAtual === 'douglasaraujooficial@live.com' ||
    emailAtual.includes('alexan') ||
    nomeAtual.includes('alexan')
  );

  if (!isAuthorized) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '40px auto' }}>
        <h2 style={{ color: '#ef4444', marginBottom: 12 }}>Acesso Restrito ao Administrador Alexandre</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Esta área contém links de feeds, chaves e webhooks de integração do site e portais parceiros. 
          O acesso é restrito exclusivamente ao Administrador Alexandre em Configurações.
        </p>
      </div>
    );
  }

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState('');
  const [testeResultado, setTesteResultado] = useState(null);
  const [testandoFeed, setTestandoFeed] = useState(false);
  const [testandoLead, setTestandoLead] = useState(false);
  const [msgSucesso, setMsgSucesso] = useState('');

  const carregar = async () => {
    try {
      setLoading(true);
      const res = await getIntegracaoSite();
      setDados(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const copiar = (texto, chave) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(chave);
    setTimeout(() => setCopiado(''), 2500);
  };

  const salvar = async (e) => {
    e?.preventDefault();
    try {
      setSalvando(true);
      await saveIntegracaoSite({
        token: dados.token,
        url_site: dados.url_site,
        auto_publicar_site: dados.auto_publicar_site,
      });
      setMsgSucesso('Configurações da integração salvas com sucesso!');
      setTimeout(() => setMsgSucesso(''), 3000);
      await carregar();
    } catch (err) {
      alert('Erro ao salvar configurações.');
    } finally {
      setSalvando(false);
    }
  };

  const testarFeedAgora = async () => {
    try {
      setTestandoFeed(true);
      const vs = await getVeiculos();
      const formatados = (Array.isArray(vs) ? vs : []).map((v) => ({
        id: v.id,
        marca: v.marca,
        modelo: v.modelo,
        anoModelo: v.ano || `${v.ano_fabricacao}/${v.ano_modelo}`,
        km: Number(v.km) || 0,
        placa: v.placa || '—',
        valorVenda: Number(v.preco || v.preco_venda) || 0,
        fotos: Array.isArray(v.fotos) ? v.fotos : []
      }));
      setTesteResultado({
        status: 200,
        total: formatados.length,
        veiculos: formatados.slice(0, 5),
        hora: new Date().toLocaleTimeString('pt-BR'),
      });
    } catch (err) {
      alert('Erro ao testar feed: ' + err.message);
    } finally {
      setTestandoFeed(false);
    }
  };

  const enviarLeadTeste = async () => {
    try {
      setTestandoLead(true);
      await saveOportunidade({
        nome_lead: 'Lead Teste — Site DG Automóveis',
        telefone: '(47) 98916-9598',
        email: 'cliente.teste@dgautomoveis.com.br',
        origem: 'SITE_OFICIAL',
        estagio: 'pendente',
        veiculo_interesse: 'Simulação via Site DG',
        valor_proposta: 95000,
        etiquetas: ['LEAD_SITE', 'Quente']
      });
      alert('✓ Sucesso! Lead de teste gerado com sucesso. Verifique na aba CRM / Oportunidades!');
      await carregar();
    } catch (err) {
      alert('Erro ao enviar lead: ' + err.message);
    } finally {
      setTestandoLead(false);
    }
  };

  const handleRegerarToken = async () => {
    if (!confirm('Deseja regerar o token de integração? Você precisará atualizar a URL no site DG.')) return;
    try {
      const res = await regerarTokenSite();
      setDados({ ...dados, token: res.token });
      alert('Novo token gerado: ' + res.token);
      await carregar();
    } catch {
      alert('Erro ao regerar token.');
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: 30 }}>Carregando dados da integração...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* CABEÇALHO */}
      {!embedded ? (
        <header className="topbar">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Globe size={24} style={{ color: 'var(--primary)' }} /> Integração com Site Oficial & Portais
            </h1>
            <p>
              Gere o feed de estoque em tempo real (JSON / XML) no mesmo padrão da Altimus para abastecer o site <strong>DG Automóveis</strong> e portais parceiros.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="button" className="btn" onClick={carregar} title="Recarregar">
              <RefreshCw size={15} /> Atualizar
            </button>
            <a
              href={dados.url_site}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              <ExternalLink size={15} /> Acessar Site Oficial
            </a>
          </div>
        </header>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
            Configurações e URLs de integração com o site oficial e portais externos — acesso exclusivo de <strong>Admin Alexandre</strong>.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={carregar} title="Recarregar">
              <RefreshCw size={14} /> Atualizar
            </button>
            <a href={dados.url_site} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
              <ExternalLink size={14} /> Acessar Site Oficial
            </a>
          </div>
        </div>
      )}

      {msgSucesso && (
        <div style={{ background: '#dcfce7', color: '#15803d', padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #bbf7d0', fontWeight: 600 }}>
          <CheckCircle2 size={18} /> {msgSucesso}
        </div>
      )}

      {/* CARDS INDICADORES */}
      <section className="stats">
        <div className="stat-card">
          <div className="stat-label">Veículos no Pátio</div>
          <div className="stat-val">{dados.total_veiculos}</div>
          <div className="stat-desc">Cadastrados no estoque da loja</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Publicados no Site Oficial</div>
          <div className="stat-val" style={{ color: 'var(--success)' }}>{dados.publicados_site}</div>
          <div className="stat-desc">Disponíveis no feed JSON / XML</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Em Destaque na Home</div>
          <div className="stat-val" style={{ color: 'var(--primary)' }}>{dados.destaques_site}</div>
          <div className="stat-desc">Vitrine e carrossel principal</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leads Recebidos do Site</div>
          <div className="stat-val" style={{ color: '#0284c7' }}>{dados.leads_site_total}</div>
          <div className="stat-desc">Integrados no CRM DGAUTOS</div>
        </div>
      </section>

      {/* LINKS OFICIAIS DO FEED (PADRÃO ALTIMUS) */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={20} /> Links do Feed em Tempo Real (Padrão Oficial)
            </h2>
            <small style={{ color: 'var(--muted)' }}>
              Compatível 100% com o formato esperado pelo site DG (substitui a URL antiga da Altimus).
            </small>
          </div>
          <button type="button" className="btn btn-sm" onClick={testarFeedAgora} disabled={testandoFeed}>
            <Server size={14} /> {testandoFeed ? 'Testando...' : 'Testar Resposta do Feed'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* LINK JSON */}
          <div style={{ background: 'var(--color-neutral-80)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: '.88rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileCode size={16} style={{ color: 'var(--primary)' }} /> Link JSON Oficial (estoquejson)
              </strong>
              <span className="badge badge-disponivel">Ativo · Atualização Instantânea</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                readOnly
                value={dados.feed_json_url}
                style={{ background: '#ffffff', fontFamily: 'monospace', fontSize: '.84rem', color: '#0f172a' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => copiar(dados.feed_json_url, 'json')}
                title="Copiar link JSON"
              >
                {copiado === 'json' ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiado === 'json' ? 'Copiado!' : 'Copiar'}</span>
              </button>
              <a
                href={dados.feed_json_url}
                target="_blank"
                rel="noreferrer"
                className="btn"
                title="Abrir no navegador"
              >
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          {/* LINK XML */}
          <div style={{ background: 'var(--color-neutral-80)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: '.88rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={16} style={{ color: '#0284c7' }} /> Link XML Oficial (estoquexml para Portais e Meta)
              </strong>
              <span className="badge">Padrão XML UTF-8</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                readOnly
                value={dados.feed_xml_url}
                style={{ background: '#ffffff', fontFamily: 'monospace', fontSize: '.84rem', color: '#0f172a' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => copiar(dados.feed_xml_url, 'xml')}
                title="Copiar link XML"
              >
                {copiado === 'xml' ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiado === 'xml' ? 'Copiado!' : 'Copiar'}</span>
              </button>
              <a
                href={dados.feed_xml_url}
                target="_blank"
                rel="noreferrer"
                className="btn"
                title="Abrir no navegador"
              >
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          {/* WEBHOOK LEADS */}
          <div style={{ background: 'var(--color-neutral-80)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: '.88rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={16} style={{ color: 'var(--success)' }} /> Webhook de Captura de Leads (Site DG ➔ CRM DGAUTOS)
              </strong>
              <span className="badge badge-reservado">Inbound Leads</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                readOnly
                value={dados.webhook_leads_url}
                style={{ background: '#ffffff', fontFamily: 'monospace', fontSize: '.84rem', color: '#0f172a' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => copiar(dados.webhook_leads_url, 'lead')}
                title="Copiar webhook"
              >
                {copiado === 'lead' ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiado === 'lead' ? 'Copiado!' : 'Copiar'}</span>
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={enviarLeadTeste}
                disabled={testandoLead}
                title="Enviar lead de teste para o CRM"
              >
                {testandoLead ? 'Enviando...' : 'Disparar Lead Teste'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTADO DO TESTE DO FEED (SE EXECUTADO) */}
      {testeResultado && (
        <div className="card" style={{ padding: 18, borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} /> Teste Realizado com Sucesso às {testeResultado.hora}
            </h3>
            <span className="badge badge-disponivel">{testeResultado.total} veículos retornados</span>
          </div>
          <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: 12 }}>
            Abaixo estão os primeiros veículos que o site DG Automóveis está recebendo da API em tempo real:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {testeResultado.veiculos.map((v) => (
              <div key={v.id} style={{ display: 'flex', gap: 12, background: 'var(--color-neutral-80)', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                <img
                  src={v.fotos?.[0] || '/logo-dg.png'}
                  alt={v.modelo}
                  style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, background: '#cbd5e1' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ fontWeight: 700, fontSize: '.88rem' }}>{v.marca} {v.modelo}</div>
                  <small style={{ color: 'var(--muted)', display: 'block' }}>{v.anoModelo} · {v.km?.toLocaleString('pt-BR')} km · Placa: {v.placa}</small>
                  <strong style={{ color: 'var(--success)', fontSize: '.9rem' }}>{brl(v.valorVenda)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GUIA DE CONEXÃO COM A PASTA D:\Site douglas */}
      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server size={18} /> Como Conectar o Site DG Automóveis (Pasta D:\Site douglas)
        </h3>
        <p style={{ fontSize: '.9rem', color: 'var(--muted)', marginBottom: 16 }}>
          O site DG está configurado na pasta <code>D:\Site douglas</code> para ler a variável de ambiente <code>DG_FEED_URL</code>. Siga os 2 passos rápidos para colocar o estoque no ar:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>
              1. Configuração do Feed no Site (.env)
            </div>
            <p style={{ fontSize: '.84rem', color: '#475569', marginBottom: 10 }}>
              No arquivo <code>D:\Site douglas\.env</code>, atualize a linha do feed:
            </p>
            <pre style={{ background: '#1e293b', color: '#f8fafc', padding: 12, borderRadius: 6, fontSize: '.8rem', overflowX: 'auto' }}>
{`DG_FEED_URL="${dados.feed_json_url}"`}
            </pre>
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => copiar(`DG_FEED_URL="${dados.feed_json_url}"`, 'env')}
            >
              {copiado === 'env' ? 'Copiado!' : 'Copiar Linha .env'}
            </button>
          </div>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>
              2. Entrega Automática de Leads no CRM
            </div>
            <p style={{ fontSize: '.84rem', color: '#475569', marginBottom: 10 }}>
              Todos os formulários do site DG (Compra, Venda de Usados, Financiamento e Chat do Consultor) agora caem diretamente na sua tela de CRM:
            </p>
            <ul style={{ fontSize: '.82rem', color: '#334155', paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Notificação instantânea para os vendedores cadastrados.</li>
              <li>Etiqueta automática <code>LEAD_SITE</code> para mensurar conversão.</li>
              <li>Histórico do veículo que o cliente estava visualizando no momento.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE CONFIGURAÇÕES AVANÇADAS */}
      <form onSubmit={salvar} className="card" style={{ padding: 22 }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 16 }}>
          Configurações da Loja & Token de Segurança
        </h3>

        <div className="form-grid">
          <div className="field span-2">
            <label>Token Secreto do Feed (Parâmetro ?estoque=...)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={dados.token ?? ''}
                onChange={(e) => setDados({ ...dados, token: e.target.value })}
                required
                style={{ fontFamily: 'monospace' }}
              />
              <button type="button" className="btn btn-sm" onClick={handleRegerarToken} title="Gerar novo UUID">
                Regerar
              </button>
            </div>
            <small style={{ color: 'var(--muted)' }}>Mesmo token utilizado anteriormente no link da Altimus.</small>
          </div>

          <div className="field">
            <label>URL Oficial do Site</label>
            <input
              className="input"
              value={dados.url_site ?? ''}
              onChange={(e) => setDados({ ...dados, url_site: e.target.value })}
              placeholder="https://dgautomoveis.com.br"
            />
            <small style={{ color: 'var(--muted)' }}>Domínio onde o site está publicado.</small>
          </div>

          <div className="field span-3">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                checked={dados.auto_publicar_site !== false}
                onChange={(e) => setDados({ ...dados, auto_publicar_site: e.target.checked })}
              />
              <span>Publicar novos veículos cadastrados automaticamente no site oficial</span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : '✓ Salvar Configurações da Integração'}
          </button>
        </div>
      </form>
    </div>
  );
}
