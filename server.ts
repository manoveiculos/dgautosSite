
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  SITE_URL,
  getVehicles,
  renderCatalog,
  renderVehicle,
  renderAbout,
  renderFAQ,
  renderPrivacy,
  renderLlms,
  renderSitemap,
  renderRobots,
  renderSold,
  findBySlug,
  findSimilar,
  aplicarFiltro,
} from "./server/catalog";
import { radarMiddleware } from "./server/radar";
import { calcularScore, acaoRecomendada } from "./server/scoring";
import fs, { readFileSync } from "fs";
import motrizBackendApp from "./backend/server.js";
import { enviarEventoCapi, capiConfigurado, PIXEL_ID, PIXEL_PADRAO } from "./server/meta";
import {
  syncCatalogMapping,
  mapeamentoConfigurado,
  contentIdParaVenda,
} from "./server/catalogSync";
import { enviarEventoOpenAiAds, openAiAdsConfigurado } from "./server/openaiAds";
import { registrarScore, lerScores, diagnosticoScores } from "./server/leadStats";
import { renderLeadsPanel } from "./server/leadsPanel";
import { basicAuth } from "./server/auth";
import { digitosNacionais } from "./server/telefone";
import { montarProdutos, produtosParaParquet } from "./server/openaiFeed";
import {
  montarProdutos as montarProdutosMeta,
  montarVeiculos as montarVeiculosMeta,
  produtosParaCsv,
  veiculosParaCsv,
} from "./server/metaFeed";
import { processConsultorMessage } from "./server/consultor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// OTP (WhatsApp verification code) store.
// The code is generated and verified server-side only — it is never sent to
// the browser — so only the code delivered via WhatsApp can be used to enter.
// In-memory: codes are cleared on restart and assume a single server instance.
// ---------------------------------------------------------------------------
type OtpEntry = { code: string; expiresAt: number; attempts: number };
const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

// Mesma normalização usada no score e no Meta CAPI (server/telefone.ts), para
// os três não divergirem sobre o que é código de país e o que é DDD.
const normalizePhone = digitosNacionais;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

/**
 * Evento de lead QUALIFICADO para a Meta.
 *
 * A otimização "leads de conversão" precisa de um evento que separe lead bom de
 * lead qualquer — sem ele a campanha só sabe contar formulário preenchido e
 * aprende a buscar volume. O site já calcula essa distinção em
 * server/scoring.ts; aqui ela vira sinal para a plataforma.
 *
 * Só faixa `quente` (nota >= 70) conta. Mandar morno junto diluiria o sinal até
 * ele virar sinônimo de `Lead` e a otimização não teria o que aprender.
 *
 * `event_id` derivado do id do Lead: nome de evento diferente já basta para a
 * Meta não deduplicar um contra o outro, e derivar mantém os dois rastreáveis
 * até a mesma pessoa.
 */
function enviarLeadQualificado(
  qualificacao: { faixa: string; score: number },
  base: Parameters<typeof enviarEventoCapi>[0],
): void {
  if (qualificacao.faixa !== "quente") return;
  void enviarEventoCapi({
    ...base,
    eventName: "QualifiedLead",
    eventId: `${base.eventId}-qualified`,
  });
}

/**
 * Dataset que ficou gravado no build do funil.
 *
 * O funil resolve o id no build (VITE_META_PIXEL_ID) e o servidor em tempo de
 * execução (META_PIXEL_ID). Definir só uma das duas deixa o funil medindo num
 * conjunto de dados e o catálogo em outro — sem erro, sem sintoma na tela, e a
 * conta só não fecha semanas depois. Por isso o health compara os dois.
 *
 * Lido uma vez e guardado: o arquivo só muda quando há nova publicação, que
 * reinicia o processo de qualquer forma.
 */
let pixelDoFunilCache: string | null | undefined;
function pixelDoFunil(): string | null {
  if (pixelDoFunilCache !== undefined) return pixelDoFunilCache;
  try {
    const html = readFileSync(path.join(__dirname, "dist", "index.html"), "utf8");
    const achado = html.match(/name="manos:meta-pixel"\s+content="([^"]*)"/);
    const valor = achado?.[1] ?? "";
    // Marcador não substituído (começa com "%") ou vazio: o funil caiu no padrão.
    pixelDoFunilCache = !valor || valor.charAt(0) === "%" ? PIXEL_PADRAO : valor;
  } catch {
    pixelDoFunilCache = null; // sem build (desenvolvimento)
  }
  return pixelDoFunilCache;
}

/**
 * Requisição veio de ambiente de desenvolvimento?
 *
 * O pixel do navegador já tem a mesma guarda (index.html), mas os envios
 * server-side precisam da sua: em desenvolvimento o `.env` da máquina costuma
 * ter os tokens de produção, e um lead de teste viraria conversão real no
 * Gerenciador de Eventos.
 *
 * A checagem é pelo Host da requisição, não por NODE_ENV: a hospedagem não
 * garante essa variável, e um NODE_ENV ausente em produção desligaria a
 * medição inteira sem ninguém perceber. O domínio real nunca é localhost.
 */
function ambienteDeTeste(req: express.Request): boolean {
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local")
  );
}

/** Lê um cookie do cabeçalho cru — evita uma dependência só para isto. */
function lerCookie(req: express.Request, nome: string): string | undefined {
  const cru = req.headers.cookie;
  if (!cru) return undefined;
  for (const parte of cru.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) {
      return decodeURIComponent(parte.slice(i + 1).trim()) || undefined;
    }
  }
  return undefined;
}

/**
 * Cookies `_fbp` e `_fbc`, que o pixel da Meta grava no navegador.
 *
 * São o sinal de correspondência mais forte que existe para evento de web —
 * bem mais que telefone e cidade, que dependem de a pessoa ter os mesmos dados
 * cadastrados na Meta. O código já sabia enviá-los, mas ninguém os lia: os
 * eventos saíam com correspondência pior do que a disponível.
 *
 * Quando o `_fbc` ainda não existe (primeira visita: o clique chegou mas o
 * pixel não gravou o cookie a tempo), ele é montado a partir do `fbclid` que a
 * atribuição capturou, no formato que a Meta especifica.
 */
function cookiesMeta(
  req: express.Request,
  atribuicao: Record<string, string | undefined>,
): { fbp?: string; fbc?: string; externalId?: string } {
  const fbp = lerCookie(req, "_fbp");
  let fbc = lerCookie(req, "_fbc");
  if (!fbc && atribuicao.fbclid) {
    fbc = `fb.1.${Date.now()}.${atribuicao.fbclid}`;
  }
  // Id anônimo do visitante (src/lib/visitante.ts). O pixel manda o mesmo valor
  // como external_id, então navegador e servidor descrevem a mesma pessoa.
  const externalId = lerCookie(req, "manos_vid");
  return { fbp, fbc, externalId };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3030;

  // Em produção o nginx faz proxy reverso para esta porta. Sem isto, req.ip é
  // sempre 127.0.0.1 — e o IP do visitante é um dos sinais que a Meta usa para
  // casar o evento do Conversions API com a pessoa certa.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Security Headers (Hardening contra clickjacking, MIME sniffing e XSS)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.use(express.json());

  // Integrar rotas da API do Sistema ERP/CRM (DG AUTOS)
  app.use(motrizBackendApp);

  // Servir frontend do sistema administrativo em /sistema
  const sistemaDist = fs.existsSync(path.join(process.cwd(), "dist", "sistema"))
    ? path.join(process.cwd(), "dist", "sistema")
    : path.join(process.cwd(), "dist-sistema");
  app.use("/sistema", express.static(sistemaDist));
  app.get(["/sistema", "/sistema/*"], (_req, res) => {
    const indexPath = path.join(sistemaDist, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).send(`
        <div style="font-family:sans-serif;text-align:center;padding:50px">
          <h2>Sistema DG AUTOS</h2>
          <p>O painel administrativo ainda está sendo construído ou compilado.</p>
          <p>Execute <code>npm run build:sistema</code> para gerar a pasta <code>dist-sistema</code>.</p>
        </div>
      `);
    }
  });

  // AI Visit Radar — logs crawler hits + AI/search referrals (fire-and-forget)
  app.use(radarMiddleware);

  // Redirect 301: /vendasrapidas -> /vender-meu-carro
  app.get("/vendasrapidas", (_req, res) => {
    res.redirect(301, "/vender-meu-carro");
  });

  // Altimus Stock Feed Endpoint (JSON & XML Proxy)
  app.get("/api/stock", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.json(vehicles);
    } catch (error) {
      console.error("Stock API error:", error);
      res.status(500).json({ error: "Failed to fetch stock" });
    }
  });

  app.get("/api/stock.xml", async (_req, res) => {
    try {
      const url = process.env.DG_FEED_XML_URL || 'http://localhost:3333/api/estoquexml?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch from Motriz feed');
      const xml = await response.text();
      res.set('Content-Type', 'text/xml');
      res.send(xml);
    } catch (error) {
      console.error('XML Proxy error:', error);
      res.status(500).json({ error: 'Failed to fetch stock XML' });
    }
  });

  // Consultor Manos AI Endpoints
  app.post("/api/consultor", async (req, res) => {
    try {
      const resultado = await processConsultorMessage(req.body ?? {});
      res.json({ ok: true, ...resultado });
    } catch (error) {
      console.error("Consultor API error:", error);
      res.status(500).json({ ok: false, error: "Erro no Consultor Manos" });
    }
  });

  app.post("/api/consultor/lead", async (req, res) => {
    try {
      const body = req.body ?? {};
      const response = await fetch("https://n8n.drivvoo.com/webhook/veiculosnatrocadg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok, protocolo: `DG-${Date.now().toString().slice(-6)}` });
    } catch (error) {
      console.error("Consultor lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Erro ao registrar lead do consultor" });
    }
  });

  // -------------------------------------------------------------------------
  // Leads do funil principal (/) — Compra, Venda e Financiamento.
  //
  // Antes, o navegador gravava no Firestore e SÓ ENTÃO chamava o webhook do n8n.
  // Qualquer falha na gravação (bloqueador de anúncio, rede de celular ruim,
  // regra recusada) derrubava as duas coisas e o consultor nunca ficava sabendo
  // do lead. Aqui a ordem se inverte: a entrega ao n8n — que é o que chega no
  // time comercial — acontece no servidor, sem depender do navegador do cliente.
  //
  // O mesmo endpoint recebe o lead PARCIAL (contato capturado no início do
  // funil) e o COMPLETO (qualificação inteira). Os dois carregam o mesmo
  // `lead_id`, para o n8n atualizar o registro em vez de duplicar.
  // -------------------------------------------------------------------------
  // Sobrescrevíveis por ambiente para dar para apontar a um mock em homologação
  // sem gerar lead falso na fila do consultor.
  const LEAD_WEBHOOKS: Record<string, string> = {
    Compra: process.env.N8N_WEBHOOK_COMPRA || "https://n8n.drivvoo.com/webhook/veiculosnatrocadg",
    Venda: process.env.N8N_WEBHOOK_VENDA || "https://n8n.drivvoo.com/webhook/veiculosnatrocadg",
    Financiamento: process.env.N8N_WEBHOOK_FINANCIAMENTO || "https://n8n.drivvoo.com/webhook/veiculosnatrocadg",
  };

  app.post("/api/leads", async (req, res) => {
    try {
      const body = req.body ?? {};
      const leadType = String(body.lead_type || "");
      const name = String(body.name || "").trim();
      const phone = normalizePhone(body.phone ?? "");

      if (!LEAD_WEBHOOKS[leadType]) {
        return res.status(400).json({ ok: false, error: "lead_type inválido" });
      }
      if (!name || phone.length < 10) {
        return res.status(400).json({ ok: false, error: "Nome e WhatsApp são obrigatórios" });
      }

      const stage = body.stage === "completo" ? "completo" : "parcial";
      const atribuicao = (body.atribuicao ?? {}) as Record<string, string | undefined>;
      const details = (body.details ?? {}) as Record<string, unknown>;

      // Nota de qualificação. O consultor recebe a nota, a faixa e o porquê —
      // em vez de uma fila indistinta onde "quero fechar essa semana" e "só
      // estou avaliando" chegam iguais.
      const qualificacao = calcularScore({
        lead_type: leadType,
        phone,
        cidade: String(details.cidade ?? ""),
        canal: atribuicao.canal,
        details,
      });

      // Registro analítico ANTES da entrega, de propósito. Se o n8n estiver
      // fora do ar, o lead se perde — mas a medição não pode se perder junto:
      // é exatamente aí que interessa saber qual campanha trouxe a pessoa.
      // Antes isto rodava só depois do webhook responder ok, então uma queda
      // do n8n apagava o desempenho da campanha em vez de só atrasar o lead.
      registrarScore({
        lead_id: String(body.lead_id ?? ""),
        stage,
        lead_type: leadType,
        score: qualificacao.score,
        faixa: qualificacao.faixa,
        descartado: qualificacao.descartar,
        fora_do_raio: qualificacao.fora_do_raio,
        canal: atribuicao.canal ?? null,
        utm_source: atribuicao.utm_source ?? null,
        utm_campaign: atribuicao.utm_campaign ?? null,
        utm_content: atribuicao.utm_content ?? null,
        cidade: String(details.cidade ?? "") || null,
      });

      const payload = {
        ...body,
        name,
        phone,
        // stage: "parcial" = só contato; "completo" = qualificação inteira.
        stage,
        score: qualificacao.score,
        faixa: qualificacao.faixa,
        score_motivos: qualificacao.motivos,
        fora_do_raio: qualificacao.fora_do_raio,
        descartar: qualificacao.descartar,
        acao_recomendada: acaoRecomendada(qualificacao),
        source: body.source || "Funil Manos Web App",
        server_received_at: new Date().toISOString(),
        user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
      };

      const response = await fetch(LEAD_WEBHOOKS[leadType], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Lead webhook respondeu ${response.status} para ${leadType}`);
        return res.status(502).json({ ok: false, error: "Falha ao entregar o lead" });
      }

      // Entrega direta ao CRM Motriz (Autos 360)
      const motrizWebhook = process.env.MOTRIZ_CRM_WEBHOOK || "http://localhost:3333/api/public/leads";
      void fetch(motrizWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          lead_type: leadType,
          stage,
          veiculo_interesse: details.nome_veiculo || details.veiculo_interesse || details.marca_modelo,
          veiculo_id: details.id_veiculo,
          details: { ...details, score: qualificacao.score, canal: atribuicao.canal }
        })
      }).catch((e) => console.error("[motriz] Entrega ao CRM falhou:", e));

      // Só o lead completo vira conversão no Meta. O parcial é sinal de funil,
      // não de negócio — otimizar por ele treinaria a campanha a buscar quem
      // apenas deixa telefone.
      if (stage === "completo" && body.event_id && !ambienteDeTeste(req)) {
        const eventoMeta = {
          eventName: "Lead" as const,
          eventId: String(body.event_id),
          phone,
          firstName: name,
          city: String(details.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          ...cookiesMeta(req, atribuicao),
          // Valor da conversão ponderado pela nota: a Meta passa a buscar quem
          // se parece com lead bom, não com lead qualquer.
          value: Math.round((Number(details.valor_veiculo) || 0) * (qualificacao.score / 100)),
          contentIds: details.id_veiculo ? [String(details.id_veiculo)] : undefined,
          contentName: details.nome_veiculo ? String(details.nome_veiculo) : undefined,
        };
        void enviarEventoCapi(eventoMeta);
        enviarLeadQualificado(qualificacao, eventoMeta);

        // Mesmo event_id do pixel oaiq: e o que faz a OpenAI entender que
        // navegador e servidor descrevem a mesma conversao.
        void enviarEventoOpenAiAds({
          eventName: "lead_created",
          eventId: String(body.event_id),
          phone,
          city: String(details.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          oppref: atribuicao.oppref ?? null,
          value: Math.round((Number(details.valor_veiculo) || 0) * (qualificacao.score / 100)),
        });
      }

      res.json({ ok: true, lead_id: body.lead_id ?? null, score: qualificacao.score, faixa: qualificacao.faixa });
    } catch (error) {
      console.error("Lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Falha ao entregar o lead" });
    }
  });

  // API Proxy for n8n Webhooks to avoid CORS.
  // Generates the WhatsApp verification code server-side and forwards it to n8n
  // (field `codigo`) so it can be delivered via WhatsApp. The code is NOT
  // returned to the browser.
  app.post("/api/bolao/lead", async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.whatsapp ?? req.body?.telefone ?? "");
      const codigo = generateOtp();
      if (phone) {
        otpStore.set(phone, { code: codigo, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
      }

      const response = await fetch("https://n8n.drivvoo.com/webhook/f3f66db5-444d-4ba0-a403-3584c432cf23", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req.body, codigo }),
      });
      // Never echo the code (or n8n's body) back to the client
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Webhook lead proxy error:", error);
      res.status(500).json({ error: "Failed to forward lead to webhook" });
    }
  });

  // Verifies the WhatsApp code. Only the code generated above (and delivered
  // via WhatsApp) is accepted; the code is consumed on success.
  app.post("/api/bolao/verify", (req, res) => {
    const phone = normalizePhone(req.body?.whatsapp ?? req.body?.telefone ?? "");
    const codigo = String(req.body?.codigo ?? "").replace(/\D/g, "");
    const entry = otpStore.get(phone);

    if (!entry || Date.now() > entry.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ valid: false, error: "expired" });
    }
    entry.attempts += 1;
    if (entry.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(phone);
      return res.status(429).json({ valid: false, error: "too_many_attempts" });
    }
    if (codigo && codigo === entry.code) {
      otpStore.delete(phone);
      return res.json({ valid: true });
    }
    return res.status(400).json({ valid: false, error: "invalid" });
  });

  app.post("/api/bolao/palpite", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2ed8336e-1a2a-4681-bf68-3c844c665f2d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Webhook palpite proxy error:", error);
      res.status(500).json({ error: "Failed to forward palpite to webhook" });
    }
  });

  app.post("/api/bolao/finalizar", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2196b31c-775d-4d8d-861d-ea65faf321f6", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Webhook finalizar proxy error:", error);
      res.status(500).json({ error: "Failed to forward finalizar to webhook" });
    }
  });

  // -------------------------------------------------------------------------
  // Vendas Rápidas — funil de compra de veículos (/vendasrapidas).
  // Lead (nome/telefone/cidade) -> placa (apiplacas) -> detalhes -> finaliza.
  // -------------------------------------------------------------------------
  const PLACA_TOKEN = process.env.PLACA_TOKEN || "97e59dd0a4790f25a020ca4623f9a902";

  // Step 1: captura inicial (enviada cedo p/ não perder o contato se desistir).
  app.post("/api/vendas/lead", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2ea982be-39f1-4224-b378-c45dee5230c7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Vendas lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward vendas lead" });
    }
  });

  // -------------------------------------------------------------------------
  // Veículos de Repasse — formulário de interesse enviado ao n8n
  // -------------------------------------------------------------------------
  app.post("/api/repasse/lead", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/42d8e1c7-83ec-40b2-a646-ec363cf88c2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Repasse lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward repasse lead" });
    }
  });

  // Novo Cadastro de Lojista/Repassador — notificação enviada ao n8n
  app.post("/api/repasse/cadastro", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/7a146026-4b40-447d-a49d-0853ac749f26", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Repasse cadastro proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward repasse cadastro" });
    }
  });


  // Placa lookup (apiplacas/wdapi2). Token fica no servidor; nunca no client.
  app.get("/api/placa/:placa", async (req, res) => {
    try {
      const placa = String(req.params.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
      if (!/^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(placa)) {
        return res.status(200).json({ ok: false, error: "Placa inválida. Use o formato ABC1D23 ou ABC1234." });
      }
      const r = await fetch(`https://wdapi2.com.br/consulta/${placa}/${PLACA_TOKEN}`);
      const data: any = await r.json().catch(() => null);
      if (!data || data.message || (!data.marca && !data.MARCA)) {
        return res.status(200).json({ ok: false, error: "Não encontramos os dados dessa placa. Você pode seguir sem ela." });
      }
      // FIPE: escolhe o maior score (melhor correspondência) p/ valor + versão.
      let fipeValor = "";
      let versaoFipe = "";
      const fipeList = data?.fipe?.dados;
      if (Array.isArray(fipeList) && fipeList.length) {
        const best = [...fipeList].sort((a: any, b: any) => (b?.score || 0) - (a?.score || 0))[0];
        fipeValor = best?.texto_valor || "";
        versaoFipe = best?.texto_modelo || "";
      }
      const veiculo = {
        marca: data.marca || data.MARCA || "",
        modelo: data.modelo || data.MODELO || "",
        versao: versaoFipe || data.VERSAO || data.SUBMODELO || "",
        ano: data.ano || data.anoModelo || "",
        cor: data.cor || "",
        combustivel: data?.extra?.combustivel || "",
        municipio: data.municipio || data?.extra?.municipio || "",
        uf: data.uf || data?.extra?.uf_placa || "",
        fipeValor,
        logo: data.logo || "",
      };
      res.json({ ok: true, veiculo });
    } catch (error) {
      console.error("Placa lookup error:", error);
      res.status(200).json({ ok: false, error: "Erro ao consultar a placa. Você pode seguir sem ela." });
    }
  });

  // Final: envia todos os dados coletados p/ a equipe de compras.
  app.post("/api/vendas/finalizar", async (req, res) => {
    try {
      const body = req.body ?? {};
      const atribuicao = (body.atribuicao ?? {}) as Record<string, string | undefined>;

      // Em Venda a nota mede viabilidade do negócio, não intenção: o peso maior
      // está em ter placa/FIPE e no preço pedido bater com a tabela. Preço muito
      // acima da FIPE é o principal motivo de avaliação que não fecha.
      const qualificacao = calcularScore({
        lead_type: "Venda",
        phone: String(body.telefone ?? ""),
        cidade: String(body.cidade ?? ""),
        canal: atribuicao.canal,
        venda: {
          placa: body.placa ?? null,
          fipe: body.fipe ?? null,
          valor_desejado: body.valor_desejado ?? null,
          km: body.km ?? null,
          marca: body.marca ?? null,
        },
      });

      // Antes da entrega, pelo mesmo motivo da rota /api/leads: se o fetch
      // estourar (rede, DNS, timeout), a execução pula direto para o catch e a
      // medição desta avaliação sumiria junto com o lead.
      registrarScore({
        lead_id: String(body.lead_id ?? body.event_id ?? ""),
        stage: "completo",
        lead_type: "Venda",
        score: qualificacao.score,
        faixa: qualificacao.faixa,
        descartado: qualificacao.descartar,
        fora_do_raio: qualificacao.fora_do_raio,
        canal: atribuicao.canal ?? null,
        utm_source: atribuicao.utm_source ?? null,
        utm_campaign: atribuicao.utm_campaign ?? null,
        utm_content: atribuicao.utm_content ?? null,
        cidade: String(body.cidade ?? "") || null,
      });

      const response = await fetch("https://n8n.drivvoo.com/webhook/veiculosnatrocadg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          score: qualificacao.score,
          faixa: qualificacao.faixa,
          score_motivos: qualificacao.motivos,
          fora_do_raio: qualificacao.fora_do_raio,
          descartar: qualificacao.descartar,
          acao_recomendada: acaoRecomendada(qualificacao),
          server_received_at: new Date().toISOString(),
        }),
      });

      if (body.event_id && !ambienteDeTeste(req)) {
        const eventoMeta = {
          eventName: "Lead" as const,
          eventId: String(body.event_id),
          phone: String(body.telefone ?? ""),
          firstName: String(body.nome ?? ""),
          city: String(body.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          ...cookiesMeta(req, atribuicao),
          value: Math.round((Number(body.valor_desejado) || 0) * (qualificacao.score / 100)),
          contentName: [body.marca, body.modelo].filter(Boolean).join(" ") || undefined,
          sourceUrl: "https://manosveiculoscompra.com/vendasrapidas",
        };
        void enviarEventoCapi(eventoMeta);
        enviarLeadQualificado(qualificacao, eventoMeta);

        void enviarEventoOpenAiAds({
          eventName: "lead_created",
          eventId: String(body.event_id),
          phone: String(body.telefone ?? ""),
          city: String(body.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          oppref: atribuicao.oppref ?? null,
          value: Math.round((Number(body.valor_desejado) || 0) * (qualificacao.score / 100)),
          sourceUrl: "https://manosveiculoscompra.com/vendasrapidas",
        });
      }

      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Vendas finalizar proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward vendas finalizar" });
    }
  });

  // -------------------------------------------------------------------------
  // AEO/SEO server-rendered catalog (indexable by AI engines + crawlers).
  // Registered BEFORE the SPA catch-all so these paths return real HTML/XML.
  // -------------------------------------------------------------------------
  app.get("/robots.txt", (_req, res) => {
    res.set("Content-Type", "text/plain").send(renderRobots());
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "application/xml").send(renderSitemap(vehicles));
    } catch (err) {
      console.error("sitemap error:", err);
      res.status(500).send("error");
    }
  });

  // Versão JSON do mesmo feed de produtos. A Meta NÃO aceita JSON como fonte de
  // dados (só CSV/TSV/XML/XLSX) — quem for ligar o catálogo usa
  // /feeds/meta/produtos.csv. Esta rota fica para consumo interno e de
  // parceiros.
  //
  // Ela montava os campos à mão a partir de propriedades que o feed não tem
  // (`v.image`, `v.link`), então saía com `image_link` e `link` indefinidos e
  // `availability: in_stock` — valor que a Meta escreve com espaço. Agora sai do
  // mesmo montador do CSV, um lugar só a definir o formato.
  app.get("/feed/vehicles.json", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "application/json").json(montarProdutosMeta(vehicles));
    } catch (err) {
      console.error("feed error:", err);
      res.status(500).json({ error: "Failed to generate vehicle feed" });
    }
  });

  app.get("/sobre", (_req, res) => {
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(renderAbout());
  });

  app.get("/perguntas-frequentes", (_req, res) => {
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(renderFAQ());
  });

  app.get("/politica-de-privacidade", (_req, res) => {
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(renderPrivacy());
  });

  // Painel interno: leads por origem, campanha, criativo e nota.
  // Protegido por Basic Auth — expõe desempenho por campanha, que é informação
  // de negócio. Sem PANEL_PASSWORD no .env, responde 503 em vez de abrir.
  app.get(["/leads-dg", "/leads-manos"], basicAuth("Painel DG Automóveis"), async (_req, res) => {
    try {
      const linhas = await lerScores(500);
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "no-store")
        .set("X-Robots-Tag", "noindex, nofollow")
        .send(renderLeadsPanel(linhas));
    } catch (err) {
      console.error("leads panel error:", err);
      res.status(500).send("error");
    }
  });

  // Diagnóstico rápido da mensuração — evita descobrir só depois da campanha
  // no ar que o token do CAPI nunca foi configurado.
  app.get("/api/health/tracking", async (_req, res) => {
    const scores = await diagnosticoScores();
    res.json({
      meta_capi: capiConfigurado() ? "configurado" : "sem META_CAPI_TOKEN",
      meta_pixel_catalogo: process.env.META_PIXEL_ID ? PIXEL_ID : `${PIXEL_ID} (default)`,
      meta_pixel_funil: (() => {
        const funil = pixelDoFunil();
        if (!funil) return "dist/index.html não encontrado — rodando sem build?";
        if (funil === PIXEL_ID) return "igual ao servidor";
        return `DIVERGENTE — funil ${funil}, servidor ${PIXEL_ID}. Defina VITE_META_PIXEL_ID igual a META_PIXEL_ID e republique`;
      })(),
      meta_venda_confirmada: process.env.META_WEBHOOK_SECRET ? "configurado" : "sem META_WEBHOOK_SECRET",
      // Enquanto o catálogo for alimentado por terceiro, o id do produto não é
      // o nosso e o mapeamento acima é obrigatório. Apontar o catálogo para
      // este feed torna o mapeamento desnecessário — por isso a URL aparece
      // aqui, ao lado do sintoma que ela resolve.
      meta_catalogo_feed: {
        veiculos: `${SITE_URL}/feeds/meta/veiculos.csv`,
        produtos: `${SITE_URL}/feeds/meta/produtos.csv`,
      },
      meta_catalogo_mapping: mapeamentoConfigurado()
        ? "configurado"
        : "sem META_CATALOG_ACCESS_TOKEN/SUPABASE_SERVICE_ROLE_KEY — eventos saem com o id da Altimus",
      openai_ads_capi: openAiAdsConfigurado() ? "configurado" : "sem OPENAI_ADS_API_KEY",
      // Tabela quebrada e tabela vazia pedem ações opostas — conserto de RLS
      // versus falta de tráfego. Antes as duas apareciam na mesma frase e o
      // diagnóstico mandava procurar defeito onde não havia.
      lead_scores: !scores.acessivel
        ? `INACESSÍVEL (${scores.erro}) — confira a tabela e a RLS`
        : scores.total
          ? `gravando — ${scores.total} registro(s), último em ${scores.ultimo}`
          : "tabela ok e gravável, porém nenhum lead registrado até agora",
      webhooks_n8n: {
        compra: LEAD_WEBHOOKS.Compra.includes("n8n.drivvoo.com") ? "produção" : "sobrescrito",
        venda: LEAD_WEBHOOKS.Venda.includes("n8n.drivvoo.com") ? "produção" : "sobrescrito",
      },
    });
  });

  // -------------------------------------------------------------------------
  // Espelho server-side de conversões que acontecem só no navegador.
  //
  // Clique de WhatsApp é a conversão mais importante de uma revenda e a mais
  // frágil de medir: a pessoa sai da página no mesmo instante e o evento é o
  // primeiro que um bloqueador derruba. O navegador manda um beacon aqui e o
  // servidor reenvia pela Conversions API, com o MESMO event_id — então quando
  // os dois chegam, a plataforma conta uma conversão, não duas.
  //
  // Só eventos da lista são aceitos: o endpoint é público, e sem a lista
  // qualquer um poderia inventar conversão e sujar a otimização da campanha.
  //
  // Dois grupos, duas plataformas: "whatsapp"/"telefone" vêm do funil (SPA) e
  // do catálogo, e reenviam pela CAPI do OpenAI Ads. "catalogo_addtocart" vem
  // só das páginas SSR do catálogo (server/catalog.ts) e reenvia pela
  // Conversions API da Meta — é o mesmo clique em "Tenho interesse"/WhatsApp
  // que já dispara o `fbq('track','AddToCart', ...)` no navegador; aqui é só
  // o reforço contra bloqueador, com o MESMO event_id para não dobrar.
  // -------------------------------------------------------------------------
  const EVENTOS_OPENAI = new Set(["whatsapp", "telefone"]);
  // Nome do evento no beacon -> nome padrão da Meta. O clique de WhatsApp no
  // catálogo manda os dois: AddToCart (sinal de catálogo) e Contact (é por ele
  // que campanha de conversa otimiza).
  const EVENTOS_META: Record<string, "AddToCart" | "Contact"> = {
    catalogo_addtocart: "AddToCart",
    catalogo_contato: "Contact",
  };

  app.post("/api/ads/conversao", (req, res) => {
    try {
      const body = req.body ?? {};
      const evento = String(body.evento || "");
      const eventId = String(body.event_id || "");
      const paraOpenAi = EVENTOS_OPENAI.has(evento);
      const nomeMeta = EVENTOS_META[evento];
      const paraMeta = Boolean(nomeMeta);

      if ((!paraOpenAi && !paraMeta) || !eventId) {
        return res.status(400).json({ ok: false });
      }

      // Beacon de desenvolvimento não vira conversão de produção.
      if (ambienteDeTeste(req)) return res.status(204).end();

      const atribuicao = (body.atribuicao ?? {}) as Record<string, string | undefined>;

      if (paraOpenAi) {
        void enviarEventoOpenAiAds({
          eventName: "custom",
          customEventName: evento,
          eventId,
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          oppref: atribuicao.oppref ?? null,
          sourceUrl: typeof body.source_url === "string" ? body.source_url : undefined,
        });
      }

      if (paraMeta) {
        void enviarEventoCapi({
          eventName: nomeMeta,
          eventId,
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          ...cookiesMeta(req, atribuicao),
          value: Number(body.value) || 0,
          currency: "BRL",
          contentIds: body.vehicle_id ? [String(body.vehicle_id)] : undefined,
          contentName: typeof body.vehicle_name === "string" ? body.vehicle_name : undefined,
          sourceUrl: typeof body.source_url === "string" ? body.source_url : undefined,
        });
      }

      // 204: o navegador está saindo da página e não vai ler resposta nenhuma.
      res.status(204).end();
    } catch (err) {
      console.error("espelho de conversao falhou:", err);
      res.status(204).end();
    }
  });

  // -------------------------------------------------------------------------
  // Evento `Purchase` para a Meta — venda confirmada no CRM.
  //
  // Não existe checkout neste site (é um funil de lead para revenda de
  // veículos), então "compra" só existe quando o CRM marca a venda como
  // fechada. Este endpoint é o gancho para isso: o CRM (ou o n8n) chama aqui
  // quando o lead vira venda, e o servidor reenvia pela Conversions API.
  //
  // Terceiro dos três eventos que o Gerenciador de Comércio apontava como
  // ausentes nos últimos 7 dias (os outros dois — ViewContent e AddToCart —
  // já saem das páginas do catálogo, ver server/catalog.ts).
  //
  // Protegido por segredo compartilhado (não é rota pública como a de cima):
  // sem META_WEBHOOK_SECRET configurado, o endpoint responde 503 — falha
  // fechada, mesmo padrão do /leads-manos.
  //
  // Corpo esperado: `placa` (recomendado), `event_id` (id da venda no CRM, para
  // reenvio não contar duas vezes), `value`, `phone`, `name`, `city`,
  // `vehicle_name`. A `placa` é a chave que o CRM tem e a única estável entre
  // Altimus, catálogo da Meta e CRM — o content_id do catálogo sai dela, pelo
  // mapeamento (server/catalogSync.ts). `vehicle_id` continua aceito para quem
  // já chama assim, mas vai como veio: se for o id da Altimus, o catálogo da
  // Meta não reconhece.
  // -------------------------------------------------------------------------
  app.post("/api/meta/venda-confirmada", express.json(), async (req, res) => {
    const segredo = process.env.META_WEBHOOK_SECRET || "";
    if (!segredo) {
      return res.status(503).json({ ok: false, error: "META_WEBHOOK_SECRET não configurado" });
    }
    if (req.headers["x-webhook-secret"] !== segredo) {
      return res.status(401).json({ ok: false });
    }

    try {
      const body = req.body ?? {};
      const eventId = String(body.event_id || `venda_${Date.now()}`);
      const placa = typeof body.placa === "string" ? body.placa : "";
      const vehicleId = body.vehicle_id ? String(body.vehicle_id) : undefined;

      // Com placa, o id vem do mapeamento — e um match aproximado é recusado
      // lá: numa venda, produto errado credita dinheiro ao veículo errado, o
      // que é pior do que venda sem produto.
      const doMapa = placa ? await contentIdParaVenda(placa) : null;
      const contentId = doMapa ? (doMapa.contentId ?? undefined) : vehicleId;

      const aviso = doMapa && !doMapa.contentId
        ? `venda sem produto do catálogo (${doMapa.motivo}) — confira a placa em vehicle_meta_mapping`
        : !placa
          ? "mande `placa` para casar a venda com o catálogo da Meta"
          : undefined;
      if (aviso) console.warn(`venda-confirmada: ${aviso} (event_id ${eventId})`);

      void enviarEventoCapi({
        eventName: "Purchase",
        eventId,
        // A venda foi fechada no CRM, não numa página do site.
        actionSource: "system_generated",
        phone: typeof body.phone === "string" ? body.phone : undefined,
        firstName: typeof body.name === "string" ? body.name : undefined,
        city: typeof body.city === "string" ? body.city : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        // O CRM guardou este id no momento da captura do lead; é o que liga a
        // venda de hoje à visita de semanas atrás.
        externalId: typeof body.external_id === "string" ? body.external_id : undefined,
        value: Number(body.value) || 0,
        currency: "BRL",
        contentIds: contentId ? [contentId] : undefined,
        contentName: typeof body.vehicle_name === "string" ? body.vehicle_name : undefined,
      });

      res.status(200).json({ ok: true, content_id: contentId ?? null, aviso });
    } catch (err) {
      console.error("venda-confirmada falhou:", err);
      res.status(500).json({ ok: false });
    }
  });

  // -------------------------------------------------------------------------
  // Sincronização placa -> content_id do catálogo da Meta.
  //
  // O catálogo do Gerenciador de Comércio é alimentado pela Autos 360, que
  // numera os veículos do jeito dela. Sem esta tradução, os eventos saem com o
  // id da Altimus, a Meta não reconhece o produto e a correspondência do
  // catálogo fica em 0% mesmo com o pixel disparando certo.
  //
  // Protegida por segredo, como a de venda confirmada: fala com a Graph API e
  // escreve no Supabase. Sem INTERNAL_SYNC_SECRET responde 503 — falha fechada.
  //
  // Para agendar de hora em hora sem depender de cron externo (pg_cron + pg_net
  // já rodam no projeto):
  //
  //   select cron.schedule(
  //     'sync-catalog-mapping-hourly',
  //     '0 * * * *',
  //     $
  //     select net.http_post(
  //       url := 'https://manosveiculoscompra.com/api/internal/sync-catalog-mapping',
  //       headers := jsonb_build_object(
  //         'Content-Type', 'application/json',
  //         'x-internal-secret', 'MESMO_VALOR_DE_INTERNAL_SYNC_SECRET'
  //       )
  //     );
  //     $
  //   );
  // -------------------------------------------------------------------------
  app.post("/api/internal/sync-catalog-mapping", async (req, res) => {
    const segredo = process.env.INTERNAL_SYNC_SECRET || "";
    if (!segredo) {
      return res.status(503).json({ ok: false, error: "INTERNAL_SYNC_SECRET não configurado" });
    }
    // Header repetido chega como array; comparar direto daria falso negativo.
    if (String(req.headers["x-internal-secret"] || "") !== segredo) {
      return res.status(401).json({ ok: false });
    }

    try {
      const vehicles = await getVehicles();
      const resumo = await syncCatalogMapping(
        vehicles.map((v) => ({ id: v.id, placa: v.placa, title: v.title, price: v.price })),
      );
      res.json({
        ok: true,
        matched: resumo.matched,
        needsReview: resumo.needsReview,
        unmatched: resumo.unmatched,
        // jaIguais == matched significa que o catálogo já usa o id do feed e o
        // mapeamento não era necessário.
        jaIguais: resumo.jaIguais,
        // Vendidos continuam na tabela por um tempo: a venda é confirmada no
        // CRM depois de o carro sair do feed, e o Purchase precisa do id.
        marcadosForaDeEstoque: resumo.marcadosForaDeEstoque,
        purgados: resumo.purgados,
        // Só volta o que precisa de olho humano: a lista inteira não ajuda a
        // decidir nada, e placa é dado de veículo.
        revisar: resumo.results.filter((r) => r.needsReview || r.confidence === "unmatched"),
      });
    } catch (err) {
      console.error("sync-catalog-mapping falhou:", err);
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // -------------------------------------------------------------------------
  // Product feed do OpenAI Ads (snapshot completo em Parquet).
  //
  // É esta URL que se cola em Ads Manager › Feeds › "Conecte seu feed via URL".
  // O painel aceita os parâmetros `file_type=full-parquet` e `prefix`; ambos
  // são inofensivos aqui — a rota sempre devolve o catálogo inteiro, então a
  // URL funciona com ou sem eles.
  //
  // `?preview=1` devolve as mesmas linhas em JSON, para conferir o conteúdo
  // sem precisar abrir o binário.
  // -------------------------------------------------------------------------
  app.get("/feeds/openai/products.parquet", async (req, res) => {
    try {
      const vehicles = await getVehicles();
      const produtos = montarProdutos(vehicles);

      if (req.query.preview) {
        return res
          .set("Cache-Control", "no-store")
          .set("X-Robots-Tag", "noindex, nofollow")
          .json({
            total_estoque: vehicles.length,
            total_no_feed: produtos.length,
            descartados_sem_preco_ou_foto: vehicles.length - produtos.length,
            produtos,
          });
      }

      const parquet = produtosParaParquet(produtos);
      res
        .set("Content-Type", "application/vnd.apache.parquet")
        .set("Content-Disposition", 'attachment; filename="products.parquet"')
        .set("Content-Length", String(parquet.length))
        // O catálogo em memória tem TTL de 10 min; alinhar evita servir cache
        // mais velho que a fonte.
        .set("Cache-Control", "public, max-age=600")
        .set("X-Robots-Tag", "noindex, nofollow")
        .send(parquet);
    } catch (err) {
      console.error("openai feed error:", err);
      res.status(500).json({ error: "failed to build feed" });
    }
  });

  // -------------------------------------------------------------------------
  // Data feed da Meta (Gerenciador de Comércio › Fontes de dados › URL agendada)
  //
  // São duas URLs porque a Meta valida o arquivo contra o TIPO do catálogo e os
  // nomes das colunas mudam entre eles (ver server/metaFeed.ts):
  //
  //   /feeds/meta/veiculos.csv  → catálogo "Veículos" (inventário automotivo)
  //   /feeds/meta/produtos.csv  → catálogo "E-commerce/Produtos"
  //
  // Colar a URL errada dá erro de coluna obrigatória ausente na hora do upload,
  // não silenciosamente depois — dá para testar as duas sem risco.
  //
  // `?preview=1` devolve as mesmas linhas em JSON, para conferir sem abrir o CSV.
  // -------------------------------------------------------------------------
  function responderFeedMeta(
    res: express.Response,
    nomeArquivo: string,
    csv: string,
  ): void {
    res
      .set("Content-Type", "text/csv; charset=utf-8")
      .set("Content-Disposition", `inline; filename="${nomeArquivo}"`)
      // O estoque em memória tem TTL de 10 min; alinhar evita servir cache mais
      // velho que a fonte.
      .set("Cache-Control", "public, max-age=600")
      .set("X-Robots-Tag", "noindex, nofollow")
      .send(csv);
  }

  app.get("/feeds/meta/veiculos.csv", async (req, res) => {
    try {
      const vehicles = await getVehicles();
      const linhas = montarVeiculosMeta(vehicles);

      if (req.query.preview) {
        return res
          .set("Cache-Control", "no-store")
          .set("X-Robots-Tag", "noindex, nofollow")
          .json({
            schema: "vehicles (anúncios de inventário automotivo)",
            // Prova de que o arquivo não é estático: muda a cada requisição.
            // O navegador baixa o .csv em vez de exibir (é o que ele faz com
            // text/csv), então esta é a janela para conferir o conteúdo — e o
            // horário sobe a cada F5.
            gerado_em: new Date().toISOString(),
            total_estoque: vehicles.length,
            total_no_feed: linhas.length,
            descartados_sem_preco_ou_foto: vehicles.length - linhas.length,
            veiculos: linhas,
          });
      }

      responderFeedMeta(res, "manos-veiculos.csv", veiculosParaCsv(linhas));
    } catch (err) {
      console.error("meta feed (veiculos) error:", err);
      res.status(500).json({ error: "failed to build feed" });
    }
  });

  app.get("/feeds/meta/produtos.csv", async (req, res) => {
    try {
      const vehicles = await getVehicles();
      const produtos = montarProdutosMeta(vehicles);

      if (req.query.preview) {
        return res
          .set("Cache-Control", "no-store")
          .set("X-Robots-Tag", "noindex, nofollow")
          .json({
            schema: "products (catálogo de e-commerce)",
            gerado_em: new Date().toISOString(),
            total_estoque: vehicles.length,
            total_no_feed: produtos.length,
            descartados_sem_preco_ou_foto: vehicles.length - produtos.length,
            produtos,
          });
      }

      responderFeedMeta(res, "manos-produtos.csv", produtosParaCsv(produtos));
    } catch (err) {
      console.error("meta feed (produtos) error:", err);
      res.status(500).json({ error: "failed to build feed" });
    }
  });

  app.get("/llms.txt", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "text/plain; charset=utf-8").send(renderLlms(vehicles));
    } catch (err) {
      console.error("llms.txt error:", err);
      res.status(500).send("error");
    }
  });

  app.get("/estoque", async (req, res, next) => {
    const accept = String(req.headers.accept || "");
    const ua = String(req.headers["user-agent"] || "").toLowerCase();
    const isBot = /bot|google|search|crawler|spider|perplexity|gptbot/i.test(ua);
    if (!isBot && accept.includes("text/html") && process.env.NODE_ENV !== "production") {
      return next();
    }
    try {
      const todos = await getVehicles();
      const filtro = {
        faixa: typeof req.query.faixa === "string" ? req.query.faixa : undefined,
        marca: typeof req.query.marca === "string" ? req.query.marca : undefined,
      };
      const vehicles = aplicarFiltro(todos, filtro);
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "public, max-age=600")
        .send(renderCatalog(vehicles, filtro, todos));
    } catch (err) {
      console.error("catalog error:", err);
      res.status(500).send("error");
    }
  });

  app.get("/estoque/:slug", async (req, res, next) => {
    const accept = String(req.headers.accept || "");
    const ua = String(req.headers["user-agent"] || "").toLowerCase();
    const isBot = /bot|google|search|crawler|spider|perplexity|gptbot/i.test(ua);
    if (!isBot && accept.includes("text/html") && process.env.NODE_ENV !== "production") {
      return next();
    }
    try {
      const vehicles = await getVehicles();
      const vehicle = findBySlug(vehicles, req.params.slug);
      if (!vehicle) {
        return res
          .status(410)
          .set("Content-Type", "text/html; charset=utf-8")
          .send(renderSold(req.params.slug, findSimilar(vehicles, req.params.slug)));
      }
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "public, max-age=600")
        .send(renderVehicle(vehicle));
    } catch (err) {
      console.error("vehicle page error:", err);
      res.status(500).send("error");
    }
  });

  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.argv[1]?.endsWith("server.js"));

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(process.cwd(), 'dist');
    const sistemaDist = path.resolve(distPath, 'sistema');

    if (fs.existsSync(sistemaDist)) {
      app.use('/sistema', express.static(sistemaDist));
      app.get(['/sistema', '/sistema/*'], (_req, res) => {
        const sistemaHtml = path.join(sistemaDist, 'index.html');
        if (fs.existsSync(sistemaHtml)) {
          return res.sendFile(sistemaHtml);
        }
        res.status(404).send('Sistema Altimus index não encontrado.');
      });
    }

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }

    app.get('*', async (req, res) => {
      const rootHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(rootHtml)) {
        return res.sendFile(rootHtml);
      }
      try {
        const todos = await getVehicles();
        const vehicles = aplicarFiltro(todos, {});
        return res
          .set("Content-Type", "text/html; charset=utf-8")
          .send(renderCatalog(vehicles, {}, todos));
      } catch (err) {
        return res.status(200).send("<!DOCTYPE html><html><head><title>DG Automóveis</title></head><body><h1>DG Automóveis</h1><p>Sistema inicializado com sucesso.</p></body></html>");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
