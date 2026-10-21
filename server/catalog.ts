// ---------------------------------------------------------------------------
// AEO/SEO catalog (server-rendered) for DG Automóveis.
//
// Goal: give AI answer engines (GPTBot, ClaudeBot, PerplexityBot, Google) and
// classic crawlers fully-rendered HTML + JSON-LD they can read WITHOUT running
// JavaScript. The React app is a client-rendered lead funnel and is invisible
// to those bots; these routes are the indexable surface.
//
// Source of truth is the live Altimus XML feed (same one the funnel proxies).
// Everything is generated on the fly with a short in-memory cache.
// ---------------------------------------------------------------------------

import { aplicarMapeamento } from './catalogSync';
import { PIXEL_ID } from './meta';

export const SITE_URL = 'https://dgautomoveis.com.br';

const OPENAI_ADS_PIXEL_ID =
  process.env.VITE_OPENAI_ADS_PIXEL_ID || process.env.OPENAI_ADS_PIXEL_ID || '';

const META_PIXEL_ID = PIXEL_ID;
export const DEFAULT_DG_FEED_URL = 'http://localhost:3333/api/estoquejson?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14';
const FEED_URL = process.env.DG_FEED_URL || DEFAULT_DG_FEED_URL;

export const DEALER = {
  name: 'DG Automóveis',
  legalName: 'DG Automóveis',
  url: SITE_URL,
  mainSite: 'https://dgautomoveis.com.br',
  logo: '/logo-dg.png',
  telephone: '+55-47-98916-9598',
  whatsapp: '5547989169598',
  street: 'Rua Dom Pedro II, 461 - Canoas',
  city: 'Rio do Sul',
  region: 'SC',
  postalCode: '89164-138',
  country: 'BR',
  lat: -27.2207243,
  lng: -49.6539853,
  areaServed: 'Alto Vale do Itajaí, Santa Catarina',
  foundingDate: '2020',
  ratingValue: 4.9,
  reviewCount: 250,
  instagram: 'https://www.instagram.com/dgautomoveis__/',
  facebook: 'https://www.instagram.com/dgautomoveis__/',
  maps: 'https://www.google.com/maps/search/?api=1&query=DG+Automoveis+Rua+Dom+Pedro+II+461+Rio+do+Sul+SC',
  services: [
    'Venda de carros populares e exclusividades',
    'Avaliação e compra do seu usado',
    'Troca de veículos com troco na troca',
    'Financiamento de veículos em até 60x',
  ],
};

export interface FeedVehicle {
  id: string;
  slug: string;
  title: string;
  brand: string;
  /**
   * `<tipo>` da Altimus: 1 = carro, 4 = moto. O feed da Meta precisa disto
   * porque o catálogo de veículos não tem carroceria de moto — sem o tipo, uma
   * Biz entraria como hatch (ver server/metaFeed.ts).
   */
  tipo: string;
  year: string;
  price: number;
  priceFormatted: string;
  km: string;
  kmNumber: number;
  color: string;
  fuel: string;
  transmission: string;
  options: string[];
  images: string[];
  description: string;
  /** Chave estável entre Altimus, catálogo da Meta e CRM. */
  placa: string;
  /**
   * content_id do catálogo da Meta, quando o mapeamento já resolveu esta placa
   * (ver server/catalogSync.ts). Ausente = manda o id da Altimus, como antes.
   */
  metaContentId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function escHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Safe to embed inside <script type="application/ld+json">
function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatKm(km: number): string {
  return `${km.toLocaleString('pt-BR')} km`;
}

function detectTransmission(description: string, options: string[]): string {
  const hay = (description + ' ' + options.join(' ')).toLowerCase();
  if (/\baut/.test(hay) || /autom[aá]tic/.test(hay) || /cvt|tiptronic|s-tronic|dsg/.test(hay))
    return 'Automático';
  if (/\bmanual\b|\bmec[aâ]nic/.test(hay)) return 'Manual';
  return '';
}

// ---------------------------------------------------------------------------
// Feed fetching + parsing (with cache)
// ---------------------------------------------------------------------------

let cache: { at: number; vehicles: FeedVehicle[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function parseFeed(raw: string): FeedVehicle[] {
  const trimmed = (raw || '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : (data.veiculos || []);
      const vehicles: FeedVehicle[] = list.map((v: any) => {
        const brandName = (v.marca || '').trim() || 'DG Automóveis';
        const modelName = (v.modelo || '').trim();
        const versaoName = (v.versao || '').trim();
        const fullName = `${brandName} ${modelName} ${versaoName}`.trim() || 'Veículo DG Automóveis';
        const desc = (v.descricao || v.observacao_anuncio || v.observacao || fullName).trim();
        const price = Number(v.valorVenda || v.valor || v.preco || 0);
        const kmNumber = Number(v.km || 0);
        const ops = Array.isArray(v.opcionais) ? v.opcionais : [];
        const imgs = Array.isArray(v.fotos) && v.fotos.length > 0
          ? v.fotos
          : (Array.isArray(v.images) && v.images.length > 0 ? v.images : (v.foto ? [v.foto] : []));
        const anoFormatado = (v.anoFabricacao && v.anoModelo) 
          ? `${v.anoFabricacao}/${v.anoModelo}` 
          : String(v.anoModelo || v.anoFabricacao || v.ano || '');

        return {
          id: String(v.id),
          slug: `${slugify(fullName)}-${v.id}`,
          title: fullName,
          brand: brandName,
          tipo: String(v.tipo || '1'),
          year: anoFormatado,
          price,
          priceFormatted: price > 0 ? formatBRL(price) : 'Consulte',
          km: formatKm(kmNumber),
          kmNumber,
          color: v.cor || '',
          fuel: v.combustivel || '',
          transmission: v.cambio || detectTransmission(desc, ops),
          options: ops,
          images: imgs,
          description: desc,
          placa: (v.placa || '').toUpperCase(),
        };
      });
      return ordenarPorRecencia(vehicles);
    } catch (e) {
      console.error('Error parsing JSON feed, falling back to XML:', e);
    }
  }

  const blocks = raw
    .split(/<veiculo>/i)
    .slice(1)
    .map((b) => b.split(/<\/veiculo>/i)[0]);

  const vehicles: FeedVehicle[] = [];

  for (const block of blocks) {
    const getTag = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? decodeEntities(m[1]) : '';
    };
    const getAll = (tag: string): string[] => {
      const out: string[] = [];
      const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(block)) !== null) out.push(decodeEntities(m[1]));
      return out.filter(Boolean);
    };

    const id = getTag('id');
    const description = getTag('descricao');
    if (!id || !description) continue;

    const price = parseFloat((getTag('valor') || '0').replace(',', '.')) || 0;
    const kmNumber = parseInt((getTag('km') || '0').replace(/\D/g, ''), 10) || 0;
    const options = getAll('opcional');
    const images = getAll('imagem');
    const brand = description.split(/\s|-/)[0] || 'DG Automóveis';

    vehicles.push({
      id,
      slug: `${slugify(description)}-${id}`,
      title: description,
      brand,
      tipo: getTag('tipo'),
      year: getTag('ano'),
      price,
      priceFormatted: price > 0 ? formatBRL(price) : 'Consulte',
      km: formatKm(kmNumber),
      kmNumber,
      color: getTag('cor'),
      fuel: getTag('combustivel'),
      transmission: detectTransmission(description, options),
      options,
      images,
      description,
      placa: getTag('placa').toUpperCase(),
    });
  }

  return ordenarPorRecencia(vehicles);
}

/**
 * Mais recentes primeiro.
 *
 * O feed da Altimus não traz nenhum campo de data (as tags são id, loja, tipo,
 * marca, modelo, versao, valor, ano, descricao, km, cor, combustivel,
 * opcionais, fotos, placa, observacao) e também não vem ordenado. O `id` é
 * sequencial no sistema deles, então id maior = cadastrado depois — é o melhor
 * sinal de recência disponível.
 *
 * `ano` NÃO serve para isso: um carro 2015 que entrou no pátio ontem é novidade
 * na loja, e um 2022 parado há seis meses não é.
 */
export function ordenarPorRecencia<T extends { id: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return String(b.id).localeCompare(String(a.id), 'pt-BR', { numeric: true });
  });
}

export const DG_DEFAULT_VEHICLES: FeedVehicle[] = [];

export async function getVehicles(): Promise<FeedVehicle[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS && cache.vehicles.length > 0) return cache.vehicles;

  const urlsToTry = [
    FEED_URL,
    'http://127.0.0.1:3333/api/estoquejson?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14',
    `http://127.0.0.1:${process.env.PORT || 3030}/api/estoquejson?estoque=20706bbe-4a09-4a03-8e2a-1f47e73d7a14`
  ];

  for (const url of Array.from(new Set(urlsToTry))) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;
      const text = await res.text();
      const vehicles = await aplicarMapeamento(parseFeed(text));
      if (vehicles.length > 0) {
        cache = { at: Date.now(), vehicles };
        return vehicles;
      }
    } catch {
      // Tenta próximo endpoint
    }
  }

  return cache?.vehicles ?? [];
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

function autoDealerNode() {
  return {
    '@type': 'AutoDealer',
    '@id': `${SITE_URL}/#dealer`,
    name: DEALER.name,
    description: `Concessionária de carros seminovos em ${DEALER.city}/${DEALER.region}, atuando desde ${DEALER.foundingDate}. Compra, venda, troca e financiamento no ${DEALER.areaServed}.`,
    url: DEALER.url,
    logo: DEALER.logo,
    image: DEALER.logo,
    telephone: DEALER.telephone,
    priceRange: 'R$$',
    foundingDate: DEALER.foundingDate,
    address: {
      '@type': 'PostalAddress',
      streetAddress: DEALER.street,
      addressLocality: DEALER.city,
      addressRegion: DEALER.region,
      postalCode: DEALER.postalCode,
      addressCountry: DEALER.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: DEALER.lat, longitude: DEALER.lng },
    hasMap: DEALER.maps,
    areaServed: DEALER.areaServed,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: DEALER.ratingValue,
      reviewCount: DEALER.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '19:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '08:00',
        closes: '13:00',
      },
    ],
    makesOffer: DEALER.services.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s },
    })),
    knowsAbout: ['Carros seminovos', 'Financiamento de veículos', 'Avaliação de usados', 'Troca de carros'],
    sameAs: [DEALER.mainSite, DEALER.maps, DEALER.instagram, DEALER.facebook],
  };
}

function vehicleSchema(v: FeedVehicle) {
  const url = `${SITE_URL}/estoque/${v.slug}`;
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: v.title,
    description: `${v.title}. Seminovo revisado disponível na DG Automóveis em ${DEALER.city}/${DEALER.region}.`,
    url,
    brand: { '@type': 'Brand', name: v.brand },
    vehicleModelDate: v.year || undefined,
    itemCondition: 'https://schema.org/UsedCondition',
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.kmNumber, unitCode: 'KMT' },
    image: v.images.length ? v.images : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: v.price || undefined,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      url,
      seller: autoDealerNode(),
    },
  };
  if (v.color) node.color = v.color;
  if (v.fuel) node.fuelType = v.fuel;
  if (v.transmission) node.vehicleTransmission = v.transmission;
  return node;
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

const BASE_CSS = `
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

/**
 * Pixel do OpenAI Ads nas páginas do catálogo.
 *
 * Três coisas acontecem aqui, e nenhuma existia antes: o pixel inicializa,
 * a página de veículo reporta `contents_viewed`, e clique em WhatsApp/telefone
 * vira conversão — inclusive pelo servidor, via o mesmo `/api/ads/conversao`
 * que o funil usa, com o mesmo `event_id` deduplicando os dois caminhos.
 *
 * Sem o id no ambiente, devolve string vazia: nenhuma tag, nenhum erro.
 */
function medicaoScript(veiculo?: { id: string; nome: string; preco: number }): string {
  if (!OPENAI_ADS_PIXEL_ID) return '';

  // JSON dentro de <script> precisa ter o `<` escapado, senão um `</` no nome
  // do veículo fecharia a tag no meio.
  const dadosVeiculo = veiculo
    ? JSON.stringify({ id: veiculo.id, nome: veiculo.nome, preco: Math.round(veiculo.preco) }).replace(/</g, '\\u003c')
    : 'null';

  return `<script>
// Mesma guarda do index.html: servidor rodando em localhost não manda evento
// para o dataset de produção.
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))
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

  // Delegação: os CTAs são links renderizados no servidor, então um listener
  // no documento cobre todos, inclusive os cards do catálogo.
  d.addEventListener("click", function(ev){
    var a = ev.target && ev.target.closest ? ev.target.closest("a") : null;
    if(!a || !a.href) return;
    var canal = a.href.indexOf("wa.me") > -1 ? "whatsapp"
              : a.href.indexOf("tel:") === 0 ? "telefone" : null;
    if(!canal) return;

    var eid = novoId();
    w.oaiq("measure","custom",{type:"custom"},{event_id:eid,custom_event_name:canal});

    // sendBeacon sobrevive à navegação para fora; o servidor reenvia pela CAPI.
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

/**
 * Pixel da Meta nas páginas do catálogo (SSR).
 *
 * Espelha exatamente o que medicaoScript() já faz para o OpenAI Ads, e existe
 * pelo mesmo motivo: estas páginas são renderizadas fora do index.html, então
 * precisam carregar e disparar o pixel por conta própria. Sem isto, cliques em
 * anúncio de catálogo dinâmico da Meta — que abrem direto numa página de
 * veículo — e todo o tráfego orgânico do /estoque nunca disparavam
 * ViewContent/AddToCart, e o Gerenciador de Comércio reportava 0% de taxa de
 * correspondência e os 3 eventos como ausentes.
 *
 * `ViewContent` só client-side de propósito (mesmo raciocínio documentado em
 * RASTREAMENTO-OPENAI-ADS.md): a maior parte do tráfego bruto do /estoque é
 * crawler, e crawler não executa JS — então nunca dispara aqui. Mandar pelo
 * servidor contaria cada passagem de bot como visualização.
 *
 * `AddToCart` já sai também pelo servidor (Conversions API, server/meta.ts):
 * é clique humano — precisa de JS para acontecer — e é justamente o tipo de
 * evento que sumiria com um bloqueador de anúncio.
 *
 * SEM a tag `<noscript>` de propósito, ao contrário do index.html. Ela dispara
 * um PageView por carregamento de imagem, sem JS e portanto sem `_fbp` nem
 * `_fbc` — e estas páginas são a superfície mais visitada por crawler do site.
 * Cada passagem de bot virava um PageView de qualidade zero, que entra no
 * cálculo da correspondência como se fosse gente. Quem navega sem JS não é
 * público de anúncio; o pixel por JS cobre o tráfego humano inteiro.
 */
function metaPixelScript(
  veiculo?: { id: string; nome: string; preco: number; metaId?: string },
): string {
  if (!META_PIXEL_ID) return '';

  // `metaId` é o id do produto no catálogo da Meta; o id da Altimus é o
  // fallback para quem ainda não tem correspondência. O OpenAI Ads segue com o
  // id da Altimus (o feed dele é montado com esse número) — por isso os dois
  // scripts não compartilham o mesmo campo.
  const dadosVeiculo = veiculo
    ? JSON.stringify({
        id: veiculo.metaId || veiculo.id,
        nome: veiculo.nome,
        preco: Math.round(veiculo.preco),
      }).replace(/</g, '\\u003c')
    : 'null';

  return `<script>
// Mesma guarda do index.html: servidor rodando em localhost não manda evento
// para o dataset de produção.
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
// Mesmo cookie do funil (src/lib/visitante.ts): o visitante que chega pelo
// catálogo e converte no funil precisa ser a mesma pessoa para a Meta.
window.__manosVid = (function(){
  try {
    var m = document.cookie.match(/(?:^|;\s*)manos_vid=([^;]*)/);
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

  // Delegação: os CTAs ("Tenho interesse" e WhatsApp) carregam o veículo em
  // data-attributes — cobre tanto a página de um carro quanto os cards da
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

    // Clique de WhatsApp é contato de verdade, não só intenção de carrinho. O
    // evento vai separado, com id próprio: são dois acontecimentos distintos
    // para a Meta, e juntá-los num só faria a plataforma deduplicar um contra o
    // outro. "Tenho interesse" não conta — aquilo leva ao funil, não abre
    // conversa.
    var ehWhatsApp = (a.getAttribute("href") || "").indexOf("wa.me") > -1;
    var eidContato = ehWhatsApp ? novoId() : "";
    if(ehWhatsApp){
      fbq('track','Contact',{content_ids:[vid],content_type:'product',
        content_name:nome},{eventID:eidContato});
    }

    // sendBeacon sobrevive à navegação (WhatsApp sai do site); o servidor
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

function layout(opts: {
  title: string;
  description: string;
  canonical: string;
  jsonLdBlocks: string[];
  body: string;
  ogImage?: string;
  /** Sobrescreve a diretiva padrão — usado por páginas que não devem indexar. */
  robots?: string;
  /** Quando a página é de um veículo, dispara `contents_viewed` com ele. */
  veiculo?: { id: string; nome: string; preco: number; metaId?: string };
}): string {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // Mesma tag do index.html: a Meta pode conferir qualquer URL do domínio, e
    // /estoque é justamente a parte que ela mais rastreia.
    '<meta name="facebook-domain-verification" content="n91926e6jtyofyvpj8jgf2z68uasoe">',
    `<title>${escHtml(opts.title)}</title>`,
    `<meta name="description" content="${escHtml(opts.description)}">`,
    `<link rel="canonical" href="${escHtml(opts.canonical)}">`,
    `<meta name="robots" content="${escHtml(opts.robots ?? 'index,follow,max-image-preview:large')}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escHtml(DEALER.name)}">`,
    `<meta property="og:title" content="${escHtml(opts.title)}">`,
    `<meta property="og:description" content="${escHtml(opts.description)}">`,
    `<meta property="og:url" content="${escHtml(opts.canonical)}">`,
    opts.ogImage ? `<meta property="og:image" content="${escHtml(opts.ogImage)}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    `<style>${BASE_CSS}</style>`,
    ...opts.jsonLdBlocks.map(
      (b) => `<script type="application/ld+json">${b}</script>`
    ),
  ].join('\n');

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
    <a href="/sobre">A DG Automóveis</a>
    <a href="/perguntas-frequentes">Dúvidas</a>
  </nav>
</header>
<div class="wrap">
${opts.body}
</div>
<footer>
  <strong>${escHtml(DEALER.name)}</strong> — ${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}.<br>
  WhatsApp ${escHtml(DEALER.telephone)} • <a href="${DEALER.mainSite}">${DEALER.mainSite.replace('https://', '')}</a>
</footer>
</body>
</html>`;
}

// Faixas de preço do catálogo. Servidas como links (não JavaScript) para
// continuarem navegáveis por crawler e por quem está sem JS.
const FAIXAS: { chave: string; rotulo: string; min: number; max: number }[] = [
  { chave: 'ate-50k', rotulo: 'Até R$ 50 mil', min: 0, max: 50000 },
  { chave: '50k-100k', rotulo: 'R$ 50 a 100 mil', min: 50000, max: 100000 },
  { chave: 'acima-100k', rotulo: 'Acima de R$ 100 mil', min: 100000, max: Infinity },
];

export interface FiltroCatalogo {
  faixa?: string;
  marca?: string;
}

/** Marcas presentes no estoque, com a contagem, ordenadas por volume. */
function marcasDoEstoque(vehicles: FeedVehicle[]): { marca: string; total: number }[] {
  const contagem = new Map<string, number>();
  for (const v of vehicles) {
    const m = v.brand.trim();
    if (m) contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([marca, total]) => ({ marca, total }))
    .sort((a, b) => b.total - a.total || a.marca.localeCompare(b.marca));
}

export function aplicarFiltro(vehicles: FeedVehicle[], filtro: FiltroCatalogo): FeedVehicle[] {
  let out = vehicles;
  const faixa = FAIXAS.find((f) => f.chave === filtro.faixa);
  if (faixa) out = out.filter((v) => v.price > faixa.min && v.price <= faixa.max);
  if (filtro.marca) {
    const alvo = filtro.marca.toLowerCase();
    out = out.filter((v) => v.brand.toLowerCase() === alvo);
  }
  return out;
}

export function renderCatalog(
  vehicles: FeedVehicle[],
  filtro: FiltroCatalogo = {},
  todos: FeedVehicle[] = vehicles,
): string {
  const faixaAtiva = FAIXAS.find((f) => f.chave === filtro.faixa);
  const marcaAtiva = filtro.marca;
  const filtrado = Boolean(faixaAtiva || marcaAtiva);

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Estoque de seminovos — DG Automóveis',
    numberOfItems: vehicles.length,
    itemListElement: vehicles.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/estoque/${v.slug}`,
      name: v.title,
    })),
  };

  const chip = (rotulo: string, href: string, ativo: boolean) =>
    `<a class="chip${ativo ? ' on' : ''}" href="${escHtml(href)}">${escHtml(rotulo)}</a>`;

  const filtroFaixas = [
    chip('Todos os preços', '/estoque' + (marcaAtiva ? `?marca=${encodeURIComponent(marcaAtiva)}` : ''), !faixaAtiva),
    ...FAIXAS.map((f) =>
      chip(
        f.rotulo,
        `/estoque?faixa=${f.chave}` + (marcaAtiva ? `&marca=${encodeURIComponent(marcaAtiva)}` : ''),
        faixaAtiva?.chave === f.chave,
      ),
    ),
  ].join('\n');

  const filtroMarcas = [
    chip('Todas as marcas', '/estoque' + (faixaAtiva ? `?faixa=${faixaAtiva.chave}` : ''), !marcaAtiva),
    ...marcasDoEstoque(todos)
      .slice(0, 12)
      .map((m) =>
        chip(
          `${m.marca} (${m.total})`,
          `/estoque?marca=${encodeURIComponent(m.marca)}` + (faixaAtiva ? `&faixa=${faixaAtiva.chave}` : ''),
          marcaAtiva?.toLowerCase() === m.marca.toLowerCase(),
        ),
      ),
  ].join('\n');

  // Card com dois links em vez de um card-link só: cada carro passa a ter o CTA
  // ao lado do preço. Antes havia um único botão de WhatsApp no topo da página,
  // longe do carro que a pessoa estava olhando.
  const cards = vehicles
    .map(
      (v) => `
  <div class="card">
    <a href="/estoque/${escHtml(v.slug)}" class="card-media">
      ${v.images[0] ? `<img src="${escHtml(v.images[0])}" alt="${escHtml(v.title)}" loading="lazy">` : ''}
    </a>
    <div class="body">
      <h3><a href="/estoque/${escHtml(v.slug)}">${escHtml(v.title)}</a></h3>
      <div class="muted small">${escHtml(v.year)} • ${escHtml(v.km)}${v.fuel ? ' • ' + escHtml(v.fuel) : ''}</div>
      <div class="price">${escHtml(v.priceFormatted)}</div>
      <div class="card-actions">
        <a class="btn" href="${SITE_URL}/?id=${encodeURIComponent(v.id)}" data-vid="${escHtml(v.metaContentId || v.id)}" data-vname="${escHtml(v.title)}" data-vprice="${v.price || 0}">Tenho interesse</a>
        <a class="btn ghost" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Tenho interesse no ' + v.title)}" data-vid="${escHtml(v.metaContentId || v.id)}" data-vname="${escHtml(v.title)}" data-vprice="${v.price || 0}">WhatsApp</a>
      </div>
    </div>
  </div>`,
    )
    .join('\n');

  const titulo = marcaAtiva
    ? `${marcaAtiva} seminovos em ${DEALER.city}/${DEALER.region}`
    : faixaAtiva
      ? `Carros seminovos ${faixaAtiva.rotulo.toLowerCase()} em ${DEALER.city}/${DEALER.region}`
      : `Carros seminovos em ${DEALER.city}/${DEALER.region}`;

  const body = `
  <h1>${escHtml(titulo)}</h1>
  <p class="muted">${vehicles.length} ${vehicles.length === 1 ? 'veículo disponível' : 'veículos disponíveis'} no estoque da ${escHtml(DEALER.name)}, revenda no ${escHtml(DEALER.areaServed)}. Atualizado em tempo real.</p>
  <div class="filtros">
    <div class="filtro-linha"><b>Preço</b><div class="chips">${filtroFaixas}</div></div>
    <div class="filtro-linha"><b>Marca</b><div class="chips">${filtroMarcas}</div></div>
  </div>
  <a class="cta" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Vi o estoque no site e quero falar com um consultor.')}">Falar com consultor no WhatsApp</a>
  ${
    vehicles.length
      ? `<div class="grid">${cards}</div>`
      : `<div class="faq"><h3>Nenhum carro nesse filtro agora</h3><p>O estoque gira toda semana. <a href="/estoque">Ver o estoque completo</a> ou <a href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Procuro um carro que não vi no site.')}">falar com um consultor</a> — a gente procura um para você.</p></div>`
  }`;

  return layout({
    title: filtrado
      ? `${titulo} | ${DEALER.name}`
      : `Estoque de Seminovos em ${DEALER.city}/${DEALER.region} | ${DEALER.name}`,
    description: `Confira ${vehicles.length} carros seminovos revisados na ${DEALER.name}, em ${DEALER.city}/${DEALER.region}. Compra, troca e financiamento no Alto Vale do Itajaí.`,
    // Views filtradas apontam para /estoque e não indexam: evita conteúdo
    // duplicado competindo com a página principal do catálogo.
    canonical: `${SITE_URL}/estoque`,
    robots: filtrado ? 'noindex,follow' : undefined,
    ogImage: vehicles[0]?.images[0] || DEALER.logo,
    jsonLdBlocks: [jsonLd(autoDealerNode()), jsonLd(itemList)],
    body,
  });
}

export function renderVehicle(v: FeedVehicle): string {
  const canonical = `${SITE_URL}/estoque/${v.slug}`;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Estoque', item: `${SITE_URL}/estoque` },
      { '@type': 'ListItem', position: 2, name: v.title, item: canonical },
    ],
  };

  const specs = [
    v.year && `<span class="chip">Ano ${escHtml(v.year)}</span>`,
    v.km && `<span class="chip">${escHtml(v.km)}</span>`,
    v.fuel && `<span class="chip">${escHtml(v.fuel)}</span>`,
    v.transmission && `<span class="chip">${escHtml(v.transmission)}</span>`,
    v.color && `<span class="chip">Cor ${escHtml(v.color)}</span>`,
  ]
    .filter(Boolean)
    .join('\n');

  const gallery = v.images
    .slice(0, 12)
    .map((src) => `<img src="${escHtml(src)}" alt="${escHtml(v.title)}" loading="lazy">`)
    .join('\n');

  const opts = v.options.length
    ? `<h2>Opcionais</h2><ul class="opts">${v.options
        .map((o) => `<li>${escHtml(o)}</li>`)
        .join('')}</ul>`
    : '';

  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> › <span class="muted">${escHtml(v.title)}</span></nav>
  <h1>${escHtml(v.title)}</h1>
  <div class="price" style="font-size:26px">${escHtml(v.priceFormatted)}</div>
  <div class="specs">${specs}</div>
  <a class="cta" href="${SITE_URL}/?id=${encodeURIComponent(v.id)}" data-vid="${escHtml(v.metaContentId || v.id)}" data-vname="${escHtml(v.title)}" data-vprice="${v.price || 0}">Tenho interesse — receber proposta</a>
  &nbsp;
  <a class="cta alt" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Tenho interesse no ' + v.title + ' (' + canonical + ')')}" data-vid="${escHtml(v.metaContentId || v.id)}" data-vname="${escHtml(v.title)}" data-vprice="${v.price || 0}">WhatsApp</a>
  ${gallery ? `<h2>Fotos</h2><div class="gallery">${gallery}</div>` : ''}
  <h2>Sobre este veículo</h2>
  <p>${escHtml(v.title)} à venda na <strong>${escHtml(DEALER.name)}</strong>, em ${escHtml(DEALER.city)}/${DEALER.region}. Veículo seminovo${v.km ? ` com ${escHtml(v.km)}` : ''}${v.fuel ? `, motor ${escHtml(v.fuel)}` : ''}${v.transmission ? `, câmbio ${escHtml(v.transmission)}` : ''}. Aceitamos seu usado na troca e oferecemos financiamento.</p>
  ${opts}`;

  return layout({
    title: `${v.title} — ${v.priceFormatted} | ${DEALER.name}`,
    description: `${v.title} por ${v.priceFormatted} na ${DEALER.name}, ${DEALER.city}/${DEALER.region}.${v.km ? ' ' + v.km + '.' : ''} Compra, troca e financiamento.`,
    canonical,
    ogImage: v.images[0] || DEALER.logo,
    jsonLdBlocks: [jsonLd(vehicleSchema(v)), jsonLd(breadcrumb)],
    veiculo: { id: v.id, nome: v.title, preco: v.price, metaId: v.metaContentId },
    body,
  });
}

/**
 * Página de veículo já vendido.
 *
 * Antes, um slug que não batia caía no catch-all da SPA e devolvia a home do
 * quiz com status 200: para o comprador que clicou num carro específico no
 * Google era uma porta na cara, e para o Google era um soft-404 que corroía a
 * indexação do catálogo inteiro. Agora devolve 410 (Gone) com explicação e
 * alternativas reais — a intenção de compra é recuperada em vez de perdida.
 */
export function renderSold(slug: string, similares: FeedVehicle[]): string {
  const canonical = `${SITE_URL}/estoque`;

  const cards = similares
    .map(
      (v) => `
  <a class="card" href="/estoque/${escHtml(v.slug)}">
    ${v.images[0] ? `<img src="${escHtml(v.images[0])}" alt="${escHtml(v.title)}" loading="lazy">` : ''}
    <div class="body">
      <h3>${escHtml(v.title)}</h3>
      <div class="muted small">${escHtml(v.year)} • ${escHtml(v.km)}${v.fuel ? ' • ' + escHtml(v.fuel) : ''}</div>
      <div class="price">${escHtml(v.priceFormatted)}</div>
    </div>
  </a>`,
    )
    .join('\n');

  // O slug carrega a descrição do carro; vira um texto legível para a mensagem.
  const procurado = slug
    .replace(/-\d+$/, '')
    .replace(/-/g, ' ')
    .trim();

  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> › <span class="muted">Veículo vendido</span></nav>
  <h1>Esse carro já foi vendido</h1>
  <p class="muted">${procurado ? `O <strong>${escHtml(procurado)}</strong> saiu do nosso pátio.` : 'Esse veículo saiu do nosso pátio.'} O estoque gira toda semana — veja abaixo o que temos agora, ou fale com um consultor que a gente procura um parecido para você.</p>
  <a class="cta" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Vi que o ' + (procurado || 'carro') + ' já foi vendido. Vocês têm algo parecido?')}">Quero um parecido — falar no WhatsApp</a>
  &nbsp;
  <a class="cta alt" href="/estoque">Ver estoque completo</a>
  ${cards ? `<h2>Disponíveis agora</h2><div class="grid">${cards}</div>` : ''}`;

  return layout({
    title: 'Veículo vendido — veja o estoque atual | DG Automóveis',
    description: `Este veículo já foi vendido. Veja o estoque atual de seminovos da ${DEALER.name} em ${DEALER.city}/${DEALER.region}.`,
    canonical,
    ogImage: similares[0]?.images[0] || DEALER.logo,
    // noindex: a URL não deve mais disputar espaço no índice.
    robots: 'noindex,follow',
    jsonLdBlocks: [jsonLd(autoDealerNode())],
    body,
  });
}

/**
 * Escolhe substitutos para a página de vendido: mesma marca primeiro (o slug
 * começa pela descrição, então a primeira palavra costuma ser a marca), depois
 * completa com o restante do estoque.
 */
export function findSimilar(vehicles: FeedVehicle[], slug: string, limit = 3): FeedVehicle[] {
  const marca = slug.split('-')[0]?.toLowerCase() ?? '';
  const mesmaMarca = marca
    ? vehicles.filter((v) => v.brand.toLowerCase() === marca || v.slug.startsWith(marca + '-'))
    : [];
  const resto = vehicles.filter((v) => !mesmaMarca.includes(v));
  return [...mesmaMarca, ...resto].slice(0, limit);
}

// Conversational Q&A — the long-tail queries people ask AI assistants.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'A DG Automóveis é confiável?',
    a: `Sim. A ${DEALER.name} é uma concessionária de seminovos com loja física em ${DEALER.city}/${DEALER.region}, atuando desde ${DEALER.foundingDate}, com nota ${String(DEALER.ratingValue).replace('.', ',')} no Google em ${DEALER.reviewCount} avaliações. Todos os veículos passam por revisão antes da venda.`,
  },
  {
    q: 'Onde fica a DG Automóveis?',
    a: `A loja fica na ${DEALER.street}, ${DEALER.city}/${DEALER.region}, CEP ${DEALER.postalCode}. Atendemos clientes de todo o ${DEALER.areaServed}.`,
  },
  {
    q: 'Qual o horário de funcionamento da DG Automóveis?',
    a: 'Segunda a sexta das 8h às 19h (sem fechar ao meio-dia) e aos sábados das 8h às 13h.',
  },
  {
    q: 'A DG Automóveis aceita meu carro usado na troca?',
    a: 'Sim. Avaliamos o seu usado e aceitamos como parte do pagamento na compra de outro veículo, com avaliação justa e na hora.',
  },
  {
    q: 'A DG Automóveis faz financiamento de seminovos?',
    a: 'Sim. Trabalhamos com financiamento de veículos, simulação de parcelas e aprovação de crédito, inclusive com opções de entrada facilitada.',
  },
  {
    q: 'Como ver o estoque de carros da DG Automóveis?',
    a: `O estoque completo e atualizado em tempo real está em ${SITE_URL}/estoque, com fotos, preço, ano e quilometragem de cada veículo.`,
  },
  {
    q: 'Como falar com um consultor da DG Automóveis?',
    a: `Pelo WhatsApp ${DEALER.telephone} ou diretamente em ${SITE_URL}, onde você recebe uma proposta personalizada.`,
  },
];

export function renderAbout(): string {
  const canonical = `${SITE_URL}/sobre`;
  const schema = { '@context': 'https://schema.org', ...autoDealerNode() };

  const facts = [
    ['Avaliação no Google', `${String(DEALER.ratingValue).replace('.', ',')} ★ (${DEALER.reviewCount} avaliações)`],
    ['Desde', DEALER.foundingDate],
    ['Endereço', `${DEALER.street}, ${DEALER.city}/${DEALER.region}`],
    ['Horário', 'Seg a Sex 8h–19h • Sáb 8h–13h'],
    ['Atendemos', DEALER.areaServed],
    ['WhatsApp', DEALER.telephone],
  ]
    .map(([k, v]) => `<div class="fact"><b>${escHtml(k)}</b>${escHtml(v)}</div>`)
    .join('\n');

  const services = DEALER.services.map((s) => `<li>${escHtml(s)}</li>`).join('');

  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> › <span class="muted">A DG Automóveis</span></nav>
  <h1>DG Automóveis — concessionária de seminovos em ${escHtml(DEALER.city)}/${DEALER.region}</h1>
  <p class="muted">Desde ${escHtml(DEALER.foundingDate)}, a ${escHtml(DEALER.name)} é referência em carros seminovos no ${escHtml(DEALER.areaServed)}, com nota ${String(DEALER.ratingValue).replace('.', ',')} no Google em ${DEALER.reviewCount} avaliações.</p>
  <div class="facts">${facts}</div>
  <a class="cta" href="/estoque">Ver estoque de seminovos</a>
  &nbsp;
  <a class="cta alt" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Quero falar com um consultor da DG Automóveis.')}">WhatsApp</a>
  <h2>O que a DG Automóveis oferece</h2>
  <ul class="opts">${services}</ul>
  <h2>Sobre a DG Automóveis</h2>
  <p>A ${escHtml(DEALER.name)} é uma concessionária de veículos seminovos localizada em ${escHtml(DEALER.city)}, Santa Catarina, na ${escHtml(DEALER.street)}. Atuando desde ${escHtml(DEALER.foundingDate)}, atende compradores de todo o ${escHtml(DEALER.areaServed)} com compra, venda, troca e financiamento de carros. O estoque é atualizado em tempo real em <a href="/estoque">${SITE_URL}/estoque</a>.</p>`;

  return layout({
    title: `Sobre a DG Automóveis — Seminovos em ${DEALER.city}/${DEALER.region}`,
    description: `DG Automóveis: concessionária de seminovos em ${DEALER.city}/${DEALER.region} desde ${DEALER.foundingDate}, nota ${String(DEALER.ratingValue).replace('.', ',')} no Google (${DEALER.reviewCount} avaliações). Compra, troca e financiamento.`,
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [jsonLd(schema)],
    body,
  });
}

export function renderFAQ(): string {
  const canonical = `${SITE_URL}/perguntas-frequentes`;
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const items = FAQS.map(
    (f) => `<div class="faq"><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`
  ).join('\n');

  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> › <span class="muted">Dúvidas frequentes</span></nav>
  <h1>Perguntas frequentes — DG Automóveis</h1>
  <p class="muted">Tudo sobre comprar, vender, trocar e financiar seu carro na ${escHtml(DEALER.name)}, em ${escHtml(DEALER.city)}/${DEALER.region}.</p>
  ${items}
  <a class="cta" href="/estoque">Ver estoque de seminovos</a>`;

  return layout({
    title: `Perguntas Frequentes — DG Automóveis (${DEALER.city}/${DEALER.region})`,
    description: `Respostas sobre a DG Automóveis: confiança, localização, horário, troca, financiamento e estoque de seminovos em ${DEALER.city}/${DEALER.region}.`,
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [jsonLd(faqSchema)],
    body,
  });
}

export function renderPrivacy(): string {
  const canonical = `${SITE_URL}/politica-de-privacidade`;
  const body = `
  <nav class="bc"><a href="/estoque">Início</a> › <span class="muted">Política de Privacidade</span></nav>
  <h1>Política de Privacidade</h1>
  <p class="muted">Última atualização: julho de 2026. Esta política explica como a ${escHtml(DEALER.legalName)} coleta, usa e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>

  <h2>1. Quem somos</h2>
  <p>A ${escHtml(DEALER.name)} é uma concessionária de veículos seminovos localizada em ${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}. Somos a controladora dos dados coletados neste site.</p>

  <h2>2. Dados que coletamos</h2>
  <p>Ao preencher nosso formulário de avaliação para venda do seu veículo, coletamos:</p>
  <ul>
    <li><strong>Dados de contato:</strong> nome, telefone e cidade.</li>
    <li><strong>Dados do veículo:</strong> placa, marca, modelo, ano, quilometragem, cor e o valor desejado.</li>
  </ul>
  <p>Também podemos coletar automaticamente dados de navegação (endereço IP, tipo de dispositivo e páginas visitadas) por meio de cookies e tecnologias similares.</p>

  <h2>3. Como usamos seus dados</h2>
  <ul>
    <li>Avaliar seu veículo e elaborar uma proposta comercial de compra.</li>
    <li>Permitir que nossa equipe comercial entre em contato por telefone.</li>
    <li>Melhorar nossos serviços e a sua experiência no site.</li>
    <li>Mensurar e otimizar nossas campanhas de anúncios.</li>
  </ul>

  <h2>4. Cookies e anúncios (Google e Meta/Facebook)</h2>
  <p>Utilizamos cookies e pixels de rastreamento, que podem incluir Google Ads, Google Analytics e Meta (Facebook/Instagram) Pixel, para medir a eficácia dos nossos anúncios e exibir ofertas relevantes. Esses parceiros tratam dados conforme suas próprias políticas de privacidade. Você pode gerenciar ou bloquear cookies nas configurações do seu navegador.</p>

  <h2>5. Compartilhamento de dados</h2>
  <p>Nós não vendemos seus dados pessoais. Podemos compartilhá-los com prestadores de serviço que nos apoiam (por exemplo, ferramentas de CRM e automação) e com plataformas de anúncios (Google e Meta), exclusivamente para as finalidades descritas acima e com as devidas medidas de segurança.</p>

  <h2>6. Por quanto tempo guardamos</h2>
  <p>Mantemos seus dados apenas pelo tempo necessário às finalidades descritas ou conforme exigido por lei. Depois disso, eles são excluídos ou anonimizados.</p>

  <h2>7. Seus direitos (LGPD)</h2>
  <p>Você pode, a qualquer momento, solicitar: confirmação e acesso aos seus dados, correção, anonimização, portabilidade, exclusão e revogação do consentimento. Para exercer esses direitos, entre em contato conosco pelos canais abaixo.</p>

  <h2>8. Segurança</h2>
  <p>Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou alteração.</p>

  <h2>9. Contato</h2>
  <p>${escHtml(DEALER.name)}<br>${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}<br>Telefone: ${escHtml(DEALER.telephone)}</p>

  <a class="cta" href="/vendasrapidas">Voltar e avaliar meu carro</a>`;

  return layout({
    title: 'Política de Privacidade — DG Automóveis',
    description: 'Como a DG Automóveis coleta, usa e protege seus dados pessoais (LGPD), incluindo cookies e anúncios do Google e da Meta/Facebook.',
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [],
    body,
  });
}

export function renderLlms(vehicles: FeedVehicle[]): string {
  return `# DG Automóveis

> Concessionária de carros seminovos em ${DEALER.city}/${DEALER.region}, Brasil, desde ${DEALER.foundingDate}. Nota ${String(DEALER.ratingValue).replace('.', ',')}/5 no Google (${DEALER.reviewCount} avaliações). Compra, venda, troca e financiamento de veículos no ${DEALER.areaServed}.

## Contato
- Endereço: ${DEALER.street}, ${DEALER.city}/${DEALER.region}, ${DEALER.postalCode}, Brasil
- WhatsApp/Telefone: ${DEALER.telephone}
- Horário: Segunda a sexta 8h-19h; Sábado 8h-13h
- Site: ${SITE_URL}
- Google Maps: ${DEALER.maps}
- Instagram: ${DEALER.instagram}
- Facebook: ${DEALER.facebook}

## Páginas principais
- Estoque de seminovos (atualizado em tempo real): ${SITE_URL}/estoque
- Sobre a empresa: ${SITE_URL}/sobre
- Perguntas frequentes: ${SITE_URL}/perguntas-frequentes
- Sitemap: ${SITE_URL}/sitemap.xml

## Serviços
${DEALER.services.map((s) => `- ${s}`).join('\n')}

## Estoque atual
${vehicles.length} veículos disponíveis no momento.
`;
}

export function renderSitemap(vehicles: FeedVehicle[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, priority: '0.8' },
    { loc: `${SITE_URL}/estoque`, priority: '0.9' },
    { loc: `${SITE_URL}/sobre`, priority: '0.7' },
    { loc: `${SITE_URL}/perguntas-frequentes`, priority: '0.7' },
    ...vehicles.map((v) => ({ loc: `${SITE_URL}/estoque/${v.slug}`, priority: '0.7' })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export function renderRobots(): string {
  // Allow AI answer engines + classic crawlers; expose the sitemap.
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

export function findBySlug(vehicles: FeedVehicle[], slug: string): FeedVehicle | undefined {
  const direct = vehicles.find((v) => v.slug === slug);
  if (direct) return direct;
  const id = slug.split('-').pop();
  return vehicles.find((v) => v.id === id);
}
