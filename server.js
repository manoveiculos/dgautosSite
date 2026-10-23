// server.ts
import "dotenv/config";
import express2 from "express";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// server/catalogSync.ts
var GRAPH_VERSION = "v21.0";
var CATALOG_ID = process.env.META_CATALOG_ID || "712583511204994";
var CATALOG_TOKEN = process.env.META_CATALOG_ACCESS_TOKEN || "";
var SUPABASE_URL = process.env.SUPABASE_URL || "https://jkblxdxnbmciicakusnl.supabase.co";
var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var TABELA = "vehicle_meta_mapping";
var FETCH_TIMEOUT_MS = 15e3;
var MAPA_TTL_MS = 10 * 60 * 1e3;
var RETENCAO_APOS_SAIDA_DIAS = 90;
function idParaEvento(p) {
  return p.retailer_id || p.id;
}
function mapeamentoConfigurado() {
  return Boolean(CATALOG_TOKEN && SERVICE_KEY);
}
async function fetchComTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
function normalizar(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function precoDoCatalogo(valor) {
  const n = parseFloat(String(valor).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function precosCompativeis(a, b) {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= Math.max(a, b) * 0.08;
}
function distanciaEdicao(a, b, maximo) {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;
  let anterior = new Array(b.length + 1);
  let atual = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) anterior[j] = j;
  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    let melhorDaLinha = atual[0];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = a[i - 1] === b[j - 1] ? anterior[j - 1] : 1 + Math.min(anterior[j], atual[j - 1], anterior[j - 1]);
      if (atual[j] < melhorDaLinha) melhorDaLinha = atual[j];
    }
    if (melhorDaLinha > maximo) return maximo + 1;
    const troca = anterior;
    anterior = atual;
    atual = troca;
  }
  return anterior[b.length];
}
function placaValida(placa) {
  return /^[A-Za-z0-9]{5,8}$/.test(placa);
}
function cabecalhosSupabase(extra = {}) {
  return {
    "Content-Type": "application/json",
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra
  };
}
var mapaCache = null;
async function lerMapeamento() {
  if (mapaCache && Date.now() - mapaCache.at < MAPA_TTL_MS) return mapaCache.mapa;
  if (!SERVICE_KEY) return /* @__PURE__ */ new Map();
  try {
    const res = await fetchComTimeout(
      `${SUPABASE_URL}/rest/v1/${TABELA}?select=placa,meta_content_id,needs_review&meta_content_id=not.is.null`,
      { headers: cabecalhosSupabase() }
    );
    if (!res.ok) {
      console.warn(`vehicle_meta_mapping leitura non-ok (${res.status}) \u2014 confira a tabela/RLS`);
      return mapaCache?.mapa ?? /* @__PURE__ */ new Map();
    }
    const linhas = await res.json();
    const mapa = /* @__PURE__ */ new Map();
    for (const linha of linhas) {
      if (linha.placa && linha.meta_content_id) {
        mapa.set(linha.placa.toUpperCase(), {
          contentId: linha.meta_content_id,
          needsReview: Boolean(linha.needs_review)
        });
      }
    }
    mapaCache = { at: Date.now(), mapa };
    return mapa;
  } catch (err) {
    console.error("vehicle_meta_mapping leitura falhou:", err);
    return mapaCache?.mapa ?? /* @__PURE__ */ new Map();
  }
}
async function contentIdParaVenda(placa) {
  const chave = (placa || "").trim().toUpperCase();
  if (!placaValida(chave)) return { contentId: null, motivo: "placa_invalida" };
  const entrada = (await lerMapeamento()).get(chave);
  if (!entrada) return { contentId: null, motivo: "sem_mapeamento" };
  if (entrada.needsReview) return { contentId: null, motivo: "precisa_revisao" };
  return { contentId: entrada.contentId, motivo: "ok" };
}
async function aplicarMapeamento(veiculos) {
  if (!SERVICE_KEY) return veiculos;
  const mapa = await lerMapeamento();
  if (mapa.size === 0) return veiculos;
  for (const veiculo of veiculos) {
    const placa = (veiculo.placa || "").toUpperCase();
    const entrada = placa ? mapa.get(placa) : void 0;
    if (entrada) veiculo.metaContentId = entrada.contentId;
  }
  return veiculos;
}
async function lerCatalogoMeta() {
  const produtos = [];
  let url = `https://graph.facebook.com/${GRAPH_VERSION}/${CATALOG_ID}/products?fields=id,retailer_id,name,price&limit=100`;
  for (let pagina = 0; url && pagina < 50; pagina++) {
    const res = await fetchComTimeout(url, {
      headers: { Authorization: `Bearer ${CATALOG_TOKEN}` }
    });
    const json = await res.json();
    if (json.error) throw new Error(`Graph API: ${JSON.stringify(json.error)}`);
    produtos.push(...json.data ?? []);
    url = json.paging?.next ?? "";
  }
  return produtos;
}
function casarVeiculos(veiculos, produtos) {
  const catalogo = produtos.map((p) => ({
    ...p,
    nomeNormalizado: normalizar(p.name),
    preco: precoDoCatalogo(p.price)
  }));
  const usados = /* @__PURE__ */ new Set();
  const resultados = [];
  for (const veiculo of veiculos) {
    const alvo = normalizar(veiculo.title);
    const disponiveis = catalogo.filter((p) => !usados.has(p.id));
    let confidence = "unmatched";
    let escolhido;
    const exatos = disponiveis.filter((p) => p.nomeNormalizado === alvo);
    if (exatos.length === 1) {
      escolhido = exatos[0];
      confidence = "exact";
    } else if (exatos.length > 1) {
      const porPreco = exatos.filter((p) => precosCompativeis(p.preco, veiculo.price));
      if (porPreco.length === 1) {
        escolhido = porPreco[0];
        confidence = "exact";
      } else {
        confidence = "ambiguous";
      }
    } else {
      const candidatos = disponiveis.filter((p) => precosCompativeis(p.preco, veiculo.price)).map((p) => ({ p, dist: distanciaEdicao(p.nomeNormalizado, alvo, 4) })).filter(({ dist }) => dist <= 4).sort((a, b) => a.dist - b.dist);
      if (candidatos.length > 0) {
        escolhido = candidatos[0].p;
        confidence = "fuzzy";
      }
    }
    if (escolhido) usados.add(escolhido.id);
    resultados.push({
      placa: veiculo.placa,
      altimusId: veiculo.id,
      metaContentId: escolhido ? idParaEvento(escolhido) : null,
      matchedName: escolhido?.name ?? null,
      confidence,
      needsReview: confidence === "fuzzy" || confidence === "ambiguous"
    });
  }
  return resultados;
}
async function linhasNaTabela() {
  const res = await fetchComTimeout(
    `${SUPABASE_URL}/rest/v1/${TABELA}?select=placa,left_stock_at`,
    { headers: cabecalhosSupabase() }
  );
  if (!res.ok) return [];
  const linhas = await res.json();
  return linhas.filter((l) => l.placa);
}
function listaPlacas(placas) {
  return placas.map((p) => `"${p}"`).join(",");
}
async function syncCatalogMapping(veiculos) {
  if (!CATALOG_TOKEN) throw new Error("META_CATALOG_ACCESS_TOKEN n\xE3o configurado");
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY n\xE3o configurado");
  const comPlaca = veiculos.filter((v) => placaValida(v.placa));
  if (comPlaca.length === 0) {
    throw new Error("nenhum ve\xEDculo com placa v\xE1lida no feed \u2014 sincroniza\xE7\xE3o abortada");
  }
  const produtos = await lerCatalogoMeta();
  const resultados = casarVeiculos(comPlaca, produtos);
  const linhas = resultados.map((r) => ({
    placa: r.placa.toUpperCase(),
    altimus_id: r.altimusId,
    meta_content_id: r.metaContentId,
    matched_name: r.matchedName,
    match_confidence: r.confidence,
    needs_review: r.needsReview,
    synced_at: (/* @__PURE__ */ new Date()).toISOString(),
    // Está no feed agora: se tinha saído e voltou, limpa a marca de saída.
    left_stock_at: null
  }));
  const resUpsert = await fetchComTimeout(
    `${SUPABASE_URL}/rest/v1/${TABELA}?on_conflict=placa`,
    {
      method: "POST",
      headers: cabecalhosSupabase({
        Prefer: "return=minimal,resolution=merge-duplicates"
      }),
      body: JSON.stringify(linhas)
    }
  );
  if (!resUpsert.ok) {
    const detalhe = await resUpsert.text().catch(() => "");
    throw new Error(`grava\xE7\xE3o falhou (${resUpsert.status}): ${detalhe.slice(0, 300)}`);
  }
  let marcadosForaDeEstoque = 0;
  let purgados = 0;
  const atuais = new Set(linhas.map((l) => l.placa));
  const existentes = await linhasNaTabela();
  const sumiram = existentes.filter((l) => !atuais.has(l.placa.toUpperCase()) && !l.left_stock_at).map((l) => l.placa).filter(placaValida);
  if (sumiram.length > 0 && sumiram.length > existentes.length * 0.5) {
    console.warn(
      `[catalog-sync] marca\xE7\xE3o de sa\xEDda abortada: ${sumiram.length} de ${existentes.length} placas sumiriam de uma vez \u2014 o feed provavelmente veio incompleto`
    );
  } else if (sumiram.length > 0) {
    const resSaida = await fetchComTimeout(
      `${SUPABASE_URL}/rest/v1/${TABELA}?placa=in.(${encodeURIComponent(listaPlacas(sumiram))})`,
      {
        method: "PATCH",
        headers: cabecalhosSupabase({ Prefer: "return=minimal" }),
        body: JSON.stringify({ left_stock_at: (/* @__PURE__ */ new Date()).toISOString() })
      }
    );
    if (resSaida.ok) marcadosForaDeEstoque = sumiram.length;
    else console.warn(`[catalog-sync] marca\xE7\xE3o de sa\xEDda non-ok (${resSaida.status})`);
  }
  const limite = new Date(
    Date.now() - RETENCAO_APOS_SAIDA_DIAS * 24 * 60 * 60 * 1e3
  ).toISOString();
  const vencidos = existentes.filter((l) => l.left_stock_at && l.left_stock_at < limite).length;
  if (vencidos > 0) {
    const resPurga = await fetchComTimeout(
      `${SUPABASE_URL}/rest/v1/${TABELA}?left_stock_at=lt.${encodeURIComponent(limite)}`,
      { method: "DELETE", headers: cabecalhosSupabase({ Prefer: "return=minimal" }) }
    );
    if (resPurga.ok) purgados = vencidos;
    else console.warn(`[catalog-sync] purga non-ok (${resPurga.status})`);
  }
  mapaCache = null;
  const needsReview = resultados.filter((r) => r.needsReview).length;
  const unmatched = resultados.filter((r) => r.confidence === "unmatched").length;
  const jaIguais = resultados.filter(
    (r) => r.metaContentId && r.metaContentId === r.altimusId
  ).length;
  if (needsReview > 0 || unmatched > 0) {
    console.warn(
      `[catalog-sync] ${unmatched} sem correspond\xEAncia, ${needsReview} para revis\xE3o:`,
      resultados.filter((r) => r.needsReview || r.confidence === "unmatched").map((r) => `${r.placa} (${r.altimusId}, ${r.confidence})`).join(", ")
    );
  }
  return {
    matched: resultados.filter((r) => r.confidence === "exact").length,
    needsReview,
    unmatched,
    jaIguais,
    marcadosForaDeEstoque,
    purgados,
    results: resultados
  };
}

// server/meta.ts
import { createHash } from "crypto";

// server/telefone.ts
function digitosNacionais(phone) {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) return d.slice(2);
  return d;
}
function dddDe(phone) {
  const d = digitosNacionais(phone);
  return d.length >= 10 ? d.slice(0, 2) : "";
}
function telefoneValido(phone) {
  const d = digitosNacionais(phone);
  if (d.length < 10 || d.length > 11) return false;
  if (!/^[1-9][1-9]$/.test(d.slice(0, 2))) return false;
  if (d.length === 11 && d[2] !== "9") return false;
  if (/^(\d)\1+$/.test(d.slice(2))) return false;
  return true;
}
function paraE164(phone) {
  const d = digitosNacionais(phone);
  return d ? `55${d}` : "";
}

// server/meta.ts
var PIXEL_PADRAO = "3253946971444443";
var PIXEL_ID = process.env.META_PIXEL_ID || PIXEL_PADRAO;
var CAPI_TOKEN = process.env.META_CAPI_TOKEN || "";
var API_VERSION = "v21.0";
var TEST_CODE = process.env.META_TEST_EVENT_CODE || "";
function hash(valor) {
  return createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
}
function capiConfigurado() {
  return Boolean(CAPI_TOKEN);
}
async function enviarEventoCapi(evento) {
  if (!CAPI_TOKEN) return false;
  try {
    const userData = {};
    const telefone = paraE164(evento.phone || "");
    if (telefone) userData.ph = [hash(telefone)];
    if (evento.firstName) userData.fn = [hash(evento.firstName.split(" ")[0])];
    if (evento.email) userData.em = [hash(evento.email)];
    if (evento.externalId) userData.external_id = [hash(evento.externalId)];
    if (evento.city) userData.ct = [hash(evento.city.replace(/\s/g, ""))];
    if (evento.clientIp) userData.client_ip_address = evento.clientIp;
    if (evento.userAgent) userData.client_user_agent = evento.userAgent;
    if (evento.fbp) userData.fbp = evento.fbp;
    if (evento.fbc) userData.fbc = evento.fbc;
    userData.country = [hash("br")];
    const customData = {
      currency: evento.currency || "BRL",
      value: evento.value ?? 0
    };
    if (evento.contentIds?.length) {
      customData.content_ids = evento.contentIds;
      customData.content_type = "product";
      customData.contents = evento.contentIds.map((id) => ({ id, quantity: 1 }));
    }
    if (evento.contentName) customData.content_name = evento.contentName;
    const body = {
      data: [
        {
          event_name: evento.eventName,
          event_time: Math.floor(Date.now() / 1e3),
          event_id: evento.eventId,
          action_source: evento.actionSource || "website",
          event_source_url: evento.sourceUrl || "https://manosveiculoscompra.com/",
          user_data: userData,
          custom_data: customData
        }
      ]
    };
    if (TEST_CODE) body.test_event_code = TEST_CODE;
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(CAPI_TOKEN)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.warn(`Meta CAPI respondeu ${res.status}: ${detalhe.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Meta CAPI falhou:", err);
    return false;
  }
}

// server/catalog.ts
var SITE_URL = "https://dgautomoveis.com.br";
var OPENAI_ADS_PIXEL_ID = process.env.VITE_OPENAI_ADS_PIXEL_ID || process.env.OPENAI_ADS_PIXEL_ID || "";
var META_PIXEL_ID = PIXEL_ID;
var DEFAULT_DG_FEED_URL = "http://localhost:3333/api/estoquejson?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14";
var FEED_URL = process.env.DG_FEED_URL || DEFAULT_DG_FEED_URL;
var DEALER = {
  name: "DG Autom\xF3veis",
  legalName: "DG Autom\xF3veis",
  url: SITE_URL,
  mainSite: "https://dgautomoveis.com.br",
  logo: "/logo-dg.png",
  telephone: "+55-47-98916-9598",
  whatsapp: "5547989169598",
  street: "Rua Dom Pedro II, 461 - Canoas",
  city: "Rio do Sul",
  region: "SC",
  postalCode: "89164-138",
  country: "BR",
  lat: -27.2207243,
  lng: -49.6539853,
  areaServed: "Alto Vale do Itaja\xED, Santa Catarina",
  foundingDate: "2020",
  ratingValue: 4.9,
  reviewCount: 250,
  instagram: "https://www.instagram.com/dgautomoveis__/",
  facebook: "https://www.instagram.com/dgautomoveis__/",
  maps: "https://www.google.com/maps/search/?api=1&query=DG+Automoveis+Rua+Dom+Pedro+II+461+Rio+do+Sul+SC",
  services: [
    "Venda de carros populares e exclusividades",
    "Avalia\xE7\xE3o e compra do seu usado",
    "Troca de ve\xEDculos com troco na troca",
    "Financiamento de ve\xEDculos em at\xE9 60x"
  ]
};
function decodeEntities(input) {
  if (!input) return "";
  return input.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}
function slugify(input) {
  return (input || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
}
function escHtml(input) {
  return (input || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatKm(km) {
  return `${km.toLocaleString("pt-BR")} km`;
}
function detectTransmission(description, options) {
  const hay = (description + " " + options.join(" ")).toLowerCase();
  if (/\baut/.test(hay) || /autom[aá]tic/.test(hay) || /cvt|tiptronic|s-tronic|dsg/.test(hay))
    return "Autom\xE1tico";
  if (/\bmanual\b|\bmec[aâ]nic/.test(hay)) return "Manual";
  return "";
}
var cache = null;
var CACHE_TTL_MS = 10 * 60 * 1e3;
function parseFeed(raw) {
  const trimmed = (raw || "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : data.veiculos || [];
      const vehicles2 = list.map((v) => {
        const brandName = (v.marca || "").trim() || "DG Autom\xF3veis";
        const modelName = (v.modelo || "").trim();
        const versaoName = (v.versao || "").trim();
        const fullName = `${brandName} ${modelName} ${versaoName}`.trim() || "Ve\xEDculo DG Autom\xF3veis";
        const desc = (v.descricao || v.observacao_anuncio || v.observacao || fullName).trim();
        const price = Number(v.valorVenda || v.valor || v.preco || 0);
        const kmNumber = Number(v.km || 0);
        const ops = Array.isArray(v.opcionais) ? v.opcionais : [];
        const imgs = Array.isArray(v.fotos) && v.fotos.length > 0 ? v.fotos : Array.isArray(v.images) && v.images.length > 0 ? v.images : v.foto ? [v.foto] : [];
        const anoFormatado = v.anoFabricacao && v.anoModelo ? `${v.anoFabricacao}/${v.anoModelo}` : String(v.anoModelo || v.anoFabricacao || v.ano || "");
        return {
          id: String(v.id),
          slug: `${slugify(fullName)}-${v.id}`,
          title: fullName,
          brand: brandName,
          tipo: String(v.tipo || "1"),
          year: anoFormatado,
          price,
          priceFormatted: price > 0 ? formatBRL(price) : "Consulte",
          km: formatKm(kmNumber),
          kmNumber,
          color: v.cor || "",
          fuel: v.combustivel || "",
          transmission: v.cambio || detectTransmission(desc, ops),
          options: ops,
          images: imgs,
          description: desc,
          placa: (v.placa || "").toUpperCase()
        };
      });
      return ordenarPorRecencia(vehicles2);
    } catch (e) {
      console.error("Error parsing JSON feed, falling back to XML:", e);
    }
  }
  const blocks = raw.split(/<veiculo>/i).slice(1).map((b) => b.split(/<\/veiculo>/i)[0]);
  const vehicles = [];
  for (const block of blocks) {
    const getTag = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
      return m ? decodeEntities(m[1]) : "";
    };
    const getAll = (tag) => {
      const out = [];
      const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
      let m;
      while ((m = re.exec(block)) !== null) out.push(decodeEntities(m[1]));
      return out.filter(Boolean);
    };
    const id = getTag("id");
    const description = getTag("descricao");
    if (!id || !description) continue;
    const price = parseFloat((getTag("valor") || "0").replace(",", ".")) || 0;
    const kmNumber = parseInt((getTag("km") || "0").replace(/\D/g, ""), 10) || 0;
    const options = getAll("opcional");
    const images = getAll("imagem");
    const brand = description.split(/\s|-/)[0] || "DG Autom\xF3veis";
    vehicles.push({
      id,
      slug: `${slugify(description)}-${id}`,
      title: description,
      brand,
      tipo: getTag("tipo"),
      year: getTag("ano"),
      price,
      priceFormatted: price > 0 ? formatBRL(price) : "Consulte",
      km: formatKm(kmNumber),
      kmNumber,
      color: getTag("cor"),
      fuel: getTag("combustivel"),
      transmission: detectTransmission(description, options),
      options,
      images,
      description,
      placa: getTag("placa").toUpperCase()
    });
  }
  return ordenarPorRecencia(vehicles);
}
function ordenarPorRecencia(lista) {
  return [...lista].sort((a, b) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return String(b.id).localeCompare(String(a.id), "pt-BR", { numeric: true });
  });
}
async function getVehicles() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS && cache.vehicles.length > 0) return cache.vehicles;
  const urlsToTry = [
    FEED_URL,
    "http://127.0.0.1:3333/api/estoquejson?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14",
    `http://127.0.0.1:${process.env.PORT || 3030}/api/estoquejson?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14`
  ];
  for (const url of Array.from(new Set(urlsToTry))) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3e3) });
      if (!res.ok) continue;
      const text = await res.text();
      const vehicles = await aplicarMapeamento(parseFeed(text));
      if (vehicles.length > 0) {
        cache = { at: Date.now(), vehicles };
        return vehicles;
      }
    } catch {
    }
  }
  return cache?.vehicles ?? [];
}
function autoDealerNode() {
  return {
    "@type": "AutoDealer",
    "@id": `${SITE_URL}/#dealer`,
    name: DEALER.name,
    description: `Concession\xE1ria de carros seminovos em ${DEALER.city}/${DEALER.region}, atuando desde ${DEALER.foundingDate}. Compra, venda, troca e financiamento no ${DEALER.areaServed}.`,
    url: DEALER.url,
    logo: DEALER.logo,
    image: DEALER.logo,
    telephone: DEALER.telephone,
    priceRange: "R$$",
    foundingDate: DEALER.foundingDate,
    address: {
      "@type": "PostalAddress",
      streetAddress: DEALER.street,
      addressLocality: DEALER.city,
      addressRegion: DEALER.region,
      postalCode: DEALER.postalCode,
      addressCountry: DEALER.country
    },
    geo: { "@type": "GeoCoordinates", latitude: DEALER.lat, longitude: DEALER.lng },
    hasMap: DEALER.maps,
    areaServed: DEALER.areaServed,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: DEALER.ratingValue,
      reviewCount: DEALER.reviewCount,
      bestRating: 5,
      worstRating: 1
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "19:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "08:00",
        closes: "13:00"
      }
    ],
    makesOffer: DEALER.services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s }
    })),
    knowsAbout: ["Carros seminovos", "Financiamento de ve\xEDculos", "Avalia\xE7\xE3o de usados", "Troca de carros"],
    sameAs: [DEALER.mainSite, DEALER.maps, DEALER.instagram, DEALER.facebook]
  };
}
function vehicleSchema(v) {
  const url = `${SITE_URL}/estoque/${v.slug}`;
  const node = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: v.title,
    description: `${v.title}. Seminovo revisado dispon\xEDvel na DG Autom\xF3veis em ${DEALER.city}/${DEALER.region}.`,
    url,
    brand: { "@type": "Brand", name: v.brand },
    vehicleModelDate: v.year || void 0,
    itemCondition: "https://schema.org/UsedCondition",
    mileageFromOdometer: { "@type": "QuantitativeValue", value: v.kmNumber, unitCode: "KMT" },
    image: v.images.length ? v.images : void 0,
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: v.price || void 0,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      url,
      seller: autoDealerNode()
    }
  };
  if (v.color) node.color = v.color;
  if (v.fuel) node.fuelType = v.fuel;
  if (v.transmission) node.vehicleTransmission = v.transmission;
  return node;
}
var BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,400..800;1,400..800&family=Manrope:wght@400;500;600;700;800&display=swap');

*{box-sizing:border-box}
body{margin:0;background:#F8FAFC;color:#0B1120;font-family:'Manrope',system-ui,sans-serif;line-height:1.5}
a{color:#0052FF;text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1200px;margin:0 auto;padding:24px 20px 80px}
header{display:flex;align-items:center;gap:14px;padding:16px 20px;background:#0B1120;color:#FFFFFF;border-bottom:1px solid #060B14}
header img{height:36px}
.muted{color:#475569}.small{font-size:13px}
nav.nav{margin-left:auto;display:flex;gap:18px}nav.nav a{color:#FFFFFF;font-weight:700;font-size:14px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:18px 0}
.fact{background:#F1F5F9;border:1px solid #E2E8F0;border-radius:14px;padding:14px 16px;color:#0B1120}
.fact b{display:block;font-size:13px;color:#475569;font-weight:700;margin-bottom:4px}
.faq{background:#F1F5F9;border:1px solid #E2E8F0;border-radius:14px;padding:16px 18px;margin:12px 0;color:#0B1120}
.faq h3{margin:0 0 8px;font-size:16px;font-family:'Bitter',serif;font-weight:700}.faq p{margin:0;color:#475569}
h1{font-size:28px;font-family:'Bitter',serif;font-weight:800;letter-spacing:-.02em;margin:18px 0 6px;color:#0B1120}
h2{font-size:20px;font-family:'Bitter',serif;font-weight:800;margin:28px 0 10px;color:#0B1120}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-top:18px}
.card{background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:all 0.2s ease}
.card:hover{border-color:#0052FF}
.card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#F1F5F9;display:block}
.card .card-media{display:block;line-height:0}
.card .body{padding:16px;display:flex;flex-direction:column;gap:8px;flex:1}
.card h3{font-size:16px;margin:0;font-family:'Bitter',serif;font-weight:700}
.card h3 a{color:#0B1120}.card h3 a:hover{color:#0052FF;text-decoration:none}
.price{color:#0052FF;font-weight:800;font-size:22px}
.card-actions{display:flex;gap:8px;margin-top:auto;padding-top:12px}
.btn{flex:1;text-align:center;background:#0052FF;color:#FFFFFF;font-weight:700;font-size:13px;padding:12px 10px;border-radius:12px;transition:all 0.2s ease}
.btn:hover{background:#003ECC;text-decoration:none}
.btn.ghost{background:#25D366;color:#ffffff}
.btn.ghost:hover{background:#1eb855}
.filtros{display:flex;flex-direction:column;gap:12px;margin:18px 0 12px}
.filtro-linha{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.filtro-linha>b{font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:.08em;min-width:60px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips .chip{color:#0B1120;font-size:13px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:999px;padding:6px 14px;font-weight:600}
.chips .chip:hover{background:#E2E8F0;text-decoration:none}
.chips .chip.on{background:#0052FF;border-color:#0052FF;color:#FFFFFF;font-weight:700}
.specs{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.chip{background:#F1F5F9;border:1px solid #E2E8F0;border-radius:999px;padding:6px 14px;font-size:13px;color:#0B1120;font-weight:600}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:18px 0}
.gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;background:#F1F5F9;border:1px solid #E2E8F0}
.cta{display:inline-block;background:#0052FF;color:#FFFFFF;font-weight:800;padding:14px 24px;border-radius:14px;margin-top:12px;font-size:14px}
.cta:hover{background:#003ECC;text-decoration:none}
.cta.alt{background:#25D366;color:#ffffff}
.cta.alt:hover{background:#1eb855}
ul.opts{columns:2;gap:24px;padding-left:18px;color:#0B1120}@media(max-width:600px){ul.opts{columns:1}}
footer{background:#0B1120;color:#E2E8F0;border-top:1px solid #060B14;margin-top:40px;padding:32px 20px;font-size:13px}
footer a{color:#FFFFFF;font-weight:700}
nav.bc{font-size:13px;margin:12px 0 0;color:#475569}
`;
function medicaoScript(veiculo) {
  if (!OPENAI_ADS_PIXEL_ID) return "";
  const dadosVeiculo = veiculo ? JSON.stringify({ id: veiculo.id, nome: veiculo.nome, preco: Math.round(veiculo.preco) }).replace(/</g, "\\u003c") : "null";
  return `<script>
// Mesma guarda do index.html: servidor rodando em localhost n\xE3o manda evento
// para o dataset de produ\xE7\xE3o.
if (!/^(localhost|127.0.0.1|[::1])$/.test(location.hostname))
(function(w,d,s,u,id){
  if(!id) return;
  if(!w.oaiq){var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;
    var j=d.createElement(s);j.async=1;j.src=u;
    var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(j,f);}
  w.oaiq("init",{pixelId:id,debug:false});

  function novoId(){
    try{ if(w.crypto&&w.crypto.randomUUID) return w.crypto.randomUUID(); }catch(e){}
    return "evt_"+Date.now()+"_"+Math.random().toString(36).slice(2,11);
  }

  var v = ${dadosVeiculo};
  if(v){
    w.oaiq("measure","contents_viewed",{type:"contents",amount:v.preco,currency:"BRL",
      contents:[{id:v.id,name:v.nome,content_type:"vehicle",quantity:1,amount:v.preco}]});
  }

  // Delega\xE7\xE3o: os CTAs s\xE3o links renderizados no servidor, ent\xE3o um listener
  // no documento cobre todos, inclusive os cards do cat\xE1logo.
  d.addEventListener("click", function(ev){
    var a = ev.target && ev.target.closest ? ev.target.closest("a") : null;
    if(!a || !a.href) return;
    var canal = a.href.indexOf("wa.me") > -1 ? "whatsapp"
              : a.href.indexOf("tel:") === 0 ? "telefone" : null;
    if(!canal) return;

    var eid = novoId();
    w.oaiq("measure","custom",{type:"custom"},{event_id:eid,custom_event_name:canal});

    // sendBeacon sobrevive \xE0 navega\xE7\xE3o para fora; o servidor reenvia pela CAPI.
    try{
      var corpo = JSON.stringify({evento:canal,event_id:eid,contexto:"catalogo",
        source_url:w.location.origin+w.location.pathname});
      if(navigator.sendBeacon){
        navigator.sendBeacon("/api/ads/conversao", new Blob([corpo],{type:"application/json"}));
      }
    }catch(e){}
  }, true);
})(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js",${JSON.stringify(OPENAI_ADS_PIXEL_ID)});
</script>`;
}
function metaPixelScript(veiculo) {
  if (!META_PIXEL_ID) return "";
  const dadosVeiculo = veiculo ? JSON.stringify({
    id: veiculo.metaId || veiculo.id,
    nome: veiculo.nome,
    preco: Math.round(veiculo.preco)
  }).replace(/</g, "\\u003c") : "null";
  return `<script>
// Mesma guarda do index.html: servidor rodando em localhost n\xE3o manda evento
// para o dataset de produ\xE7\xE3o.
if (!/^(localhost|127.0.0.1|[::1])$/.test(location.hostname)) {
// Mesmo cookie do funil (src/lib/visitante.ts): o visitante que chega pelo
// cat\xE1logo e converte no funil precisa ser a mesma pessoa para a Meta.
window.__manosVid = (function(){
  try {
    var m = document.cookie.match(/(?:^|;s*)manos_vid=([^;]*)/);
    if (m) return decodeURIComponent(m[1]);
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,11);
    document.cookie = "manos_vid=" + encodeURIComponent(id) +
      ";Max-Age=63072000;Path=/;SameSite=Lax" +
      (location.protocol === "https:" ? ";Secure" : "");
    return id;
  } catch (e) { return ""; }
})();
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(META_PIXEL_ID)}, window.__manosVid ? {external_id: window.__manosVid} : {});
fbq('track', 'PageView');
(function(w,d){
  function novoId(){
    try{ if(w.crypto&&w.crypto.randomUUID) return w.crypto.randomUUID(); }catch(e){}
    return "evt_"+Date.now()+"_"+Math.random().toString(36).slice(2,11);
  }

  var v = ${dadosVeiculo};
  if(v){
    fbq('track','ViewContent',{content_ids:[v.id],content_type:'product',
      content_name:v.nome,value:v.preco,currency:'BRL'});
  }

  // Delega\xE7\xE3o: os CTAs ("Tenho interesse" e WhatsApp) carregam o ve\xEDculo em
  // data-attributes \u2014 cobre tanto a p\xE1gina de um carro quanto os cards da
  // listagem em /estoque, todos com o mesmo listener.
  d.addEventListener("click", function(ev){
    var a = ev.target && ev.target.closest ? ev.target.closest("a[data-vid]") : null;
    if(!a) return;

    var eid = novoId();
    var vid = a.getAttribute("data-vid");
    var nome = a.getAttribute("data-vname") || "";
    var preco = parseFloat(a.getAttribute("data-vprice") || "0") || 0;

    fbq('track','AddToCart',{content_ids:[vid],content_type:'product',
      content_name:nome,value:preco,currency:'BRL'},{eventID:eid});

    // Clique de WhatsApp \xE9 contato de verdade, n\xE3o s\xF3 inten\xE7\xE3o de carrinho. O
    // evento vai separado, com id pr\xF3prio: s\xE3o dois acontecimentos distintos
    // para a Meta, e junt\xE1-los num s\xF3 faria a plataforma deduplicar um contra o
    // outro. "Tenho interesse" n\xE3o conta \u2014 aquilo leva ao funil, n\xE3o abre
    // conversa.
    var ehWhatsApp = (a.getAttribute("href") || "").indexOf("wa.me") > -1;
    var eidContato = ehWhatsApp ? novoId() : "";
    if(ehWhatsApp){
      fbq('track','Contact',{content_ids:[vid],content_type:'product',
        content_name:nome},{eventID:eidContato});
    }

    // sendBeacon sobrevive \xE0 navega\xE7\xE3o (WhatsApp sai do site); o servidor
    // reenvia pela Conversions API com o mesmo event_id, deduplicando os dois.
    try{
      var corpo = JSON.stringify({evento:"catalogo_addtocart",event_id:eid,
        vehicle_id:vid,vehicle_name:nome,value:preco,
        source_url:w.location.origin+w.location.pathname});
      if(navigator.sendBeacon){
        navigator.sendBeacon("/api/ads/conversao", new Blob([corpo],{type:"application/json"}));
        if(ehWhatsApp){
          var corpoContato = JSON.stringify({evento:"catalogo_contato",event_id:eidContato,
            vehicle_id:vid,vehicle_name:nome,
            source_url:w.location.origin+w.location.pathname});
          navigator.sendBeacon("/api/ads/conversao", new Blob([corpoContato],{type:"application/json"}));
        }
      }
    }catch(e){}
  }, true);
})(window,document);
}
</script>`;
}
function layout(opts) {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // Mesma tag do index.html: a Meta pode conferir qualquer URL do domínio, e
    // /estoque é justamente a parte que ela mais rastreia.
    '<meta name="facebook-domain-verification" content="n91926e6jtyofyvpj8jgf2z68uasoe">',
    `<title>${escHtml(opts.title)}</title>`,
    `<meta name="description" content="${escHtml(opts.description)}">`,
    `<link rel="canonical" href="${escHtml(opts.canonical)}">`,
    `<meta name="robots" content="${escHtml(opts.robots ?? "index,follow,max-image-preview:large")}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escHtml(DEALER.name)}">`,
    `<meta property="og:title" content="${escHtml(opts.title)}">`,
    `<meta property="og:description" content="${escHtml(opts.description)}">`,
    `<meta property="og:url" content="${escHtml(opts.canonical)}">`,
    opts.ogImage ? `<meta property="og:image" content="${escHtml(opts.ogImage)}">` : "",
    '<meta name="twitter:card" content="summary_large_image">',
    `<style>${BASE_CSS}</style>`,
    ...opts.jsonLdBlocks.map(
      (b) => `<script type="application/ld+json">${b}</script>`
    )
  ].join("\n");
  return `<!doctype html>
<html lang="pt-BR">
<head>
${head}
${metaPixelScript(opts.veiculo)}
${medicaoScript(opts.veiculo)}
</head>
<body>
<header>
  <a href="/estoque"><img src="${DEALER.logo}" alt="${escHtml(DEALER.name)}"></a>
  <nav class="nav small">
    <a href="/estoque">Estoque</a>
    <a href="/sobre">A DG Autom\xF3veis</a>
    <a href="/perguntas-frequentes">D\xFAvidas</a>
  </nav>
</header>
<div class="wrap">
${opts.body}
</div>
<footer>
  <strong>${escHtml(DEALER.name)}</strong> \u2014 ${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}.<br>
  WhatsApp ${escHtml(DEALER.telephone)} \u2022 <a href="${DEALER.mainSite}">${DEALER.mainSite.replace("https://", "")}</a>
</footer>
</body>
</html>`;
}
var FAIXAS = [
  { chave: "ate-50k", rotulo: "At\xE9 R$ 50 mil", min: 0, max: 5e4 },
  { chave: "50k-100k", rotulo: "R$ 50 a 100 mil", min: 5e4, max: 1e5 },
  { chave: "acima-100k", rotulo: "Acima de R$ 100 mil", min: 1e5, max: Infinity }
];
function marcasDoEstoque(vehicles) {
  const contagem = /* @__PURE__ */ new Map();
  for (const v of vehicles) {
    const m = v.brand.trim();
    if (m) contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  return [...contagem.entries()].map(([marca, total]) => ({ marca, total })).sort((a, b) => b.total - a.total || a.marca.localeCompare(b.marca));
}
function aplicarFiltro(vehicles, filtro) {
  let out = vehicles;
  const faixa = FAIXAS.find((f) => f.chave === filtro.faixa);
  if (faixa) out = out.filter((v) => v.price > faixa.min && v.price <= faixa.max);
  if (filtro.marca) {
    const alvo = filtro.marca.toLowerCase();
    out = out.filter((v) => v.brand.toLowerCase() === alvo);
  }
  return out;
}
function renderCatalog(vehicles, filtro = {}, todos = vehicles) {
  const faixaAtiva = FAIXAS.find((f) => f.chave === filtro.faixa);
  const marcaAtiva = filtro.marca;
  const filtrado = Boolean(faixaAtiva || marcaAtiva);
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Estoque de seminovos \u2014 DG Autom\xF3veis",
    numberOfItems: vehicles.length,
    itemListElement: vehicles.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/estoque/${v.slug}`,
      name: v.title
    }))
  };
  const chip = (rotulo, href, ativo) => `<a class="chip${ativo ? " on" : ""}" href="${escHtml(href)}">${escHtml(rotulo)}</a>`;
  const filtroFaixas = [
    chip("Todos os pre\xE7os", "/estoque" + (marcaAtiva ? `?marca=${encodeURIComponent(marcaAtiva)}` : ""), !faixaAtiva),
    ...FAIXAS.map(
      (f) => chip(
        f.rotulo,
        `/estoque?faixa=${f.chave}` + (marcaAtiva ? `&marca=${encodeURIComponent(marcaAtiva)}` : ""),
        faixaAtiva?.chave === f.chave
      )
    )
  ].join("\n");
  const filtroMarcas = [
    chip("Todas as marcas", "/estoque" + (faixaAtiva ? `?faixa=${faixaAtiva.chave}` : ""), !marcaAtiva),
    ...marcasDoEstoque(todos).slice(0, 12).map(
      (m) => chip(
        `${m.marca} (${m.total})`,
        `/estoque?marca=${encodeURIComponent(m.marca)}` + (faixaAtiva ? `&faixa=${faixaAtiva.chave}` : ""),
        marcaAtiva?.toLowerCase() === m.marca.toLowerCase()
      )
    )
  ].join("\n");
  const cards = vehicles.map(
    (v) => `
  <div class="card">
    <a href="/estoque/${escHtml(v.slug)}" class="card-media">
      ${v.images[0] ? `<img src="${escHtml(v.images[0])}" alt="${escHtml(v.title)}" loading="lazy">` : ""}
    </a>
    <div class="body">
      <h3><a href="/estoque/${escHtml(v.slug)}">${escHtml(v.title)}</a></h3>
      <div class="muted small">${escHtml(v.year)} \u2022 ${escHtml(v.km)}${v.fuel ? " \u2022 " + escHtml(v.fuel) : ""}</div>
      <div class="price">${escHtml(v.priceFormatted)}</div>
      <div class="card-actions">
        <a class="btn" href="${SITE_URL}/?id=${encodeURIComponent(v.id)}" data-vid="${escHtml(v.metaContentId || v.id)}" data-vname="${escHtml(v.title)}" data-vprice="${v.price || 0}">Tenho interesse</a>
        <a class="btn ghost" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent("Ol\xE1! Tenho interesse no " + v.title)}" data-vid="${escHtml(v.metaContentId || v.id)}" data-vname="${escHtml(v.title)}" data-vprice="${v.price || 0}">WhatsApp</a>
      </div>
    </div>
  </div>`
  ).join("\n");
  const titulo = marcaAtiva ? `${marcaAtiva} seminovos em ${DEALER.city}/${DEALER.region}` : faixaAtiva ? `Carros seminovos ${faixaAtiva.rotulo.toLowerCase()} em ${DEALER.city}/${DEALER.region}` : `Carros seminovos em ${DEALER.city}/${DEALER.region}`;
  const body = `
  <h1>${escHtml(titulo)}</h1>
  <p class="muted">${vehicles.length} ${vehicles.length === 1 ? "ve\xEDculo dispon\xEDvel" : "ve\xEDculos dispon\xEDveis"} no estoque da ${escHtml(DEALER.name)}, revenda no ${escHtml(DEALER.areaServed)}. Atualizado em tempo real.</p>
  <div class="filtros">
    <div class="filtro-linha"><b>Pre\xE7o</b><div class="chips">${filtroFaixas}</div></div>
    <div class="filtro-linha"><b>Marca</b><div class="chips">${filtroMarcas}</div></div>
  </div>
  <a class="cta" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent("Ol\xE1! Vi o estoque no site e quero falar com um consultor.")}">Falar com consultor no WhatsApp</a>
  ${vehicles.length ? `<div class="grid">${cards}</div>` : `<div class="faq"><h3>Nenhum carro nesse filtro agora</h3><p>O estoque gira toda semana. <a href="/estoque">Ver o estoque completo</a> ou <a href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent("Ol\xE1! Procuro um carro que n\xE3o vi no site.")}">falar com um consultor</a> \u2014 a gente procura um para voc\xEA.</p></div>`}`;
  return layout({
    title: filtrado ? `${titulo} | ${DEALER.name}` : `Estoque de Seminovos em ${DEALER.city}/${DEALER.region} | ${DEALER.name}`,
    description: `Confira ${vehicles.length} carros seminovos revisados na ${DEALER.name}, em ${DEALER.city}/${DEALER.region}. Compra, troca e financiamento no Alto Vale do Itaja\xED.`,
    // Views filtradas apontam para /estoque e não indexam: evita conteúdo
    // duplicado competindo com a página principal do catálogo.
    canonical: `${SITE_URL}/estoque`,
    robots: filtrado ? "noindex,follow" : void 0,
    ogImage: vehicles[0]?.images[0] || DEALER.logo,
    jsonLdBlocks: [jsonLd(autoDealerNode()), jsonLd(itemList)],
    body
  });
}
function renderVehicle(v) {
  const canonical = `${SITE_URL}/estoque/${v.slug}`;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Estoque", item: `${SITE_URL}/estoque` },
      { "@type": "ListItem", position: 2, name: v.title, item: canonical }
    ]
  };
  const specs = [
    v.year && `<span class="chip">Ano ${escHtml(v.year)}</span>`,
    v.km && `<span class="chip">${escHtml(v.km)}</span>`,
    v.fuel && `<span class="chip">${escHtml(v.fuel)}</span>`,
    v.transmission && `<span class="chip">${escHtml(v.transmission)}</span>`,
    v.color && `<span class="chip">Cor ${escHtml(v.color)}</span>`
  ].filter(Boolean).join("\n");
  const gallery = v.images.slice(0, 12).map((src) => `<img src="${escHtml(src)}" alt="${escHtml(v.title)}" loading="lazy">`).join("\n");
  const opts = v.options.length ? `<h2>Opcionais</h2><ul class="opts">${v.options.map((o) => `<li>${escHtml(o)}</li>`).join("")}</ul>` : "";
  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> \u203A <span class="muted">${escHtml(v.title)}</span></nav>
  <h1>${escHtml(v.title)}</h1>
  <div class="price" style="font-size:26px">${escHtml(v.priceFormatted)}</div>
  <div class="specs">${specs}</div>
  <a class="cta" href="${SITE_URL}/?id=${encodeURIComponent(v.id)}" data-vid="${escHtml(v.metaContentId || v.id)}" data-vname="${escHtml(v.title)}" data-vprice="${v.price || 0}">Tenho interesse \u2014 receber proposta</a>
  &nbsp;
  <a class="cta alt" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent("Ol\xE1! Tenho interesse no " + v.title + " (" + canonical + ")")}" data-vid="${escHtml(v.metaContentId || v.id)}" data-vname="${escHtml(v.title)}" data-vprice="${v.price || 0}">WhatsApp</a>
  ${gallery ? `<h2>Fotos</h2><div class="gallery">${gallery}</div>` : ""}
  <h2>Sobre este ve\xEDculo</h2>
  <p>${escHtml(v.title)} \xE0 venda na <strong>${escHtml(DEALER.name)}</strong>, em ${escHtml(DEALER.city)}/${DEALER.region}. Ve\xEDculo seminovo${v.km ? ` com ${escHtml(v.km)}` : ""}${v.fuel ? `, motor ${escHtml(v.fuel)}` : ""}${v.transmission ? `, c\xE2mbio ${escHtml(v.transmission)}` : ""}. Aceitamos seu usado na troca e oferecemos financiamento.</p>
  ${opts}`;
  return layout({
    title: `${v.title} \u2014 ${v.priceFormatted} | ${DEALER.name}`,
    description: `${v.title} por ${v.priceFormatted} na ${DEALER.name}, ${DEALER.city}/${DEALER.region}.${v.km ? " " + v.km + "." : ""} Compra, troca e financiamento.`,
    canonical,
    ogImage: v.images[0] || DEALER.logo,
    jsonLdBlocks: [jsonLd(vehicleSchema(v)), jsonLd(breadcrumb)],
    veiculo: { id: v.id, nome: v.title, preco: v.price, metaId: v.metaContentId },
    body
  });
}
function renderSold(slug, similares) {
  const canonical = `${SITE_URL}/estoque`;
  const cards = similares.map(
    (v) => `
  <a class="card" href="/estoque/${escHtml(v.slug)}">
    ${v.images[0] ? `<img src="${escHtml(v.images[0])}" alt="${escHtml(v.title)}" loading="lazy">` : ""}
    <div class="body">
      <h3>${escHtml(v.title)}</h3>
      <div class="muted small">${escHtml(v.year)} \u2022 ${escHtml(v.km)}${v.fuel ? " \u2022 " + escHtml(v.fuel) : ""}</div>
      <div class="price">${escHtml(v.priceFormatted)}</div>
    </div>
  </a>`
  ).join("\n");
  const procurado = slug.replace(/-\d+$/, "").replace(/-/g, " ").trim();
  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> \u203A <span class="muted">Ve\xEDculo vendido</span></nav>
  <h1>Esse carro j\xE1 foi vendido</h1>
  <p class="muted">${procurado ? `O <strong>${escHtml(procurado)}</strong> saiu do nosso p\xE1tio.` : "Esse ve\xEDculo saiu do nosso p\xE1tio."} O estoque gira toda semana \u2014 veja abaixo o que temos agora, ou fale com um consultor que a gente procura um parecido para voc\xEA.</p>
  <a class="cta" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent("Ol\xE1! Vi que o " + (procurado || "carro") + " j\xE1 foi vendido. Voc\xEAs t\xEAm algo parecido?")}">Quero um parecido \u2014 falar no WhatsApp</a>
  &nbsp;
  <a class="cta alt" href="/estoque">Ver estoque completo</a>
  ${cards ? `<h2>Dispon\xEDveis agora</h2><div class="grid">${cards}</div>` : ""}`;
  return layout({
    title: "Ve\xEDculo vendido \u2014 veja o estoque atual | DG Autom\xF3veis",
    description: `Este ve\xEDculo j\xE1 foi vendido. Veja o estoque atual de seminovos da ${DEALER.name} em ${DEALER.city}/${DEALER.region}.`,
    canonical,
    ogImage: similares[0]?.images[0] || DEALER.logo,
    // noindex: a URL não deve mais disputar espaço no índice.
    robots: "noindex,follow",
    jsonLdBlocks: [jsonLd(autoDealerNode())],
    body
  });
}
function findSimilar(vehicles, slug, limit = 3) {
  const marca = slug.split("-")[0]?.toLowerCase() ?? "";
  const mesmaMarca = marca ? vehicles.filter((v) => v.brand.toLowerCase() === marca || v.slug.startsWith(marca + "-")) : [];
  const resto = vehicles.filter((v) => !mesmaMarca.includes(v));
  return [...mesmaMarca, ...resto].slice(0, limit);
}
var FAQS = [
  {
    q: "A DG Autom\xF3veis \xE9 confi\xE1vel?",
    a: `Sim. A ${DEALER.name} \xE9 uma concession\xE1ria de seminovos com loja f\xEDsica em ${DEALER.city}/${DEALER.region}, atuando desde ${DEALER.foundingDate}, com nota ${String(DEALER.ratingValue).replace(".", ",")} no Google em ${DEALER.reviewCount} avalia\xE7\xF5es. Todos os ve\xEDculos passam por revis\xE3o antes da venda.`
  },
  {
    q: "Onde fica a DG Autom\xF3veis?",
    a: `A loja fica na ${DEALER.street}, ${DEALER.city}/${DEALER.region}, CEP ${DEALER.postalCode}. Atendemos clientes de todo o ${DEALER.areaServed}.`
  },
  {
    q: "Qual o hor\xE1rio de funcionamento da DG Autom\xF3veis?",
    a: "Segunda a sexta das 8h \xE0s 19h (sem fechar ao meio-dia) e aos s\xE1bados das 8h \xE0s 13h."
  },
  {
    q: "A DG Autom\xF3veis aceita meu carro usado na troca?",
    a: "Sim. Avaliamos o seu usado e aceitamos como parte do pagamento na compra de outro ve\xEDculo, com avalia\xE7\xE3o justa e na hora."
  },
  {
    q: "A DG Autom\xF3veis faz financiamento de seminovos?",
    a: "Sim. Trabalhamos com financiamento de ve\xEDculos, simula\xE7\xE3o de parcelas e aprova\xE7\xE3o de cr\xE9dito, inclusive com op\xE7\xF5es de entrada facilitada."
  },
  {
    q: "Como ver o estoque de carros da DG Autom\xF3veis?",
    a: `O estoque completo e atualizado em tempo real est\xE1 em ${SITE_URL}/estoque, com fotos, pre\xE7o, ano e quilometragem de cada ve\xEDculo.`
  },
  {
    q: "Como falar com um consultor da DG Autom\xF3veis?",
    a: `Pelo WhatsApp ${DEALER.telephone} ou diretamente em ${SITE_URL}, onde voc\xEA recebe uma proposta personalizada.`
  }
];
function renderAbout() {
  const canonical = `${SITE_URL}/sobre`;
  const schema = { "@context": "https://schema.org", ...autoDealerNode() };
  const facts = [
    ["Avalia\xE7\xE3o no Google", `${String(DEALER.ratingValue).replace(".", ",")} \u2605 (${DEALER.reviewCount} avalia\xE7\xF5es)`],
    ["Desde", DEALER.foundingDate],
    ["Endere\xE7o", `${DEALER.street}, ${DEALER.city}/${DEALER.region}`],
    ["Hor\xE1rio", "Seg a Sex 8h\u201319h \u2022 S\xE1b 8h\u201313h"],
    ["Atendemos", DEALER.areaServed],
    ["WhatsApp", DEALER.telephone]
  ].map(([k, v]) => `<div class="fact"><b>${escHtml(k)}</b>${escHtml(v)}</div>`).join("\n");
  const services = DEALER.services.map((s) => `<li>${escHtml(s)}</li>`).join("");
  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> \u203A <span class="muted">A DG Autom\xF3veis</span></nav>
  <h1>DG Autom\xF3veis \u2014 concession\xE1ria de seminovos em ${escHtml(DEALER.city)}/${DEALER.region}</h1>
  <p class="muted">Desde ${escHtml(DEALER.foundingDate)}, a ${escHtml(DEALER.name)} \xE9 refer\xEAncia em carros seminovos no ${escHtml(DEALER.areaServed)}, com nota ${String(DEALER.ratingValue).replace(".", ",")} no Google em ${DEALER.reviewCount} avalia\xE7\xF5es.</p>
  <div class="facts">${facts}</div>
  <a class="cta" href="/estoque">Ver estoque de seminovos</a>
  &nbsp;
  <a class="cta alt" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent("Ol\xE1! Quero falar com um consultor da DG Autom\xF3veis.")}">WhatsApp</a>
  <h2>O que a DG Autom\xF3veis oferece</h2>
  <ul class="opts">${services}</ul>
  <h2>Sobre a DG Autom\xF3veis</h2>
  <p>A ${escHtml(DEALER.name)} \xE9 uma concession\xE1ria de ve\xEDculos seminovos localizada em ${escHtml(DEALER.city)}, Santa Catarina, na ${escHtml(DEALER.street)}. Atuando desde ${escHtml(DEALER.foundingDate)}, atende compradores de todo o ${escHtml(DEALER.areaServed)} com compra, venda, troca e financiamento de carros. O estoque \xE9 atualizado em tempo real em <a href="/estoque">${SITE_URL}/estoque</a>.</p>`;
  return layout({
    title: `Sobre a DG Autom\xF3veis \u2014 Seminovos em ${DEALER.city}/${DEALER.region}`,
    description: `DG Autom\xF3veis: concession\xE1ria de seminovos em ${DEALER.city}/${DEALER.region} desde ${DEALER.foundingDate}, nota ${String(DEALER.ratingValue).replace(".", ",")} no Google (${DEALER.reviewCount} avalia\xE7\xF5es). Compra, troca e financiamento.`,
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [jsonLd(schema)],
    body
  });
}
function renderFAQ() {
  const canonical = `${SITE_URL}/perguntas-frequentes`;
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };
  const items = FAQS.map(
    (f) => `<div class="faq"><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`
  ).join("\n");
  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> \u203A <span class="muted">D\xFAvidas frequentes</span></nav>
  <h1>Perguntas frequentes \u2014 DG Autom\xF3veis</h1>
  <p class="muted">Tudo sobre comprar, vender, trocar e financiar seu carro na ${escHtml(DEALER.name)}, em ${escHtml(DEALER.city)}/${DEALER.region}.</p>
  ${items}
  <a class="cta" href="/estoque">Ver estoque de seminovos</a>`;
  return layout({
    title: `Perguntas Frequentes \u2014 DG Autom\xF3veis (${DEALER.city}/${DEALER.region})`,
    description: `Respostas sobre a DG Autom\xF3veis: confian\xE7a, localiza\xE7\xE3o, hor\xE1rio, troca, financiamento e estoque de seminovos em ${DEALER.city}/${DEALER.region}.`,
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [jsonLd(faqSchema)],
    body
  });
}
function renderPrivacy() {
  const canonical = `${SITE_URL}/politica-de-privacidade`;
  const body = `
  <nav class="bc"><a href="/estoque">In\xEDcio</a> \u203A <span class="muted">Pol\xEDtica de Privacidade</span></nav>
  <h1>Pol\xEDtica de Privacidade</h1>
  <p class="muted">\xDAltima atualiza\xE7\xE3o: julho de 2026. Esta pol\xEDtica explica como a ${escHtml(DEALER.legalName)} coleta, usa e protege seus dados pessoais, em conformidade com a Lei Geral de Prote\xE7\xE3o de Dados (LGPD \u2014 Lei n\xBA 13.709/2018).</p>

  <h2>1. Quem somos</h2>
  <p>A ${escHtml(DEALER.name)} \xE9 uma concession\xE1ria de ve\xEDculos seminovos localizada em ${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}. Somos a controladora dos dados coletados neste site.</p>

  <h2>2. Dados que coletamos</h2>
  <p>Ao preencher nosso formul\xE1rio de avalia\xE7\xE3o para venda do seu ve\xEDculo, coletamos:</p>
  <ul>
    <li><strong>Dados de contato:</strong> nome, telefone e cidade.</li>
    <li><strong>Dados do ve\xEDculo:</strong> placa, marca, modelo, ano, quilometragem, cor e o valor desejado.</li>
  </ul>
  <p>Tamb\xE9m podemos coletar automaticamente dados de navega\xE7\xE3o (endere\xE7o IP, tipo de dispositivo e p\xE1ginas visitadas) por meio de cookies e tecnologias similares.</p>

  <h2>3. Como usamos seus dados</h2>
  <ul>
    <li>Avaliar seu ve\xEDculo e elaborar uma proposta comercial de compra.</li>
    <li>Permitir que nossa equipe comercial entre em contato por telefone.</li>
    <li>Melhorar nossos servi\xE7os e a sua experi\xEAncia no site.</li>
    <li>Mensurar e otimizar nossas campanhas de an\xFAncios.</li>
  </ul>

  <h2>4. Cookies e an\xFAncios (Google e Meta/Facebook)</h2>
  <p>Utilizamos cookies e pixels de rastreamento, que podem incluir Google Ads, Google Analytics e Meta (Facebook/Instagram) Pixel, para medir a efic\xE1cia dos nossos an\xFAncios e exibir ofertas relevantes. Esses parceiros tratam dados conforme suas pr\xF3prias pol\xEDticas de privacidade. Voc\xEA pode gerenciar ou bloquear cookies nas configura\xE7\xF5es do seu navegador.</p>

  <h2>5. Compartilhamento de dados</h2>
  <p>N\xF3s n\xE3o vendemos seus dados pessoais. Podemos compartilh\xE1-los com prestadores de servi\xE7o que nos apoiam (por exemplo, ferramentas de CRM e automa\xE7\xE3o) e com plataformas de an\xFAncios (Google e Meta), exclusivamente para as finalidades descritas acima e com as devidas medidas de seguran\xE7a.</p>

  <h2>6. Por quanto tempo guardamos</h2>
  <p>Mantemos seus dados apenas pelo tempo necess\xE1rio \xE0s finalidades descritas ou conforme exigido por lei. Depois disso, eles s\xE3o exclu\xEDdos ou anonimizados.</p>

  <h2>7. Seus direitos (LGPD)</h2>
  <p>Voc\xEA pode, a qualquer momento, solicitar: confirma\xE7\xE3o e acesso aos seus dados, corre\xE7\xE3o, anonimiza\xE7\xE3o, portabilidade, exclus\xE3o e revoga\xE7\xE3o do consentimento. Para exercer esses direitos, entre em contato conosco pelos canais abaixo.</p>

  <h2>8. Seguran\xE7a</h2>
  <p>Adotamos medidas t\xE9cnicas e organizacionais para proteger seus dados contra acesso n\xE3o autorizado, perda ou altera\xE7\xE3o.</p>

  <h2>9. Contato</h2>
  <p>${escHtml(DEALER.name)}<br>${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}<br>Telefone: ${escHtml(DEALER.telephone)}</p>

  <a class="cta" href="/vendasrapidas">Voltar e avaliar meu carro</a>`;
  return layout({
    title: "Pol\xEDtica de Privacidade \u2014 DG Autom\xF3veis",
    description: "Como a DG Autom\xF3veis coleta, usa e protege seus dados pessoais (LGPD), incluindo cookies e an\xFAncios do Google e da Meta/Facebook.",
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [],
    body
  });
}
function renderLlms(vehicles) {
  return `# DG Autom\xF3veis

> Concession\xE1ria de carros seminovos em ${DEALER.city}/${DEALER.region}, Brasil, desde ${DEALER.foundingDate}. Nota ${String(DEALER.ratingValue).replace(".", ",")}/5 no Google (${DEALER.reviewCount} avalia\xE7\xF5es). Compra, venda, troca e financiamento de ve\xEDculos no ${DEALER.areaServed}.

## Contato
- Endere\xE7o: ${DEALER.street}, ${DEALER.city}/${DEALER.region}, ${DEALER.postalCode}, Brasil
- WhatsApp/Telefone: ${DEALER.telephone}
- Hor\xE1rio: Segunda a sexta 8h-19h; S\xE1bado 8h-13h
- Site: ${SITE_URL}
- Google Maps: ${DEALER.maps}
- Instagram: ${DEALER.instagram}
- Facebook: ${DEALER.facebook}

## P\xE1ginas principais
- Estoque de seminovos (atualizado em tempo real): ${SITE_URL}/estoque
- Sobre a empresa: ${SITE_URL}/sobre
- Perguntas frequentes: ${SITE_URL}/perguntas-frequentes
- Sitemap: ${SITE_URL}/sitemap.xml

## Servi\xE7os
${DEALER.services.map((s) => `- ${s}`).join("\n")}

## Estoque atual
${vehicles.length} ve\xEDculos dispon\xEDveis no momento.
`;
}
function renderSitemap(vehicles) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, priority: "0.8" },
    { loc: `${SITE_URL}/estoque`, priority: "0.9" },
    { loc: `${SITE_URL}/sobre`, priority: "0.7" },
    { loc: `${SITE_URL}/perguntas-frequentes`, priority: "0.7" },
    ...vehicles.map((v) => ({ loc: `${SITE_URL}/estoque/${v.slug}`, priority: "0.7" }))
  ];
  const body = urls.map(
    (u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}
function renderRobots() {
  return `User-agent: *
Allow: /

# AI answer engines
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}
function findBySlug(vehicles, slug) {
  const direct = vehicles.find((v) => v.slug === slug);
  if (direct) return direct;
  const id = slug.split("-").pop();
  return vehicles.find((v) => v.id === id);
}

// server/radar.ts
var SUPABASE_URL2 = process.env.SUPABASE_URL || "https://jkblxdxnbmciicakusnl.supabase.co";
var SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_a_LZCcUT50c9-2JspQf1aQ_-khIilRb";
var BOT_PATTERNS = [
  { re: /GPTBot/i, source: "gptbot" },
  { re: /OAI-SearchBot/i, source: "oai-searchbot" },
  { re: /ChatGPT-User/i, source: "chatgpt-user" },
  { re: /ClaudeBot|Claude-Web|anthropic-ai/i, source: "claudebot" },
  { re: /PerplexityBot/i, source: "perplexitybot" },
  { re: /Perplexity-User/i, source: "perplexity-user" },
  { re: /Google-Extended/i, source: "google-extended" },
  { re: /Googlebot/i, source: "googlebot" },
  { re: /bingbot/i, source: "bingbot" },
  { re: /Applebot/i, source: "applebot" },
  { re: /Bytespider/i, source: "bytespider" },
  { re: /CCBot/i, source: "ccbot" },
  { re: /Amazonbot/i, source: "amazonbot" },
  { re: /meta-externalagent|FacebookBot/i, source: "meta" }
];
function referrerSource(host) {
  if (/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/.test(host)) return "chatgpt";
  if (/(^|\.)perplexity\.ai$/.test(host)) return "perplexity";
  if (/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/.test(host)) return "gemini";
  if (/(^|\.)copilot\.microsoft\.com$/.test(host)) return "copilot";
  if (/(^|\.)claude\.ai$/.test(host)) return "claude";
  if (/(^|\.)bing\.com$/.test(host)) return "bing";
  if (/(^|\.)duckduckgo\.com$/.test(host)) return "duckduckgo";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google";
  return null;
}
function isLoggablePath(path3) {
  if (path3.startsWith("/api") || path3.startsWith("/assets") || path3.startsWith("/@") || path3.startsWith("/src")) {
    return false;
  }
  if (/\.(js|mjs|css|png|jpe?g|webp|svg|ico|gif|woff2?|ttf|map|json)$/i.test(path3)) {
    return false;
  }
  return true;
}
function classify(req) {
  const ua = String(req.headers["user-agent"] || "");
  for (const b of BOT_PATTERNS) {
    if (b.re.test(ua)) return { type: "bot_crawl", source: b.source };
  }
  const ref = String(req.headers["referer"] || req.headers["referrer"] || "");
  if (ref) {
    try {
      const host = new URL(ref).hostname.toLowerCase();
      const src = referrerSource(host);
      if (src) return { type: "referral", source: src };
    } catch {
    }
  }
  return null;
}
function logVisit(req, hit) {
  let referrerHost = null;
  const ref = String(req.headers["referer"] || req.headers["referrer"] || "");
  if (ref) {
    try {
      referrerHost = new URL(ref).hostname.toLowerCase();
    } catch {
      referrerHost = null;
    }
  }
  const row = {
    type: hit.type,
    source: hit.source,
    path: req.path.slice(0, 300),
    referrer: referrerHost,
    user_agent: String(req.headers["user-agent"] || "").slice(0, 300)
  };
  fetch(`${SUPABASE_URL2}/rest/v1/ai_visits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(row)
  }).then((r) => {
    if (!r.ok) console.warn(`radar insert non-ok (${r.status}) \u2014 check the ai_visits table/RLS`);
  }).catch((err) => console.error("radar log failed:", err?.message || err));
}
function radarMiddleware(req, _res, next) {
  try {
    if (req.method === "GET" && isLoggablePath(req.path)) {
      const hit = classify(req);
      if (hit) logVisit(req, hit);
    }
  } catch (err) {
    console.error("radar middleware error:", err);
  }
  next();
}

// server/scoring.ts
var CIDADES_ATENDIDAS = /* @__PURE__ */ new Set([
  // Alto Vale
  "rio do sul",
  "ituporanga",
  "taio",
  "presidente getulio",
  "ibirama",
  "lontras",
  "aurora",
  "agronomica",
  "laurentino",
  "rio do oeste",
  "trombudo central",
  "braco do trombudo",
  "pouso redondo",
  "salete",
  "santa terezinha",
  "mirim doce",
  "vitor meireles",
  "jose boiteux",
  "witmarsum",
  "dona emma",
  "presidente nereu",
  "petrolandia",
  "imbuia",
  "chapadao do lageado",
  "atalanta",
  "agrolandia",
  "vidal ramos",
  "alfredo wagner",
  "leoberto leal",
  "santa terezinha do progresso",
  // Médio Vale
  "apiuna",
  "rodeio",
  "ascurra",
  "indaial",
  "timbo",
  "blumenau",
  "gaspar",
  "pomerode",
  "brusque",
  "guabiruba",
  "botuvera",
  // Litoral / unidade de Itapema
  "itapema",
  "balneario camboriu",
  "camboriu",
  "itajai",
  "navegantes",
  "porto belo",
  "bombinhas",
  "tijucas",
  "penha",
  "pi\xE7arras",
  "picarras"
]);
var DDDS_REGIAO = /* @__PURE__ */ new Set(["47", "48", "49"]);
function normalizar2(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\/\-–]\s*(sc|santa catarina)\s*$/i, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}
function contemCidade(texto, cidade) {
  return texto === cidade || texto.startsWith(cidade + " ") || texto.endsWith(" " + cidade) || texto.includes(" " + cidade + " ");
}
function cidadeAtendida(cidade) {
  const c = normalizar2(cidade);
  if (!c) return false;
  if (CIDADES_ATENDIDAS.has(c)) return true;
  for (const atendida of CIDADES_ATENDIDAS) {
    if (contemCidade(c, atendida)) return true;
  }
  return false;
}
var CANAIS_ALTA_INTENCAO = /* @__PURE__ */ new Set([
  "google_ads",
  "google_organico",
  "bing_ads",
  "bing_organico",
  "chatgpt",
  "perplexity",
  "claude",
  "gemini",
  "site_principal"
]);
function horarioComercialBRT() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      hour: "2-digit",
      hour12: false
    }).formatToParts(/* @__PURE__ */ new Date()).map((p) => [p.type, p.value])
  );
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dia = dias[partes.weekday] ?? 1;
  const hora = parseInt(partes.hour, 10) % 24;
  if (dia === 0) return false;
  if (dia === 6) return hora >= 8 && hora < 13;
  return hora >= 8 && hora < 19;
}
function paraNumero(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const texto = String(valor ?? "");
  if (!texto) return 0;
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}
function faixaDe(score) {
  if (score >= 70) return "quente";
  if (score >= 40) return "morno";
  return "frio";
}
function calcularScore(lead) {
  const motivos = [];
  let score = 0;
  if (!telefoneValido(lead.phone || "")) {
    return {
      score: 0,
      faixa: "frio",
      motivos: ["Telefone inv\xE1lido"],
      descartar: true,
      motivo_descarte: "telefone_invalido",
      fora_do_raio: false
    };
  }
  const d = lead.details ?? {};
  const cidade = String(lead.cidade || d.cidade || "");
  const noRaio = cidadeAtendida(cidade);
  if (lead.lead_type === "Venda") {
    const v = lead.venda ?? {};
    if (v.placa && v.fipe) {
      score += 25;
      motivos.push("Placa consultada com FIPE");
    } else if (v.placa) {
      score += 10;
      motivos.push("Informou a placa");
    }
    const fipe = paraNumero(v.fipe);
    const pedido = paraNumero(v.valor_desejado);
    if (fipe > 0 && pedido > 0) {
      const razao = pedido / fipe;
      if (razao <= 1.1) {
        score += 20;
        motivos.push("Pre\xE7o pedido dentro da FIPE");
      } else if (razao > 1.25) {
        score -= 25;
        motivos.push(`Pre\xE7o pedido ${Math.round((razao - 1) * 100)}% acima da FIPE`);
      }
    }
    const km = paraNumero(v.km);
    if (km > 0 && km < 12e4) {
      score += 10;
      motivos.push("Quilometragem baixa");
    }
  } else {
    if (d.id_veiculo) {
      score += 25;
      motivos.push("Escolheu um carro espec\xEDfico do estoque");
    }
    if (d.tem_troca === "Sim") {
      score += 15;
      motivos.push("Tem carro na troca");
    }
    if (typeof d.down_payment === "string" && /20 mil|acima/i.test(d.down_payment)) {
      score += 15;
      motivos.push("Entrada acima de R$ 20 mil");
    } else if (typeof d.down_payment === "string" && /10 mil/i.test(d.down_payment)) {
      score += 8;
      motivos.push("Entrada declarada");
    }
    if (d.has_interest === "Sim") {
      score += 10;
      motivos.push("Buscou um modelo pelo nome");
    }
    if (d.quer_financiamento === "N\xE3o") {
      score += 10;
      motivos.push("Compra \xE0 vista");
    }
  }
  if (noRaio) {
    score += 10;
    motivos.push("Cidade dentro da \xE1rea de atendimento");
  }
  const dddCliente = dddDe(lead.phone || "");
  if (DDDS_REGIAO.has(dddCliente)) {
    score += 5;
    motivos.push(`DDD ${dddCliente} da regi\xE3o`);
  }
  if (lead.canal && CANAIS_ALTA_INTENCAO.has(lead.canal)) {
    score += 10;
    motivos.push(`Origem de alta inten\xE7\xE3o (${lead.canal})`);
  }
  if (horarioComercialBRT()) {
    score += 5;
    motivos.push("Chegou em hor\xE1rio comercial");
  }
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    faixa: faixaDe(score),
    motivos,
    descartar: false,
    motivo_descarte: null,
    fora_do_raio: !noRaio && cidade !== ""
  };
}
function acaoRecomendada(r) {
  if (r.descartar) return "descartar_telefone_invalido";
  if (r.faixa === "quente") return "ligar_agora_meta_5min";
  if (r.faixa === "morno") return "fila_do_dia_whatsapp";
  return "nutricao_automatica";
}

// server.ts
import fs2, { readFileSync } from "fs";

// backend/server.js
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt2 from "bcryptjs";

// backend/db.js
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
function resolverCaminhoBanco() {
  const opcoes = [
    path.join(process.cwd(), "backend", "motriz.db"),
    path.join(process.cwd(), "motriz.db"),
    fileURLToPath(new URL("./motriz.db", import.meta.url))
  ];
  for (const p of opcoes) {
    if (fs.existsSync(p) && fs.statSync(p).size > 1e5) return p;
  }
  return opcoes[0];
}
var db = new DatabaseSync(resolverCaminhoBanco());
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'vendedor' -- admin | gerente | vendedor | financeiro
  );

  CREATE TABLE IF NOT EXISTS veiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marca TEXT NOT NULL, modelo TEXT NOT NULL, ano TEXT, km INTEGER DEFAULT 0,
    cor TEXT, combustivel TEXT, cambio TEXT, placa TEXT, chassi TEXT, renavam TEXT,
    opcionais TEXT, custo REAL DEFAULT 0, preco REAL DEFAULT 0, fipe REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'disponivel', foto TEXT,
    entrada TEXT NOT NULL DEFAULT (date('now')), venda TEXT,
    dados_altimus TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_pessoa TEXT NOT NULL DEFAULT 'PF', -- PF | PJ
    papel TEXT NOT NULL DEFAULT 'cliente', -- cliente | fornecedor | ambos
    nome TEXT NOT NULL,
    cpf_cnpj TEXT,
    rg_ie TEXT,
    data_nasc TEXT,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    cep TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT DEFAULT 'SC',
    origem TEXT DEFAULT 'MANUAL',
    observacoes TEXT,
    criado_em TEXT NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS oportunidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_lead TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    cliente_id INTEGER,
    vendedor_id INTEGER,
    veiculo_id INTEGER,
    veiculo_interesse TEXT,
    troca_veiculo TEXT,
    valor_proposta REAL DEFAULT 0,
    origem TEXT NOT NULL DEFAULT 'WHATSAPP',
    estagio TEXT NOT NULL DEFAULT 'pendente',
    etiquetas TEXT DEFAULT '[]',
    proxima_acao_tipo TEXT DEFAULT 'Contato',
    proxima_acao_data TEXT,
    motivo_conclusao TEXT,
    historico TEXT DEFAULT '[]',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS negociacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL DEFAULT 'venda',
    status TEXT NOT NULL DEFAULT 'aberta',
    cliente_id INTEGER,
    vendedor_id INTEGER,
    canal_venda TEXT DEFAULT 'LOJA',
    veiculo_id INTEGER,
    valor_veiculo REAL DEFAULT 0,
    desconto REAL DEFAULT 0,
    troca_marca TEXT,
    troca_modelo TEXT,
    troca_ano TEXT,
    troca_placa TEXT,
    troca_km INTEGER DEFAULT 0,
    troca_cor TEXT,
    troca_valor REAL DEFAULT 0,
    pagamentos TEXT DEFAULT '[]',
    comissao_vendedor REAL DEFAULT 0,
    observacoes TEXT,
    data_negociacao TEXT NOT NULL DEFAULT (date('now')),
    data_fechamento TEXT
  );

  CREATE TABLE IF NOT EXISTS financeiro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL DEFAULT 'despesa',
    categoria TEXT NOT NULL DEFAULT 'Outros',
    descricao TEXT NOT NULL,
    valor REAL NOT NULL DEFAULT 0,
    vencimento TEXT NOT NULL DEFAULT (date('now')),
    pagamento_data TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    forma_pagamento TEXT DEFAULT 'Pix / TED',
    conta_bancaria TEXT DEFAULT 'Conta Principal',
    veiculo_id INTEGER,
    cliente_id INTEGER,
    negociacao_id INTEGER,
    criado_em TEXT NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS config_loja (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    razao_social TEXT DEFAULT 'DG Autom\xF3veis Com\xE9rcio de Ve\xEDculos Ltda',
    nome_fantasia TEXT DEFAULT 'DG Autom\xF3veis',
    cnpj TEXT DEFAULT '12.345.678/0001-90',
    telefone TEXT DEFAULT '(47) 3333-4444',
    whatsapp TEXT DEFAULT '(47) 99999-8888',
    email TEXT DEFAULT 'contato@dgautos.com.br',
    endereco TEXT DEFAULT 'Av. Brasil, 1500 - Centro',
    cidade TEXT DEFAULT 'Balne\xE1rio Cambori\xFA',
    uf TEXT DEFAULT 'SC',
    cep TEXT DEFAULT '88330-000',
    termos_garantia TEXT DEFAULT 'Garantia legal de 90 (noventa) dias para motor e c\xE2mbio, conforme Art. 26 do C\xF3digo de Defesa do Consumidor, contados a partir da data de entrega do ve\xEDculo.'
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER, acao TEXT, tabela TEXT, registro_id INTEGER,
    data TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
try {
  db.exec("ALTER TABLE veiculos ADD COLUMN fipe REAL DEFAULT 0");
} catch {
}
try {
  db.exec("ALTER TABLE veiculos ADD COLUMN dados_altimus TEXT DEFAULT '{}'");
} catch {
}
try {
  db.exec("ALTER TABLE config_loja ADD COLUMN token_feed_site TEXT DEFAULT '20706bbe-4a09-4a03-8e2a-1f47e73d7a14'");
} catch {
}
try {
  db.exec("ALTER TABLE config_loja ADD COLUMN url_site TEXT DEFAULT 'https://dgautomoveis.com.br'");
} catch {
}
try {
  db.exec("ALTER TABLE config_loja ADD COLUMN auto_publicar_site INTEGER DEFAULT 1");
} catch {
}
var veicsSemDetalhes = db.prepare("SELECT * FROM veiculos WHERE dados_altimus IS NULL OR dados_altimus = '{}'").all();
if (veicsSemDetalhes.length > 0) {
  const upd = db.prepare("UPDATE veiculos SET fipe = CASE WHEN fipe > 0 THEN fipe ELSE ? END, chassi = COALESCE(chassi, ?), renavam = COALESCE(renavam, ?), dados_altimus = ? WHERE id = ?");
  veicsSemDetalhes.forEach((v, idx) => {
    const [anoFab, anoMod] = String(v.ano || "2022/2023").split("/");
    const fipeSugerida = v.fipe > 0 ? v.fipe : Math.round(Number(v.preco || 1e5) * 1.02);
    const chassiPadrao = v.chassi || `9BWZZZ377VT00${1100 + v.id}`;
    const renavamPadrao = v.renavam || `01284950${100 + v.id}`;
    const extras = {
      codigo_interno: `V-${100 + v.id}`,
      estado_conservacao: "USADO",
      propriedade: v.status === "consignado" ? "TERCEIRO_CONSIGNADO" : "PROPRIO",
      repasse: false,
      garantia_fabrica: idx === 3 ? "Sim (at\xE9 2027)" : "N\xE3o",
      modelo_complemento: v.modelo.split(" ").slice(1).join(" ") || "Completo",
      ano_fabricacao: anoFab || "2022",
      ano_modelo: anoMod || anoFab || "2023",
      cor_interna: "Preto (Couro)",
      portas: 4,
      potencia: "177",
      cilindradas: "2000",
      direcao: "El\xE9trica",
      categoria_veiculo: "Carro / SUV / Utilit\xE1rio",
      numero_motor: `MTR${202600 + v.id}`,
      crv: `CRV-${99810 + v.id}`,
      cidade_emplacamento: "Balne\xE1rio Cambori\xFA - SC",
      ipva_exercicio: "2026",
      licenciamento_exercicio: "2026",
      dpvat_exercicio: "2026",
      situacao_patio: v.status === "vendido" ? "Entregue ao cliente" : "Pronto para venda (Showroom)",
      localizacao_patio: v.status === "vendido" ? "Fora do p\xE1tio" : "Showroom Principal",
      codigo_fipe: `00${2110 + v.id}-${idx + 1}`,
      valor_fipe_anterior: Math.round(fipeSugerida * 1.008),
      valor_minimo: Math.round(Number(v.preco || 0) * 0.97),
      valor_troca: Math.round(Number(v.preco || 0) * 1.03),
      valor_site: Number(v.preco || 0),
      km_entrada: Number(v.km || 0),
      km_saida: v.status === "vendido" ? Number(v.km || 0) + 15 : "",
      cliente_entrada_id: v.status === "consignado" ? 3 : 1,
      proprietario_atual_id: v.status === "consignado" ? 3 : "",
      cliente_saida_id: v.status === "vendido" ? 5 : "",
      observacao_interna: "Ve\xEDculo periciado com laudo cautelar 100% aprovado. Chave reserva no cofre #0" + v.id,
      observacao_anuncio: `${v.marca} ${v.modelo} ${v.ano}, c\xE2mbio ${v.cambio}, impec\xE1vel, pneus novos e revisado com garantia.`,
      observacao_internet: `${v.marca} ${v.modelo} (${v.ano}) com apenas ${Number(v.km || 0).toLocaleString("pt-BR")} km! Laudo cautelar aprovado, manual e chave reserva. Aceitamos seu usado na troca com a melhor avalia\xE7\xE3o da regi\xE3o e financiamos em at\xE9 60x!`,
      observacao_contrato: "Ve\xEDculo entregue revisado, com garantia legal de 90 dias para motor e c\xE2mbio.",
      observacao_financiamento: "Eleg\xEDvel para tabela retorno zero ou taxas especiais Santander / Ita\xFA / Safra.",
      itens_opcionais: [
        "Airbag",
        "Ar Condicionado",
        "Ar Digital",
        "Alarme",
        "Bancos de Couro",
        "C\xE2mera de R\xE9",
        "Central Multim\xEDdia",
        "Chave Presencial",
        "Computador de bordo",
        "Conex\xE3o USB",
        "Interface Bluetooth",
        "Rodas de liga leve",
        "Sensor de r\xE9",
        "Trava el\xE9trica",
        "Vidro el\xE9trico",
        "Volante multifuncional"
      ],
      itens_destaques: ["\xDAnico dono", "IPVA Pago", "Manual do Propriet\xE1rio", "Chave Reserva", "Ve\xEDculo quitado", "Laudo Cautelar Aprovado"],
      pendencias: [
        { id: 1, titulo: "Laudo Cautelar / Vistoria ECV", obrigatoria: true, concluida: true, data: v.entrada },
        { id: 2, titulo: "Chave Reserva e Manual no Cofre", obrigatoria: false, concluida: true, data: v.entrada },
        { id: 3, titulo: "Reconhecimento de Firma / ATPV-e", obrigatoria: true, concluida: v.status === "vendido", data: v.entrada }
      ],
      reservas: v.status === "reservado" ? [
        { id: 1, funcionario: "Carlos Mendes (Vendas)", cliente: "Fernanda Duarte Silva", data_limite: "2026-10-23", observacao: "Sinal de R$ 2.000 via Pix aguardando aprova\xE7\xE3o final Santander.", status: "Pendente" }
      ] : [],
      investidores: [
        { id: 1, nome: "DG Autom\xF3veis (Loja)", percentual: 100 }
      ],
      documentos_anexos: [
        { id: 1, tipo: "CRLV Digital 2026", numero: renavamPadrao, status: "Validado", data: v.entrada },
        { id: 2, tipo: "Laudo Cautelar SuperVis\xE3o", numero: `LC-${8820 + v.id}`, status: "Aprovado sem restri\xE7\xF5es", data: v.entrada }
      ],
      fotos: v.foto ? [v.foto] : [],
      url_video: "",
      cfop_entrada: "1102 - Compra para comercializa\xE7\xE3o",
      cfop_saida: "5102 - Venda de mercadoria adquirida",
      liberar_nf_compra: true,
      valor_nf_compra: Number(v.custo || 0),
      liberar_nf_venda: v.status === "vendido",
      valor_nf_venda: Number(v.preco || 0)
    };
    upd.run(fipeSugerida, chassiPadrao, renavamPadrao, JSON.stringify(extras), v.id);
  });
}
if (!db.prepare("SELECT COUNT(*) n FROM config_loja").get().n) {
  db.prepare("INSERT INTO config_loja (id) VALUES (1)").run();
}
if (!db.prepare("SELECT COUNT(*) n FROM usuarios").get().n) {
  const insU = db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)");
  insU.run("Administrador", "admin@dgautos.com.br", bcrypt.hashSync("admin123", 10), "admin");
  insU.run("Alexandre Gorges", "alexandre@dgautos.com.br", bcrypt.hashSync("admin123", 10), "gerente");
  insU.run("Carlos Mendes (Vendas)", "carlos@dgautos.com.br", bcrypt.hashSync("admin123", 10), "vendedor");
}
var audit = (usuarioId, acao, tabela2, registroId) => db.prepare("INSERT INTO auditoria (usuario_id, acao, tabela, registro_id) VALUES (?,?,?,?)").run(usuarioId, acao, tabela2, registroId);

// backend/server.js
var SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === "production") {
    SECRET = crypto.randomBytes(32).toString("hex");
    console.warn("[SEGURAN\xC7A] JWT_SECRET n\xE3o configurado. Gerado segredo tempor\xE1rio aleat\xF3rio para a sess\xE3o.");
  } else {
    SECRET = "dgautos-dev-secret-key-35236994000124";
  }
}
var MOTRIZ_PORT = Number(process.env.MOTRIZ_PORT) || 3333;
var app = express();
var loginAttempts = /* @__PURE__ */ new Map();
var LOGIN_WINDOW_MS = 5 * 60 * 1e3;
var MAX_LOGIN_ATTEMPTS = 8;
function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  entry.count++;
  return true;
}
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.post("/api/auth/login", (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkLoginRateLimit(clientIp)) {
    return res.status(429).json({ erro: "Muitas tentativas de login. Aguarde 5 minutos antes de tentar novamente." });
  }
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(400).json({ erro: "E-mail e senha s\xE3o obrigat\xF3rios." });
  }
  const u = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(String(email).trim().toLowerCase());
  if (!u || !bcrypt2.compareSync(String(senha), u.senha_hash)) {
    return res.status(401).json({ erro: "E-mail ou senha inv\xE1lidos." });
  }
  loginAttempts.delete(clientIp);
  const user = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: "12h" }), user });
});
function auth(req, res, next) {
  try {
    req.user = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Sess\xE3o expirada. Entre novamente." });
  }
}
var perfil = (...perfis) => (req, res, next) => perfis.includes(req.user.perfil) ? next() : res.status(403).json({ erro: "Sem permiss\xE3o." });
app.get("/api/auth/me", auth, (req, res) => res.json(req.user));
var parseJsonObj = (s, fb = {}) => {
  try {
    return typeof s === "string" ? JSON.parse(s) : s && typeof s === "object" ? s : fb;
  } catch {
    return fb;
  }
};
var parseJsonSafe = (s, fb = []) => {
  try {
    return typeof s === "string" ? JSON.parse(s) : Array.isArray(s) ? s : fb;
  } catch {
    return fb;
  }
};
var CAMPOS_VEIC = ["marca", "modelo", "ano", "km", "cor", "combustivel", "cambio", "placa", "chassi", "renavam", "opcionais", "custo", "preco", "fipe", "status", "foto", "entrada", "venda", "dados_altimus"];
var extrairDadosExtras = (b) => {
  const base = parseJsonObj(b.dados_altimus, {});
  const chavesExtras = [
    "codigo_interno",
    "estado_conservacao",
    "propriedade",
    "repasse",
    "garantia_fabrica",
    "modelo_complemento",
    "ano_fabricacao",
    "ano_modelo",
    "cor_interna",
    "portas",
    "potencia",
    "cilindradas",
    "direcao",
    "categoria_veiculo",
    "numero_motor",
    "crv",
    "cidade_emplacamento",
    "ipva_exercicio",
    "licenciamento_exercicio",
    "dpvat_exercicio",
    "situacao_patio",
    "localizacao_patio",
    "codigo_fipe",
    "valor_fipe_anterior",
    "valor_minimo",
    "valor_troca",
    "valor_site",
    "km_entrada",
    "km_saida",
    "cliente_entrada_id",
    "proprietario_atual_id",
    "cliente_saida_id",
    "observacao_interna",
    "observacao_anuncio",
    "observacao_internet",
    "observacao_contrato",
    "observacao_financiamento",
    "itens_opcionais",
    "itens_destaques",
    "pendencias",
    "reservas",
    "investidores",
    "documentos_anexos",
    "fotos",
    "url_video",
    "cfop_entrada",
    "cfop_saida",
    "liberar_nf_compra",
    "valor_nf_compra",
    "liberar_nf_venda",
    "valor_nf_venda",
    "publicar_site",
    "destaque_site",
    "observacao_site",
    "url_anuncio_site"
  ];
  const merged = { ...base };
  chavesExtras.forEach((k) => {
    if (b[k] !== void 0) merged[k] = b[k];
  });
  return JSON.stringify(merged);
};
var pickVeic = (b) => {
  const ano = b.ano || (b.ano_fabricacao && b.ano_modelo ? `${b.ano_fabricacao}/${b.ano_modelo}` : "2023/2024");
  const fotosArr = Array.isArray(b.fotos) ? b.fotos : [];
  const fotoCapa = b.foto || fotosArr[0] || "";
  const opcionaisStr = Array.isArray(b.itens_opcionais) && b.itens_opcionais.length ? b.itens_opcionais.join(", ") : b.opcionais ?? "";
  return [
    b.marca ?? "",
    b.modelo ?? "",
    ano,
    Number(b.km ?? b.km_entrada) || 0,
    b.cor ?? "",
    b.combustivel ?? "Flex",
    b.cambio ?? "Autom\xE1tico",
    (b.placa ?? "").toUpperCase(),
    (b.chassi ?? "").toUpperCase(),
    b.renavam ?? "",
    opcionaisStr,
    Number(b.custo) || 0,
    Number(b.preco) || 0,
    Number(b.fipe) || 0,
    b.status || "disponivel",
    fotoCapa,
    b.entrada || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    b.venda ?? null,
    extrairDadosExtras(b)
  ];
};
var listaVeiculos = () => {
  const rows = db.prepare(`
    SELECT v.*,
      COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.veiculo_id = v.id AND f.tipo = 'despesa'), 0) AS despesas_veiculo,
      COALESCE((SELECT SUM(f.valor) FROM financeiro f WHERE f.veiculo_id = v.id AND f.tipo = 'receita'), 0) AS receitas_veiculo
    FROM veiculos v
    ORDER BY v.id DESC
  `).all();
  const despPorVeic = db.prepare("SELECT * FROM financeiro WHERE veiculo_id IS NOT NULL ORDER BY vencimento DESC, id DESC").all();
  return rows.map((r) => {
    const extras = parseJsonObj(r.dados_altimus, {});
    return {
      ...extras,
      ...r,
      lancamentos_veiculo: despPorVeic.filter((d) => d.veiculo_id === r.id)
    };
  });
};
function formatarVeiculoParaJsonFeed(v, loja = {}) {
  const [anoFabStr, anoModStr] = String(v.ano || "2023/2024").split("/");
  const anoFabricacao = Number(v.ano_fabricacao || anoFabStr) || (/* @__PURE__ */ new Date()).getFullYear();
  const anoModelo = Number(v.ano_modelo || anoModStr) || anoFabricacao;
  let fotos = [];
  if (Array.isArray(v.fotos) && v.fotos.length > 0) {
    fotos = v.fotos;
  } else if (v.foto) {
    fotos = [v.foto];
  }
  let opcionais = [];
  if (Array.isArray(v.itens_opcionais) && v.itens_opcionais.length > 0) {
    opcionais = v.itens_opcionais;
  } else if (v.opcionais) {
    opcionais = String(v.opcionais).split(",").map((s) => s.trim()).filter(Boolean);
  }
  const precoVenda = Number(v.valor_site > 0 ? v.valor_site : v.preco || 0);
  const descVersao = v.modelo_complemento || v.versao || "";
  const descCompleta = v.observacao_anuncio || `${v.marca} ${v.modelo} ${descVersao} ${v.ano} ${v.cambio}`.trim();
  return {
    id: v.id,
    anoFabricacao,
    anoModelo,
    km: Number(v.km || 0),
    portas: Number(v.portas || 4),
    valorVenda: precoVenda,
    dataEntradaEstoque: v.entrada ? `${v.entrada} 12:00:00` : (/* @__PURE__ */ new Date()).toISOString(),
    dataAtualizacao: (/* @__PURE__ */ new Date()).toISOString(),
    filialApelido: loja.nome_fantasia || "DG Autom\xF3veis",
    tipo: v.categoria_veiculo || "Carro/Camioneta",
    marca: v.marca,
    modelo: v.modelo,
    versao: descVersao,
    cidade: loja.cidade || "Rio do Sul",
    cor: v.cor || "Branco",
    combustivel: v.combustivel || "Flex",
    motor: v.numero_motor || "",
    observacao: v.observacao_internet || v.observacao_site || v.observacao_anuncio || descCompleta,
    placa: (v.placa || "").toUpperCase(),
    potencia: String(v.potencia || ""),
    cilindrada: String(v.cilindradas || ""),
    cambio: v.cambio || "Autom\xE1tico",
    categoria: null,
    opcionais,
    fotos,
    informacoesAdicionais: {
      valor_promocional: null
    },
    destaque: v.destaque_site ? 1 : 0,
    chassi: (v.chassi || "").toUpperCase(),
    codigoFipe: v.codigo_fipe || "",
    valorFipe: Number(v.fipe || 0)
  };
}
function formatarVeiculoParaXmlFeed(v, loja = {}) {
  const json = formatarVeiculoParaJsonFeed(v, loja);
  const escapeXml = (str) => String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const desc = `${v.marca} ${v.modelo} ${v.modelo_complemento || ""} - ${v.cor} - ${v.ano}`.trim();
  return `  <veiculo>
    <id>${json.id}</id>
    <loja>${escapeXml(loja.nome_fantasia || "DG Autom\xF3veis")}</loja>
    <tipo>1</tipo>
    <marca>${escapeXml(v.marca)}</marca>
    <modelo>${escapeXml(v.modelo)}</modelo>
    <versao>${escapeXml(json.versao)}</versao>
    <valor>${json.valorVenda.toFixed(1)}</valor>
    <ano>${json.anoModelo}</ano>
    <descricao>${escapeXml(desc)}</descricao>
    <km>${json.km}</km>
    <cor>${escapeXml(json.cor)}</cor>
    <combustivel>${escapeXml(json.combustivel)}</combustivel>
    <cambio>${escapeXml(json.cambio)}</cambio>
    <placa>${escapeXml(json.placa)}</placa>
    <chassi>${escapeXml(json.chassi)}</chassi>
    <opcionais>
${json.opcionais.map((op) => `      <opcional>${escapeXml(op)}</opcional>`).join("\n")}
    </opcionais>
    <fotos>
${json.fotos.map((ft) => `      <foto>${escapeXml(ft)}</foto>
      <imagem>${escapeXml(ft)}</imagem>`).join("\n")}
    </fotos>
    <observacao>${escapeXml(json.observacao)}</observacao>
  </veiculo>`;
}
app.get(["/api/estoquejson", "/api/public/estoquejson"], (req, res) => {
  const token = req.query.estoque || req.query.token;
  const loja = db.prepare("SELECT * FROM config_loja WHERE id=1").get() || {};
  if (token && loja.token_feed_site && token !== loja.token_feed_site) {
    return res.status(403).json({ erro: "Token de estoque inv\xE1lido." });
  }
  const veics = listaVeiculos().filter((v) => {
    return v.status !== "vendido" && v.publicar_site !== false;
  });
  const payload = {
    veiculos: veics.map((v) => formatarVeiculoParaJsonFeed(v, loja))
  };
  res.set("Access-Control-Allow-Origin", "*");
  res.json(payload);
});
app.get(["/api/estoquexml", "/api/public/estoquexml"], (req, res) => {
  const token = req.query.estoque || req.query.token;
  const loja = db.prepare("SELECT * FROM config_loja WHERE id=1").get() || {};
  if (token && loja.token_feed_site && token !== loja.token_feed_site) {
    return res.status(403).send('<?xml version="1.0" encoding="UTF-8"?><erro>Token inv\xE1lido</erro>');
  }
  const veics = listaVeiculos().filter((v) => v.status !== "vendido" && v.publicar_site !== false);
  const xmlItems = veics.map((v) => formatarVeiculoParaXmlFeed(v, loja)).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<estoque>
${xmlItems}
</estoque>`;
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.set("Access-Control-Allow-Origin", "*");
  res.send(xml);
});
app.post(["/api/public/leads", "/api/leads/site"], (req, res) => {
  const b = req.body || {};
  const nome = b.name || b.nome || b.nome_lead;
  const telefone = b.phone || b.telefone || b.whatsapp;
  if (!nome || !telefone) {
    return res.status(400).json({ ok: false, erro: "Nome e telefone/whatsapp s\xE3o obrigat\xF3rios." });
  }
  const leadType = b.lead_type || b.tipo_interesse || "Compra";
  const veicId = b.veiculo_id ? Number(b.veiculo_id) : null;
  const veicInteresse = b.veiculo_interesse || b.title || b.description || "";
  const detalhes = b.details || {};
  const valorProposta = Number(detalhes.valor_proposta || b.valor_proposta || 0);
  const historicoInicial = [
    {
      data: (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " "),
      autor: "Site DG Autom\xF3veis (Web)",
      tipo: "Lead Capturado",
      texto: `Lead recebido automaticamente do site para: ${leadType}${veicInteresse ? ` \u2014 ${veicInteresse}` : ""}.`
    }
  ];
  const etiquetas = ["LEAD_SITE", "DG_AUTOMOVEIS"];
  if (leadType) etiquetas.push(String(leadType).toUpperCase());
  const vendedor = db.prepare("SELECT id FROM usuarios WHERE perfil='vendedor' ORDER BY id LIMIT 1").get() || { id: 1 };
  const r = db.prepare(`
    INSERT INTO oportunidades (
      nome_lead, telefone, email, vendedor_id, veiculo_id, veiculo_interesse,
      valor_proposta, origem, estagio, etiquetas, historico, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    nome,
    telefone,
    b.email || detalhes.email || null,
    vendedor.id,
    veicId,
    veicInteresse,
    valorProposta,
    "SITE_DG",
    "pendente",
    JSON.stringify(etiquetas),
    JSON.stringify(historicoInicial)
  );
  res.set("Access-Control-Allow-Origin", "*");
  res.status(201).json({
    ok: true,
    lead_id: Number(r.lastInsertRowid),
    mensagem: "Lead registrado com sucesso no CRM Motriz!"
  });
});
app.get("/api/integracao/site", auth, (req, res) => {
  const loja = db.prepare("SELECT * FROM config_loja WHERE id=1").get() || {};
  const veics = listaVeiculos();
  const total = veics.length;
  const publicados = veics.filter((v) => v.status !== "vendido" && v.publicar_site !== false).length;
  const destaques = veics.filter((v) => v.destaque_site).length;
  const leadsSite = db.prepare("SELECT COUNT(*) AS total FROM oportunidades WHERE origem='SITE_DG' OR etiquetas LIKE '%LEAD_SITE%'").get()?.total || 0;
  const token = loja.token_feed_site || "20706bbe-4a09-4a03-8e2a-1f47e73d7a14";
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `localhost:${PORT}`;
  const baseUrl = `${proto}://${host}`;
  res.json({
    token,
    url_site: loja.url_site || "https://dgautomoveis.com.br",
    auto_publicar_site: loja.auto_publicar_site !== 0,
    feed_json_url: `${baseUrl}/api/estoquejson?estoque=${token}`,
    feed_xml_url: `${baseUrl}/api/estoquexml?estoque=${token}`,
    webhook_leads_url: `${baseUrl}/api/public/leads?token=${token}`,
    total_veiculos: total,
    publicados_site: publicados,
    destaques_site: destaques,
    leads_site_total: leadsSite,
    diretorio_site_local: "D:\\Site douglas"
  });
});
app.put("/api/integracao/site", auth, perfil("admin", "gerente"), (req, res) => {
  const { token, url_site, auto_publicar_site } = req.body || {};
  db.prepare(`
    UPDATE config_loja
    SET token_feed_site = COALESCE(?, token_feed_site),
        url_site = COALESCE(?, url_site),
        auto_publicar_site = COALESCE(?, auto_publicar_site)
    WHERE id=1
  `).run(token, url_site, auto_publicar_site ? 1 : 0);
  audit(req.user.id, "configurar_integracao_site", "config_loja", 1);
  const loja = db.prepare("SELECT * FROM config_loja WHERE id=1").get() || {};
  res.json(loja);
});
app.post("/api/integracao/site/regerar-token", auth, perfil("admin"), (req, res) => {
  const novoToken = crypto.randomUUID ? crypto.randomUUID() : `token_${Date.now()}`;
  db.prepare("UPDATE config_loja SET token_feed_site=? WHERE id=1").run(novoToken);
  audit(req.user.id, "regerar_token_site", "config_loja", 1);
  res.json({ token: novoToken });
});
app.get("/api/veiculos", auth, (req, res) => res.json(listaVeiculos()));
app.post("/api/veiculos", auth, (req, res) => {
  if (!req.body?.marca || !req.body?.modelo) return res.status(400).json({ erro: "Marca e modelo s\xE3o obrigat\xF3rios." });
  const r = db.prepare(`INSERT INTO veiculos (${CAMPOS_VEIC.join(",")}) VALUES (${CAMPOS_VEIC.map(() => "?").join(",")})`).run(...pickVeic(req.body));
  audit(req.user.id, "criar", "veiculos", Number(r.lastInsertRowid));
  res.status(201).json(listaVeiculos());
});
app.put("/api/veiculos/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE veiculos SET ${CAMPOS_VEIC.map((c) => `${c}=?`).join(",")} WHERE id=?`).run(...pickVeic(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: "Ve\xEDculo n\xE3o encontrado." });
  audit(req.user.id, "editar", "veiculos", id);
  res.json(listaVeiculos());
});
app.delete("/api/veiculos/:id", auth, perfil("admin", "gerente"), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM veiculos WHERE id=?").run(id);
  audit(req.user.id, "excluir", "veiculos", id);
  res.json(listaVeiculos());
});
var CAMPOS_CLI = ["tipo_pessoa", "papel", "nome", "cpf_cnpj", "rg_ie", "data_nasc", "telefone", "whatsapp", "email", "cep", "endereco", "cidade", "uf", "origem", "observacoes"];
var pickCli = (b) => CAMPOS_CLI.map((c) => b[c] ?? null);
var listaClientes = () => db.prepare("SELECT * FROM clientes ORDER BY id DESC").all();
app.get("/api/clientes", auth, (req, res) => res.json(listaClientes()));
app.post("/api/clientes", auth, (req, res) => {
  if (!req.body?.nome) return res.status(400).json({ erro: "Nome \xE9 obrigat\xF3rio." });
  const r = db.prepare(`INSERT INTO clientes (${CAMPOS_CLI.join(",")}) VALUES (${CAMPOS_CLI.map(() => "?").join(",")})`).run(...pickCli(req.body));
  audit(req.user.id, "criar", "clientes", Number(r.lastInsertRowid));
  res.status(201).json(listaClientes());
});
app.put("/api/clientes/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE clientes SET ${CAMPOS_CLI.map((c) => `${c}=?`).join(",")} WHERE id=?`).run(...pickCli(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: "Cliente n\xE3o encontrado." });
  audit(req.user.id, "editar", "clientes", id);
  res.json(listaClientes());
});
app.delete("/api/clientes/:id", auth, perfil("admin", "gerente"), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM clientes WHERE id=?").run(id);
  audit(req.user.id, "excluir", "clientes", id);
  res.json(listaClientes());
});
var CAMPOS_OP = [
  "nome_lead",
  "telefone",
  "email",
  "cliente_id",
  "vendedor_id",
  "veiculo_id",
  "veiculo_interesse",
  "troca_veiculo",
  "valor_proposta",
  "origem",
  "estagio",
  "etiquetas",
  "proxima_acao_tipo",
  "proxima_acao_data",
  "motivo_conclusao",
  "historico"
];
var pickOp = (b) => CAMPOS_OP.map((c) => {
  if (["etiquetas", "historico"].includes(c)) return JSON.stringify(parseJsonSafe(b[c], []));
  if (["cliente_id", "vendedor_id", "veiculo_id"].includes(c)) return b[c] ? Number(b[c]) : null;
  if (c === "valor_proposta") return Number(b[c]) || 0;
  return b[c] ?? null;
});
var listaOportunidades = () => db.prepare(`
    SELECT o.*,
      u.nome AS vendedor_nome,
      v.marca AS veic_marca, v.modelo AS veic_modelo, v.ano AS veic_ano, v.preco AS veic_preco, v.placa AS veic_placa
    FROM oportunidades o
    LEFT JOIN usuarios u ON u.id = o.vendedor_id
    LEFT JOIN veiculos v ON v.id = o.veiculo_id
    ORDER BY o.id DESC
  `).all().map((o) => ({
  ...o,
  etiquetas: parseJsonSafe(o.etiquetas, []),
  historico: parseJsonSafe(o.historico, [])
}));
app.get("/api/oportunidades", auth, (req, res) => res.json(listaOportunidades()));
app.post("/api/oportunidades", auth, (req, res) => {
  if (!req.body?.nome_lead) return res.status(400).json({ erro: "Nome do lead \xE9 obrigat\xF3rio." });
  const body = {
    ...req.body,
    vendedor_id: req.body.vendedor_id || req.user.id,
    estagio: req.body.estagio || "pendente",
    origem: req.body.origem || "WHATSAPP"
  };
  const r = db.prepare(`INSERT INTO oportunidades (${CAMPOS_OP.join(",")}) VALUES (${CAMPOS_OP.map(() => "?").join(",")})`).run(...pickOp(body));
  audit(req.user.id, "criar", "oportunidades", Number(r.lastInsertRowid));
  res.status(201).json(listaOportunidades());
});
app.put("/api/oportunidades/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE oportunidades SET ${CAMPOS_OP.map((c) => `${c}=?`).join(",")} WHERE id=?`).run(...pickOp(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: "Oportunidade n\xE3o encontrada." });
  audit(req.user.id, "editar", "oportunidades", id);
  res.json(listaOportunidades());
});
app.patch("/api/oportunidades/:id/estagio", auth, (req, res) => {
  const id = Number(req.params.id);
  const { estagio, motivo_conclusao } = req.body || {};
  const atual = db.prepare("SELECT * FROM oportunidades WHERE id=?").get(id);
  if (!atual) return res.status(404).json({ erro: "Oportunidade n\xE3o encontrada." });
  const hist = parseJsonSafe(atual.historico, []);
  hist.unshift({
    data: (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " "),
    autor: req.user.nome,
    tipo: "Est\xE1gio",
    texto: `Movido para "${estagio}"${motivo_conclusao ? ` (Motivo: ${motivo_conclusao})` : ""}.`
  });
  db.prepare("UPDATE oportunidades SET estagio=?, motivo_conclusao=?, historico=? WHERE id=?").run(estagio, motivo_conclusao ?? atual.motivo_conclusao, JSON.stringify(hist), id);
  audit(req.user.id, "mover_estagio", "oportunidades", id);
  res.json(listaOportunidades());
});
app.delete("/api/oportunidades/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM oportunidades WHERE id=?").run(id);
  audit(req.user.id, "excluir", "oportunidades", id);
  res.json(listaOportunidades());
});
var CAMPOS_NEG = [
  "tipo",
  "status",
  "cliente_id",
  "vendedor_id",
  "canal_venda",
  "veiculo_id",
  "valor_veiculo",
  "desconto",
  "troca_marca",
  "troca_modelo",
  "troca_ano",
  "troca_placa",
  "troca_km",
  "troca_cor",
  "troca_valor",
  "pagamentos",
  "comissao_vendedor",
  "observacoes",
  "data_negociacao",
  "data_fechamento"
];
var pickNeg = (b) => CAMPOS_NEG.map((c) => {
  if (c === "pagamentos") return JSON.stringify(parseJsonSafe(b.pagamentos, []));
  if (["cliente_id", "vendedor_id", "veiculo_id"].includes(c)) return b[c] ? Number(b[c]) : null;
  if (["valor_veiculo", "desconto", "troca_km", "troca_valor", "comissao_vendedor"].includes(c)) return Number(b[c]) || 0;
  if (c === "data_negociacao") return b[c] || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return b[c] ?? null;
});
var listaNegociacoes = () => db.prepare(`
    SELECT n.*,
      c.nome AS cliente_nome, c.cpf_cnpj AS cliente_cpf_cnpj, c.telefone AS cliente_telefone, c.endereco AS cliente_endereco, c.cidade AS cliente_cidade, c.uf AS cliente_uf,
      u.nome AS vendedor_nome,
      v.marca AS veic_marca, v.modelo AS veic_modelo, v.ano AS veic_ano, v.placa AS veic_placa, v.chassi AS veic_chassi, v.renavam AS veic_renavam, v.cor AS veic_cor, v.km AS veic_km, v.custo AS veic_custo
    FROM negociacoes n
    LEFT JOIN clientes c ON c.id = n.cliente_id
    LEFT JOIN usuarios u ON u.id = n.vendedor_id
    LEFT JOIN veiculos v ON v.id = n.veiculo_id
    ORDER BY n.id DESC
  `).all().map((n) => ({
  ...n,
  pagamentos: parseJsonSafe(n.pagamentos, [])
}));
app.get("/api/negociacoes", auth, (req, res) => res.json(listaNegociacoes()));
app.post("/api/negociacoes", auth, (req, res) => {
  const body = { ...req.body, vendedor_id: req.body.vendedor_id || req.user.id };
  const r = db.prepare(`INSERT INTO negociacoes (${CAMPOS_NEG.join(",")}) VALUES (${CAMPOS_NEG.map(() => "?").join(",")})`).run(...pickNeg(body));
  const negId = Number(r.lastInsertRowid);
  if (body.veiculo_id && body.status === "conferencia") {
    db.prepare("UPDATE veiculos SET status='reservado' WHERE id=? AND status='disponivel'").run(Number(body.veiculo_id));
  }
  audit(req.user.id, "criar", "negociacoes", negId);
  res.status(201).json(listaNegociacoes());
});
app.put("/api/negociacoes/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE negociacoes SET ${CAMPOS_NEG.map((c) => `${c}=?`).join(",")} WHERE id=?`).run(...pickNeg(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: "Negocia\xE7\xE3o n\xE3o encontrada." });
  audit(req.user.id, "editar", "negociacoes", id);
  res.json(listaNegociacoes());
});
app.post("/api/negociacoes/:id/concluir", auth, (req, res) => {
  const id = Number(req.params.id);
  const neg = db.prepare("SELECT * FROM negociacoes WHERE id=?").get(id);
  if (!neg) return res.status(404).json({ erro: "Negocia\xE7\xE3o n\xE3o encontrada." });
  if (neg.status === "concluida") return res.status(400).json({ erro: "Negocia\xE7\xE3o j\xE1 est\xE1 conclu\xEDda." });
  const hoje = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  db.prepare("UPDATE negociacoes SET status='concluida', data_fechamento=? WHERE id=?").run(hoje, id);
  let veicLabel = `Negocia\xE7\xE3o #${id}`;
  if (neg.veiculo_id) {
    const v = db.prepare("SELECT * FROM veiculos WHERE id=?").get(neg.veiculo_id);
    if (v) {
      veicLabel = `${v.marca} ${v.modelo} (${v.placa || "s/ placa"})`;
      const novoStatus = neg.tipo === "compra" ? "disponivel" : "vendido";
      db.prepare("UPDATE veiculos SET status=?, venda=? WHERE id=?").run(novoStatus, novoStatus === "vendido" ? hoje : null, v.id);
    }
  }
  if (neg.troca_marca && neg.troca_modelo && Number(neg.troca_valor) > 0) {
    const precoSugerido = Math.round(Number(neg.troca_valor) * 1.16);
    db.prepare(`INSERT INTO veiculos (marca, modelo, ano, km, cor, combustivel, cambio, placa, custo, preco, status, entrada)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      neg.troca_marca,
      neg.troca_modelo,
      neg.troca_ano || "2020/2020",
      Number(neg.troca_km) || 0,
      neg.troca_cor || "Prata",
      "Flex",
      "Autom\xE1tico",
      (neg.troca_placa || "").toUpperCase(),
      Number(neg.troca_valor),
      precoSugerido,
      "disponivel",
      hoje
    );
  }
  const pags = parseJsonSafe(neg.pagamentos, []);
  const insFin = db.prepare(`INSERT INTO financeiro
    (tipo, categoria, descricao, valor, vencimento, pagamento_data, status, forma_pagamento, conta_bancaria, veiculo_id, cliente_id, negociacao_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  pags.forEach((p) => {
    if (!p.valor || Number(p.valor) <= 0 || String(p.forma).toLowerCase().includes("troca")) return;
    const isReceita = neg.tipo !== "compra";
    insFin.run(
      isReceita ? "receita" : "despesa",
      isReceita ? "Venda de Ve\xEDculo" : "Compra de Ve\xEDculo",
      `${p.forma}${p.financeira ? ` (${p.financeira})` : ""} \u2014 ${veicLabel}`,
      Number(p.valor),
      hoje,
      hoje,
      "pago",
      p.forma,
      "Conta Principal",
      neg.veiculo_id,
      neg.cliente_id,
      id
    );
  });
  if (Number(neg.comissao_vendedor) > 0) {
    insFin.run(
      "despesa",
      "Comiss\xE3o",
      `Comiss\xE3o venda \u2014 ${veicLabel}`,
      Number(neg.comissao_vendedor),
      hoje,
      null,
      "pendente",
      "Pix / TED",
      "Conta Principal",
      neg.veiculo_id,
      null,
      id
    );
  }
  audit(req.user.id, "concluir_negociacao", "negociacoes", id);
  res.json(listaNegociacoes());
});
app.delete("/api/negociacoes/:id", auth, perfil("admin", "gerente"), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM negociacoes WHERE id=?").run(id);
  audit(req.user.id, "excluir", "negociacoes", id);
  res.json(listaNegociacoes());
});
var CAMPOS_FIN = ["tipo", "categoria", "descricao", "valor", "vencimento", "pagamento_data", "status", "forma_pagamento", "conta_bancaria", "veiculo_id", "cliente_id", "negociacao_id"];
var pickFin = (b) => CAMPOS_FIN.map((c) => {
  if (c === "valor") return Number(b[c]) || 0;
  if (["veiculo_id", "cliente_id", "negociacao_id"].includes(c)) return b[c] ? Number(b[c]) : null;
  return b[c] ?? null;
});
var listaFinanceiro = () => db.prepare(`
    SELECT f.*,
      v.marca AS veic_marca, v.modelo AS veic_modelo, v.placa AS veic_placa,
      c.nome AS cliente_nome
    FROM financeiro f
    LEFT JOIN veiculos v ON v.id = f.veiculo_id
    LEFT JOIN clientes c ON c.id = f.cliente_id
    ORDER BY f.vencimento DESC, f.id DESC
  `).all();
app.get("/api/financeiro", auth, (req, res) => res.json(listaFinanceiro()));
app.post("/api/financeiro", auth, (req, res) => {
  if (!req.body?.descricao) return res.status(400).json({ erro: "Descri\xE7\xE3o \xE9 obrigat\xF3ria." });
  const r = db.prepare(`INSERT INTO financeiro (${CAMPOS_FIN.join(",")}) VALUES (${CAMPOS_FIN.map(() => "?").join(",")})`).run(...pickFin(req.body));
  audit(req.user.id, "criar", "financeiro", Number(r.lastInsertRowid));
  res.status(201).json(listaFinanceiro());
});
app.put("/api/financeiro/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE financeiro SET ${CAMPOS_FIN.map((c) => `${c}=?`).join(",")} WHERE id=?`).run(...pickFin(req.body), id);
  if (!r.changes) return res.status(404).json({ erro: "T\xEDtulo n\xE3o encontrado." });
  audit(req.user.id, "editar", "financeiro", id);
  res.json(listaFinanceiro());
});
app.patch("/api/financeiro/:id/baixar", auth, (req, res) => {
  const id = Number(req.params.id);
  const hoje = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  db.prepare("UPDATE financeiro SET status='pago', pagamento_data=? WHERE id=?").run(hoje, id);
  audit(req.user.id, "baixar_titulo", "financeiro", id);
  res.json(listaFinanceiro());
});
app.delete("/api/financeiro/:id", auth, perfil("admin", "gerente", "financeiro"), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM financeiro WHERE id=?").run(id);
  audit(req.user.id, "excluir", "financeiro", id);
  res.json(listaFinanceiro());
});
app.get("/api/config", auth, (req, res) => {
  const loja = db.prepare("SELECT * FROM config_loja WHERE id=1").get();
  const usuarios = db.prepare("SELECT id, nome, email, perfil FROM usuarios ORDER BY id").all();
  const auditoria = db.prepare(`
    SELECT a.*, u.nome AS usuario_nome
    FROM auditoria a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    ORDER BY a.id DESC LIMIT 60
  `).all();
  res.json({ loja, usuarios, auditoria });
});
app.put("/api/config/loja", auth, perfil("admin", "gerente"), (req, res) => {
  const b = req.body || {};
  db.prepare(`
    UPDATE config_loja
    SET razao_social=?, nome_fantasia=?, cnpj=?, telefone=?, whatsapp=?, email=?, endereco=?, cidade=?, uf=?, cep=?, termos_garantia=?
    WHERE id=1
  `).run(b.razao_social, b.nome_fantasia, b.cnpj, b.telefone, b.whatsapp, b.email, b.endereco, b.cidade, b.uf, b.cep, b.termos_garantia);
  audit(req.user.id, "editar", "config_loja", 1);
  res.json(db.prepare("SELECT * FROM config_loja WHERE id=1").get());
});
app.post("/api/usuarios", auth, perfil("admin", "gerente"), (req, res) => {
  const { nome, email, senha, perfil: p } = req.body || {};
  if (!nome || !email || !senha) return res.status(400).json({ erro: "Nome, e-mail e senha s\xE3o obrigat\xF3rios." });
  try {
    const r = db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)").run(nome, String(email).toLowerCase(), bcrypt2.hashSync(String(senha), 10), p || "vendedor");
    audit(req.user.id, "criar", "usuarios", Number(r.lastInsertRowid));
    res.status(201).json(db.prepare("SELECT id, nome, email, perfil FROM usuarios ORDER BY id").all());
  } catch {
    res.status(400).json({ erro: "E-mail j\xE1 cadastrado." });
  }
});
app.delete("/api/usuarios/:id", auth, perfil("admin"), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ erro: "Voc\xEA n\xE3o pode excluir seu pr\xF3prio usu\xE1rio." });
  db.prepare("DELETE FROM usuarios WHERE id=?").run(id);
  audit(req.user.id, "excluir", "usuarios", id);
  res.json(db.prepare("SELECT id, nome, email, perfil FROM usuarios ORDER BY id").all());
});
try {
  const motrizServer = app.listen(MOTRIZ_PORT, () => {
    console.log(`[Motriz API] Ativa em http://localhost:${MOTRIZ_PORT}`);
  });
  motrizServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`[Motriz API] Porta ${MOTRIZ_PORT} ocupada, servindo integrado.`);
    } else {
      console.error("[Motriz API] Erro no listener:", err);
    }
  });
} catch (e) {
}
var server_default = app;

// server/openaiAds.ts
import { createHash as createHash2 } from "crypto";
var PIXEL_ID2 = process.env.OPENAI_ADS_PIXEL_ID || "";
var API_KEY = process.env.OPENAI_ADS_API_KEY || "";
var ENDPOINT = "https://bzr.openai.com/v1/events";
function sha256(valor) {
  return createHash2("sha256").update(valor.trim().toLowerCase()).digest("hex");
}
function urlLimpa(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "https://manosveiculoscompra.com/";
  }
}
var FORMA_DE_DADOS = {
  lead_created: "customer_action",
  contents_viewed: "contents",
  items_added: "contents",
  custom: "custom"
};
function openAiAdsConfigurado() {
  return Boolean(API_KEY && PIXEL_ID2);
}
async function enviarEventoOpenAiAds(evento) {
  if (!API_KEY || !PIXEL_ID2) return false;
  try {
    const user = {};
    const telefone = paraE164(evento.phone || "");
    if (telefone) user.external_id_sha256 = sha256(telefone);
    if (evento.city) user.city = evento.city;
    user.country = "BR";
    if (evento.clientIp) user.ip_address = evento.clientIp;
    if (evento.userAgent) user.user_agent = evento.userAgent;
    const data = {
      type: FORMA_DE_DADOS[evento.eventName],
      amount: Math.round(evento.value ?? 0),
      currency: evento.currency || "BRL"
    };
    if (evento.contents?.length) data.contents = evento.contents;
    const item = {
      id: evento.eventId,
      type: evento.eventName,
      timestamp_ms: Date.now(),
      source_url: urlLimpa(evento.sourceUrl || "https://manosveiculoscompra.com/"),
      action_source: "web",
      data,
      user
    };
    if (evento.eventName === "custom" && evento.customEventName) {
      item.custom_event_name = evento.customEventName;
    }
    if (evento.oppref) item.oppref = evento.oppref;
    const corpo = JSON.stringify({ validate_only: false, events: [item] });
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const res = await fetch(`${ENDPOINT}?pid=${encodeURIComponent(PIXEL_ID2)}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
          },
          body: corpo
        });
        if (res.ok) return true;
        const temporario = res.status >= 500 || res.status === 429;
        const detalhe = await res.text().catch(() => "");
        console.warn(
          `OpenAI Ads CAPI respondeu ${res.status} (tentativa ${tentativa}): ${detalhe.slice(0, 300)}`
        );
        if (!temporario || tentativa === 2) return false;
      } catch (err) {
        console.warn(`OpenAI Ads CAPI falhou na rede (tentativa ${tentativa}):`, err);
        if (tentativa === 2) return false;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  } catch (err) {
    console.error("OpenAI Ads CAPI falhou:", err);
    return false;
  }
}

// server/leadStats.ts
var SUPABASE_URL3 = process.env.SUPABASE_URL || "https://jkblxdxnbmciicakusnl.supabase.co";
var SUPABASE_KEY2 = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_a_LZCcUT50c9-2JspQf1aQ_-khIilRb";
function registrarScore(linha) {
  fetch(`${SUPABASE_URL3}/rest/v1/lead_scores?on_conflict=lead_id,stage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY2,
      Authorization: `Bearer ${SUPABASE_KEY2}`,
      Prefer: "return=minimal,resolution=merge-duplicates"
    },
    body: JSON.stringify(linha)
  }).then((r) => {
    if (!r.ok) console.warn(`lead_scores insert non-ok (${r.status}) \u2014 confira a tabela/RLS`);
  }).catch((err) => console.error("lead_scores log falhou:", err?.message || err));
}
async function diagnosticoScores() {
  try {
    const res = await fetch(
      `${SUPABASE_URL3}/rest/v1/lead_scores?select=created_at&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY2,
          Authorization: `Bearer ${SUPABASE_KEY2}`,
          // Faz o PostgREST devolver a contagem no cabeçalho Content-Range.
          Prefer: "count=exact"
        }
      }
    );
    if (!res.ok) {
      return { acessivel: false, total: null, ultimo: null, erro: `HTTP ${res.status}` };
    }
    const total = Number(res.headers.get("content-range")?.split("/")[1]);
    const linhas = await res.json();
    return {
      acessivel: true,
      total: Number.isFinite(total) ? total : null,
      ultimo: linhas[0]?.created_at ?? null,
      erro: null
    };
  } catch (err) {
    return {
      acessivel: false,
      total: null,
      ultimo: null,
      erro: err?.message || "falha de rede"
    };
  }
}
async function lerScores(limite = 500) {
  try {
    const res = await fetch(
      `${SUPABASE_URL3}/rest/v1/lead_scores?select=*&order=created_at.desc&limit=${limite}`,
      { headers: { apikey: SUPABASE_KEY2, Authorization: `Bearer ${SUPABASE_KEY2}` } }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("lead_scores leitura falhou:", err);
    return [];
  }
}

// server/leadsPanel.ts
function esc(input) {
  return (input || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function agregar(linhas, campo) {
  const mapa = /* @__PURE__ */ new Map();
  for (const l of linhas) {
    const chave = campo(l) || "(sem origem)";
    const a = mapa.get(chave) ?? {
      chave,
      total: 0,
      quentes: 0,
      mornos: 0,
      frios: 0,
      descartados: 0,
      somaScore: 0
    };
    a.total += 1;
    a.somaScore += l.score;
    if (l.descartado) a.descartados += 1;
    else if (l.faixa === "quente") a.quentes += 1;
    else if (l.faixa === "morno") a.mornos += 1;
    else a.frios += 1;
    mapa.set(chave, a);
  }
  return [...mapa.values()].sort((a, b) => b.quentes - a.quentes || b.total - a.total);
}
function tabela(titulo, rotuloChave, dados) {
  if (!dados.length) return "";
  const linhas = dados.map((d) => {
    const pctQuente = d.total ? Math.round(d.quentes / d.total * 100) : 0;
    return `<tr>
        <td>${esc(d.chave)}</td>
        <td class="n">${d.total}</td>
        <td class="n hot">${d.quentes}</td>
        <td class="n">${d.mornos}</td>
        <td class="n dim">${d.frios}</td>
        <td class="n dim">${d.descartados}</td>
        <td class="n">${Math.round(d.somaScore / Math.max(1, d.total))}</td>
        <td class="n"><span class="bar"><i style="width:${pctQuente}%"></i></span> ${pctQuente}%</td>
      </tr>`;
  }).join("\n");
  return `
  <h2>${esc(titulo)}</h2>
  <div class="tw"><table>
    <thead><tr>
      <th>${esc(rotuloChave)}</th><th>Leads</th><th>Quentes</th><th>Mornos</th>
      <th>Frios</th><th>Descartados</th><th>Nota m\xE9dia</th><th>% quente</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table></div>`;
}
function renderLeadsPanel(linhas) {
  const completos = linhas.filter((l) => l.stage === "completo");
  const parciais = linhas.filter((l) => l.stage === "parcial");
  const quentes = completos.filter((l) => !l.descartado && l.faixa === "quente").length;
  const descartados = completos.filter((l) => l.descartado).length;
  const notaMedia = completos.length ? Math.round(completos.reduce((s, l) => s + l.score, 0) / completos.length) : 0;
  const abandonos = Math.max(0, parciais.length - completos.length);
  const css = `
*{box-sizing:border-box}
body{margin:0;background:#0A0A0A;color:#fff;font-family:Inter,system-ui,Arial,sans-serif;line-height:1.5}
.wrap{max-width:1100px;margin:0 auto;padding:24px 20px 80px}
header{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid #1c1c1c}
header img{height:32px}
h1{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:18px 0 4px}
h2{font-size:17px;font-weight:800;margin:32px 0 10px}
.muted{color:#9a9a9a}.small{font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0}
.tile{background:#141414;border:1px solid #1f1f1f;border-radius:14px;padding:14px 16px}
.tile b{display:block;font-size:12px;color:#9a9a9a;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.tile span{font-size:30px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.tile span.hot{color:#ED1C24}
.tw{overflow-x:auto;border:1px solid #1f1f1f;border-radius:14px;background:#141414}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:640px}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid #1f1f1f;white-space:nowrap}
th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;background:#181818}
tbody tr:last-child td{border-bottom:0}
td.n{font-variant-numeric:tabular-nums;font-weight:700}
td.hot{color:#ED1C24}td.dim{color:#7a7a7a;font-weight:400}
.bar{display:inline-block;width:60px;height:6px;background:#232323;border-radius:99px;overflow:hidden;vertical-align:middle;margin-right:6px}
.bar i{display:block;height:100%;background:#ED1C24}
.nota{background:#141414;border:1px solid #1f1f1f;border-left:3px solid #ED1C24;border-radius:12px;padding:14px 16px;margin:24px 0;color:#cfcfcf;font-size:14px}
footer{border-top:1px solid #1c1c1c;margin-top:40px;padding:20px;color:#7a7a7a;font-size:12px}`;
  const vazio = !linhas.length ? `<div class="nota">
        Nenhum lead registrado ainda. Se o funil j\xE1 est\xE1 no ar, confira se a tabela
        <code>lead_scores</code> existe no Supabase e se a policy de insert para
        <code>anon</code> est\xE1 ativa \u2014 o SQL est\xE1 em <code>server/leadStats.ts</code>.
      </div>` : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Leads por origem e nota \u2014 DG Autom\xF3veis</title>
<style>${css}</style>
</head>
<body>
<header>
  <img src="/logo-dg.png" alt="DG Autom\xF3veis">
  <span class="muted small">Painel interno</span>
</header>
<div class="wrap">
  <h1>Leads por origem e nota</h1>
  <p class="muted small">\xDAltimos ${linhas.length} registros. Sem dado pessoal \u2014 nome e telefone ficam no CRM.</p>

  ${vazio}

  <div class="tiles">
    <div class="tile"><b>Leads completos</b><span>${completos.length}</span></div>
    <div class="tile"><b>Quentes</b><span class="hot">${quentes}</span></div>
    <div class="tile"><b>Nota m\xE9dia</b><span>${notaMedia}</span></div>
    <div class="tile"><b>Contatos sem finalizar</b><span>${abandonos}</span></div>
    <div class="tile"><b>Descartados</b><span>${descartados}</span></div>
  </div>

  ${tabela("Por canal", "Canal", agregar(completos, (l) => l.canal ?? ""))}
  ${tabela("Por campanha", "utm_campaign", agregar(completos.filter((l) => l.utm_campaign), (l) => l.utm_campaign ?? ""))}
  ${tabela("Por criativo", "utm_content", agregar(completos.filter((l) => l.utm_content), (l) => l.utm_content ?? ""))}
  ${tabela("Por tipo de neg\xF3cio", "Tipo", agregar(completos, (l) => l.lead_type))}
  ${tabela("Por cidade", "Cidade", agregar(completos.filter((l) => l.cidade), (l) => l.cidade ?? ""))}

  <div class="nota">
    <strong>Como ler:</strong> compare as campanhas pela coluna <em>% quente</em>, n\xE3o pelo total de leads.
    Uma campanha com muitos leads e pouca nota est\xE1 gastando verba para encher a fila do consultor.
    Os pesos da nota est\xE3o em <code>server/scoring.ts</code> \u2014 depois de uns 200 leads, cruze nota
    com neg\xF3cio fechado e recalibre.
  </div>
</div>
<footer>DG Autom\xF3veis \u2014 painel interno. N\xE3o indexado.</footer>
</body>
</html>`;
}

// server/auth.ts
import { timingSafeEqual } from "crypto";
function comparaSeguro(a, b) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
function pedirCredenciais(res, realm) {
  res.status(401).set("WWW-Authenticate", `Basic realm="${realm}", charset="UTF-8"`).set("Cache-Control", "no-store").type("text/plain").send("Acesso restrito.");
}
function basicAuth(realm) {
  return (req, res, next) => {
    const usuarioEsperado = process.env.PANEL_USER || "manos";
    const senhaEsperada = process.env.PANEL_PASSWORD || "";
    if (!senhaEsperada) {
      console.warn(
        `[auth] ${req.path} bloqueado: defina PANEL_PASSWORD no .env do servidor para liberar o painel.`
      );
      res.status(503).set("Cache-Control", "no-store").type("text/plain").send(
        "Painel indispon\xEDvel: PANEL_PASSWORD n\xE3o configurada no servidor.\nDefina PANEL_USER e PANEL_PASSWORD no .env e reinicie (pm2 reload manos --update-env)."
      );
      return;
    }
    const header = req.headers.authorization || "";
    if (!header.toLowerCase().startsWith("basic ")) {
      pedirCredenciais(res, realm);
      return;
    }
    let usuario = "";
    let senha = "";
    try {
      const decodificado = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
      const corte = decodificado.indexOf(":");
      if (corte === -1) {
        pedirCredenciais(res, realm);
        return;
      }
      usuario = decodificado.slice(0, corte);
      senha = decodificado.slice(corte + 1);
    } catch {
      pedirCredenciais(res, realm);
      return;
    }
    const usuarioOk = comparaSeguro(usuario, usuarioEsperado);
    const senhaOk = comparaSeguro(senha, senhaEsperada);
    if (usuarioOk && senhaOk) {
      next();
      return;
    }
    pedirCredenciais(res, realm);
  };
}

// node_modules/hyparquet-writer/src/bytewriter.js
var ByteWriter = class {
  /**
   * @param {number} [initalSize]
   */
  constructor(initalSize = 1024) {
    this.buffer = new ArrayBuffer(initalSize);
    this.view = new DataView(this.buffer);
    this.offset = 0;
    this.index = 0;
  }
  /**
   * @param {number} size
   */
  ensure(size) {
    if (this.index + size > this.buffer.byteLength) {
      const newSize = Math.max(this.buffer.byteLength * 2, this.index + size);
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer);
    }
  }
  finish() {
  }
  getBuffer() {
    return this.buffer.slice(0, this.index);
  }
  getBytes() {
    return new Uint8Array(this.buffer, 0, this.index);
  }
  /**
   * @param {number} value
   */
  appendUint8(value) {
    this.ensure(this.index + 1);
    this.view.setUint8(this.index, value);
    this.offset++;
    this.index++;
  }
  /**
   * @param {number} value
   */
  appendUint32(value) {
    this.ensure(this.index + 4);
    this.view.setUint32(this.index, value, true);
    this.offset += 4;
    this.index += 4;
  }
  /**
   * @param {number} value
   */
  appendInt32(value) {
    this.ensure(this.index + 4);
    this.view.setInt32(this.index, value, true);
    this.offset += 4;
    this.index += 4;
  }
  /**
   * @param {bigint} value
   */
  appendInt64(value) {
    this.ensure(this.index + 8);
    this.view.setBigInt64(this.index, BigInt(value), true);
    this.offset += 8;
    this.index += 8;
  }
  /**
   * @param {number} value
   */
  appendFloat32(value) {
    this.ensure(this.index + 8);
    this.view.setFloat32(this.index, value, true);
    this.offset += 4;
    this.index += 4;
  }
  /**
   * @param {number} value
   */
  appendFloat64(value) {
    this.ensure(this.index + 8);
    this.view.setFloat64(this.index, value, true);
    this.offset += 8;
    this.index += 8;
  }
  /**
   * @param {ArrayBuffer} value
   */
  appendBuffer(value) {
    this.appendBytes(new Uint8Array(value));
  }
  /**
   * @param {Uint8Array} value
   */
  appendBytes(value) {
    this.ensure(this.index + value.length);
    new Uint8Array(this.buffer, this.index, value.length).set(value);
    this.offset += value.length;
    this.index += value.length;
  }
  /**
   * Convert a 32-bit signed integer to varint (1-5 bytes).
   * Writes out groups of 7 bits at a time, setting high bit if more to come.
   *
   * @param {number} value
   */
  appendVarInt(value) {
    while (true) {
      if ((value & ~127) === 0) {
        this.appendUint8(value);
        return;
      } else {
        this.appendUint8(value & 127 | 128);
        value >>>= 7;
      }
    }
  }
  /**
   * Convert a bigint to varint (1-10 bytes for 64-bit range).
   *
   * @param {bigint} value
   */
  appendVarBigInt(value) {
    while (true) {
      if ((value & ~0x7fn) === 0n) {
        this.appendUint8(Number(value));
        return;
      } else {
        this.appendUint8(Number(value & 0x7fn | 0x80n));
        value >>= 7n;
      }
    }
  }
  /**
   * Convert number to zigzag encoding and write as varint.
   *
   * @param {number | bigint} value
   */
  appendZigZag(value) {
    if (typeof value === "number") {
      this.appendVarInt(value << 1 ^ value >> 31);
    } else {
      this.appendVarBigInt(value << 1n ^ value >> 63n);
    }
  }
};

// node_modules/hyparquet/src/schema.js
function schemaTree(schema, rootIndex, path3) {
  const element = schema[rootIndex];
  const children = [];
  let count = 1;
  if (element.num_children) {
    while (children.length < element.num_children) {
      const childElement = schema[rootIndex + count];
      const child = schemaTree(schema, rootIndex + count, [...path3, childElement.name]);
      count += child.count;
      children.push(child);
    }
  }
  return { count, element, children, path: path3 };
}
function getSchemaPath(schema, name) {
  let tree = schemaTree(schema, 0, []);
  const path3 = [tree];
  for (const part of name) {
    const child = tree.children.find((child2) => child2.element.name === part);
    if (!child) throw new Error(`parquet schema element not found: ${name}`);
    path3.push(child);
    tree = child;
  }
  return path3;
}
function getMaxDefinitionLevel(schemaPath) {
  let maxLevel = 0;
  for (const { element } of schemaPath.slice(1)) {
    if (element.repetition_type !== "REQUIRED") {
      maxLevel++;
    }
  }
  return maxLevel;
}
function isListLike(schema) {
  if (!schema) return false;
  if (schema.element.converted_type !== "LIST") return false;
  if (schema.children.length > 1) return false;
  const firstChild = schema.children[0];
  if (firstChild.children.length > 1) return false;
  if (firstChild.element.repetition_type !== "REPEATED") return false;
  return true;
}
function isMapLike(schema) {
  if (!schema) return false;
  if (schema.element.converted_type !== "MAP") return false;
  if (schema.children.length > 1) return false;
  const firstChild = schema.children[0];
  if (firstChild.children.length !== 2) return false;
  if (firstChild.element.repetition_type !== "REPEATED") return false;
  const keyChild = firstChild.children.find((child) => child.element.name === "key");
  if (keyChild?.element.repetition_type === "REPEATED") return false;
  const valueChild = firstChild.children.find((child) => child.element.name === "value");
  if (valueChild?.element.repetition_type === "REPEATED") return false;
  return true;
}

// node_modules/hyparquet/src/xxhash.js
var MASK = 0xffffffffffffffffn;
var PRIME1 = 0x9e3779b185ebca87n;
var PRIME2 = 0xc2b2ae3d27d4eb4fn;
var PRIME3 = 0x165667b19e3779f9n;
var PRIME4 = 0x85ebca77c2b2ae63n;
var PRIME5 = 0x27d4eb2f165667c5n;
function rotl64(x, r) {
  return (x << r | x >> 64n - r) & MASK;
}
function round(acc, val) {
  acc = acc + val * PRIME2 & MASK;
  acc = rotl64(acc, 31n);
  return acc * PRIME1 & MASK;
}
function mergeRound(acc, val) {
  acc ^= round(0n, val);
  return acc * PRIME1 + PRIME4 & MASK;
}
function xxhash64(input, seed = 0n) {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const len = input.byteLength;
  let offset = 0;
  let h64;
  if (len >= 32) {
    let v1 = seed + PRIME1 + PRIME2 & MASK;
    let v2 = seed + PRIME2 & MASK;
    let v3 = seed;
    let v4 = seed - PRIME1 & MASK;
    while (offset + 32 <= len) {
      v1 = round(v1, view.getBigUint64(offset, true));
      offset += 8;
      v2 = round(v2, view.getBigUint64(offset, true));
      offset += 8;
      v3 = round(v3, view.getBigUint64(offset, true));
      offset += 8;
      v4 = round(v4, view.getBigUint64(offset, true));
      offset += 8;
    }
    h64 = rotl64(v1, 1n) + rotl64(v2, 7n) + rotl64(v3, 12n) + rotl64(v4, 18n) & MASK;
    h64 = mergeRound(h64, v1);
    h64 = mergeRound(h64, v2);
    h64 = mergeRound(h64, v3);
    h64 = mergeRound(h64, v4);
  } else {
    h64 = seed + PRIME5 & MASK;
  }
  h64 = h64 + BigInt(len) & MASK;
  while (offset + 8 <= len) {
    h64 ^= round(0n, view.getBigUint64(offset, true));
    h64 = rotl64(h64, 27n) * PRIME1 + PRIME4 & MASK;
    offset += 8;
  }
  if (offset + 4 <= len) {
    h64 ^= BigInt(view.getUint32(offset, true)) * PRIME1 & MASK;
    h64 = rotl64(h64, 23n) * PRIME2 + PRIME3 & MASK;
    offset += 4;
  }
  while (offset < len) {
    h64 ^= BigInt(view.getUint8(offset)) * PRIME5 & MASK;
    h64 = rotl64(h64, 11n) * PRIME1 & MASK;
    offset += 1;
  }
  h64 ^= h64 >> 33n;
  h64 = h64 * PRIME2 & MASK;
  h64 ^= h64 >> 29n;
  h64 = h64 * PRIME3 & MASK;
  h64 ^= h64 >> 32n;
  return h64;
}

// node_modules/hyparquet/src/bloom.js
var textEncoder = new TextEncoder();
var SALT = new Uint32Array([
  1203114875,
  1150766481,
  2284105051,
  2729912477,
  1884591559,
  770785867,
  2667333959,
  1550580529
]);
function hashParquetValue(value, element) {
  if (value === null || value === void 0) return void 0;
  const { type, converted_type, logical_type } = element;
  if (type === "BOOLEAN") {
    if (typeof value !== "boolean") return void 0;
    return xxhash64(new Uint8Array([value ? 1 : 0]));
  }
  if (type === "FLOAT") {
    if (typeof value !== "number") return void 0;
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    return xxhash64(new Uint8Array(buf));
  }
  if (type === "DOUBLE") {
    if (typeof value !== "number") return void 0;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    return xxhash64(new Uint8Array(buf));
  }
  if (type === "INT32") {
    if (converted_type === "DATE" || converted_type === "DECIMAL" || converted_type === "TIME_MILLIS") return void 0;
    if (logical_type?.type === "DATE" || logical_type?.type === "TIME" || logical_type?.type === "DECIMAL") return void 0;
    if (typeof value !== "number" || !Number.isInteger(value)) return void 0;
    const buf = new ArrayBuffer(4);
    new DataView(buf).setInt32(0, value | 0, true);
    return xxhash64(new Uint8Array(buf));
  }
  if (type === "INT64") {
    if (converted_type === "TIMESTAMP_MILLIS" || converted_type === "TIMESTAMP_MICROS") return void 0;
    if (converted_type === "TIME_MICROS" || converted_type === "DECIMAL") return void 0;
    if (logical_type?.type === "TIMESTAMP" || logical_type?.type === "TIME" || logical_type?.type === "DECIMAL") return void 0;
    let bigValue;
    if (typeof value === "bigint") bigValue = value;
    else if (typeof value === "number" && Number.isSafeInteger(value)) bigValue = BigInt(value);
    else return void 0;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, BigInt.asUintN(64, bigValue), true);
    return xxhash64(new Uint8Array(buf));
  }
  if (type === "BYTE_ARRAY") {
    if (converted_type === "JSON" || converted_type === "BSON" || converted_type === "DECIMAL") return void 0;
    if (logical_type?.type === "JSON" || logical_type?.type === "BSON" || logical_type?.type === "VARIANT") return void 0;
    if (logical_type?.type === "GEOMETRY" || logical_type?.type === "GEOGRAPHY") return void 0;
    if (typeof value === "string") return xxhash64(textEncoder.encode(value));
    if (value instanceof Uint8Array) return xxhash64(value);
    return void 0;
  }
  if (type === "FIXED_LEN_BYTE_ARRAY") {
    if (converted_type === "DECIMAL" || converted_type === "INTERVAL") return void 0;
    if (logical_type?.type === "DECIMAL" || logical_type?.type === "UUID" || logical_type?.type === "FLOAT16") return void 0;
    if (logical_type?.type === "GEOMETRY" || logical_type?.type === "GEOGRAPHY") return void 0;
    if (value instanceof Uint8Array) return xxhash64(value);
    return void 0;
  }
  return void 0;
}

// node_modules/hyparquet-writer/src/thrift.js
var STOP = 0;
var TRUE = 1;
var FALSE = 2;
var BYTE = 3;
var I32 = 5;
var I64 = 6;
var DOUBLE = 7;
var BINARY = 8;
var LIST = 9;
var STRUCT = 12;
var ThriftStruct = class {
  /**
   * @param {ThriftField[]} fields
   */
  constructor(fields) {
    this.fields = fields;
  }
};
function serializeTCompactProtocol(writer, data) {
  writeElement(writer, STRUCT, data);
}
function writeElement(writer, type, value) {
  if (type === TRUE) return;
  if (type === FALSE) return;
  if (type === BYTE && typeof value === "number") {
    writer.appendUint8(value);
  } else if (type === I32 && typeof value === "number") {
    writer.appendZigZag(value);
  } else if (type === I64 && typeof value === "bigint") {
    writer.appendZigZag(value);
  } else if (type === DOUBLE && typeof value === "number") {
    writer.appendFloat64(value);
  } else if (type === BINARY && typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    writer.appendVarInt(bytes.length);
    writer.appendBytes(bytes);
  } else if (type === BINARY && value instanceof Uint8Array) {
    writer.appendVarInt(value.byteLength);
    writer.appendBytes(value);
  } else if (type === LIST && Array.isArray(value)) {
    const elemType = getCompactTypeForList(value);
    if (value.length > 14) {
      writer.appendUint8(15 << 4 | elemType);
      writer.appendVarInt(value.length);
    } else {
      writer.appendUint8(value.length << 4 | elemType);
    }
    if (elemType === FALSE) {
      for (const v of value) {
        writer.appendUint8(v ? 1 : 0);
      }
    } else {
      for (const v of value) {
        writeElement(writer, elemType, v);
      }
    }
  } else if (type === STRUCT && value instanceof ThriftStruct) {
    let lastFid = 0;
    for (const [fid, fieldType, fieldValue] of value.fields) {
      if (fieldValue === void 0) continue;
      lastFid = writeStructField(writer, lastFid, fid, fieldType, fieldValue);
    }
    writer.appendUint8(STOP);
  } else if (type === STRUCT && typeof value === "object") {
    let lastFid = 0;
    for (const [k, v] of Object.entries(value)) {
      if (v === void 0) continue;
      const fid = parseInt(k.replace(/^field_/, ""), 10);
      if (Number.isNaN(fid)) {
        throw new Error(`thrift invalid field name: ${k}. Expected "field_###"`);
      }
      const t = getCompactTypeForValue(v);
      lastFid = writeStructField(writer, lastFid, fid, t, v);
    }
    writer.appendUint8(STOP);
  } else {
    throw new Error(`thrift invalid type ${type} for value ${value}`);
  }
}
function writeStructField(writer, lastFid, fid, type, value) {
  const delta = fid - lastFid;
  if (delta <= 0) {
    throw new Error(`thrift non-monotonic field id: fid=${fid}, lastFid=${lastFid}`);
  }
  if (delta > 15) {
    writer.appendUint8(type);
    writer.appendZigZag(fid);
  } else {
    writer.appendUint8(delta << 4 | type);
  }
  writeElement(writer, type, value);
  return fid;
}
function getCompactTypeForValue(value) {
  if (value === true) return TRUE;
  if (value === false) return FALSE;
  if (Number.isInteger(value)) return I32;
  if (typeof value === "number") return DOUBLE;
  if (typeof value === "bigint") return I64;
  if (typeof value === "string") return BINARY;
  if (value instanceof Uint8Array) return BINARY;
  if (Array.isArray(value)) return LIST;
  if (value && typeof value === "object") return STRUCT;
  throw new Error(`Cannot determine thrift compact type for: ${value}`);
}
function getCompactTypeForList(value) {
  let elemType = 0;
  for (const v of value) {
    let t = getCompactTypeForValue(v);
    if (t === TRUE) t = FALSE;
    if (!elemType) elemType = t;
    if (elemType === DOUBLE && t === I32) t = DOUBLE;
    if (elemType === I32 && t === DOUBLE) elemType = DOUBLE;
    if (t !== elemType) {
      throw new Error(`thrift invalid type for list element: ${v} (expected type ${elemType})`);
    }
  }
  return elemType ?? BYTE;
}

// node_modules/hyparquet-writer/src/bloom.js
var SALT2 = new Uint32Array([
  1203114875,
  1150766481,
  2284105051,
  2729912477,
  1884591559,
  770785867,
  2667333959,
  1550580529
]);
var BYTES_PER_BLOCK = 32;
var MIN_BYTES = 32;
var MAX_BYTES = 128 * 1024 * 1024;
function blockIndex(hash2, numBlocks) {
  return Number((hash2 >> 32n) * BigInt(numBlocks) >> 32n);
}
function blockMask(hash2) {
  const m = new Uint32Array(8);
  const low = Number(hash2 & 0xffffffffn) | 0;
  for (let i = 0; i < 8; i++) {
    m[i] = 1 << (Math.imul(low, SALT2[i]) >>> 27);
  }
  return m;
}
function sbbfInsert(blocks, hash2) {
  const offset = blockIndex(hash2, blocks.length >> 3) << 3;
  const m = blockMask(hash2);
  for (let i = 0; i < 8; i++) {
    blocks[offset + i] |= m[i];
  }
}
function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
function optimalNumBytes(ndv, fpp) {
  if (!(fpp > 0 && fpp < 1)) throw new Error(`bloom filter fpp must be in (0, 1), got ${fpp}`);
  if (!(ndv >= 0)) throw new Error(`bloom filter ndv must be >= 0, got ${ndv}`);
  const m = -8 * ndv / Math.log(1 - fpp ** (1 / 8));
  let numBits = Math.ceil(m);
  if (!isFinite(numBits) || numBits > MAX_BYTES << 3) numBits = MAX_BYTES << 3;
  const blockBits = BYTES_PER_BLOCK << 3;
  numBits = Math.ceil(numBits / blockBits) * blockBits;
  let numBytes = numBits >> 3;
  if (numBytes < MIN_BYTES) numBytes = MIN_BYTES;
  if (numBytes < 1024) numBytes = nextPowerOfTwo(numBytes);
  return numBytes;
}
var BloomBuilder = class {
  /**
   * @param {SchemaElement} element
   * @param {{ fpp?: number, maxBytes?: number }} [options]
   */
  constructor(element, { fpp = 0.01, maxBytes = 1024 * 1024 } = {}) {
    this.element = element;
    this.fpp = fpp;
    this.maxBytes = maxBytes;
    this.hashes = /* @__PURE__ */ new Set();
    this.skipped = 0;
  }
  /** @param {any} value */
  insert(value) {
    if (value === null || value === void 0) return;
    const h = hashParquetValue(value, this.element);
    if (h === void 0) {
      this.skipped++;
      return;
    }
    this.hashes.add(h);
  }
  /** @returns {Uint32Array | undefined} */
  finalize() {
    if (this.skipped > 0 || this.hashes.size === 0) return void 0;
    const numBytes = optimalNumBytes(this.hashes.size, this.fpp);
    if (numBytes > this.maxBytes) return void 0;
    const blocks = new Uint32Array(numBytes >> 2);
    for (const h of this.hashes) sbbfInsert(blocks, h);
    return blocks;
  }
};
function writeBloomFilter(writer, blocks) {
  if (blocks.length % 8 !== 0) {
    throw new Error(`bloom filter block count must be a multiple of 8 uint32 words, got ${blocks.length}`);
  }
  serializeTCompactProtocol(writer, {
    field_1: blocks.byteLength,
    // numBytes
    field_2: { field_1: {} },
    // algorithm: SplitBlockAlgorithm
    field_3: { field_1: {} },
    // hash: XxHash
    field_4: { field_1: {} }
    // compression: Uncompressed
  });
  for (let i = 0; i < blocks.length; i++) {
    writer.appendUint32(blocks[i]);
  }
}
function writeBlooms(writer, pageIndexes) {
  for (const { chunk, bloomFilter } of pageIndexes) {
    if (!bloomFilter || !chunk.meta_data) continue;
    const offset = writer.offset;
    writeBloomFilter(writer, bloomFilter);
    chunk.meta_data.bloom_filter_offset = BigInt(offset);
    chunk.meta_data.bloom_filter_length = writer.offset - offset;
  }
}

// node_modules/hyparquet/src/constants.js
var ParquetTypes = [
  "BOOLEAN",
  "INT32",
  "INT64",
  "INT96",
  // deprecated
  "FLOAT",
  "DOUBLE",
  "BYTE_ARRAY",
  "FIXED_LEN_BYTE_ARRAY"
];
var Encodings = [
  "PLAIN",
  "GROUP_VAR_INT",
  // deprecated
  "PLAIN_DICTIONARY",
  "RLE",
  "BIT_PACKED",
  // deprecated
  "DELTA_BINARY_PACKED",
  "DELTA_LENGTH_BYTE_ARRAY",
  "DELTA_BYTE_ARRAY",
  "RLE_DICTIONARY",
  "BYTE_STREAM_SPLIT"
];
var FieldRepetitionTypes = [
  "REQUIRED",
  "OPTIONAL",
  "REPEATED"
];
var ConvertedTypes = [
  "UTF8",
  "MAP",
  "MAP_KEY_VALUE",
  "LIST",
  "ENUM",
  "DECIMAL",
  "DATE",
  "TIME_MILLIS",
  "TIME_MICROS",
  "TIMESTAMP_MILLIS",
  "TIMESTAMP_MICROS",
  "UINT_8",
  "UINT_16",
  "UINT_32",
  "UINT_64",
  "INT_8",
  "INT_16",
  "INT_32",
  "INT_64",
  "JSON",
  "BSON",
  "INTERVAL"
];
var CompressionCodecs = [
  "UNCOMPRESSED",
  "SNAPPY",
  "GZIP",
  "LZO",
  "BROTLI",
  "LZ4",
  "ZSTD",
  "LZ4_RAW"
];
var PageTypes = [
  "DATA_PAGE",
  "INDEX_PAGE",
  "DICTIONARY_PAGE",
  "DATA_PAGE_V2"
];
var BoundaryOrders = [
  "UNORDERED",
  "ASCENDING",
  "DESCENDING"
];
var EdgeInterpolationAlgorithms = [
  "SPHERICAL",
  "VINCENTY",
  "THOMAS",
  "ANDOYER",
  "KARNEY"
];

// node_modules/hyparquet-writer/src/delta.js
var BLOCK_SIZE = 128;
var MINIBLOCKS_PER_BLOCK = 4;
var VALUES_PER_MINIBLOCK = BLOCK_SIZE / MINIBLOCKS_PER_BLOCK;
function deltaBinaryPack(writer, values) {
  const count = values.length;
  if (count === 0) {
    writer.appendVarInt(BLOCK_SIZE);
    writer.appendVarInt(MINIBLOCKS_PER_BLOCK);
    writer.appendVarInt(0);
    writer.appendVarInt(0);
    return;
  }
  if (typeof values[0] !== "number" && typeof values[0] !== "bigint") {
    throw new Error("deltaBinaryPack only supports number or bigint arrays");
  }
  if (usesInt32NumberPath(values)) {
    deltaBinaryPackInt32(writer, values);
  } else {
    deltaBinaryPackBigInt(writer, values);
  }
}
function usesInt32NumberPath(values) {
  if (values instanceof Int32Array) return true;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (typeof value !== "number" || !Number.isInteger(value) || value < -2147483648 || value > 2147483647) return false;
  }
  return true;
}
function deltaBinaryPackInt32(writer, values) {
  const count = values.length;
  writer.appendVarInt(BLOCK_SIZE);
  writer.appendVarInt(MINIBLOCKS_PER_BLOCK);
  writer.appendVarInt(count);
  appendZigZagNumber(writer, Number(values[0]));
  const packedByBitWidth = [];
  const blockDeltas = new Float64Array(BLOCK_SIZE);
  const bitWidths = new Uint8Array(MINIBLOCKS_PER_BLOCK);
  let index = 1;
  while (index < count) {
    const blockEnd = Math.min(index + BLOCK_SIZE, count);
    const blockSize = blockEnd - index;
    let minDelta = Number(values[index]) - Number(values[index - 1]);
    blockDeltas[0] = minDelta;
    for (let i = 1; i < blockSize; i++) {
      const delta = Number(values[index + i]) - Number(values[index + i - 1]);
      blockDeltas[i] = delta;
      if (delta < minDelta) minDelta = delta;
    }
    appendZigZagNumber(writer, minDelta);
    for (let mb = 0; mb < MINIBLOCKS_PER_BLOCK; mb++) {
      const mbStart = mb * VALUES_PER_MINIBLOCK;
      const mbEnd = Math.min(mbStart + VALUES_PER_MINIBLOCK, blockSize);
      let maxAdjusted = 0;
      for (let i = mbStart; i < mbEnd; i++) {
        const adjusted = blockDeltas[i] - minDelta;
        if (adjusted > maxAdjusted) maxAdjusted = adjusted;
      }
      bitWidths[mb] = bitWidthNumber(maxAdjusted);
    }
    writer.appendBytes(bitWidths);
    for (let mb = 0; mb < MINIBLOCKS_PER_BLOCK; mb++) {
      const bitWidth2 = bitWidths[mb];
      if (bitWidth2 === 0) continue;
      const mbStart = mb * VALUES_PER_MINIBLOCK;
      const mbEnd = Math.min(mbStart + VALUES_PER_MINIBLOCK, blockSize);
      const packed = packedByBitWidth[bitWidth2] ??= new Uint8Array(bitWidth2 * 4);
      let byteIndex = 0;
      let buffer = 0;
      let bitsUsed = 0;
      if (bitWidth2 <= 25) {
        for (let i = 0; i < VALUES_PER_MINIBLOCK; i++) {
          const adjusted = mbStart + i < mbEnd ? blockDeltas[mbStart + i] - minDelta : 0;
          buffer |= adjusted << bitsUsed;
          bitsUsed += bitWidth2;
          while (bitsUsed >= 8) {
            packed[byteIndex++] = buffer & 255;
            buffer >>>= 8;
            bitsUsed -= 8;
          }
        }
      } else {
        for (let i = 0; i < VALUES_PER_MINIBLOCK; i++) {
          const adjusted = mbStart + i < mbEnd ? blockDeltas[mbStart + i] - minDelta : 0;
          buffer += adjusted * 2 ** bitsUsed;
          bitsUsed += bitWidth2;
          while (bitsUsed >= 8) {
            packed[byteIndex++] = buffer % 256;
            buffer = Math.floor(buffer / 256);
            bitsUsed -= 8;
          }
        }
      }
      writer.appendBytes(packed);
    }
    index = blockEnd;
  }
}
function deltaBinaryPackBigInt(writer, values) {
  const count = values.length;
  writer.appendVarInt(BLOCK_SIZE);
  writer.appendVarInt(MINIBLOCKS_PER_BLOCK);
  writer.appendVarInt(count);
  writer.appendZigZag(values[0]);
  let index = 1;
  while (index < count) {
    const blockEnd = Math.min(index + BLOCK_SIZE, count);
    const blockSize = blockEnd - index;
    const blockDeltas = new BigInt64Array(blockSize);
    let minDelta = BigInt(values[index]) - BigInt(values[index - 1]);
    blockDeltas[0] = minDelta;
    for (let i = 1; i < blockSize; i++) {
      const delta = BigInt(values[index + i]) - BigInt(values[index + i - 1]);
      blockDeltas[i] = delta;
      if (delta < minDelta) minDelta = delta;
    }
    writer.appendZigZag(minDelta);
    const bitWidths = new Uint8Array(MINIBLOCKS_PER_BLOCK);
    for (let mb = 0; mb < MINIBLOCKS_PER_BLOCK; mb++) {
      const mbStart = mb * VALUES_PER_MINIBLOCK;
      const mbEnd = Math.min(mbStart + VALUES_PER_MINIBLOCK, blockSize);
      let maxAdjusted = 0n;
      for (let i = mbStart; i < mbEnd; i++) {
        const adjusted = blockDeltas[i] - minDelta;
        if (adjusted > maxAdjusted) maxAdjusted = adjusted;
      }
      bitWidths[mb] = bitWidth(maxAdjusted);
    }
    writer.appendBytes(bitWidths);
    for (let mb = 0; mb < MINIBLOCKS_PER_BLOCK; mb++) {
      const bitWidth2 = bitWidths[mb];
      if (bitWidth2 === 0) continue;
      const mbStart = mb * VALUES_PER_MINIBLOCK;
      const mbEnd = Math.min(mbStart + VALUES_PER_MINIBLOCK, blockSize);
      let buffer = 0n;
      let bitsUsed = 0;
      for (let i = 0; i < VALUES_PER_MINIBLOCK; i++) {
        const adjusted = mbStart + i < mbEnd ? blockDeltas[mbStart + i] - minDelta : 0n;
        buffer |= adjusted << BigInt(bitsUsed);
        bitsUsed += bitWidth2;
        while (bitsUsed >= 8) {
          writer.appendUint8(Number(buffer & 0xffn));
          buffer >>= 8n;
          bitsUsed -= 8;
        }
      }
    }
    index = blockEnd;
  }
}
function appendZigZagNumber(writer, value) {
  let encoded = value < 0 ? -value * 2 - 1 : value * 2;
  while (encoded >= 128) {
    writer.appendUint8(encoded % 128 + 128);
    encoded = Math.floor(encoded / 128);
  }
  writer.appendUint8(encoded);
}
function bitWidthNumber(value) {
  if (value === 0) return 0;
  return value > 4294967295 ? 33 : 32 - Math.clz32(value);
}
function deltaLengthByteArray(writer, values) {
  const lengths = new Int32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!(value instanceof Uint8Array)) {
      throw new Error("deltaLengthByteArray expects Uint8Array values");
    }
    lengths[i] = value.length;
  }
  deltaBinaryPack(writer, lengths);
  for (const value of values) {
    writer.appendBytes(value);
  }
}
function deltaByteArray(writer, values) {
  if (values.length === 0) {
    deltaBinaryPack(writer, []);
    deltaBinaryPack(writer, []);
    return;
  }
  const prefixLengths = new Int32Array(values.length);
  const suffixLengths = new Int32Array(values.length);
  const value = values[0];
  if (!(value instanceof Uint8Array)) {
    throw new Error("deltaByteArray expects Uint8Array values");
  }
  prefixLengths[0] = 0;
  suffixLengths[0] = value.length;
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    let prefixLen;
    if (curr === prev) {
      prefixLen = curr.length;
    } else {
      if (!(curr instanceof Uint8Array)) {
        throw new Error("deltaByteArray expects Uint8Array values");
      }
      prefixLen = 0;
      const maxPrefix = Math.min(prev.length, curr.length);
      while (prefixLen < maxPrefix && prev[prefixLen] === curr[prefixLen]) {
        prefixLen++;
      }
    }
    prefixLengths[i] = prefixLen;
    suffixLengths[i] = curr.length - prefixLen;
  }
  deltaBinaryPack(writer, prefixLengths);
  deltaBinaryPack(writer, suffixLengths);
  for (let i = 0; i < values.length; i++) {
    if (suffixLengths[i] > 0) {
      writer.appendBytes(values[i].subarray(prefixLengths[i]));
    }
  }
}
function bitWidth(value) {
  if (value === 0n) return 0;
  let bits = 0;
  while (value > 0n) {
    bits++;
    value >>= 1n;
  }
  return bits;
}

// node_modules/hyparquet-writer/src/encoding.js
function writeRleBitPackedHybrid(writer, values, bitWidth2) {
  const offsetStart = writer.offset;
  let pendingBitPackedGroups = 0;
  let bitPackedStart = 0;
  let i = 0;
  while (i < values.length) {
    let rleCount = 1;
    const firstVal = values[i];
    while (i + rleCount < values.length && values[i + rleCount] === firstVal) {
      rleCount++;
    }
    if (rleCount >= 8) {
      if (pendingBitPackedGroups) {
        writeBitPackedGroups(writer, values, bitPackedStart, pendingBitPackedGroups, bitWidth2);
        pendingBitPackedGroups = 0;
      }
      writeRleRun(writer, firstVal, rleCount, bitWidth2);
      i += rleCount;
    } else {
      if (pendingBitPackedGroups === 0) {
        bitPackedStart = i;
      }
      pendingBitPackedGroups++;
      i += 8;
    }
  }
  if (pendingBitPackedGroups) {
    writeBitPackedGroups(writer, values, bitPackedStart, pendingBitPackedGroups, bitWidth2);
  }
  return writer.offset - offsetStart;
}
function writeRleRun(writer, value, count, bitWidth2) {
  writer.appendVarInt(count << 1);
  const width = bitWidth2 + 7 >> 3;
  for (let j = 0; j < width; j++) {
    writer.appendUint8(value >> (j << 3) & 255);
  }
}
function writeBitPackedGroups(writer, values, start, numGroups, bitWidth2) {
  writer.appendVarInt(numGroups << 1 | 1);
  if (bitWidth2 === 0) return;
  const mask = (1 << bitWidth2) - 1;
  let buffer = 0;
  let bitsUsed = 0;
  const totalValues = numGroups * 8;
  for (let i = 0; i < totalValues; i++) {
    const idx = start + i;
    const v = idx < values.length ? values[idx] & mask : 0;
    buffer |= v << bitsUsed;
    bitsUsed += bitWidth2;
    while (bitsUsed >= 8) {
      writer.appendUint8(buffer & 255);
      buffer >>>= 8;
      bitsUsed -= 8;
    }
  }
  if (bitsUsed > 0) {
    writer.appendUint8(buffer & 255);
  }
}

// node_modules/hyparquet-writer/src/plain.js
function writePlain(writer, values, type, fixedLength) {
  if (type === "BOOLEAN") {
    writePlainBoolean(writer, values);
  } else if (type === "INT32") {
    writePlainInt32(writer, values);
  } else if (type === "INT64") {
    writePlainInt64(writer, values);
  } else if (type === "FLOAT") {
    writePlainFloat(writer, values);
  } else if (type === "DOUBLE") {
    writePlainDouble(writer, values);
  } else if (type === "BYTE_ARRAY") {
    writePlainByteArray(writer, values);
  } else if (type === "FIXED_LEN_BYTE_ARRAY") {
    if (!fixedLength) throw new Error("parquet FIXED_LEN_BYTE_ARRAY expected type_length");
    writePlainByteArrayFixed(writer, values, fixedLength);
  } else {
    throw new Error(`parquet unsupported type: ${type}`);
  }
}
function writePlainBoolean(writer, values) {
  let currentByte = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (typeof value !== "boolean") throw new Error("parquet expected boolean value, got " + value);
    const bitOffset = i % 8;
    if (value) {
      currentByte |= 1 << bitOffset;
    }
    if (bitOffset === 7) {
      writer.appendUint8(currentByte);
      currentByte = 0;
    }
  }
  if (values.length % 8) {
    writer.appendUint8(currentByte);
  }
}
function writePlainInt32(writer, values) {
  for (const value of values) {
    if (!Number.isSafeInteger(value)) throw new Error("parquet expected integer value, got " + value);
    if (value < -2147483648 || value > 2147483647) throw new Error("parquet expected int32 value, got " + value);
    writer.appendInt32(value);
  }
}
function writePlainInt64(writer, values) {
  for (const value of values) {
    if (typeof value !== "bigint") throw new Error("parquet expected bigint value, got " + value);
    writer.appendInt64(value);
  }
}
function writePlainFloat(writer, values) {
  for (const value of values) {
    if (typeof value !== "number") throw new Error("parquet expected number value, got " + value);
    writer.appendFloat32(value);
  }
}
function writePlainDouble(writer, values) {
  for (const value of values) {
    if (typeof value !== "number") throw new Error("parquet expected number value, got " + value);
    writer.appendFloat64(value);
  }
}
function writePlainByteArray(writer, values) {
  for (const value of values) {
    let bytes = value;
    if (typeof bytes === "string") {
      bytes = new TextEncoder().encode(value);
    }
    if (!(bytes instanceof Uint8Array)) {
      throw new Error("parquet expected Uint8Array value, got " + typeof bytes);
    }
    writer.appendUint32(bytes.length);
    writer.appendBytes(bytes);
  }
}
function writePlainByteArrayFixed(writer, values, fixedLength) {
  for (const value of values) {
    if (!(value instanceof Uint8Array)) throw new Error("parquet expected Uint8Array value, got " + typeof value);
    if (value.length !== fixedLength) throw new Error(`parquet expected Uint8Array of length ${fixedLength}`);
    writer.appendBytes(value);
  }
}

// node_modules/hyparquet-writer/src/variant.js
var encoder = new TextEncoder();
var INT64_MIN = -(2n ** 63n);
var INT64_MAX = 2n ** 63n - 1n;
var VARIANT_NULL = new Uint8Array([0]);
var RESERVED_SHREDDING_FIELDS = /* @__PURE__ */ new Set(["value", "typed_value"]);
var EMPTY_KEY_INDEX = /* @__PURE__ */ new Map();
var EMPTY_METADATA = writeVariantMetadata([]);
function encodeVariantColumn(values, shredding, column) {
  if (column?.required) {
    for (let i = 0; i < values.length; i++) {
      if (values[i] === void 0) {
        throw new Error(`required variant column ${column.name} has undefined value at index ${i}`);
      }
    }
  }
  const shreddingConfig = shredding && normalizeShreddingConfig(shredding);
  if (shreddingConfig) {
    const metadataCache = /* @__PURE__ */ new Map();
    return values.map((value) => {
      if (value === void 0) return null;
      const keys = /* @__PURE__ */ new Set();
      collectKeys(value, keys);
      const { metadata: metadata2, keyIndex: keyIndex2 } = getVariantRowMetadata(keys, metadataCache);
      return { metadata: metadata2, ...encodeShredded(value, shreddingConfig, keyIndex2, true) };
    });
  }
  const dictionary = buildVariantDictionary(values);
  const metadata = writeVariantMetadata(dictionary);
  const keyIndex = /* @__PURE__ */ new Map();
  for (let i = 0; i < dictionary.length; i++) {
    keyIndex.set(dictionary[i], i);
  }
  return values.map((value) => {
    if (value === void 0) return null;
    return { metadata, value: writeVariantValue(value, keyIndex) };
  });
}
function encodeShredded(value, shredType, keyIndex, allowPartialObjects) {
  if (value === null || value === void 0) {
    return { value: VARIANT_NULL, typed_value: null };
  }
  if (Array.isArray(shredType)) {
    if (!Array.isArray(value)) {
      return { value: writeVariantValue(value, keyIndex), typed_value: null };
    }
    const elemShred = shredType[0];
    return { value: null, typed_value: value.map((el) => encodeShredded(el, elemShred, keyIndex, false)) };
  }
  if (typeof shredType === "object") {
    if (typeof value !== "object" || Array.isArray(value) || value instanceof Date || value instanceof Uint8Array) {
      return { value: writeVariantValue(value, keyIndex), typed_value: null };
    }
    const remaining = {};
    let hasRemaining = false;
    for (const k of Object.keys(value)) {
      if (k in shredType || value[k] === void 0) continue;
      remaining[k] = value[k];
      hasRemaining = true;
    }
    if (hasRemaining && !allowPartialObjects) {
      return { value: writeVariantValue(value, keyIndex), typed_value: null };
    }
    const fieldNames = Object.keys(shredType);
    const hasMissingFieldConflict = fieldNames.some(
      (fieldName) => (!Object.prototype.hasOwnProperty.call(value, fieldName) || value[fieldName] === void 0) && keyIndex.has(fieldName)
    );
    if (hasMissingFieldConflict) {
      return { value: writeVariantValue(value, keyIndex), typed_value: null };
    }
    const typedValue = {};
    for (const fieldName of fieldNames) {
      if (!Object.prototype.hasOwnProperty.call(value, fieldName) || value[fieldName] === void 0) {
        continue;
      }
      typedValue[fieldName] = encodeShredded(value[fieldName], shredType[fieldName], keyIndex, false);
    }
    const binaryValue = hasRemaining ? writeVariantValue(remaining, keyIndex) : null;
    return { value: binaryValue, typed_value: typedValue };
  }
  if (matchesType(value, shredType)) {
    return { value: null, typed_value: value };
  }
  return { value: writeVariantValue(value, keyIndex), typed_value: null };
}
function getVariantRowMetadata(keys, metadataCache) {
  if (keys.size === 0) {
    return { metadata: EMPTY_METADATA, keyIndex: EMPTY_KEY_INDEX };
  }
  const dictionary = [...keys].sort();
  const cacheKey = dictionary.join("\0");
  const cached = metadataCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const metadata = writeVariantMetadata(dictionary);
  const keyIndex = /* @__PURE__ */ new Map();
  for (let i = 0; i < dictionary.length; i++) keyIndex.set(dictionary[i], i);
  const rowMetadata = { metadata, keyIndex };
  metadataCache.set(cacheKey, rowMetadata);
  return rowMetadata;
}
function matchesType(value, type) {
  if (value === null || value === void 0) return false;
  switch (type) {
    case "BOOLEAN":
      return typeof value === "boolean";
    case "INT32":
      return typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
    case "INT64":
      return typeof value === "bigint" && value >= INT64_MIN && value <= INT64_MAX;
    case "FLOAT":
      return typeof value === "number";
    case "DOUBLE":
      return typeof value === "number";
    case "STRING":
      return typeof value === "string";
    case "TIMESTAMP":
      return value instanceof Date;
    default:
      return false;
  }
}
var MAX_SHRED_DEPTH = 3;
var MAX_SHRED_LEAVES = 256;
function autoDetectShredding(values) {
  const detected = detectShred(values, 0);
  if (detected === void 0 || typeof detected !== "object") return void 0;
  const normalized = normalizeShreddingConfig(detected);
  if (normalized === void 0 || countShredLeaves(normalized) > MAX_SHRED_LEAVES) return void 0;
  return normalized;
}
function countShredLeaves(shredType) {
  if (Array.isArray(shredType)) return shredType.length ? countShredLeaves(shredType[0]) : 0;
  if (shredType && typeof shredType === "object") {
    let leaves = 0;
    for (const key of Object.keys(shredType)) leaves += countShredLeaves(shredType[key]);
    return leaves;
  }
  return 1;
}
function detectShred(values, depth) {
  const nonNull = [];
  for (const v of values) {
    if (v !== null && v !== void 0) nonNull.push(v);
  }
  if (!nonNull.length) return void 0;
  if (nonNull.some(isPlainObject)) {
    if (depth >= MAX_SHRED_DEPTH) return void 0;
    const fieldValues = /* @__PURE__ */ new Map();
    for (const v of nonNull) {
      if (!isPlainObject(v)) continue;
      for (const [key, fieldValue] of Object.entries(v)) {
        if (fieldValue === void 0) continue;
        const arr = fieldValues.get(key);
        if (arr) arr.push(fieldValue);
        else fieldValues.set(key, [fieldValue]);
      }
    }
    const shredding = {};
    for (const [key, vals] of fieldValues) {
      const fieldShred = detectShred(vals, depth + 1);
      if (fieldShred !== void 0) shredding[key] = fieldShred;
    }
    return Object.keys(shredding).length > 0 ? shredding : void 0;
  }
  if (nonNull.every(Array.isArray)) {
    if (depth >= MAX_SHRED_DEPTH) return void 0;
    const elements = [];
    for (const arr of nonNull) for (const el of arr) elements.push(el);
    const elemShred = detectShred(elements, depth + 1);
    return elemShred === void 0 ? void 0 : [elemShred];
  }
  let jsType;
  for (const v of nonNull) {
    if (Array.isArray(v)) return void 0;
    const t = v instanceof Date ? "date" : typeof v;
    if (jsType === void 0) jsType = t;
    else if (jsType !== t) return void 0;
  }
  return jsType ? jsTypeToBasicType(jsType) : void 0;
}
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof Uint8Array);
}
function normalizeShreddingConfig(shredding) {
  if (Array.isArray(shredding)) {
    const elem = shredding.length ? normalizeShreddingConfig(shredding[0]) : void 0;
    return elem === void 0 ? void 0 : [elem];
  }
  if (typeof shredding === "object") {
    const normalized = {};
    for (const [key, type] of Object.entries(shredding)) {
      if (RESERVED_SHREDDING_FIELDS.has(key)) continue;
      const norm = normalizeShreddingConfig(type);
      if (norm !== void 0) normalized[key] = norm;
    }
    return Object.keys(normalized).length > 0 ? normalized : void 0;
  }
  return shredding;
}
function jsTypeToBasicType(jsType) {
  switch (jsType) {
    case "boolean":
      return "BOOLEAN";
    case "string":
      return "STRING";
    case "number":
      return "DOUBLE";
    case "bigint":
      return "INT64";
    case "date":
      return "TIMESTAMP";
    default:
      return void 0;
  }
}
function buildVariantDictionary(values) {
  const keys = /* @__PURE__ */ new Set();
  collectKeys(values, keys);
  return [...keys].sort();
}
function collectKeys(value, keys) {
  if (value === null || value === void 0) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return;
  }
  if (value instanceof Date || value instanceof Uint8Array) return;
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      keys.add(key);
      collectKeys(value[key], keys);
    }
  }
}
function writeVariantMetadata(dictionary) {
  const n = dictionary.length;
  const encoded = new Array(n);
  let totalStringBytes = 0;
  for (let i = 0; i < n; i++) {
    const e = encoder.encode(dictionary[i]);
    encoded[i] = e;
    totalStringBytes += e.length;
  }
  const offsetSize = byteWidth(totalStringBytes);
  const header = 1 | 1 << 4 | offsetSize - 1 << 6;
  const totalSize = 1 + offsetSize + (n + 1) * offsetSize + totalStringBytes;
  const bytes = new Uint8Array(totalSize);
  let offset = 0;
  bytes[offset++] = header;
  for (let j = 0; j < offsetSize; j++) bytes[offset++] = n >> j * 8 & 255;
  let strOffset = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < offsetSize; j++) bytes[offset++] = strOffset >> j * 8 & 255;
    strOffset += encoded[i].length;
  }
  for (let j = 0; j < offsetSize; j++) bytes[offset++] = strOffset >> j * 8 & 255;
  for (let i = 0; i < n; i++) {
    bytes.set(encoded[i], offset);
    offset += encoded[i].length;
  }
  return bytes;
}
function writeVariantValue(value, keyIndex) {
  const writer = new ByteWriter(8);
  writeValue(value, writer, keyIndex);
  return writer.getBytes();
}
function writeValue(val, writer, keyIndex) {
  if (val === null || val === void 0) {
    writer.appendUint8(0);
    return;
  }
  if (val === true) {
    writer.appendUint8(4);
    return;
  }
  if (val === false) {
    writer.appendUint8(8);
    return;
  }
  if (typeof val === "bigint") {
    if (val < INT64_MIN || val > INT64_MAX) {
      throw new RangeError(`variant bigint out of int64 range: ${val}`);
    }
    writer.appendUint8(6 << 2);
    writer.appendInt64(val);
    return;
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      if (val >= -128 && val <= 127) {
        writer.appendUint8(3 << 2);
        writer.appendUint8(val & 255);
        return;
      }
      if (val >= -32768 && val <= 32767) {
        writer.appendUint8(4 << 2);
        appendUnsignedLE(writer, val, 2);
        return;
      }
      if (val >= -2147483648 && val <= 2147483647) {
        writer.appendUint8(5 << 2);
        writer.appendInt32(val);
        return;
      }
    }
    writer.appendUint8(7 << 2);
    writer.appendFloat64(val);
    return;
  }
  if (typeof val === "string") {
    const strBytes = encoder.encode(val);
    if (strBytes.length <= 63) {
      writer.appendUint8(strBytes.length << 2 | 1);
      writer.appendBytes(strBytes);
    } else {
      writer.appendUint8(16 << 2);
      writer.appendUint32(strBytes.length);
      writer.appendBytes(strBytes);
    }
    return;
  }
  if (val instanceof Date) {
    writer.appendUint8(13 << 2);
    writer.appendInt64(BigInt(val.getTime()) * 1000n);
    return;
  }
  if (val instanceof Uint8Array) {
    writer.appendUint8(15 << 2);
    writer.appendUint32(val.length);
    writer.appendBytes(val);
    return;
  }
  if (Array.isArray(val)) {
    writeVariantArray(val, writer, keyIndex);
    return;
  }
  if (typeof val === "object") {
    writeVariantObject(val, writer, keyIndex);
    return;
  }
  throw new Error(`variant cannot encode value: ${val}`);
}
function writeVariantObject(obj, writer, keyIndex) {
  const entries = Object.keys(obj).filter((key) => obj[key] !== void 0).map((key) => {
    const id = keyIndex.get(key);
    if (id === void 0) throw new Error(`variant key not in dictionary: ${key}`);
    return { id, key };
  });
  entries.sort((a, b) => a.id - b.id);
  const numElements = entries.length;
  const maxFieldId = numElements > 0 ? entries[numElements - 1].id : 0;
  const idWidth = byteWidth(maxFieldId);
  const scratch = new ByteWriter(8);
  const offsets = new Array(numElements + 1);
  offsets[0] = 0;
  for (let i = 0; i < numElements; i++) {
    writeValue(obj[entries[i].key], scratch, keyIndex);
    offsets[i + 1] = scratch.index;
  }
  const offsetWidth = byteWidth(offsets[numElements]);
  const isLarge = numElements > 255 ? 1 : 0;
  writer.appendUint8((offsetWidth - 1 | idWidth - 1 << 2 | isLarge << 4) << 2 | 2);
  if (isLarge) writer.appendUint32(numElements);
  else writer.appendUint8(numElements);
  for (const { id } of entries) appendUnsignedLE(writer, id, idWidth);
  for (const off of offsets) appendUnsignedLE(writer, off, offsetWidth);
  writer.appendBytes(scratch.getBytes());
}
function writeVariantArray(arr, writer, keyIndex) {
  const numElements = arr.length;
  const scratch = new ByteWriter(8);
  const offsets = new Array(numElements + 1);
  offsets[0] = 0;
  for (let i = 0; i < numElements; i++) {
    writeValue(arr[i], scratch, keyIndex);
    offsets[i + 1] = scratch.index;
  }
  const offsetWidth = byteWidth(offsets[numElements]);
  const isLarge = numElements > 255 ? 1 : 0;
  writer.appendUint8((offsetWidth - 1 | isLarge << 2) << 2 | 3);
  if (isLarge) writer.appendUint32(numElements);
  else writer.appendUint8(numElements);
  for (const off of offsets) appendUnsignedLE(writer, off, offsetWidth);
  writer.appendBytes(scratch.getBytes());
}
function byteWidth(maxValue) {
  if (maxValue <= 255) return 1;
  if (maxValue <= 65535) return 2;
  if (maxValue <= 16777215) return 3;
  return 4;
}
function appendUnsignedLE(writer, value, width) {
  for (let i = 0; i < width; i++) {
    writer.appendUint8(value >> i * 8 & 255);
  }
}

// node_modules/hyparquet-writer/src/schema.js
function schemaFromColumnData({ columnData, schemaOverrides }) {
  const schema = [{
    name: "root",
    num_children: columnData.length
  }];
  for (const { name, data, type, nullable, shredding } of columnData) {
    if (schemaOverrides?.[name]) {
      const override = schemaOverrides[name];
      if (type || nullable !== void 0) {
        throw new Error(`cannot provide both type and schema override for column ${name}`);
      }
      if (override.name !== name) {
        throw new Error(`schema override for column ${name} must have matching name, got ${override.name}`);
      }
      if (override.type === "FIXED_LEN_BYTE_ARRAY" && !override.type_length) {
        throw new Error("schema override for FIXED_LEN_BYTE_ARRAY must include type_length");
      }
      if (override.num_children) {
        throw new Error("schema override does not support nested types");
      }
      schema.push(override);
    } else if (type === "VARIANT") {
      const repetition_type = nullable === false ? "REQUIRED" : "OPTIONAL";
      const shreddingConfig = shredding && shredding !== true ? normalizeShreddingConfig(shredding) : void 0;
      if (shreddingConfig) {
        schema.push(
          { name, repetition_type, num_children: 3, logical_type: { type: "VARIANT" } },
          { name: "metadata", type: "BYTE_ARRAY", repetition_type: "REQUIRED" },
          { name: "value", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
          ...buildVariantTypedValue(shreddingConfig)
        );
      } else {
        schema.push(
          { name, repetition_type, num_children: 2, logical_type: { type: "VARIANT" } },
          { name: "metadata", type: "BYTE_ARRAY", repetition_type: "REQUIRED" },
          { name: "value", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" }
        );
      }
    } else if (type) {
      schema.push(basicTypeToSchemaElement(name, type, nullable));
    } else {
      schema.push(autoSchemaElement(name, data.slice(0, 1e3)));
    }
  }
  return schema;
}
function buildVariantTypedValue(shredType) {
  if (Array.isArray(shredType)) {
    return [
      { name: "typed_value", repetition_type: "OPTIONAL", converted_type: "LIST", num_children: 1 },
      { name: "list", repetition_type: "REPEATED", num_children: 1 },
      { name: "element", repetition_type: "REQUIRED", num_children: 2 },
      { name: "value", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
      ...buildVariantTypedValue(shredType[0])
    ];
  }
  if (typeof shredType === "object") {
    const fieldNames = Object.keys(shredType);
    const elements = [
      { name: "typed_value", repetition_type: "OPTIONAL", num_children: fieldNames.length }
    ];
    for (const fieldName of fieldNames) {
      elements.push(
        { name: fieldName, repetition_type: "OPTIONAL", num_children: 2 },
        { name: "value", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
        ...buildVariantTypedValue(shredType[fieldName])
      );
    }
    return elements;
  }
  return [shreddedLeafElement(shredType)];
}
function shreddedLeafElement(type) {
  switch (type) {
    case "STRING":
      return { name: "typed_value", type: "BYTE_ARRAY", converted_type: "UTF8", repetition_type: "OPTIONAL" };
    case "INT32":
      return { name: "typed_value", type: "INT32", repetition_type: "OPTIONAL" };
    case "INT64":
      return { name: "typed_value", type: "INT64", repetition_type: "OPTIONAL" };
    case "DOUBLE":
      return { name: "typed_value", type: "DOUBLE", repetition_type: "OPTIONAL" };
    case "FLOAT":
      return { name: "typed_value", type: "FLOAT", repetition_type: "OPTIONAL" };
    case "BOOLEAN":
      return { name: "typed_value", type: "BOOLEAN", repetition_type: "OPTIONAL" };
    case "TIMESTAMP":
      return { name: "typed_value", type: "INT64", converted_type: "TIMESTAMP_MICROS", repetition_type: "OPTIONAL" };
    default:
      throw new Error(`unsupported shredded field type: ${type}`);
  }
}
function basicTypeToSchemaElement(name, type, nullable) {
  const repetition_type = nullable === false ? "REQUIRED" : "OPTIONAL";
  if (type === "STRING") {
    return { name, type: "BYTE_ARRAY", converted_type: "UTF8", repetition_type };
  }
  if (type === "JSON") {
    return { name, type: "BYTE_ARRAY", converted_type: "JSON", repetition_type };
  }
  if (type === "TIMESTAMP") {
    return { name, type: "INT64", converted_type: "TIMESTAMP_MILLIS", repetition_type };
  }
  if (type === "UUID") {
    return { name, type: "FIXED_LEN_BYTE_ARRAY", type_length: 16, logical_type: { type: "UUID" }, repetition_type };
  }
  if (type === "FLOAT16") {
    return { name, type: "FIXED_LEN_BYTE_ARRAY", type_length: 2, logical_type: { type: "FLOAT16" }, repetition_type };
  }
  if (type === "GEOMETRY") {
    return { name, type: "BYTE_ARRAY", logical_type: { type: "GEOMETRY" }, repetition_type };
  }
  if (type === "GEOGRAPHY") {
    return { name, type: "BYTE_ARRAY", logical_type: { type: "GEOGRAPHY" }, repetition_type };
  }
  return { name, type, repetition_type };
}
function autoSchemaElement(name, values) {
  let type;
  let repetition_type = "REQUIRED";
  let converted_type;
  if (values instanceof Int32Array) return { name, type: "INT32", repetition_type };
  if (values instanceof BigInt64Array) return { name, type: "INT64", repetition_type };
  if (values instanceof Float32Array) return { name, type: "FLOAT", repetition_type };
  if (values instanceof Float64Array) return { name, type: "DOUBLE", repetition_type };
  for (const value of values) {
    if (value === null || value === void 0) {
      repetition_type = "OPTIONAL";
    } else {
      let valueType;
      let valueConvertedType;
      if (typeof value === "boolean") valueType = "BOOLEAN";
      else if (typeof value === "bigint") valueType = "INT64";
      else if (Number.isInteger(value)) valueType = "INT32";
      else if (typeof value === "number") valueType = "DOUBLE";
      else if (value instanceof Uint8Array) valueType = "BYTE_ARRAY";
      else if (typeof value === "string") {
        valueType = "BYTE_ARRAY";
        valueConvertedType = "UTF8";
      } else if (value instanceof Date) {
        valueType = "INT64";
        valueConvertedType = "TIMESTAMP_MILLIS";
      } else if (typeof value === "object") {
        valueType = "BYTE_ARRAY";
        valueConvertedType = "JSON";
      } else throw new Error(`cannot determine parquet type for: ${value}`);
      if (type === void 0) {
        type = valueType;
        converted_type = valueConvertedType;
      } else if (type === "INT32" && valueType === "DOUBLE") {
        type = "DOUBLE";
      } else if (type === "DOUBLE" && valueType === "INT32") {
        continue;
      } else if (type !== valueType || converted_type !== valueConvertedType) {
        throw new Error(`parquet cannot write mixed types: ${converted_type ?? type} and ${valueConvertedType ?? valueType}`);
      }
    }
  }
  if (!type) {
    type = "BYTE_ARRAY";
    repetition_type = "OPTIONAL";
  }
  return { name, type, repetition_type, converted_type };
}
function getMaxRepetitionLevel(schemaPath) {
  let maxLevel = 0;
  for (const element of schemaPath) {
    if (element.repetition_type === "REPEATED") {
      maxLevel++;
    }
  }
  return maxLevel;
}

// node_modules/hyparquet-writer/src/splitstream.js
function writeByteStreamSplit(writer, values, type, typeLength) {
  const count = values.length;
  let bytes;
  let width;
  if (type === "FLOAT") {
    const typed = values instanceof Float32Array ? values : new Float32Array(numberArray(values));
    bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    width = 4;
  } else if (type === "DOUBLE") {
    const typed = values instanceof Float64Array ? values : new Float64Array(numberArray(values));
    bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    width = 8;
  } else if (type === "INT32") {
    const typed = values instanceof Int32Array ? values : new Int32Array(numberArray(values));
    bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    width = 4;
  } else if (type === "INT64") {
    const typed = bigIntArray(values);
    bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    width = 8;
  } else if (type === "FIXED_LEN_BYTE_ARRAY") {
    if (!typeLength) throw new Error("parquet byte_stream_split missing type_length");
    width = typeLength;
    bytes = new Uint8Array(count * width);
    for (let i = 0; i < count; i++) {
      bytes.set(values[i], i * width);
    }
  } else {
    throw new Error(`parquet byte_stream_split unsupported type: ${type}`);
  }
  for (let b = 0; b < width; b++) {
    for (let i = 0; i < count; i++) {
      writer.appendUint8(bytes[i * width + b]);
    }
  }
}
function numberArray(values) {
  if (Array.isArray(values) && values.every((v) => typeof v === "number")) {
    return values;
  }
  throw new Error("Expected number array for BYTE_STREAM_SPLIT encoding");
}
function bigIntArray(values) {
  if (values instanceof BigInt64Array) return values;
  if (Array.isArray(values) && values.every((v) => typeof v === "bigint")) {
    return new BigInt64Array(values);
  }
  throw new Error("Expected bigint array for BYTE_STREAM_SPLIT encoding");
}

// node_modules/hyparquet-writer/src/datapage.js
function writeDataPageV2({ writer, column, encoding, pageData }) {
  const { columnName, element, codec, compressors } = column;
  const { type, type_length, repetition_type } = element;
  if (!type) throw new Error(`column ${columnName} cannot determine type`);
  if (repetition_type === "REPEATED") throw new Error(`column ${columnName} repeated types not supported`);
  const levelWriter = new ByteWriter();
  const {
    definition_levels_byte_length,
    repetition_levels_byte_length,
    num_nulls,
    num_values,
    num_rows
  } = writeLevels(levelWriter, column, pageData);
  const nonnull = num_nulls ? pageData.values.filter((v) => v !== null && v !== void 0) : pageData.values;
  const page = new ByteWriter();
  if (encoding === "PLAIN") {
    writePlain(page, nonnull, type, type_length);
  } else if (encoding === "RLE") {
    if (type !== "BOOLEAN") throw new Error("RLE encoding only supported for BOOLEAN type");
    const rleData = new ByteWriter();
    writeRleBitPackedHybrid(rleData, nonnull, 1);
    page.appendUint32(rleData.offset);
    page.appendBytes(rleData.getBytes());
  } else if (encoding === "PLAIN_DICTIONARY" || encoding === "RLE_DICTIONARY") {
    let maxValue = 0;
    for (const v of nonnull) if (v > maxValue) maxValue = v;
    const bitWidth2 = Math.ceil(Math.log2(maxValue + 1));
    page.appendUint8(bitWidth2);
    writeRleBitPackedHybrid(page, nonnull, bitWidth2);
  } else if (encoding === "DELTA_BINARY_PACKED") {
    if (type !== "INT32" && type !== "INT64") {
      throw new Error("DELTA_BINARY_PACKED encoding only supported for INT32 and INT64 types");
    }
    deltaBinaryPack(page, nonnull);
  } else if (encoding === "DELTA_LENGTH_BYTE_ARRAY") {
    if (type !== "BYTE_ARRAY") {
      throw new Error("DELTA_LENGTH_BYTE_ARRAY encoding only supported for BYTE_ARRAY type");
    }
    deltaLengthByteArray(page, nonnull);
  } else if (encoding === "DELTA_BYTE_ARRAY") {
    if (type !== "BYTE_ARRAY") {
      throw new Error("DELTA_BYTE_ARRAY encoding only supported for BYTE_ARRAY type");
    }
    deltaByteArray(page, nonnull);
  } else if (encoding === "BYTE_STREAM_SPLIT") {
    writeByteStreamSplit(page, nonnull, type, type_length);
  } else {
    throw new Error(`parquet unsupported encoding: ${encoding}`);
  }
  const pageBytes = page.getBytes();
  const compressedBytes = compressors[codec]?.(pageBytes) ?? pageBytes;
  writePageHeader(writer, {
    type: "DATA_PAGE_V2",
    uncompressed_page_size: levelWriter.offset + page.offset,
    compressed_page_size: levelWriter.offset + compressedBytes.length,
    data_page_header_v2: {
      num_values,
      num_nulls,
      num_rows,
      encoding,
      definition_levels_byte_length,
      repetition_levels_byte_length,
      is_compressed: !!codec
      // is there benefit to page statistics here?
    }
  });
  writer.appendBytes(levelWriter.getBytes());
  writer.appendBytes(compressedBytes);
}
function writePageHeader(writer, header) {
  const compact = {
    field_1: PageTypes.indexOf(header.type),
    field_2: header.uncompressed_page_size,
    field_3: header.compressed_page_size,
    field_4: header.crc,
    field_5: header.data_page_header && {
      field_1: header.data_page_header.num_values,
      field_2: Encodings.indexOf(header.data_page_header.encoding),
      field_3: Encodings.indexOf(header.data_page_header.definition_level_encoding),
      field_4: Encodings.indexOf(header.data_page_header.repetition_level_encoding)
      // field_5: header.data_page_header.statistics,
    },
    field_7: header.dictionary_page_header && {
      field_1: header.dictionary_page_header.num_values,
      field_2: Encodings.indexOf(header.dictionary_page_header.encoding)
    },
    field_8: header.data_page_header_v2 && {
      field_1: header.data_page_header_v2.num_values,
      field_2: header.data_page_header_v2.num_nulls,
      field_3: header.data_page_header_v2.num_rows,
      field_4: Encodings.indexOf(header.data_page_header_v2.encoding),
      field_5: header.data_page_header_v2.definition_levels_byte_length,
      field_6: header.data_page_header_v2.repetition_levels_byte_length,
      field_7: header.data_page_header_v2.is_compressed ? void 0 : false
      // default true
    }
  };
  serializeTCompactProtocol(writer, compact);
}
function writeLevels(writer, column, dataPage) {
  const { schemaPath } = column;
  const { values, definitionLevels, repetitionLevels, maxDefinitionLevel } = dataPage;
  const num_values = definitionLevels.length || values.length;
  let num_nulls = 0;
  let num_rows = 0;
  if (repetitionLevels.length) {
    for (let i = 0; i < repetitionLevels.length; i++) {
      if (repetitionLevels[i] === 0) num_rows++;
    }
  } else {
    num_rows = values.length;
  }
  if (definitionLevels.length) {
    for (let i = 0; i < definitionLevels.length; i++) {
      if (definitionLevels[i] < maxDefinitionLevel) num_nulls++;
    }
  }
  const maxRepetitionLevel = getMaxRepetitionLevel(schemaPath);
  let repetition_levels_byte_length = 0;
  if (maxRepetitionLevel) {
    const bitWidth2 = Math.ceil(Math.log2(maxRepetitionLevel + 1));
    repetition_levels_byte_length = writeRleBitPackedHybrid(writer, repetitionLevels, bitWidth2);
  }
  let definition_levels_byte_length = 0;
  if (maxDefinitionLevel) {
    const bitWidth2 = Math.ceil(Math.log2(maxDefinitionLevel + 1));
    definition_levels_byte_length = writeRleBitPackedHybrid(writer, definitionLevels, bitWidth2);
  }
  return { definition_levels_byte_length, repetition_levels_byte_length, num_values, num_nulls, num_rows };
}

// node_modules/hyparquet-writer/src/dictionary.js
var textEncoder2 = new TextEncoder();
function estimateValueSize(value, type, type_length) {
  if (value === null || value === void 0) return 0;
  if (type === "BOOLEAN") return 0.125;
  if (type === "INT32" || type === "FLOAT") return 4;
  if (type === "INT64" || type === "DOUBLE") return 8;
  if (type === "INT96") return 12;
  if (type === "FIXED_LEN_BYTE_ARRAY") return type_length ?? 0;
  if (type === "BYTE_ARRAY") {
    if (value instanceof Uint8Array) return value.byteLength;
    if (typeof value === "string") return value.length;
  }
  return 0;
}
function hashBytes(bytes) {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
var sampleRejectionRatio = 0.9;
function useDictionary(values, type, type_length, encoding, dictionarySize, required) {
  if (encoding && encoding !== "RLE_DICTIONARY") return {};
  if (type === "BOOLEAN") return {};
  const forced = encoding === "RLE_DICTIONARY";
  const byteArrayPrefixSize = type === "BYTE_ARRAY" ? 4 : 0;
  if (!forced) {
    const sampleSize = Math.min(values.length, 1e3);
    const sampleSizes = /* @__PURE__ */ new Map();
    const sampleHashes = /* @__PURE__ */ new Map();
    let sampleDictionarySize = 0;
    let sampleTotalSize = 0;
    for (let i = 0; i < sampleSize; i++) {
      const sampleIndex = sampleSize === 1 ? 0 : Math.floor(i * (values.length - 1) / (sampleSize - 1));
      const value = values[sampleIndex];
      let key = value;
      if (value instanceof Uint8Array) {
        key = sampleHashes.get(value);
        if (key === void 0) {
          key = hashBytes(value);
          sampleHashes.set(value, key);
        }
      }
      let valueSize = sampleSizes.get(key);
      if (valueSize === void 0) {
        valueSize = estimateValueSize(value, type, type_length) + (value === null || value === void 0 ? 0 : byteArrayPrefixSize);
        sampleSizes.set(key, valueSize);
        sampleDictionarySize += valueSize;
      }
      sampleTotalSize += valueSize;
    }
    if (!sampleTotalSize || sampleDictionarySize / sampleTotalSize > sampleRejectionRatio) return {};
  }
  const dictionary = [];
  const indexes = new Array(values.length);
  const valueIndex = /* @__PURE__ */ new Map();
  const valueSizes = [];
  const hashBuckets = /* @__PURE__ */ new Map();
  let dictSize = 0;
  let physicalDictSize = 0;
  let totalSize = 0;
  let nonNullCount = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === null || value === void 0) {
      if (required) throw new Error("parquet required value is undefined");
      continue;
    }
    nonNullCount++;
    let index;
    if (value instanceof Uint8Array) {
      totalSize += value.byteLength;
      index = valueIndex.get(value);
      if (index !== void 0) {
        indexes[i] = index;
        continue;
      }
      const hash2 = hashBytes(value);
      const bucket = hashBuckets.get(hash2);
      if (bucket) {
        for (const j of bucket) {
          if (bytesEqual(dictionary[j], value)) {
            index = j;
            break;
          }
        }
      }
      if (index === void 0) {
        dictSize += value.byteLength;
        if (!forced && dictionarySize) {
          physicalDictSize += value.byteLength;
          if (physicalDictSize > dictionarySize) return {};
        }
        index = dictionary.length;
        dictionary.push(value);
        if (bucket) bucket.push(index);
        else hashBuckets.set(hash2, [index]);
      }
      valueIndex.set(value, index);
    } else {
      index = valueIndex.get(value);
      const valueSize = index === void 0 ? estimateValueSize(value, type, type_length) : valueSizes[index];
      totalSize += valueSize;
      if (index === void 0) {
        dictSize += valueSize;
        if (!forced && dictionarySize) {
          physicalDictSize += typeof value === "string" ? textEncoder2.encode(value).byteLength : valueSize;
          if (physicalDictSize > dictionarySize) return {};
        }
        index = dictionary.length;
        dictionary.push(value);
        valueSizes[index] = valueSize;
        valueIndex.set(value, index);
      }
    }
    indexes[i] = index;
  }
  const bitWidth2 = Math.ceil(Math.log2(dictionary.length));
  const indexSize = Math.ceil(nonNullCount * bitWidth2 / 8);
  const plainSize = totalSize + nonNullCount * byteArrayPrefixSize;
  const dictionaryValueSize = dictSize + dictionary.length * byteArrayPrefixSize;
  if (!forced && 2 * (dictionaryValueSize + indexSize) > plainSize) return {};
  return { dictionary, indexes };
}
function writeDictionaryPage(writer, column, dictionary) {
  const { element, codec, compressors } = column;
  const { type, type_length } = element;
  if (!type) throw new Error(`column ${column.columnName} cannot determine type`);
  const dictionaryPage = new ByteWriter();
  writePlain(dictionaryPage, dictionary, type, type_length);
  const dictionaryBytes = dictionaryPage.getBytes();
  const compressedBytes = compressors[codec]?.(dictionaryBytes) ?? dictionaryBytes;
  writePageHeader(writer, {
    type: "DICTIONARY_PAGE",
    uncompressed_page_size: dictionaryBytes.byteLength,
    compressed_page_size: compressedBytes.byteLength,
    dictionary_page_header: {
      num_values: dictionary.length,
      encoding: "PLAIN"
    }
  });
  writer.appendBytes(compressedBytes);
}

// node_modules/hyparquet-writer/src/geospatial.js
function geospatialStatistics(values) {
  const typeCodes = /* @__PURE__ */ new Set();
  let partial;
  for (const value of values) {
    if (value === null || value === void 0) continue;
    if (typeof value !== "object") {
      throw new Error("geospatial column expects GeoJSON geometries");
    }
    partial = extendBoundsFromGeometry(partial, value);
    typeCodes.add(geometryTypeCodeWithDimension(value));
  }
  let bbox;
  const { xmin, ymin, xmax, ymax } = partial ?? {};
  if (xmin !== void 0 && ymin !== void 0 && xmax !== void 0 && ymax !== void 0) {
    bbox = { ...partial, xmin, ymin, xmax, ymax };
  }
  if (typeCodes.size || bbox) {
    return {
      bbox,
      // Geospatial type codes of all instances, or an empty list if not known
      geospatial_types: typeCodes.size ? Array.from(typeCodes).sort((a, b) => a - b) : []
    };
  }
}
function extendBoundsFromGeometry(bbox, geometry) {
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries || []) {
      bbox = extendBoundsFromGeometry(bbox, child);
    }
    return bbox;
  }
  return extendBoundsFromCoordinates(bbox, geometry.coordinates);
}
function extendBoundsFromCoordinates(bbox, coordinates) {
  if (typeof coordinates[0] === "number") {
    bbox = updateAxis(bbox, "xmin", "xmax", coordinates[0]);
    bbox = updateAxis(bbox, "ymin", "ymax", coordinates[1]);
    if (coordinates.length > 2) bbox = updateAxis(bbox, "zmin", "zmax", coordinates[2]);
    if (coordinates.length > 3) bbox = updateAxis(bbox, "mmin", "mmax", coordinates[3]);
    return bbox;
  }
  for (const child of coordinates) {
    bbox = extendBoundsFromCoordinates(bbox, child);
  }
  return bbox;
}
function updateAxis(bbox, minKey, maxKey, value) {
  if (value === void 0 || !Number.isFinite(value)) return bbox;
  if (!bbox) bbox = {};
  const min = bbox[minKey];
  const max = bbox[maxKey];
  if (min === void 0 || value < min) bbox[minKey] = value;
  if (max === void 0 || value > max) bbox[maxKey] = value;
  return bbox;
}
function geometryTypeCodeWithDimension(geometry) {
  const base = geometryTypeCodes[geometry.type];
  if (base === void 0) throw new Error(`unknown geometry type: ${geometry.type}`);
  const dim = inferGeometryDimensions(geometry);
  if (dim === 2) return base;
  if (dim === 3) return base + 1e3;
  if (dim === 4) return base + 3e3;
  throw new Error(`unsupported geometry dimensions: ${dim}`);
}
var geometryTypeCodes = {
  Point: 1,
  LineString: 2,
  Polygon: 3,
  MultiPoint: 4,
  MultiLineString: 5,
  MultiPolygon: 6,
  GeometryCollection: 7
};
function inferGeometryDimensions(geometry) {
  if (geometry.type === "GeometryCollection") {
    let maxDim = 0;
    for (const child of geometry.geometries || []) {
      maxDim = Math.max(maxDim, inferGeometryDimensions(child));
    }
    return maxDim || 2;
  }
  return inferCoordinateDimensions(geometry.coordinates);
}
function inferCoordinateDimensions(value) {
  if (!value.length) return 2;
  if (typeof value[0] === "number") return value.length;
  let maxDim = 0;
  for (const item of value) {
    maxDim = Math.max(maxDim, inferCoordinateDimensions(item));
  }
  return maxDim || 2;
}

// node_modules/hyparquet/src/utils.js
function toJson(obj) {
  if (obj === void 0) return null;
  if (typeof obj === "bigint") return Number(obj);
  if (Object.is(obj, -0)) return 0;
  if (Array.isArray(obj)) return obj.map(toJson);
  if (obj instanceof Uint8Array) return Array.from(obj);
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Object) {
    const newObj = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] === void 0) continue;
      newObj[key] = toJson(obj[key]);
    }
    return newObj;
  }
  return obj;
}

// node_modules/hyparquet-writer/src/wkb.js
function geojsonToWkb(geometry) {
  const writer = new ByteWriter();
  writeGeometry(writer, geometry);
  return writer.getBytes();
}
function writeGeometry(writer, geometry) {
  if (typeof geometry !== "object") {
    throw new Error("geometry values must be GeoJSON geometries");
  }
  const typeCode = geometryTypeCode(geometry.type);
  const dim = inferGeometryDimensions2(geometry);
  let flag = 0;
  if (dim === 3) flag = 1;
  else if (dim === 4) flag = 3;
  else if (dim > 4) throw new Error(`unsupported geometry dimensions: ${dim}`);
  writer.appendUint8(1);
  writer.appendUint32(typeCode + flag * 1e3);
  if (geometry.type === "Point") {
    writePosition(writer, geometry.coordinates, dim);
  } else if (geometry.type === "LineString") {
    writeLine(writer, geometry.coordinates, dim);
  } else if (geometry.type === "Polygon") {
    writer.appendUint32(geometry.coordinates.length);
    for (const ring of geometry.coordinates) {
      writeLine(writer, ring, dim);
    }
  } else if (geometry.type === "MultiPoint") {
    writer.appendUint32(geometry.coordinates.length);
    for (const coordinates of geometry.coordinates) {
      writeGeometry(writer, { type: "Point", coordinates });
    }
  } else if (geometry.type === "MultiLineString") {
    writer.appendUint32(geometry.coordinates.length);
    for (const coordinates of geometry.coordinates) {
      writeGeometry(writer, { type: "LineString", coordinates });
    }
  } else if (geometry.type === "MultiPolygon") {
    writer.appendUint32(geometry.coordinates.length);
    for (const coordinates of geometry.coordinates) {
      writeGeometry(writer, { type: "Polygon", coordinates });
    }
  } else if (geometry.type === "GeometryCollection") {
    writer.appendUint32(geometry.geometries.length);
    for (const child of geometry.geometries) {
      writeGeometry(writer, child);
    }
  } else {
    throw new Error("unsupported geometry type");
  }
}
function writePosition(writer, position, dim) {
  if (position.length < dim) {
    throw new Error("geometry position dimensions mismatch");
  }
  for (let i = 0; i < dim; i++) {
    writer.appendFloat64(position[i]);
  }
}
function writeLine(writer, coordinates, dim) {
  writer.appendUint32(coordinates.length);
  for (const position of coordinates) {
    writePosition(writer, position, dim);
  }
}
function geometryTypeCode(type) {
  if (type === "Point") return 1;
  if (type === "LineString") return 2;
  if (type === "Polygon") return 3;
  if (type === "MultiPoint") return 4;
  if (type === "MultiLineString") return 5;
  if (type === "MultiPolygon") return 6;
  if (type === "GeometryCollection") return 7;
  throw new Error(`unknown geometry type: ${type}`);
}
function inferGeometryDimensions2(geometry) {
  if (geometry.type === "GeometryCollection") {
    let maxDim = 0;
    for (const child of geometry.geometries) {
      maxDim = Math.max(maxDim, inferGeometryDimensions2(child));
    }
    return maxDim || 2;
  }
  return inferCoordinateDimensions2(geometry.coordinates);
}
function inferCoordinateDimensions2(value) {
  if (!Array.isArray(value)) return 2;
  if (!value.length) return 2;
  if (typeof value[0] === "number") return value.length;
  let maxDim = 0;
  for (const item of value) {
    maxDim = Math.max(maxDim, inferCoordinateDimensions2(item));
  }
  return maxDim || 2;
}

// node_modules/hyparquet-writer/src/unconvert.js
var dayMillis = 864e5;
function mapConverted(values, convert) {
  const cache2 = /* @__PURE__ */ new Map();
  return Array.from(values, (value) => {
    if (cache2.has(value)) return cache2.get(value);
    const result = convert(value);
    cache2.set(value, result);
    return result;
  });
}
function unconvert(element, values) {
  const { type, converted_type: ctype, logical_type: ltype } = element;
  if (ctype === "DECIMAL") {
    const factor = 10 ** (element.scale || 0);
    return values.map((v) => {
      if (v === null || v === void 0) return v;
      if (typeof v !== "number") throw new Error("DECIMAL must be a number");
      return unconvertDecimal(element, BigInt(Math.round(v * factor)));
    });
  }
  if (ctype === "DATE") {
    return Array.from(values).map((v) => {
      if (v instanceof Date) return Math.floor(v.getTime() / dayMillis);
      return v;
    });
  }
  if (ctype === "TIMESTAMP_MILLIS") {
    return Array.from(values).map((v) => {
      if (v === null || v === void 0) return v;
      if (v instanceof Date) return BigInt(v.getTime());
      return BigInt(v);
    });
  }
  if (ctype === "TIMESTAMP_MICROS") {
    return Array.from(values).map((v) => {
      if (v === null || v === void 0) return v;
      if (v instanceof Date) return BigInt(v.getTime() * 1e3);
      return BigInt(v);
    });
  }
  if (ctype === "JSON") {
    if (!Array.isArray(values)) throw new Error("JSON must be an array");
    const encoder2 = new TextEncoder();
    return mapConverted(
      values,
      (v) => v === null || v === void 0 ? v : encoder2.encode(JSON.stringify(toJson(v)))
    );
  }
  if (ctype === "UTF8") {
    if (!Array.isArray(values)) throw new Error("strings must be an array");
    const encoder2 = new TextEncoder();
    return values.map((v) => typeof v === "string" ? encoder2.encode(v) : v);
  }
  if (ctype === "UINT_32" || ltype?.type === "INTEGER" && ltype.bitWidth === 32 && !ltype.isSigned) {
    if (values instanceof Uint32Array) return values;
    if (values instanceof Int32Array) return new Uint32Array(values.buffer, values.byteOffset, values.length);
    return Array.from(values).map((v) => {
      if (v === null || v === void 0) return v;
      if (!Number.isSafeInteger(v)) throw new Error("expected integer value, got " + v);
      if (v < 0 || v > 4294967295) throw new Error("expected uint32 value, got " + v);
      if (v > 2147483647) return v - 4294967296;
      return v;
    });
  }
  if (ltype?.type === "FLOAT16") {
    if (type !== "FIXED_LEN_BYTE_ARRAY") throw new Error("FLOAT16 must be FIXED_LEN_BYTE_ARRAY type");
    if (element.type_length !== 2) throw new Error("FLOAT16 expected type_length to be 2 bytes");
    return Array.from(values).map(unconvertFloat16);
  }
  if (ltype?.type === "UUID") {
    if (!Array.isArray(values)) throw new Error("UUID must be an array");
    if (type !== "FIXED_LEN_BYTE_ARRAY") throw new Error("UUID must be FIXED_LEN_BYTE_ARRAY type");
    if (element.type_length !== 16) throw new Error("UUID expected type_length to be 16 bytes");
    return values.map(unconvertUuid);
  }
  if (ltype?.type === "TIMESTAMP") {
    return Array.from(values).map((v) => {
      if (v === null || v === void 0) return v;
      if (v instanceof Date) {
        const millis = BigInt(v.getTime());
        if (ltype.unit === "NANOS") return millis * 1000000n;
        if (ltype.unit === "MICROS") return millis * 1000n;
        return millis;
      }
      return BigInt(v);
    });
  }
  if (ltype?.type === "GEOMETRY" || ltype?.type === "GEOGRAPHY") {
    if (!Array.isArray(values)) throw new Error("geometry must be an array");
    return mapConverted(values, (v) => {
      if (v === null || v === void 0) return v;
      return geojsonToWkb(v);
    });
  }
  return values;
}
function unconvertUuid(value) {
  if (value === void 0 || value === null) return;
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") {
    const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error("UUID must be a valid UUID string");
    }
    value = value.replace(/-/g, "").toLowerCase();
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  throw new Error("UUID must be a string or Uint8Array");
}
var STATS_TRUNCATE_LENGTH = 16;
function truncateStatistic(bytes, isMax) {
  if (bytes.length <= STATS_TRUNCATE_LENGTH) return bytes;
  const prefix = bytes.slice(0, STATS_TRUNCATE_LENGTH);
  if (!isMax) return prefix;
  let i = prefix.length - 1;
  while (i >= 0 && prefix[i] === 255) i--;
  if (i < 0) return void 0;
  const rounded = prefix.slice(0, i + 1);
  rounded[i] += 1;
  return rounded;
}
function minMaxIsExact(value, element) {
  if (value === void 0 || value === null) return void 0;
  const { type } = element;
  if (type !== "BYTE_ARRAY" && type !== "FIXED_LEN_BYTE_ARRAY") return void 0;
  if (element.logical_type?.type === "UUID") return void 0;
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value.toString());
  return bytes.length > STATS_TRUNCATE_LENGTH ? false : void 0;
}
function unconvertMinMax(value, element, isMax) {
  if (value === void 0 || value === null) return void 0;
  const { type, converted_type } = element;
  if (type === "BOOLEAN") return new Uint8Array([value ? 1 : 0]);
  if (element.logical_type?.type === "UUID" && (typeof value === "string" || value instanceof Uint8Array)) {
    return unconvertUuid(value);
  }
  if (converted_type === "DECIMAL") {
    if (typeof value !== "number") throw new Error("DECIMAL must be a number");
    const factor = 10 ** (element.scale || 0);
    const out = unconvertDecimal(element, BigInt(Math.round(value * factor)));
    if (out instanceof Uint8Array) return out;
    if (typeof out === "number") {
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setFloat32(0, out, true);
      return new Uint8Array(buffer);
    }
    if (typeof out === "bigint") {
      const buffer = new ArrayBuffer(8);
      new DataView(buffer).setBigInt64(0, out, true);
      return new Uint8Array(buffer);
    }
  }
  if (type === "BYTE_ARRAY" || type === "FIXED_LEN_BYTE_ARRAY") {
    const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value.toString());
    return truncateStatistic(bytes, isMax);
  }
  if (type === "FLOAT" && typeof value === "number") {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    return new Uint8Array(buffer);
  }
  if (type === "DOUBLE" && typeof value === "number") {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    return new Uint8Array(buffer);
  }
  if (type === "INT32" && typeof value === "number") {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setInt32(0, value, true);
    return new Uint8Array(buffer);
  }
  if (type === "INT64" && typeof value === "bigint") {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigInt64(0, value, true);
    return new Uint8Array(buffer);
  }
  if (type === "INT32" && converted_type === "DATE" && value instanceof Date) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setInt32(0, Math.floor(value.getTime() / dayMillis), true);
    return new Uint8Array(buffer);
  }
  if (type === "INT64" && converted_type === "TIMESTAMP_MILLIS" && value instanceof Date) {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigInt64(0, BigInt(value.getTime()), true);
    return new Uint8Array(buffer);
  }
  if (type === "INT64" && converted_type === "TIMESTAMP_MICROS" && value instanceof Date) {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigInt64(0, BigInt(value.getTime() * 1e3), true);
    return new Uint8Array(buffer);
  }
  if (type === "INT64" && element.logical_type?.type === "TIMESTAMP" && value instanceof Date) {
    const millis = BigInt(value.getTime());
    const { unit } = element.logical_type;
    let bigintValue = millis;
    if (unit === "NANOS") bigintValue = millis * 1000000n;
    else if (unit === "MICROS") bigintValue = millis * 1000n;
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigInt64(0, bigintValue, true);
    return new Uint8Array(buffer);
  }
  throw new Error(`unsupported type for statistics: ${type} with value ${value}`);
}
function unconvertStatistics(stats, element) {
  return {
    field_1: unconvertMinMax(stats.max, element, true),
    field_2: unconvertMinMax(stats.min, element, false),
    field_3: stats.null_count,
    field_4: stats.distinct_count,
    field_5: unconvertMinMax(stats.max_value, element, true),
    field_6: unconvertMinMax(stats.min_value, element, false),
    field_7: stats.is_max_value_exact ?? minMaxIsExact(stats.max_value ?? stats.max, element),
    field_8: stats.is_min_value_exact ?? minMaxIsExact(stats.min_value ?? stats.min, element)
  };
}
function unconvertDecimal({ type, type_length }, value) {
  if (type === "INT32") return Number(value);
  if (type === "INT64") return value;
  if (type === "FIXED_LEN_BYTE_ARRAY" && !type_length) {
    throw new Error("fixed length byte array type_length is required");
  }
  if (!type_length && !value) return new Uint8Array();
  const bytes = [];
  while (true) {
    const byte = Number(value & 0xffn);
    bytes.unshift(byte);
    value >>= 8n;
    if (type_length) {
      if (bytes.length >= type_length) break;
    } else {
      const sign = byte & 128;
      if (!sign && value === 0n || sign && value === -1n) {
        break;
      }
    }
  }
  return new Uint8Array(bytes);
}
function unconvertFloat16(value) {
  if (value === void 0 || value === null) return;
  if (typeof value !== "number") throw new Error("parquet float16 expected number value");
  if (Number.isNaN(value)) return new Uint8Array([0, 126]);
  const sign = value < 0 || Object.is(value, -0) ? 1 : 0;
  const abs = Math.abs(value);
  if (!isFinite(abs)) return new Uint8Array([0, sign << 7 | 124]);
  if (abs === 0) return new Uint8Array([0, sign << 7]);
  const buf = new ArrayBuffer(4);
  new Float32Array(buf)[0] = abs;
  const bits32 = new Uint32Array(buf)[0];
  let exp32 = bits32 >>> 23 & 255;
  let mant32 = bits32 & 8388607;
  exp32 -= 127;
  if (exp32 < -14) {
    const shift = -14 - exp32;
    mant32 = (mant32 | 8388608) >> shift + 13;
    if (mant32 & 1) mant32 += 1;
    const bits162 = sign << 15 | mant32;
    return new Uint8Array([bits162 & 255, bits162 >> 8]);
  }
  if (exp32 > 15) return new Uint8Array([0, sign << 7 | 124]);
  let exp16 = exp32 + 15;
  mant32 = mant32 + 4096;
  if (mant32 & 8388608) {
    mant32 = 0;
    if (++exp16 === 31)
      return new Uint8Array([0, sign << 7 | 124]);
  }
  const bits16 = sign << 15 | exp16 << 10 | mant32 >> 13;
  return new Uint8Array([bits16 & 255, bits16 >> 8]);
}

// node_modules/hyparquet-writer/src/column.js
function writeColumn({ writer, column, pageData }) {
  const { columnName, element, schemaPath, stats, pageSize, dictionarySize, encoding: userEncoding } = column;
  const { type, type_length } = element;
  if (!type) throw new Error(`column ${columnName} cannot determine type`);
  const { values, definitionLevels, repetitionLevels, maxDefinitionLevel } = pageData;
  const offsetStart = writer.offset;
  const encodings = [];
  const isGeospatial = element?.logical_type?.type === "GEOMETRY" || element?.logical_type?.type === "GEOGRAPHY";
  const statistics = stats ? getStatistics(values) : void 0;
  const geospatial_statistics = stats && isGeospatial ? geospatialStatistics(values) : void 0;
  let bloomFilter;
  if (column.bloomFilter) {
    const opts = typeof column.bloomFilter === "object" ? column.bloomFilter : void 0;
    const builder = new BloomBuilder(element, opts);
    for (const v of values) builder.insert(v);
    bloomFilter = builder.finalize();
  }
  let dictionary_page_offset;
  const selectPhysical = element.converted_type !== "UTF8";
  const dictionaryValues = selectPhysical ? unconvert(element, values) : values;
  const { dictionary, indexes } = useDictionary(
    dictionaryValues,
    type,
    type_length,
    userEncoding,
    dictionarySize,
    maxDefinitionLevel === 0
  );
  let encoding;
  let writeValues;
  let writeType = type;
  if (dictionary && indexes) {
    writeValues = indexes;
    writeType = "INT32";
    encoding = "RLE_DICTIONARY";
    dictionary_page_offset = BigInt(writer.offset);
    const unconverted = selectPhysical ? dictionary : unconvert(element, dictionary);
    writeDictionaryPage(writer, column, unconverted);
  } else {
    writeValues = selectPhysical ? dictionaryValues : unconvert(element, values);
    encoding = userEncoding && userEncoding !== "RLE_DICTIONARY" ? userEncoding : type === "BOOLEAN" && values.length > 16 ? "RLE" : "PLAIN";
  }
  encodings.push(encoding);
  const pageBoundaries = getPageBoundaries(writeValues, writeType, type_length, pageSize);
  const columnIndex = column.columnIndex && pageBoundaries.length > 1 ? {
    null_pages: [],
    min_values: [],
    max_values: [],
    boundary_order: "UNORDERED",
    null_counts: []
  } : void 0;
  const offsetIndex = column.offsetIndex && pageBoundaries.length > 1 ? {
    page_locations: []
  } : void 0;
  const data_page_offset = BigInt(writer.offset);
  let first_row_index = 0n;
  let prevStart = 0;
  let prevMinValue;
  let prevMaxValue;
  let ascending = true;
  let descending = true;
  for (const { start, end } of pageBoundaries) {
    const pageOffset = writer.offset;
    const pageChunk = {
      values: writeValues.slice(start, end),
      definitionLevels: definitionLevels.slice(start, end),
      repetitionLevels: repetitionLevels.slice(start, end),
      maxDefinitionLevel
    };
    writeDataPageV2({ writer, column, encoding, pageData: pageChunk });
    if (columnIndex) {
      const pageValues = values.slice(start, end);
      const { min_value, max_value, null_count = 0n } = getStatistics(pageValues);
      columnIndex.null_pages.push(null_count === BigInt(end - start));
      columnIndex.min_values.push(unconvertMinMax(min_value, element, false) ?? new Uint8Array());
      columnIndex.max_values.push(unconvertMinMax(max_value, element, true) ?? new Uint8Array());
      columnIndex.null_counts?.push(null_count);
      if (prevMinValue !== void 0 && min_value !== void 0) {
        const order = compareValues(prevMinValue, min_value);
        if (order > 0) ascending = false;
        if (order < 0) descending = false;
      }
      if (prevMaxValue !== void 0 && max_value !== void 0) {
        const order = compareValues(prevMaxValue, max_value);
        if (order > 0) ascending = false;
        if (order < 0) descending = false;
      }
      prevMinValue = min_value;
      prevMaxValue = max_value;
    }
    if (offsetIndex) {
      if (repetitionLevels.length) {
        for (let i = prevStart + 1; i <= start; i++) {
          if (repetitionLevels[i] === 0) first_row_index++;
        }
      } else {
        first_row_index = BigInt(start);
      }
      offsetIndex.page_locations.push({
        offset: BigInt(pageOffset),
        compressed_page_size: writer.offset - pageOffset,
        first_row_index
      });
    }
    prevStart = start;
  }
  if (columnIndex) {
    if (ascending) columnIndex.boundary_order = "ASCENDING";
    else if (descending) columnIndex.boundary_order = "DESCENDING";
  }
  let encoding_stats;
  if (stats) {
    encoding_stats = [];
    if (dictionary_page_offset !== void 0) {
      encoding_stats.push({ page_type: "DICTIONARY_PAGE", encoding: "PLAIN", count: 1 });
    }
    encoding_stats.push({ page_type: "DATA_PAGE_V2", encoding, count: pageBoundaries.length });
  }
  return {
    chunk: {
      meta_data: {
        type,
        encodings,
        path_in_schema: schemaPath.slice(1).map((s) => s.name),
        codec: column.codec ?? "UNCOMPRESSED",
        num_values: BigInt(values.length),
        total_compressed_size: BigInt(writer.offset - offsetStart),
        total_uncompressed_size: BigInt(writer.offset - offsetStart),
        // TODO: uncompressed pages + headers
        data_page_offset,
        dictionary_page_offset,
        statistics,
        encoding_stats,
        geospatial_statistics
      },
      file_offset: BigInt(offsetStart)
    },
    columnIndex,
    offsetIndex,
    bloomFilter
  };
}
function getPageBoundaries(values, type, type_length, pageSize) {
  if (!pageSize) {
    return [{ start: 0, end: values.length }];
  }
  const boundaries = [];
  let start = 0;
  let accumulatedBytes = 0;
  for (let i = 0; i < values.length; i++) {
    const valueSize = estimateValueSize(values[i], type, type_length);
    accumulatedBytes += valueSize;
    if (accumulatedBytes >= pageSize && i > start) {
      boundaries.push({ start, end: i });
      start = i;
      accumulatedBytes = valueSize;
    }
  }
  if (start < values.length) {
    boundaries.push({ start, end: values.length });
  }
  return boundaries;
}
function getStatistics(values) {
  let min_value = void 0;
  let max_value = void 0;
  let null_count = 0n;
  for (const value of values) {
    if (value === null || value === void 0) {
      null_count++;
      continue;
    }
    if (typeof value === "object" && !(value instanceof Uint8Array)) continue;
    if (typeof value === "number" && Number.isNaN(value)) continue;
    if (min_value === void 0 || compareValues(value, min_value) < 0) min_value = value;
    if (max_value === void 0 || compareValues(value, max_value) > 0) max_value = value;
  }
  if (min_value === 0) min_value = -0;
  if (max_value === 0) max_value = 0;
  return { min_value, max_value, null_count };
}
function compareValues(left, right) {
  if (left instanceof Uint8Array && right instanceof Uint8Array) {
    const length = Math.min(left.length, right.length);
    for (let i = 0; i < length; i += 1) {
      if (left[i] !== right[i]) return left[i] - right[i];
    }
    return left.length - right.length;
  }
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

// node_modules/hyparquet-writer/src/dremel.js
function encodeNestedValues(treePath, rows) {
  const schemaPath = treePath.map((n) => n.element);
  if (treePath.length < 2) throw new Error("parquet schema path must include column");
  const definitionLevels = [];
  const repetitionLevels = [];
  const maxDefinitionLevel = getMaxDefinitionLevel(treePath);
  if (treePath.length === 2 && maxDefinitionLevel === 0) {
    return { values: rows, definitionLevels, repetitionLevels, maxDefinitionLevel };
  }
  if (treePath.length === 2 && maxDefinitionLevel === 1) {
    const definitionLevels2 = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      definitionLevels2[i] = rows[i] === null || rows[i] === void 0 ? 0 : 1;
    }
    return { values: rows, definitionLevels: definitionLevels2, repetitionLevels, maxDefinitionLevel };
  }
  const repLevelPrior = new Array(treePath.length);
  let repeatedCount = 0;
  for (let i = 0; i < treePath.length; i++) {
    repLevelPrior[i] = repeatedCount;
    if (schemaPath[i].repetition_type === "REPEATED") repeatedCount++;
  }
  const values = [];
  for (const row of rows) {
    visit(1, row, 0, 0, false);
  }
  return { values, definitionLevels, repetitionLevels, maxDefinitionLevel };
  function visit(depth, value, defLevel, repLevel, allowNull) {
    const element = schemaPath[depth];
    const repetition = element.repetition_type || "REQUIRED";
    if (depth === treePath.length - 1) {
      if (value === null || value === void 0) {
        if (repetition === "REQUIRED" && !allowNull) {
          throw new Error("parquet required value is undefined");
        }
        definitionLevels.push(defLevel);
      } else {
        definitionLevels.push(repetition === "REQUIRED" ? defLevel : defLevel + 1);
      }
      repetitionLevels.push(repLevel);
      values.push(value);
      return;
    }
    if (repetition === "REPEATED") {
      if (value === null || value === void 0) {
        if (!allowNull) throw new Error("parquet required value is undefined");
        visit(depth + 1, void 0, defLevel, repLevel, true);
        return;
      }
      if (!Array.isArray(value)) {
        throw new Error(`parquet repeated field ${element.name} must be an array`);
      }
      if (!value.length) {
        visit(depth + 1, void 0, defLevel, repLevel, true);
        return;
      }
      const isMapEntry = isMapLike(treePath[depth - 1]);
      const childElement = schemaPath[depth + 1];
      for (let i = 0; i < value.length; i++) {
        let childValue = value[i];
        if (isMapEntry && childValue && typeof childValue === "object" && childElement) {
          childValue = childValue[childElement.name];
        }
        const childRep = i === 0 ? repLevel : repLevelPrior[depth] + 1;
        visit(depth + 1, childValue, defLevel + 1, childRep, false);
      }
      return;
    }
    if (repetition === "OPTIONAL") {
      if (value === null || value === void 0) {
        visit(depth + 1, void 0, defLevel, repLevel, true);
      } else {
        const childValue = getChildValue(depth, value);
        const childIsNull = childValue === null || childValue === void 0;
        const isLogicalContainer = isListLike(treePath[depth]) || isMapLike(treePath[depth]);
        const isStruct = element.num_children && !element.type && !isLogicalContainer;
        const nextDef = isStruct || !childIsNull ? defLevel + 1 : defLevel;
        visit(depth + 1, childValue, nextDef, repLevel, childIsNull);
      }
      return;
    }
    if (value === null || value === void 0) {
      if (!allowNull) throw new Error("parquet required value is undefined");
      visit(depth + 1, void 0, defLevel, repLevel, true);
    } else {
      visit(depth + 1, getChildValue(depth, value), defLevel, repLevel, false);
    }
  }
  function getChildValue(depth, currentValue) {
    if (currentValue === null || currentValue === void 0) return void 0;
    const child = schemaPath[depth + 1];
    if (!child) return void 0;
    if (isListLike(treePath[depth])) return currentValue;
    if (isMapLike(treePath[depth])) {
      return normalizeMap(currentValue, schemaPath[depth]);
    }
    if (typeof currentValue === "object" && !Array.isArray(currentValue)) {
      return currentValue[child.name];
    }
    throw new Error(`parquet expected struct, got ${currentValue}`);
  }
}
function normalizeMap(value, element) {
  if (value instanceof Map) {
    return Array.from(value.entries(), ([k, v]) => ({ key: k, value: v }));
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (entry && typeof entry === "object" && "key" in entry && "value" in entry) {
        return entry;
      }
      if (Array.isArray(entry) && entry.length === 2) {
        return { key: entry[0], value: entry[1] };
      }
      throw new Error("parquet map entry must provide key and value");
    });
  }
  if (typeof value === "object") {
    return Object.entries(value).map(([k, v]) => ({ key: k, value: v }));
  }
  throw new Error(`parquet map field ${element.name} must be Map, array, or object`);
}

// node_modules/hyparquet-writer/src/indexes.js
function writeIndexes(writer, pageIndexes) {
  for (const { chunk, columnIndex } of pageIndexes) {
    writeColumnIndex(writer, chunk, columnIndex);
  }
  for (const { chunk, offsetIndex } of pageIndexes) {
    writeOffsetIndex(writer, chunk, offsetIndex);
  }
}
function writeColumnIndex(writer, columnChunk, columnIndex) {
  if (!columnIndex || columnIndex.min_values.length <= 1) return;
  const columnIndexOffset = writer.offset;
  serializeTCompactProtocol(writer, {
    field_1: columnIndex.null_pages,
    field_2: columnIndex.min_values,
    field_3: columnIndex.max_values,
    field_4: BoundaryOrders.indexOf(columnIndex.boundary_order),
    field_5: columnIndex.null_counts
  });
  columnChunk.column_index_offset = BigInt(columnIndexOffset);
  columnChunk.column_index_length = writer.offset - columnIndexOffset;
}
function writeOffsetIndex(writer, columnChunk, offsetIndex) {
  if (!offsetIndex || offsetIndex.page_locations.length <= 1) return;
  const offsetIndexOffset = writer.offset;
  serializeTCompactProtocol(writer, {
    field_1: offsetIndex.page_locations.map((p) => ({
      field_1: p.offset,
      field_2: p.compressed_page_size,
      field_3: p.first_row_index
    }))
  });
  columnChunk.offset_index_offset = BigInt(offsetIndexOffset);
  columnChunk.offset_index_length = writer.offset - offsetIndexOffset;
}

// node_modules/hyparquet-writer/src/metadata.js
function writeMetadata(writer, metadata) {
  const compact = {
    field_1: metadata.version,
    field_2: metadata.schema.map((element) => ({
      field_1: element.type && ParquetTypes.indexOf(element.type),
      field_2: element.type_length,
      field_3: element.repetition_type && FieldRepetitionTypes.indexOf(element.repetition_type),
      field_4: element.name,
      field_5: element.num_children,
      field_6: element.converted_type && ConvertedTypes.indexOf(element.converted_type),
      field_7: element.scale,
      field_8: element.precision,
      field_9: element.field_id,
      field_10: logicalType(element.logical_type)
    })),
    field_3: metadata.num_rows,
    field_4: metadata.row_groups.map((rg) => ({
      field_1: rg.columns.map((c) => ({
        field_1: c.file_path,
        field_2: c.file_offset,
        field_3: c.meta_data && {
          field_1: ParquetTypes.indexOf(c.meta_data.type),
          field_2: c.meta_data.encodings.map((e) => Encodings.indexOf(e)),
          field_3: c.meta_data.path_in_schema,
          field_4: CompressionCodecs.indexOf(c.meta_data.codec),
          field_5: c.meta_data.num_values,
          field_6: c.meta_data.total_uncompressed_size,
          field_7: c.meta_data.total_compressed_size,
          field_8: c.meta_data.key_value_metadata && c.meta_data.key_value_metadata.map((kv) => ({
            field_1: kv.key,
            field_2: kv.value
          })),
          field_9: c.meta_data.data_page_offset,
          field_10: c.meta_data.index_page_offset,
          field_11: c.meta_data.dictionary_page_offset,
          field_12: c.meta_data.statistics && unconvertStatistics(
            c.meta_data.statistics,
            schemaElement(metadata.schema, c.meta_data.path_in_schema)
          ),
          field_13: c.meta_data.encoding_stats && c.meta_data.encoding_stats.map((es) => ({
            field_1: PageTypes.indexOf(es.page_type),
            field_2: Encodings.indexOf(es.encoding),
            field_3: es.count
          })),
          field_14: c.meta_data.bloom_filter_offset,
          field_15: c.meta_data.bloom_filter_length,
          field_16: c.meta_data.size_statistics && {
            field_1: c.meta_data.size_statistics.unencoded_byte_array_data_bytes,
            field_2: c.meta_data.size_statistics.repetition_level_histogram,
            field_3: c.meta_data.size_statistics.definition_level_histogram
          },
          field_17: c.meta_data.geospatial_statistics && {
            field_1: c.meta_data.geospatial_statistics.bbox && thriftBoundingBox(c.meta_data.geospatial_statistics.bbox),
            field_2: c.meta_data.geospatial_statistics.geospatial_types
          }
        },
        field_4: c.offset_index_offset,
        field_5: c.offset_index_length,
        field_6: c.column_index_offset,
        field_7: c.column_index_length,
        // field_8: c.crypto_metadata,
        field_9: c.encrypted_column_metadata
      })),
      field_2: rg.total_byte_size,
      field_3: rg.num_rows,
      field_4: rg.sorting_columns && rg.sorting_columns.map((sc) => ({
        field_1: sc.column_idx,
        field_2: sc.descending,
        field_3: sc.nulls_first
      })),
      field_5: rg.file_offset,
      field_6: rg.total_compressed_size
      // field_7: rg.ordinal, // should be int16
    })),
    field_5: metadata.key_value_metadata && metadata.key_value_metadata.map((kv) => ({
      field_1: kv.key,
      field_2: kv.value
    })),
    field_6: metadata.created_by
  };
  const metadataStart = writer.offset;
  serializeTCompactProtocol(writer, compact);
  const metadataLength = writer.offset - metadataStart;
  writer.appendUint32(metadataLength);
}
function thriftBoundingBox(bbox) {
  return new ThriftStruct([
    [1, DOUBLE, bbox.xmin],
    [2, DOUBLE, bbox.xmax],
    [3, DOUBLE, bbox.ymin],
    [4, DOUBLE, bbox.ymax],
    [5, DOUBLE, bbox.zmin],
    [6, DOUBLE, bbox.zmax],
    [7, DOUBLE, bbox.mmin],
    [8, DOUBLE, bbox.mmax]
  ]);
}
function schemaElement(schema, path3) {
  const tree = getSchemaPath(schema, path3);
  return tree[tree.length - 1].element;
}
function logicalType(type) {
  if (!type) return;
  if (type.type === "STRING") return { field_1: {} };
  if (type.type === "MAP") return { field_2: {} };
  if (type.type === "LIST") return { field_3: {} };
  if (type.type === "ENUM") return { field_4: {} };
  if (type.type === "DECIMAL") return { field_5: {
    field_1: type.scale,
    field_2: type.precision
  } };
  if (type.type === "DATE") return { field_6: {} };
  if (type.type === "TIME") return { field_7: {
    field_1: type.isAdjustedToUTC,
    field_2: timeUnit(type.unit)
  } };
  if (type.type === "TIMESTAMP") return { field_8: {
    field_1: type.isAdjustedToUTC,
    field_2: timeUnit(type.unit)
  } };
  if (type.type === "INTEGER") return { field_10: {
    field_1: type.bitWidth,
    field_2: type.isSigned
  } };
  if (type.type === "NULL") return { field_11: {} };
  if (type.type === "JSON") return { field_12: {} };
  if (type.type === "BSON") return { field_13: {} };
  if (type.type === "UUID") return { field_14: {} };
  if (type.type === "FLOAT16") return { field_15: {} };
  if (type.type === "VARIANT") return { field_16: {} };
  if (type.type === "GEOMETRY") return { field_17: {
    field_1: type.crs
  } };
  if (type.type === "GEOGRAPHY") return { field_18: {
    field_1: type.crs,
    field_2: type.algorithm && EdgeInterpolationAlgorithms.indexOf(type.algorithm)
  } };
}
function timeUnit(unit) {
  if (unit === "NANOS") return { field_3: {} };
  if (unit === "MICROS") return { field_2: {} };
  return { field_1: {} };
}

// node_modules/hyparquet-writer/src/snappy.js
var BLOCK_LOG = 16;
var BLOCK_SIZE2 = 1 << BLOCK_LOG;
var MAX_HASH_TABLE_BITS = 14;
var globalHashTables = new Array(MAX_HASH_TABLE_BITS + 1);
function snappyCompress(input) {
  const writer = new ByteWriter();
  writer.appendVarInt(input.length);
  let pos = 0;
  while (pos < input.length) {
    const fragmentSize = Math.min(input.length - pos, BLOCK_SIZE2);
    compressFragment(writer, input, pos, fragmentSize);
    pos += fragmentSize;
  }
  return writer.getBytes();
}
function hashFunc(key, hashFuncShift) {
  return key * 506832829 >>> hashFuncShift;
}
function load32(array, pos) {
  return array[pos] + (array[pos + 1] << 8) + (array[pos + 2] << 16) + (array[pos + 3] << 24);
}
function equals32(array, pos1, pos2) {
  return array[pos1] === array[pos2] && array[pos1 + 1] === array[pos2 + 1] && array[pos1 + 2] === array[pos2 + 2] && array[pos1 + 3] === array[pos2 + 3];
}
function emitLiteral(writer, input, ip, len) {
  if (len <= 60) {
    writer.appendUint8(len - 1 << 2);
  } else if (len < 256) {
    writer.appendUint8(60 << 2);
    writer.appendUint8(len - 1);
  } else {
    writer.appendUint8(61 << 2);
    writer.appendUint8(len - 1 & 255);
    writer.appendUint8(len - 1 >>> 8);
  }
  writer.appendBytes(input.subarray(ip, ip + len));
}
function emitCopyLessThan64(writer, offset, len) {
  if (len < 12 && offset < 2048) {
    writer.appendUint8(1 + (len - 4 << 2) + (offset >>> 8 << 5));
    writer.appendUint8(offset & 255);
  } else {
    writer.appendUint8(2 + (len - 1 << 2));
    writer.appendUint8(offset & 255);
    writer.appendUint8(offset >>> 8);
  }
}
function emitCopy(writer, offset, len) {
  while (len >= 68) {
    emitCopyLessThan64(writer, offset, 64);
    len -= 64;
  }
  if (len > 64) {
    emitCopyLessThan64(writer, offset, 60);
    len -= 60;
  }
  emitCopyLessThan64(writer, offset, len);
}
function compressFragment(writer, input, ip, inputSize) {
  let hashTableBits = 1;
  while (1 << hashTableBits <= inputSize && hashTableBits <= MAX_HASH_TABLE_BITS) {
    hashTableBits++;
  }
  hashTableBits--;
  const hashFuncShift = 32 - hashTableBits;
  globalHashTables[hashTableBits] ??= new Uint16Array(1 << hashTableBits);
  const hashTable = globalHashTables[hashTableBits];
  hashTable.fill(0);
  const ipEnd = ip + inputSize;
  let ipLimit;
  const baseIp = ip;
  let nextEmit = ip;
  let hash2, nextHash;
  let nextIp, candidate, skip;
  let bytesBetweenHashLookups;
  let base, matched, offset;
  let prevHash, curHash;
  let flag = true;
  const INPUT_MARGIN = 15;
  if (inputSize >= INPUT_MARGIN) {
    ipLimit = ipEnd - INPUT_MARGIN;
    ip++;
    nextHash = hashFunc(load32(input, ip), hashFuncShift);
    while (flag) {
      skip = 32;
      nextIp = ip;
      do {
        ip = nextIp;
        hash2 = nextHash;
        bytesBetweenHashLookups = skip >>> 5;
        skip++;
        nextIp = ip + bytesBetweenHashLookups;
        if (ip > ipLimit) {
          flag = false;
          break;
        }
        nextHash = hashFunc(load32(input, nextIp), hashFuncShift);
        candidate = baseIp + hashTable[hash2];
        hashTable[hash2] = ip - baseIp;
      } while (!equals32(input, ip, candidate));
      if (!flag) {
        break;
      }
      emitLiteral(writer, input, nextEmit, ip - nextEmit);
      do {
        base = ip;
        matched = 4;
        while (ip + matched < ipEnd && input[ip + matched] === input[candidate + matched]) {
          matched++;
        }
        ip += matched;
        offset = base - candidate;
        emitCopy(writer, offset, matched);
        nextEmit = ip;
        if (ip >= ipLimit) {
          flag = false;
          break;
        }
        prevHash = hashFunc(load32(input, ip - 1), hashFuncShift);
        hashTable[prevHash] = ip - 1 - baseIp;
        curHash = hashFunc(load32(input, ip), hashFuncShift);
        candidate = baseIp + hashTable[curHash];
        hashTable[curHash] = ip - baseIp;
      } while (equals32(input, ip, candidate));
      if (!flag) {
        break;
      }
      ip++;
      nextHash = hashFunc(load32(input, ip), hashFuncShift);
    }
  }
  if (nextEmit < ipEnd) {
    emitLiteral(writer, input, nextEmit, ipEnd - nextEmit);
  }
}

// node_modules/hyparquet-writer/src/parquet-writer.js
var ParquetWriter = class {
  /**
   * @param {object} options
   * @param {Writer} options.writer
   * @param {SchemaElement[]} options.schema
   * @param {CompressionCodec} [options.codec]
   * @param {Compressors} [options.compressors]
   * @param {boolean} [options.statistics]
   * @param {KeyValue[]} [options.kvMetadata]
   */
  constructor({ writer, schema, codec = "SNAPPY", compressors, statistics = true, kvMetadata }) {
    this.writer = writer;
    this.schema = schema;
    this.codec = codec;
    this.compressors = { SNAPPY: snappyCompress, ...compressors };
    this.statistics = statistics;
    this.kvMetadata = kvMetadata;
    this.row_groups = [];
    this.num_rows = 0n;
    this.pendingIndexes = [];
    this.writer.appendUint32(827474256);
  }
  /**
   * Write data to the file.
   * Will split data into row groups of the specified size.
   * Calls writer.flush() (if defined) after each row group; if it returns a
   * Promise, subsequent row groups await it before encoding more data.
   *
   * @param {object} options
   * @param {ColumnSource[]} options.columnData
   * @param {number | number[]} [options.rowGroupSize]
   * @param {number} [options.pageSize]
   * @param {number} [options.dictionarySize]
   * @returns {void | Promise<void>}
   */
  write({ columnData, rowGroupSize = [1e3, 1e5], pageSize = 1048576, dictionarySize }) {
    const columnDataRows = columnData[0]?.data?.length || 0;
    let pending;
    for (const { groupStartIndex, groupSize: groupSize2 } of groupIterator({ columnDataRows, rowGroupSize })) {
      const writeGroup = () => {
        const groupStartOffset = this.writer.offset;
        const columns = [];
        for (let j = 0; j < columnData.length; j++) {
          const { name, data, encoding, codec = this.codec, columnIndex = false, offsetIndex = true, shredding, bloomFilter } = columnData[j];
          if (columnIndex && !offsetIndex) {
            throw new Error("parquet ColumnIndex cannot be present without OffsetIndex");
          }
          if (data.length !== columnDataRows) {
            throw new Error("parquet columns must have the same length");
          }
          const groupData = data.slice(groupStartIndex, groupStartIndex + groupSize2);
          const columnPath = getSchemaPath(this.schema, [name]);
          const leafPaths = getLeafSchemaPaths(columnPath);
          const columnElement = columnPath.at(-1)?.element;
          const shreddingConfig = shredding && shredding !== true ? shredding : void 0;
          const isVariant = columnElement?.logical_type?.type === "VARIANT";
          const isRequired = columnElement?.repetition_type === "REQUIRED";
          const rows = isVariant ? encodeVariantColumn(Array.from(groupData), shreddingConfig, { name, required: isRequired }) : groupData;
          for (const leafPath of leafPaths) {
            const schemaPath = leafPath.map((node) => node.element);
            const column = {
              columnName: schemaPath.slice(1).map((s) => s.name).join("."),
              element: schemaPath[schemaPath.length - 1],
              schemaPath,
              codec,
              compressors: this.compressors,
              stats: this.statistics,
              pageSize,
              dictionarySize,
              columnIndex,
              offsetIndex,
              encoding,
              bloomFilter
            };
            const pageData = encodeNestedValues(leafPath, rows);
            const result = writeColumn({
              writer: this.writer,
              column,
              pageData
            });
            columns.push(result.chunk);
            this.pendingIndexes.push(result);
          }
        }
        this.num_rows += BigInt(groupSize2);
        this.row_groups.push({
          columns,
          total_byte_size: BigInt(this.writer.offset - groupStartOffset),
          num_rows: BigInt(groupSize2)
        });
        return this.writer.flush?.();
      };
      if (pending) {
        pending = pending.then(writeGroup);
      } else {
        const r = writeGroup();
        if (r) pending = Promise.resolve(r);
      }
    }
    return pending;
  }
  /**
   * Finish writing the file.
   *
   * @returns {void | Promise<void>}
   */
  finish() {
    writeIndexes(this.writer, this.pendingIndexes);
    writeBlooms(this.writer, this.pendingIndexes);
    const metadata = {
      version: 2,
      created_by: "hyparquet",
      schema: this.schema,
      num_rows: this.num_rows,
      row_groups: this.row_groups,
      metadata_length: 0,
      key_value_metadata: this.kvMetadata
    };
    delete metadata.metadata_length;
    writeMetadata(this.writer, metadata);
    this.writer.appendUint32(827474256);
    return this.writer.finish();
  }
};
function groupSize(rowGroupSize, i) {
  return Array.isArray(rowGroupSize) ? rowGroupSize[Math.min(i, rowGroupSize.length - 1)] : rowGroupSize;
}
function groupIterator({ columnDataRows, rowGroupSize }) {
  if (Array.isArray(rowGroupSize) && !rowGroupSize.length) {
    throw new Error("rowGroupSize array cannot be empty");
  }
  const groups = [];
  let groupIndex = 0;
  let groupStartIndex = 0;
  while (groupStartIndex < columnDataRows) {
    const size = groupSize(rowGroupSize, groupIndex);
    groups.push({ groupStartIndex, groupSize: Math.min(size, columnDataRows - groupStartIndex) });
    groupStartIndex += size;
    groupIndex++;
  }
  return groups;
}
function getLeafSchemaPaths(schemaPath) {
  const leaves = [];
  dfs(schemaPath);
  return leaves;
  function dfs(path3) {
    const node = path3[path3.length - 1];
    if (!node.children.length) {
      leaves.push(path3);
      return;
    }
    for (const child of node.children) {
      dfs([...path3, child]);
    }
  }
}

// node_modules/hyparquet-writer/src/write.js
function parquetWrite({
  writer,
  columnData,
  schema,
  codec = "SNAPPY",
  compressors,
  statistics = true,
  rowGroupSize = [1e3, 1e5],
  kvMetadata,
  pageSize = 1048576,
  dictionarySize
}) {
  columnData = columnData.map((col) => {
    if (col.shredding === true && col.type === "VARIANT") {
      const detected = autoDetectShredding(Array.from(col.data));
      return detected ? { ...col, shredding: detected } : { ...col, shredding: void 0 };
    }
    if (col.shredding !== void 0 && col.shredding !== true && col.type === "VARIANT") {
      const shredding = normalizeShreddingConfig(col.shredding);
      return shredding ? { ...col, shredding } : { ...col, shredding: void 0 };
    }
    return col;
  });
  if (!schema) {
    schema = schemaFromColumnData({ columnData });
  } else if (columnData.some(({ type }) => type)) {
    throw new Error("cannot provide both schema and columnData type");
  } else {
  }
  const pq = new ParquetWriter({
    writer,
    schema,
    codec,
    compressors,
    statistics,
    kvMetadata
  });
  const w = pq.write({
    columnData,
    rowGroupSize,
    pageSize,
    dictionarySize
  });
  return w ? w.then(() => pq.finish()) : pq.finish();
}
function parquetWriteBuffer(options) {
  const writer = new ByteWriter();
  parquetWrite({ ...options, writer });
  return writer.getBuffer();
}

// server/openaiFeed.ts
var CATEGORIA = "Vehicles & Parts > Vehicles > Motor Vehicles > Cars, Trucks & Vans";
function truncar(texto, max) {
  const limpo = (texto || "").replace(/\s+/g, " ").trim();
  return limpo.length <= max ? limpo : limpo.slice(0, max - 1).trimEnd() + "\u2026";
}
function descrever(v) {
  const atributos = [
    v.year && `ano ${v.year}`,
    v.kmNumber > 0 && v.km,
    v.fuel && `combust\xEDvel ${v.fuel.toLowerCase()}`,
    v.transmission && `c\xE2mbio ${v.transmission.toLowerCase()}`,
    v.color && `cor ${v.color.toLowerCase()}`
  ].filter(Boolean);
  const partes = [
    `${v.title} seminovo \xE0 venda na ${DEALER.name}, revenda em ${DEALER.city}/${DEALER.region}, no ${DEALER.areaServed}.`,
    atributos.length ? `Ficha: ${atributos.join(", ")}.` : "",
    v.options.length ? `Opcionais: ${v.options.slice(0, 40).join(", ")}.` : "",
    "Ve\xEDculo revisado. Aceitamos seu usado na troca e trabalhamos com financiamento."
  ].filter(Boolean);
  return truncar(partes.join(" "), 5e3);
}
function montarProdutos(vehicles) {
  const produtos = [];
  for (const v of vehicles) {
    if (!(v.price > 0) || !v.images[0]) continue;
    produtos.push({
      item_id: truncar(v.id, 100),
      title: truncar(v.title, 150),
      description: descrever(v),
      url: `${SITE_URL}/estoque/${v.slug}`,
      brand: truncar(v.brand, 70),
      image_url: v.images[0],
      // "amount followed by a three-letter currency code" — ex.: "219900.00 BRL"
      price: `${v.price.toFixed(2)} BRL`,
      availability: "in_stock",
      condition: "used",
      product_category: CATEGORIA,
      color: truncar(v.color.toLowerCase(), 40),
      seller_name: truncar(DEALER.name, 70),
      seller_url: DEALER.url,
      seller_privacy_policy: `${SITE_URL}/politica-de-privacidade`,
      target_countries: "BR",
      store_country: "BR",
      is_eligible_search: true,
      // Não existe checkout de carro no site: a compra passa por consultor.
      // Marcar como elegível prometeria à OpenAI um fluxo que não temos.
      is_eligible_checkout: false,
      // Exigido pelo Ads. O nome é este — `is_ads_enabled` não existe.
      is_ads_eligible: true
    });
  }
  return produtos;
}
var COLUNAS = [
  { nome: "item_id", tipo: "STRING" },
  { nome: "title", tipo: "STRING" },
  { nome: "description", tipo: "STRING" },
  { nome: "url", tipo: "STRING" },
  { nome: "brand", tipo: "STRING" },
  { nome: "image_url", tipo: "STRING" },
  { nome: "price", tipo: "STRING" },
  { nome: "availability", tipo: "STRING" },
  { nome: "condition", tipo: "STRING" },
  { nome: "product_category", tipo: "STRING" },
  { nome: "color", tipo: "STRING" },
  { nome: "seller_name", tipo: "STRING" },
  { nome: "seller_url", tipo: "STRING" },
  { nome: "seller_privacy_policy", tipo: "STRING" },
  { nome: "target_countries", tipo: "STRING" },
  { nome: "store_country", tipo: "STRING" },
  { nome: "is_eligible_search", tipo: "BOOLEAN" },
  { nome: "is_eligible_checkout", tipo: "BOOLEAN" },
  { nome: "is_ads_eligible", tipo: "BOOLEAN" }
];
function produtosParaParquet(produtos) {
  const columnData = COLUNAS.map((c) => ({
    name: c.nome,
    type: c.tipo,
    data: produtos.map((p) => p[c.nome])
  }));
  const buffer = parquetWriteBuffer({
    columnData,
    kvMetadata: [
      { key: "generated_by", value: "manosveiculoscompra.com" },
      { key: "generated_at", value: (/* @__PURE__ */ new Date()).toISOString() }
    ]
  });
  return Buffer.from(buffer);
}

// server/metaFeed.ts
var MAX_IMAGENS = 20;
var CATEGORIA2 = "Vehicles & Parts > Vehicles > Motor Vehicles > Cars, Trucks & Vans";
var ENDERECO_JSON = JSON.stringify({
  addr1: DEALER.street,
  city: DEALER.city,
  region: DEALER.region,
  postal_code: DEALER.postalCode,
  country: DEALER.country
});
var MARCAS_COMPOSTAS = [
  "land rover",
  "alfa romeo",
  "aston martin",
  "great wall",
  "jac motors",
  "rolls royce",
  "mercedes benz"
];
function parteDoModelo(title) {
  return (title.split(" - ")[0] || title).replace(/\s+/g, " ").trim();
}
function separarMarcaModelo(title) {
  const texto = parteDoModelo(title);
  const minusculo = texto.toLowerCase();
  const composta = MARCAS_COMPOSTAS.find((m) => minusculo.startsWith(m + " "));
  const palavras = texto.split(" ").filter(Boolean);
  const tamanhoMarca = composta ? composta.split(" ").length : 1;
  const make = palavras.slice(0, tamanhoMarca).join(" ") || DEALER.name;
  const model = palavras[tamanhoMarca] || make;
  const trim = palavras.slice(tamanhoMarca + 1).join(" ");
  return { make, model, trim };
}
var CARROCERIA_POR_MODELO = {
  // Sedãs
  fusion: "SEDAN",
  sonata: "SEDAN",
  hb20s: "SEDAN",
  corolla: "SEDAN",
  civic: "SEDAN",
  cruze: "SEDAN",
  virtus: "SEDAN",
  voyage: "SEDAN",
  prisma: "SEDAN",
  versa: "SEDAN",
  cronos: "SEDAN",
  ka: "SEDAN",
  // Hatches
  hb20: "HATCHBACK",
  dolphin: "HATCHBACK",
  gol: "HATCHBACK",
  polo: "HATCHBACK",
  uno: "HATCHBACK",
  palio: "HATCHBACK",
  argo: "HATCHBACK",
  mobi: "HATCHBACK",
  onix: "HATCHBACK",
  sandero: "HATCHBACK",
  march: "HATCHBACK",
  fox: "HATCHBACK",
  up: "HATCHBACK",
  fit: "HATCHBACK",
  focus: "HATCHBACK",
  // Nomes comerciais de duas palavras. A chave composta é consultada primeiro:
  // "Corolla" sozinho é sedã, "Corolla Cross" é SUV, e o modelo isolado não
  // distingue os dois.
  "corolla cross": "SUV",
  "new beetle": "HATCHBACK",
  "up cross": "HATCHBACK",
  // SUVs e crossovers
  nivus: "SUV",
  "2008": "SUV",
  "3008": "SUV",
  ex30: "SUV",
  soul: "SUV",
  c4: "SUV",
  haval: "SUV",
  "hr-v": "SUV",
  "wr-v": "SUV",
  tucson: "SUV",
  sportage: "SUV",
  outlander: "SUV",
  asx: "SUV",
  corvette: "COUPE"
};
function deduzirCarroceria(v) {
  if (v.tipo === "4") return "OTHER";
  const texto = `${v.title} ${v.options.join(" ")}`.toLowerCase();
  const { model, trim } = separarMarcaModelo(v.title);
  const composto = `${model} ${trim.split(" ")[0] || ""}`.trim().toLowerCase();
  const porModelo = CARROCERIA_POR_MODELO[composto] || CARROCERIA_POR_MODELO[model.toLowerCase()];
  if (porModelo) return porModelo;
  if (/roadster|conversivel|convers[ií]vel|cabrio/.test(texto)) return "CONVERTIBLE";
  if (/\bcoup[eé]\b/.test(texto)) return "COUPE";
  if (/pick-?up|picape|\bcd\b|cabine dupla|frontier|hilux|ranger|s10|toro|strada|saveiro|montana|amarok|oroch/.test(texto))
    return "TRUCK";
  if (/minivan|\bspin\b|livina|zafira|grand c4/.test(texto)) return "MINIVAN";
  if (/\bvan\b|ducato|sprinter|master|daily/.test(texto)) return "VAN";
  if (/perua|\bsw\b|station|variant|sportwagon/.test(texto)) return "WAGON";
  if (/\bsuv\b|tracker|compass|renegade|creta|kicks|duster|tiguan|t-cross|taos|hr-v|wr-v|haval|captur|territory|ecosport|pulse|fastback/.test(texto))
    return "SUV";
  if (/hatch|\b5p\b/.test(texto)) return "HATCHBACK";
  if (/sedan|\b4p\b/.test(texto)) return "SEDAN";
  return "OTHER";
}
function deduzirCombustivel(v) {
  const texto = `${v.fuel} ${v.title}`.toLowerCase();
  if (/h[ií]brid/.test(texto)) return "HYBRID";
  if (/el[eé]tric|bateria/.test(texto)) return "ELECTRIC";
  if (/diesel/.test(texto)) return "DIESEL";
  if (/flex|[aá]lcool|etanol/.test(texto)) return "FLEX";
  if (/gasolina/.test(texto)) return "GASOLINE";
  return "OTHER";
}
function deduzirTracao(v) {
  const texto = `${v.title} ${v.options.join(" ")}`.toLowerCase();
  if (/\b4x4\b|4wd/.test(texto)) return "4X4";
  if (/\bawd\b/.test(texto)) return "AWD";
  if (/\b4x2\b/.test(texto)) return "4X2";
  return "";
}
function deduzirCambio(v) {
  if (/autom/i.test(v.transmission)) return "Automatic";
  if (/manual/i.test(v.transmission)) return "Manual";
  return "";
}
function anoInteiro(v) {
  const m = String(v.year).match(/(\d{4})/g);
  return m ? m[m.length - 1] : "";
}
function truncar2(texto, max) {
  const limpo = (texto || "").replace(/\s+/g, " ").trim();
  return limpo.length <= max ? limpo : limpo.slice(0, max - 1).trimEnd() + "\u2026";
}
function descrever2(v, maxOpcionais, limite) {
  const atributos = [
    v.year && `ano ${v.year}`,
    v.kmNumber > 0 && v.km,
    v.fuel && `combust\xEDvel ${v.fuel.toLowerCase()}`,
    v.transmission && `c\xE2mbio ${v.transmission.toLowerCase()}`,
    v.color && `cor ${v.color.toLowerCase()}`
  ].filter(Boolean);
  const partes = [
    `${v.title} seminovo \xE0 venda na ${DEALER.name}, revenda em ${DEALER.city}/${DEALER.region}, no ${DEALER.areaServed}.`,
    atributos.length ? `Ficha: ${atributos.join(", ")}.` : "",
    v.options.length ? `Opcionais: ${v.options.slice(0, maxOpcionais).join(", ")}.` : "",
    "Ve\xEDculo revisado. Aceitamos seu usado na troca e trabalhamos com financiamento."
  ].filter(Boolean);
  return truncar2(partes.join(" "), limite);
}
function urlDoVeiculo(v) {
  return `${SITE_URL}/estoque/${v.slug}`;
}
function faixaDePreco(preco) {
  if (preco < 5e4) return "ate-50k";
  if (preco < 8e4) return "50k-80k";
  if (preco < 12e4) return "80k-120k";
  if (preco < 2e5) return "120k-200k";
  return "acima-200k";
}
function anunciavel(v) {
  return v.price > 0 && Boolean(v.images[0]);
}
function montarProdutos2(vehicles) {
  const produtos = [];
  for (const v of vehicles) {
    if (!anunciavel(v)) continue;
    const { make, model } = separarMarcaModelo(v.title);
    produtos.push({
      // O MESMO id que o pixel manda em content_ids. É isto que faz a taxa de
      // correspondência sair de 0%.
      id: truncar2(v.id, 100),
      title: truncar2(v.title, 200),
      description: descrever2(v, 40, 9999),
      // Só entra no feed o que está no estoque; o que some do feed sai do ar.
      availability: "in stock",
      condition: "used",
      price: `${v.price.toFixed(2)} BRL`,
      link: urlDoVeiculo(v),
      image_link: v.images[0],
      // A Meta lê a lista separada por vírgula dentro da mesma célula.
      additional_image_link: v.images.slice(1, MAX_IMAGENS).join(","),
      brand: truncar2(make, 100),
      google_product_category: CATEGORIA2,
      product_type: truncar2(`Seminovos > ${make} > ${model}`, 750),
      color: truncar2(v.color, 200),
      custom_label_0: anoInteiro(v),
      custom_label_1: faixaDePreco(v.price),
      custom_label_2: v.kmNumber > 0 ? String(v.kmNumber) : "",
      custom_label_3: truncar2(v.fuel, 100),
      custom_label_4: truncar2(v.transmission, 100)
    });
  }
  return produtos;
}
var COLUNAS_PRODUTO = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "google_product_category",
  "product_type",
  "color",
  "custom_label_0",
  "custom_label_1",
  "custom_label_2",
  "custom_label_3",
  "custom_label_4"
];
function montarVeiculos(vehicles) {
  const linhas = [];
  for (const v of vehicles) {
    if (!anunciavel(v)) continue;
    const { make, model, trim } = separarMarcaModelo(v.title);
    const linha = {
      // Mesmo id do pixel — ver comentário em montarProdutos.
      vehicle_id: truncar2(v.id, 100),
      title: truncar2(v.title, 500),
      description: descrever2(v, 30, 5e3),
      url: urlDoVeiculo(v),
      make: truncar2(make, 100),
      model: truncar2(model, 100),
      trim: truncar2(trim, 100),
      year: anoInteiro(v),
      "mileage.value": String(v.kmNumber),
      "mileage.unit": "KM",
      price: `${v.price.toFixed(2)} BRL`,
      exterior_color: truncar2(v.color, 100),
      // A loja vende seminovo; carro zero não entra neste estoque.
      state_of_vehicle: "Used",
      body_style: deduzirCarroceria(v),
      transmission: deduzirCambio(v),
      fuel_type: deduzirCombustivel(v),
      drivetrain: deduzirTracao(v),
      availability: "available",
      address: ENDERECO_JSON,
      latitude: String(DEALER.lat),
      longitude: String(DEALER.lng),
      dealer_id: "dg-rio-do-sul",
      dealer_name: truncar2(DEALER.name, 100),
      dealer_phone: DEALER.telephone,
      // Não existe `vin` no feed da Altimus. A placa NÃO é VIN e não pode ir
      // nesse campo — ela vai num rótulo próprio, que também é a chave usada
      // pelo CRM para casar a venda.
      custom_label_0: v.placa
    };
    for (let i = 0; i < MAX_IMAGENS; i++) {
      linha[`image[${i}].url`] = v.images[i] || "";
    }
    linhas.push(linha);
  }
  return linhas;
}
function colunasVeiculo() {
  const fixas = [
    "vehicle_id",
    "title",
    "description",
    "url",
    "make",
    "model",
    "trim",
    "year",
    "mileage.value",
    "mileage.unit",
    "price",
    "exterior_color",
    "state_of_vehicle",
    "body_style",
    "transmission",
    "fuel_type",
    "drivetrain",
    "availability",
    "address",
    "latitude",
    "longitude",
    "dealer_id",
    "dealer_name",
    "dealer_phone",
    "custom_label_0"
  ];
  const imagens = Array.from({ length: MAX_IMAGENS }, (_, i) => `image[${i}].url`);
  return [...fixas, ...imagens];
}
function celula(valor) {
  const texto = String(valor ?? "").replace(/[\r\n]+/g, " ");
  return /[",]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}
function paraCsv(linhas, colunas) {
  const cabecalho = colunas.join(",");
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c])).join(","));
  return [cabecalho, ...corpo].join("\n") + "\n";
}
function produtosParaCsv(produtos) {
  return paraCsv(produtos, COLUNAS_PRODUTO);
}
function veiculosParaCsv(linhas) {
  return paraCsv(linhas, colunasVeiculo());
}

// server/consultor.ts
var TAXA_MENSAL = 0.023;
function parcela({
  valor,
  entrada = 0,
  meses = 48
}) {
  const financiado = Math.max(valor - entrada, 0);
  if (!financiado || !meses) return 0;
  const f = Math.pow(1 + TAXA_MENSAL, meses);
  return financiado * TAXA_MENSAL * f / (f - 1);
}
function precoMaxPorParcela({
  parcelaMax,
  entrada = 0,
  meses = 48
}) {
  const f = Math.pow(1 + TAXA_MENSAL, meses);
  const fator = TAXA_MENSAL * f / (f - 1);
  return Math.round(parcelaMax / fator + entrada);
}
function simularParcela(valor, entrada = 0, meses = 48) {
  const raw = parcela({ valor, entrada, meses });
  const parcelaAproximada = Math.round(raw / 10) * 10;
  return { parcelaAproximada, meses };
}
function limparMarkdown(text) {
  if (!text) return "";
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/^#{1,6}\s*/gm, "").replace(/^[-•]\s*/gm, "").replace(/`/g, "").replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();
}
function isMoto(v) {
  const hay = (v.title + " " + v.description + " " + (v.fuel || "")).toLowerCase();
  return hay.includes("moto") || hay.includes("biz") || hay.includes("cg") || hay.includes("125") || hay.includes("150") || hay.includes("yamaha") || hay.includes("titan") || hay.includes("factor") || hay.includes("nmax") || hay.includes("pcx");
}
var SYSTEM_PROMPT = `Voc\xEA \xE9 o Consultor DG, da DG Autom\xF3veis, revenda de seminovos em Rio do Sul, Santa Catarina. Atende no site da loja.

COMO FALAR
Use o m\xEDnimo de palavras poss\xEDvel. Educado, gentil, direto. Sem formalidade e sem jarg\xE3o. No m\xE1ximo 3 frases curtas por resposta, salvo quando o cliente pedir detalhe.
Nunca use Markdown: sem asterisco, sem cerquilha, sem lista com h\xEDfen. S\xF3 texto simples. Nomes de ve\xEDculo em texto normal.
Nunca use emoji.
Uma pergunta por vez.

O QUE VOC\xCA FAZ
Entende o que a pessoa precisa, mostra carros do estoque que servem, e leva ao atendimento da loja. Voc\xEA n\xE3o fecha venda e n\xE3o aprova cr\xE9dito.

REGRA DE HONESTIDADE
S\xF3 cite ve\xEDculos retornados pela ferramenta buscar_estoque. Nunca invente carro, pre\xE7o, ano, quilometragem, opcional ou condi\xE7\xE3o.
Se n\xE3o houver ve\xEDculo compat\xEDvel, diga com franqueza e ofere\xE7a registrar a busca.
Se n\xE3o souber, diga que vai confirmar com a equipe.
Nunca recomende um ve\xEDculo acima do or\xE7amento que o cliente informou. Verifique o valor antes de recomendar, n\xE3o depois.

PARCELA E FINANCIAMENTO
Nunca revele, cite ou mencione taxa de juros, percentual ao m\xEAs ou \xEDndice. Se o cliente perguntar a taxa, responda que a taxa depende da an\xE1lise do banco e do perfil, e que a equipe passa a condi\xE7\xE3o exata na simula\xE7\xE3o real.
Toda parcela que voc\xEA informar \xE9 aproximada, calculada pela ferramenta simular_parcela. Nunca calcule de cabe\xE7a.
Sempre que informar uma parcela, deixe claro na mesma resposta que \xE9 apenas uma base, e ofere\xE7a a simula\xE7\xE3o real com a equipe. Exemplo:
"Fica em torno de R$ 1.150 por m\xEAs. \xC9 s\xF3 uma base. Quer que a equipe fa\xE7a a simula\xE7\xE3o real e te passe a condi\xE7\xE3o exata?"
Se a parcela desejada n\xE3o couber no carro, diga em uma frase e ofere\xE7a duas sa\xEDdas: prazo maior ou entrada maior. Depois pergunte se tem carro para troca.

ATENDIMENTO
A loja fica na R. Dom Pedro II, 461 \u2014 Canoas, Rio do Sul/SC. Telefone e WhatsApp: 47 3300-1352. Hor\xE1rio: segunda a sexta 8h \xE0s 19h, s\xE1bado 8h \xE0s 13h.
Com hora marcada a loja abre qualquer dia e hor\xE1rio, inclusive fora do expediente.
Sempre que a pessoa disser que trabalha, que n\xE3o consegue no hor\xE1rio comercial ou que s\xF3 pode no fim de semana, ofere\xE7a agendar.
Para endere\xE7o, hor\xE1rio, documenta\xE7\xE3o, garantia e formas de pagamento, use a ferramenta info_loja. Nunca responda de mem\xF3ria.

VE\xCDCULOS
Se o cliente n\xE3o disser que quer moto, busque carro.
Mostre no m\xE1ximo 3 ve\xEDculos por resposta, come\xE7ando pelo que melhor atende.

REGRA DE TROCA
Quando o cliente falar sobre troca ("Quero trocar o meu", "tenho troca", etc.), voc\xEA deve sempre primeiro entender o que o cliente busca/precisa no novo carro (tipo de ve\xEDculo, uso para fam\xEDlia ou trabalho, parcela/or\xE7amento) E TAMB\xC9M perguntar sobre o carro atual dele. Nunca ofere\xE7a carros aleat\xF3rios sem antes entender a real necessidade da busca.

VIRAR ATENDIMENTO
Quando houver interesse claro \u2014 o cliente gostou de um carro, pediu simula\xE7\xE3o, falou de troca, ou a conversa passou de tr\xEAs trocas de mensagem \u2014 pe\xE7a nome e WhatsApp, mostrando em uma frase o resumo do que entendeu.
N\xE3o pe\xE7a nenhum dado antes de ter mostrado carros.
Nunca pe\xE7a CPF, RG, renda ou dado banc\xE1rio. Isso s\xF3 no formul\xE1rio de financiamento.

REGRA DE VALORIZA\xC7\xC3O E FOCO EM VENDA
Todos os ve\xEDculos da DG Autom\xF3veis s\xE3o seminovos de proced\xEAncia, revisados e com garantia de qualidade. NUNCA fale mal, desvalorize, aponte defeitos ou sugira desgaste de qualquer ve\xEDculo do p\xE1tio. Ao comparar ve\xEDculos, enalte\xE7a os pontos fortes e qualidades de CADA UM (ex: facilidade de entrada/parcela para um, ano/tecnologia/conforto para outro), conduzindo o cliente com entusiasmo para realizar a simula\xE7\xE3o ou agendar uma visita para fechar a compra.

REGRA DE AJUDA NA ESCOLHA E D\xDAVIDAS
Quando o cliente pedir ajuda para escolher entre ve\xEDculos ou estiver analisando op\xE7\xF5es ('estou na d\xFAvida', 'qual voc\xEA me recomenda', 'qual a diferen\xE7a', 'comparando carros', 'tirar d\xFAvidas'), atue como um consultor atencioso. Responda tirando as d\xFAvidas de forma direta e objetiva, fazendo PERGUNTAS DIRETAS (ex: uso di\xE1rio na cidade vs viagem, espa\xE7o para fam\xEDlia, prefer\xEAncia por c\xE2mbio autom\xE1tico ou limite de or\xE7amento) para gui\xE1-lo \xE0 melhor escolha no nosso p\xE1tio.

FORA DO ASSUNTO
Responda em uma frase e volte para carros.`;
async function processConsultorMessage(body) {
  const msg = body.mensagem.trim();
  const msgLower = msg.toLowerCase();
  const historico = body.historico || [];
  const turnCount = historico.length + 1;
  const vehicles = await getVehicles();
  if (msgLower.includes("taxa") || msgLower.includes("juros") || msgLower.includes("porcento") || msgLower.includes("%")) {
    const querHandoff = turnCount >= 2;
    return {
      resposta: limparMarkdown(
        "A taxa depende da an\xE1lise do banco e do seu perfil. A equipe faz a simula\xE7\xE3o real e te passa a condi\xE7\xE3o exata. Quer que eu j\xE1 encaminhe para simula\xE7\xE3o?"
      ),
      resumoLead: "Cliente perguntou sobre taxa de juros do financiamento.",
      mostrarHandoff: querHandoff
    };
  }
  if (msgLower.includes("analisando") || msgLower.includes("d\xFAvida") || msgLower.includes("duvida") || msgLower.includes("compar") || msgLower.includes("escolher") || msgLower.includes("ajud")) {
    return {
      resposta: limparMarkdown(
        "Estou aqui para tirar todas as suas d\xFAvidas! Para eu te ajudar a escolher o melhor carro do p\xE1tio: voc\xEA vai usar o ve\xEDculo mais para o dia a dia na cidade ou viagens em fam\xEDlia? E qual limite de parcela ou entrada que voc\xEA planeja?"
      ),
      resumoLead: "Cliente solicitou ajuda do Consultor para tirar d\xFAvidas e escolher ve\xEDculo.",
      mostrarHandoff: false
    };
  }
  const parcelaMatch = msgLower.match(/(?:parcela|mensalidade|pagar por m[êe]s|m[êe]s)\s*(?:at[eé]|de)?\s*(?:r\$)?\s*(\d+)/i) || msgLower.match(/(\d+)\s*(?:por m[êe]s|mensal|de parcela)/i);
  let parcelaVal = null;
  if (parcelaMatch) {
    const parsed = parseInt(parcelaMatch[1] || parcelaMatch[0], 10);
    if (parsed >= 300 && parsed <= 1e4) {
      parcelaVal = parsed;
    }
  }
  const entradaMatch = msgLower.match(/(?:entrada|tenho|dar)\s*(?:de)?\s*(\d+)\s*(mil|k)?/i) || msgLower.match(/(\d+)\s*(?:mil|k)\s*(?:de entrada)/i);
  let entradaVal = null;
  if (entradaMatch) {
    let num = parseInt(entradaMatch[1], 10);
    if (entradaMatch[2] === "mil" || entradaMatch[2] === "k" || num < 100) num *= 1e3;
    entradaVal = num;
  }
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (geminiKey || openaiKey) {
    try {
      const llmResult = await processWithLLM(
        msg,
        historico,
        vehicles,
        parcelaVal,
        entradaVal,
        geminiKey,
        openaiKey
      );
      if (llmResult) return llmResult;
    } catch (e) {
      console.warn("LLM processing error, falling back to rule engine:", e);
    }
  }
  const querMoto = msgLower.includes("moto") || msgLower.includes("biz") || msgLower.includes("cg") || msgLower.includes("yamaha") || msgLower.includes("125cc");
  let pool = vehicles.filter((v) => querMoto ? isMoto(v) : !isMoto(v));
  if (parcelaVal) {
    const maxPreco = precoMaxPorParcela({
      parcelaMax: parcelaVal,
      entrada: entradaVal || 0,
      meses: 48
    });
    const dentroDoOrcamento = pool.filter((v) => v.price > 0 && v.price <= maxPreco);
    if (dentroDoOrcamento.length === 0) {
      const faixaAprox2 = Math.round(maxPreco / 1e3);
      let texto2 = "";
      if (entradaVal) {
        texto2 = `Com ${entradaVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de entrada e ${parcelaVal} por m\xEAs, fico em carros de at\xE9 uns ${faixaAprox2} mil. Nessa faixa n\xE3o tenho nenhum ve\xEDculo no p\xE1tio hoje. Quer esticar para 60 vezes, dar uma entrada maior ou tem carro para dar na troca?`;
      } else {
        texto2 = `Com ${parcelaVal} por m\xEAs, chego em carros de at\xE9 uns ${faixaAprox2} mil (sem entrada). Voc\xEA tem algum valor de entrada para dar?`;
      }
      const resumoLead2 = entradaVal ? `Procura carro at\xE9 ${faixaAprox2} mil com parcela de ${parcelaVal} e entrada de ${entradaVal}.` : `Procura carro at\xE9 ${faixaAprox2} mil com parcela de ${parcelaVal}, sem entrada informada.`;
      const querHandoff2 = turnCount >= 3 || msgLower.includes("simular") || msgLower.includes("quero") || Boolean(entradaVal);
      return {
        resposta: limparMarkdown(texto2),
        veiculos: [],
        // NUNCA devolve carro fora do orçamento!
        resumoLead: limparMarkdown(resumoLead2),
        mostrarHandoff: querHandoff2
      };
    }
    const selecionados2 = dentroDoOrcamento.slice(0, 3).map((v) => {
      const { parcelaAproximada } = simularParcela(v.price, entradaVal || 0, 48);
      return {
        id: v.id,
        slug: v.slug,
        titulo: v.title,
        marca: v.brand,
        ano: v.year,
        km: v.km,
        preco: v.price,
        precoFormatado: `${v.priceFormatted} \xB7 48x em torno de R$ ${parcelaAproximada.toLocaleString("pt-BR")}`,
        foto: v.images[0] || "/logo-dg.png",
        url: `/estoque/${v.slug}`
      };
    });
    const faixaAprox = Math.round(maxPreco / 1e3);
    let texto = "";
    if (entradaVal) {
      texto = `Ent\xE3o fico em carros at\xE9 uns ${faixaAprox} mil. Tenho estes para voc\xEA:`;
    } else {
      texto = `Com ${parcelaVal} por m\xEAs, chego em carros de at\xE9 uns ${faixaAprox} mil. Voc\xEA tem algum valor de entrada?`;
    }
    const resumoLead = entradaVal ? `Procura carro at\xE9 ${faixaAprox} mil com parcela de ${parcelaVal} e entrada de ${entradaVal}.` : `Procura carro at\xE9 ${faixaAprox} mil com parcela de ${parcelaVal}, sem entrada informada.`;
    const querHandoff = turnCount >= 3 || msgLower.includes("simular") || msgLower.includes("quero") || Boolean(entradaVal);
    return {
      resposta: limparMarkdown(texto),
      veiculos: selecionados2,
      resumoLead: limparMarkdown(resumoLead),
      mostrarHandoff: querHandoff
    };
  }
  if (msgLower.includes("troca") || msgLower.includes("trocar")) {
    return {
      resposta: limparMarkdown(
        "Excelente! Pegamos o seu usado na troca com \xF3tima avalia\xE7\xE3o. Para eu te indicar os melhores carros do p\xE1tio: que tipo de modelo voc\xEA precisa (SUV, econ\xF4mico, autom\xE1tico...) e qual \xE9 a marca, modelo e ano do seu carro atual?"
      ),
      resumoLead: `Interesse em troca (${msg.slice(0, 40)}).`,
      mostrarHandoff: true
    };
  }
  if (msgLower.includes("trabalho") || msgLower.includes("hor\xE1rio") || msgLower.includes("horario") || msgLower.includes("s\xE1bado") || msgLower.includes("sabado") || msgLower.includes("fim de semana") || msgLower.includes("domingo")) {
    return {
      resposta: limparMarkdown(
        "Com hora marcada abrimos em qualquer dia e hor\xE1rio, inclusive fora do expediente. Quer agendar um hor\xE1rio para visitar a loja?"
      ),
      resumoLead: "Solicitou agendamento com hora marcada fora do expediente.",
      mostrarHandoff: true
    };
  }
  if (msgLower.includes("fam\xEDlia") || msgLower.includes("familia") || msgLower.includes("espa\xE7oso") || msgLower.includes("espacoso")) {
    const suvs = pool.filter((v) => {
      const desc = (v.title + " " + v.description).toLowerCase();
      return desc.includes("suv") || desc.includes("sedan") || desc.includes("tracker") || desc.includes("t-cross") || desc.includes("creta") || desc.includes("compass");
    });
    const selecionados2 = (suvs.length > 0 ? suvs : pool).slice(0, 3).map((v) => ({
      id: v.id,
      slug: v.slug,
      titulo: v.title,
      marca: v.brand,
      ano: v.year,
      km: v.km,
      preco: v.price,
      precoFormatado: v.priceFormatted,
      foto: v.images[0] || "/logo-dg.png",
      url: `/estoque/${v.slug}`
    }));
    return {
      resposta: limparMarkdown("Para a fam\xEDlia, os SUVs e sed\xE3s s\xE3o ideais pelo espa\xE7o interno. Separei estes no p\xE1tio:"),
      veiculos: selecionados2,
      resumoLead: "Interesse em ve\xEDculo espa\xE7oso para a fam\xEDlia.",
      mostrarHandoff: turnCount >= 3
    };
  }
  const terms = msgLower.split(/\s+/).filter((t) => t.length > 2);
  let matched = pool.filter((v) => {
    const hay = (v.title + " " + v.brand + " " + v.description).toLowerCase();
    return terms.some((term) => hay.includes(term));
  });
  if (matched.length === 0) matched = pool.slice(0, 3);
  const selecionados = matched.slice(0, 3).map((v) => ({
    id: v.id,
    slug: v.slug,
    titulo: v.title,
    marca: v.brand,
    ano: v.year,
    km: v.km,
    preco: v.price,
    precoFormatado: v.priceFormatted,
    foto: v.images[0] || "/logo-dg.png",
    url: `/estoque/${v.slug}`
  }));
  return {
    resposta: limparMarkdown("Separei estes ve\xEDculos do p\xE1tio para voc\xEA olhar. Qual modelo voc\xEA prefere?"),
    veiculos: selecionados,
    resumoLead: `Procura seminovo (${msg.slice(0, 40)}).`,
    mostrarHandoff: turnCount >= 3
  };
}
async function processWithLLM(mensagem, historico, vehicles, parcelaVal, entradaVal, geminiKey, openaiKey) {
  let maxPreco = null;
  if (parcelaVal) {
    maxPreco = precoMaxPorParcela({ parcelaMax: parcelaVal, entrada: entradaVal || 0, meses: 48 });
  }
  let filteredVehicles = vehicles;
  if (maxPreco) {
    filteredVehicles = vehicles.filter((v) => v.price > 0 && v.price <= maxPreco);
  }
  const catalogSummary = filteredVehicles.slice(0, 30).map((v) => ({
    id: v.id,
    titulo: v.title,
    marca: v.brand,
    ano: v.year,
    km: v.km,
    preco: v.price,
    precoFormatado: v.priceFormatted,
    isMoto: isMoto(v)
  }));
  if (openaiKey && openaiKey.startsWith("sk-")) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${SYSTEM_PROMPT}
Estoque filtrado dispon\xEDvel no p\xE1tio: ${JSON.stringify(catalogSummary)}` },
            ...historico.map((h) => ({
              role: h.papel === "usuario" ? "user" : "assistant",
              content: h.texto
            })),
            { role: "user", content: mensagem }
          ],
          temperature: 0.1
        })
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const selectedVehicles = (parsed.veiculoIds || []).map((id) => vehicles.find((v) => v.id === id || v.slug.includes(id))).filter((v) => {
            if (!v) return false;
            if (maxPreco && v.price > maxPreco) return false;
            return true;
          }).slice(0, 3).map((v) => {
            const { parcelaAproximada } = simularParcela(v.price, entradaVal || 0, 48);
            return {
              id: v.id,
              slug: v.slug,
              titulo: v.title,
              marca: v.brand,
              ano: v.year,
              km: v.km,
              preco: v.price,
              precoFormatado: `${v.priceFormatted} \xB7 48x em torno de R$ ${parcelaAproximada.toLocaleString("pt-BR")}`,
              foto: v.images[0] || "/logo-dg.png",
              url: `/estoque/${v.slug}`
            };
          });
          return {
            resposta: limparMarkdown(parsed.resposta || ""),
            veiculos: selectedVehicles,
            resumoLead: limparMarkdown(parsed.resumoLead || ""),
            mostrarHandoff: Boolean(parsed.mostrarHandoff)
          };
        }
      }
    } catch (err) {
      console.warn("OpenAI LLM processing error:", err);
    }
  }
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${SYSTEM_PROMPT}
Estoque filtrado dispon\xEDvel: ${JSON.stringify(catalogSummary)}
Hist\xF3rico: ${JSON.stringify(
                      historico
                    )}
Mensagem: ${mensagem}`
                  }
                ]
              }
            ],
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          const selectedVehicles = (parsed.veiculoIds || []).map((id) => vehicles.find((v) => v.id === id || v.slug.includes(id))).filter((v) => {
            if (!v) return false;
            if (maxPreco && v.price > maxPreco) return false;
            return true;
          }).slice(0, 3).map((v) => {
            const { parcelaAproximada } = simularParcela(v.price, entradaVal || 0, 48);
            return {
              id: v.id,
              slug: v.slug,
              titulo: v.title,
              marca: v.brand,
              ano: v.year,
              km: v.km,
              preco: v.price,
              precoFormatado: `${v.priceFormatted} \xB7 48x em torno de R$ ${parcelaAproximada.toLocaleString("pt-BR")}`,
              foto: v.images[0] || "/logo-dg.png",
              url: `/estoque/${v.slug}`
            };
          });
          return {
            resposta: limparMarkdown(parsed.resposta || ""),
            veiculos: selectedVehicles,
            resumoLead: limparMarkdown(parsed.resumoLead || ""),
            mostrarHandoff: Boolean(parsed.mostrarHandoff)
          };
        }
      }
    } catch (err) {
      console.warn("Gemini LLM processing error:", err);
    }
  }
  return null;
}

// server.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname = path2.dirname(__filename);
var otpStore = /* @__PURE__ */ new Map();
var OTP_TTL_MS = 10 * 60 * 1e3;
var OTP_MAX_ATTEMPTS = 5;
var normalizePhone = digitosNacionais;
function generateOtp() {
  return String(Math.floor(1e5 + Math.random() * 9e5));
}
function enviarLeadQualificado(qualificacao, base) {
  if (qualificacao.faixa !== "quente") return;
  void enviarEventoCapi({
    ...base,
    eventName: "QualifiedLead",
    eventId: `${base.eventId}-qualified`
  });
}
var pixelDoFunilCache;
function pixelDoFunil() {
  if (pixelDoFunilCache !== void 0) return pixelDoFunilCache;
  try {
    const html = readFileSync(path2.join(__dirname, "dist", "index.html"), "utf8");
    const achado = html.match(/name="manos:meta-pixel"\s+content="([^"]*)"/);
    const valor = achado?.[1] ?? "";
    pixelDoFunilCache = !valor || valor.charAt(0) === "%" ? PIXEL_PADRAO : valor;
  } catch {
    pixelDoFunilCache = null;
  }
  return pixelDoFunilCache;
}
function ambienteDeTeste(req) {
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" || host.endsWith(".local");
}
function lerCookie(req, nome) {
  const cru = req.headers.cookie;
  if (!cru) return void 0;
  for (const parte of cru.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) {
      return decodeURIComponent(parte.slice(i + 1).trim()) || void 0;
    }
  }
  return void 0;
}
function cookiesMeta(req, atribuicao) {
  const fbp = lerCookie(req, "_fbp");
  let fbc = lerCookie(req, "_fbc");
  if (!fbc && atribuicao.fbclid) {
    fbc = `fb.1.${Date.now()}.${atribuicao.fbclid}`;
  }
  const externalId = lerCookie(req, "manos_vid");
  return { fbp, fbc, externalId };
}
async function startServer() {
  const app2 = express2();
  const PORT2 = Number(process.env.PORT) || 3030;
  app2.set("trust proxy", 1);
  app2.disable("x-powered-by");
  app2.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app2.use(express2.json());
  app2.use(server_default);
  const sistemaDist = fs2.existsSync(path2.join(process.cwd(), "dist", "sistema")) ? path2.join(process.cwd(), "dist", "sistema") : path2.join(process.cwd(), "dist-sistema");
  app2.use("/sistema", express2.static(sistemaDist));
  app2.get(["/sistema", "/sistema/*"], (_req, res) => {
    const indexPath = path2.join(sistemaDist, "index.html");
    if (fs2.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).send(`
        <div style="font-family:sans-serif;text-align:center;padding:50px">
          <h2>Sistema DG AUTOS</h2>
          <p>O painel administrativo ainda est\xE1 sendo constru\xEDdo ou compilado.</p>
          <p>Execute <code>npm run build:sistema</code> para gerar a pasta <code>dist-sistema</code>.</p>
        </div>
      `);
    }
  });
  app2.use(radarMiddleware);
  app2.get("/vendasrapidas", (_req, res) => {
    res.redirect(301, "/vender-meu-carro");
  });
  app2.get("/api/stock", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.json(vehicles);
    } catch (error) {
      console.error("Stock API error:", error);
      res.status(500).json({ error: "Failed to fetch stock" });
    }
  });
  app2.get("/api/stock.xml", async (_req, res) => {
    try {
      const url = process.env.DG_FEED_XML_URL || "http://localhost:3333/api/estoquexml?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch from Motriz feed");
      const xml = await response.text();
      res.set("Content-Type", "text/xml");
      res.send(xml);
    } catch (error) {
      console.error("XML Proxy error:", error);
      res.status(500).json({ error: "Failed to fetch stock XML" });
    }
  });
  app2.post("/api/consultor", async (req, res) => {
    try {
      const resultado = await processConsultorMessage(req.body ?? {});
      res.json({ ok: true, ...resultado });
    } catch (error) {
      console.error("Consultor API error:", error);
      res.status(500).json({ ok: false, error: "Erro no Consultor Manos" });
    }
  });
  app2.post("/api/consultor/lead", async (req, res) => {
    try {
      const body = req.body ?? {};
      const response = await fetch("https://n8n.drivvoo.com/webhook/veiculosnatrocadg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok, protocolo: `DG-${Date.now().toString().slice(-6)}` });
    } catch (error) {
      console.error("Consultor lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Erro ao registrar lead do consultor" });
    }
  });
  const LEAD_WEBHOOKS = {
    Compra: process.env.N8N_WEBHOOK_COMPRA || "https://n8n.drivvoo.com/webhook/veiculosnatrocadg",
    Venda: process.env.N8N_WEBHOOK_VENDA || "https://n8n.drivvoo.com/webhook/veiculosnatrocadg",
    Financiamento: process.env.N8N_WEBHOOK_FINANCIAMENTO || "https://n8n.drivvoo.com/webhook/veiculosnatrocadg"
  };
  app2.post("/api/leads", async (req, res) => {
    try {
      const body = req.body ?? {};
      const leadType = String(body.lead_type || "");
      const name = String(body.name || "").trim();
      const phone = normalizePhone(body.phone ?? "");
      if (!LEAD_WEBHOOKS[leadType]) {
        return res.status(400).json({ ok: false, error: "lead_type inv\xE1lido" });
      }
      if (!name || phone.length < 10) {
        return res.status(400).json({ ok: false, error: "Nome e WhatsApp s\xE3o obrigat\xF3rios" });
      }
      const stage = body.stage === "completo" ? "completo" : "parcial";
      const atribuicao = body.atribuicao ?? {};
      const details = body.details ?? {};
      const qualificacao = calcularScore({
        lead_type: leadType,
        phone,
        cidade: String(details.cidade ?? ""),
        canal: atribuicao.canal,
        details
      });
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
        cidade: String(details.cidade ?? "") || null
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
        server_received_at: (/* @__PURE__ */ new Date()).toISOString(),
        user_agent: String(req.headers["user-agent"] || "").slice(0, 300)
      };
      const response = await fetch(LEAD_WEBHOOKS[leadType], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        console.error(`Lead webhook respondeu ${response.status} para ${leadType}`);
        return res.status(502).json({ ok: false, error: "Falha ao entregar o lead" });
      }
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
      if (stage === "completo" && body.event_id && !ambienteDeTeste(req)) {
        const eventoMeta = {
          eventName: "Lead",
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
          contentIds: details.id_veiculo ? [String(details.id_veiculo)] : void 0,
          contentName: details.nome_veiculo ? String(details.nome_veiculo) : void 0
        };
        void enviarEventoCapi(eventoMeta);
        enviarLeadQualificado(qualificacao, eventoMeta);
        void enviarEventoOpenAiAds({
          eventName: "lead_created",
          eventId: String(body.event_id),
          phone,
          city: String(details.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          oppref: atribuicao.oppref ?? null,
          value: Math.round((Number(details.valor_veiculo) || 0) * (qualificacao.score / 100))
        });
      }
      res.json({ ok: true, lead_id: body.lead_id ?? null, score: qualificacao.score, faixa: qualificacao.faixa });
    } catch (error) {
      console.error("Lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Falha ao entregar o lead" });
    }
  });
  app2.post("/api/bolao/lead", async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.whatsapp ?? req.body?.telefone ?? "");
      const codigo = generateOtp();
      if (phone) {
        otpStore.set(phone, { code: codigo, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
      }
      const response = await fetch("https://n8n.drivvoo.com/webhook/f3f66db5-444d-4ba0-a403-3584c432cf23", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req.body, codigo })
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Webhook lead proxy error:", error);
      res.status(500).json({ error: "Failed to forward lead to webhook" });
    }
  });
  app2.post("/api/bolao/verify", (req, res) => {
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
  app2.post("/api/bolao/palpite", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2ed8336e-1a2a-4681-bf68-3c844c665f2d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Webhook palpite proxy error:", error);
      res.status(500).json({ error: "Failed to forward palpite to webhook" });
    }
  });
  app2.post("/api/bolao/finalizar", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2196b31c-775d-4d8d-861d-ea65faf321f6", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Webhook finalizar proxy error:", error);
      res.status(500).json({ error: "Failed to forward finalizar to webhook" });
    }
  });
  const PLACA_TOKEN = process.env.PLACA_TOKEN || "97e59dd0a4790f25a020ca4623f9a902";
  app2.post("/api/vendas/lead", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2ea982be-39f1-4224-b378-c45dee5230c7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Vendas lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward vendas lead" });
    }
  });
  app2.post("/api/repasse/lead", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/42d8e1c7-83ec-40b2-a646-ec363cf88c2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Repasse lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward repasse lead" });
    }
  });
  app2.post("/api/repasse/cadastro", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/7a146026-4b40-447d-a49d-0853ac749f26", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Repasse cadastro proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward repasse cadastro" });
    }
  });
  app2.get("/api/placa/:placa", async (req, res) => {
    try {
      const placa = String(req.params.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
      if (!/^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(placa)) {
        return res.status(200).json({ ok: false, error: "Placa inv\xE1lida. Use o formato ABC1D23 ou ABC1234." });
      }
      const r = await fetch(`https://wdapi2.com.br/consulta/${placa}/${PLACA_TOKEN}`);
      const data = await r.json().catch(() => null);
      if (!data || data.message || !data.marca && !data.MARCA) {
        return res.status(200).json({ ok: false, error: "N\xE3o encontramos os dados dessa placa. Voc\xEA pode seguir sem ela." });
      }
      let fipeValor = "";
      let versaoFipe = "";
      const fipeList = data?.fipe?.dados;
      if (Array.isArray(fipeList) && fipeList.length) {
        const best = [...fipeList].sort((a, b) => (b?.score || 0) - (a?.score || 0))[0];
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
        logo: data.logo || ""
      };
      res.json({ ok: true, veiculo });
    } catch (error) {
      console.error("Placa lookup error:", error);
      res.status(200).json({ ok: false, error: "Erro ao consultar a placa. Voc\xEA pode seguir sem ela." });
    }
  });
  app2.post("/api/vendas/finalizar", async (req, res) => {
    try {
      const body = req.body ?? {};
      const atribuicao = body.atribuicao ?? {};
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
          marca: body.marca ?? null
        }
      });
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
        cidade: String(body.cidade ?? "") || null
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
          server_received_at: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
      if (body.event_id && !ambienteDeTeste(req)) {
        const eventoMeta = {
          eventName: "Lead",
          eventId: String(body.event_id),
          phone: String(body.telefone ?? ""),
          firstName: String(body.nome ?? ""),
          city: String(body.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          ...cookiesMeta(req, atribuicao),
          value: Math.round((Number(body.valor_desejado) || 0) * (qualificacao.score / 100)),
          contentName: [body.marca, body.modelo].filter(Boolean).join(" ") || void 0,
          sourceUrl: "https://manosveiculoscompra.com/vendasrapidas"
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
          sourceUrl: "https://manosveiculoscompra.com/vendasrapidas"
        });
      }
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Vendas finalizar proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward vendas finalizar" });
    }
  });
  app2.get("/robots.txt", (_req, res) => {
    res.set("Content-Type", "text/plain").send(renderRobots());
  });
  app2.get("/sitemap.xml", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "application/xml").send(renderSitemap(vehicles));
    } catch (err) {
      console.error("sitemap error:", err);
      res.status(500).send("error");
    }
  });
  app2.get("/feed/vehicles.json", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "application/json").json(montarProdutos2(vehicles));
    } catch (err) {
      console.error("feed error:", err);
      res.status(500).json({ error: "Failed to generate vehicle feed" });
    }
  });
  app2.get("/sobre", (_req, res) => {
    res.set("Content-Type", "text/html; charset=utf-8").set("Cache-Control", "public, max-age=3600").send(renderAbout());
  });
  app2.get("/perguntas-frequentes", (_req, res) => {
    res.set("Content-Type", "text/html; charset=utf-8").set("Cache-Control", "public, max-age=3600").send(renderFAQ());
  });
  app2.get("/politica-de-privacidade", (_req, res) => {
    res.set("Content-Type", "text/html; charset=utf-8").set("Cache-Control", "public, max-age=3600").send(renderPrivacy());
  });
  app2.get(["/leads-dg", "/leads-manos"], basicAuth("Painel DG Autom\xF3veis"), async (_req, res) => {
    try {
      const linhas = await lerScores(500);
      res.set("Content-Type", "text/html; charset=utf-8").set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow").send(renderLeadsPanel(linhas));
    } catch (err) {
      console.error("leads panel error:", err);
      res.status(500).send("error");
    }
  });
  app2.get("/api/health/tracking", async (_req, res) => {
    const scores = await diagnosticoScores();
    res.json({
      meta_capi: capiConfigurado() ? "configurado" : "sem META_CAPI_TOKEN",
      meta_pixel_catalogo: process.env.META_PIXEL_ID ? PIXEL_ID : `${PIXEL_ID} (default)`,
      meta_pixel_funil: (() => {
        const funil = pixelDoFunil();
        if (!funil) return "dist/index.html n\xE3o encontrado \u2014 rodando sem build?";
        if (funil === PIXEL_ID) return "igual ao servidor";
        return `DIVERGENTE \u2014 funil ${funil}, servidor ${PIXEL_ID}. Defina VITE_META_PIXEL_ID igual a META_PIXEL_ID e republique`;
      })(),
      meta_venda_confirmada: process.env.META_WEBHOOK_SECRET ? "configurado" : "sem META_WEBHOOK_SECRET",
      // Enquanto o catálogo for alimentado por terceiro, o id do produto não é
      // o nosso e o mapeamento acima é obrigatório. Apontar o catálogo para
      // este feed torna o mapeamento desnecessário — por isso a URL aparece
      // aqui, ao lado do sintoma que ela resolve.
      meta_catalogo_feed: {
        veiculos: `${SITE_URL}/feeds/meta/veiculos.csv`,
        produtos: `${SITE_URL}/feeds/meta/produtos.csv`
      },
      meta_catalogo_mapping: mapeamentoConfigurado() ? "configurado" : "sem META_CATALOG_ACCESS_TOKEN/SUPABASE_SERVICE_ROLE_KEY \u2014 eventos saem com o id da Altimus",
      openai_ads_capi: openAiAdsConfigurado() ? "configurado" : "sem OPENAI_ADS_API_KEY",
      // Tabela quebrada e tabela vazia pedem ações opostas — conserto de RLS
      // versus falta de tráfego. Antes as duas apareciam na mesma frase e o
      // diagnóstico mandava procurar defeito onde não havia.
      lead_scores: !scores.acessivel ? `INACESS\xCDVEL (${scores.erro}) \u2014 confira a tabela e a RLS` : scores.total ? `gravando \u2014 ${scores.total} registro(s), \xFAltimo em ${scores.ultimo}` : "tabela ok e grav\xE1vel, por\xE9m nenhum lead registrado at\xE9 agora",
      webhooks_n8n: {
        compra: LEAD_WEBHOOKS.Compra.includes("n8n.drivvoo.com") ? "produ\xE7\xE3o" : "sobrescrito",
        venda: LEAD_WEBHOOKS.Venda.includes("n8n.drivvoo.com") ? "produ\xE7\xE3o" : "sobrescrito"
      }
    });
  });
  const EVENTOS_OPENAI = /* @__PURE__ */ new Set(["whatsapp", "telefone"]);
  const EVENTOS_META = {
    catalogo_addtocart: "AddToCart",
    catalogo_contato: "Contact"
  };
  app2.post("/api/ads/conversao", (req, res) => {
    try {
      const body = req.body ?? {};
      const evento = String(body.evento || "");
      const eventId = String(body.event_id || "");
      const paraOpenAi = EVENTOS_OPENAI.has(evento);
      const nomeMeta = EVENTOS_META[evento];
      const paraMeta = Boolean(nomeMeta);
      if (!paraOpenAi && !paraMeta || !eventId) {
        return res.status(400).json({ ok: false });
      }
      if (ambienteDeTeste(req)) return res.status(204).end();
      const atribuicao = body.atribuicao ?? {};
      if (paraOpenAi) {
        void enviarEventoOpenAiAds({
          eventName: "custom",
          customEventName: evento,
          eventId,
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          oppref: atribuicao.oppref ?? null,
          sourceUrl: typeof body.source_url === "string" ? body.source_url : void 0
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
          contentIds: body.vehicle_id ? [String(body.vehicle_id)] : void 0,
          contentName: typeof body.vehicle_name === "string" ? body.vehicle_name : void 0,
          sourceUrl: typeof body.source_url === "string" ? body.source_url : void 0
        });
      }
      res.status(204).end();
    } catch (err) {
      console.error("espelho de conversao falhou:", err);
      res.status(204).end();
    }
  });
  app2.post("/api/meta/venda-confirmada", express2.json(), async (req, res) => {
    const segredo = process.env.META_WEBHOOK_SECRET || "";
    if (!segredo) {
      return res.status(503).json({ ok: false, error: "META_WEBHOOK_SECRET n\xE3o configurado" });
    }
    if (req.headers["x-webhook-secret"] !== segredo) {
      return res.status(401).json({ ok: false });
    }
    try {
      const body = req.body ?? {};
      const eventId = String(body.event_id || `venda_${Date.now()}`);
      const placa = typeof body.placa === "string" ? body.placa : "";
      const vehicleId = body.vehicle_id ? String(body.vehicle_id) : void 0;
      const doMapa = placa ? await contentIdParaVenda(placa) : null;
      const contentId = doMapa ? doMapa.contentId ?? void 0 : vehicleId;
      const aviso = doMapa && !doMapa.contentId ? `venda sem produto do cat\xE1logo (${doMapa.motivo}) \u2014 confira a placa em vehicle_meta_mapping` : !placa ? "mande `placa` para casar a venda com o cat\xE1logo da Meta" : void 0;
      if (aviso) console.warn(`venda-confirmada: ${aviso} (event_id ${eventId})`);
      void enviarEventoCapi({
        eventName: "Purchase",
        eventId,
        // A venda foi fechada no CRM, não numa página do site.
        actionSource: "system_generated",
        phone: typeof body.phone === "string" ? body.phone : void 0,
        firstName: typeof body.name === "string" ? body.name : void 0,
        city: typeof body.city === "string" ? body.city : void 0,
        email: typeof body.email === "string" ? body.email : void 0,
        // O CRM guardou este id no momento da captura do lead; é o que liga a
        // venda de hoje à visita de semanas atrás.
        externalId: typeof body.external_id === "string" ? body.external_id : void 0,
        value: Number(body.value) || 0,
        currency: "BRL",
        contentIds: contentId ? [contentId] : void 0,
        contentName: typeof body.vehicle_name === "string" ? body.vehicle_name : void 0
      });
      res.status(200).json({ ok: true, content_id: contentId ?? null, aviso });
    } catch (err) {
      console.error("venda-confirmada falhou:", err);
      res.status(500).json({ ok: false });
    }
  });
  app2.post("/api/internal/sync-catalog-mapping", async (req, res) => {
    const segredo = process.env.INTERNAL_SYNC_SECRET || "";
    if (!segredo) {
      return res.status(503).json({ ok: false, error: "INTERNAL_SYNC_SECRET n\xE3o configurado" });
    }
    if (String(req.headers["x-internal-secret"] || "") !== segredo) {
      return res.status(401).json({ ok: false });
    }
    try {
      const vehicles = await getVehicles();
      const resumo = await syncCatalogMapping(
        vehicles.map((v) => ({ id: v.id, placa: v.placa, title: v.title, price: v.price }))
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
        revisar: resumo.results.filter((r) => r.needsReview || r.confidence === "unmatched")
      });
    } catch (err) {
      console.error("sync-catalog-mapping falhou:", err);
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  app2.get("/feeds/openai/products.parquet", async (req, res) => {
    try {
      const vehicles = await getVehicles();
      const produtos = montarProdutos(vehicles);
      if (req.query.preview) {
        return res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow").json({
          total_estoque: vehicles.length,
          total_no_feed: produtos.length,
          descartados_sem_preco_ou_foto: vehicles.length - produtos.length,
          produtos
        });
      }
      const parquet = produtosParaParquet(produtos);
      res.set("Content-Type", "application/vnd.apache.parquet").set("Content-Disposition", 'attachment; filename="products.parquet"').set("Content-Length", String(parquet.length)).set("Cache-Control", "public, max-age=600").set("X-Robots-Tag", "noindex, nofollow").send(parquet);
    } catch (err) {
      console.error("openai feed error:", err);
      res.status(500).json({ error: "failed to build feed" });
    }
  });
  function responderFeedMeta(res, nomeArquivo, csv) {
    res.set("Content-Type", "text/csv; charset=utf-8").set("Content-Disposition", `inline; filename="${nomeArquivo}"`).set("Cache-Control", "public, max-age=600").set("X-Robots-Tag", "noindex, nofollow").send(csv);
  }
  app2.get("/feeds/meta/veiculos.csv", async (req, res) => {
    try {
      const vehicles = await getVehicles();
      const linhas = montarVeiculos(vehicles);
      if (req.query.preview) {
        return res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow").json({
          schema: "vehicles (an\xFAncios de invent\xE1rio automotivo)",
          // Prova de que o arquivo não é estático: muda a cada requisição.
          // O navegador baixa o .csv em vez de exibir (é o que ele faz com
          // text/csv), então esta é a janela para conferir o conteúdo — e o
          // horário sobe a cada F5.
          gerado_em: (/* @__PURE__ */ new Date()).toISOString(),
          total_estoque: vehicles.length,
          total_no_feed: linhas.length,
          descartados_sem_preco_ou_foto: vehicles.length - linhas.length,
          veiculos: linhas
        });
      }
      responderFeedMeta(res, "manos-veiculos.csv", veiculosParaCsv(linhas));
    } catch (err) {
      console.error("meta feed (veiculos) error:", err);
      res.status(500).json({ error: "failed to build feed" });
    }
  });
  app2.get("/feeds/meta/produtos.csv", async (req, res) => {
    try {
      const vehicles = await getVehicles();
      const produtos = montarProdutos2(vehicles);
      if (req.query.preview) {
        return res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow").json({
          schema: "products (cat\xE1logo de e-commerce)",
          gerado_em: (/* @__PURE__ */ new Date()).toISOString(),
          total_estoque: vehicles.length,
          total_no_feed: produtos.length,
          descartados_sem_preco_ou_foto: vehicles.length - produtos.length,
          produtos
        });
      }
      responderFeedMeta(res, "manos-produtos.csv", produtosParaCsv(produtos));
    } catch (err) {
      console.error("meta feed (produtos) error:", err);
      res.status(500).json({ error: "failed to build feed" });
    }
  });
  app2.get("/llms.txt", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "text/plain; charset=utf-8").send(renderLlms(vehicles));
    } catch (err) {
      console.error("llms.txt error:", err);
      res.status(500).send("error");
    }
  });
  app2.get("/estoque", async (req, res, next) => {
    const accept = String(req.headers.accept || "");
    const ua = String(req.headers["user-agent"] || "").toLowerCase();
    const isBot = /bot|google|search|crawler|spider|perplexity|gptbot/i.test(ua);
    if (!isBot && accept.includes("text/html") && process.env.NODE_ENV !== "production") {
      return next();
    }
    try {
      const todos = await getVehicles();
      const filtro = {
        faixa: typeof req.query.faixa === "string" ? req.query.faixa : void 0,
        marca: typeof req.query.marca === "string" ? req.query.marca : void 0
      };
      const vehicles = aplicarFiltro(todos, filtro);
      res.set("Content-Type", "text/html; charset=utf-8").set("Cache-Control", "public, max-age=600").send(renderCatalog(vehicles, filtro, todos));
    } catch (err) {
      console.error("catalog error:", err);
      res.status(500).send("error");
    }
  });
  app2.get("/estoque/:slug", async (req, res, next) => {
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
        return res.status(410).set("Content-Type", "text/html; charset=utf-8").send(renderSold(req.params.slug, findSimilar(vehicles, req.params.slug)));
      }
      res.set("Content-Type", "text/html; charset=utf-8").set("Cache-Control", "public, max-age=600").send(renderVehicle(vehicle));
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
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = path2.resolve(process.cwd(), "dist");
    const sistemaDist2 = path2.resolve(distPath, "sistema");
    if (fs2.existsSync(sistemaDist2)) {
      app2.use("/sistema", express2.static(sistemaDist2));
      app2.get(["/sistema", "/sistema/*"], (_req, res) => {
        const sistemaHtml = path2.join(sistemaDist2, "index.html");
        if (fs2.existsSync(sistemaHtml)) {
          return res.sendFile(sistemaHtml);
        }
        res.status(404).send("Sistema Altimus index n\xE3o encontrado.");
      });
    }
    if (fs2.existsSync(distPath)) {
      app2.use(express2.static(distPath));
    }
    app2.get("*", async (req, res) => {
      const rootHtml = path2.join(distPath, "index.html");
      if (fs2.existsSync(rootHtml)) {
        return res.sendFile(rootHtml);
      }
      try {
        const todos = await getVehicles();
        const vehicles = aplicarFiltro(todos, {});
        return res.set("Content-Type", "text/html; charset=utf-8").send(renderCatalog(vehicles, {}, todos));
      } catch (err) {
        return res.status(200).send("<!DOCTYPE html><html><head><title>DG Autom\xF3veis</title></head><body><h1>DG Autom\xF3veis</h1><p>Sistema inicializado com sucesso.</p></body></html>");
      }
    });
  }
  app2.listen(PORT2, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT2}`);
  });
}
startServer();
