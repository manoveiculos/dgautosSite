// ---------------------------------------------------------------------------
// Data feed da Meta (Gerenciador de Comércio › Fontes de dados › URL agendada).
//
// POR QUE ISTO EXISTE
//
// Hoje o catálogo 712583511204994 é alimentado pela Autos 360, que numera os
// veículos do jeito dela. O site manda o `id` da Altimus em todos os eventos do
// pixel, então nada casa e a taxa de correspondência do catálogo fica em 0% —
// é o problema que `server/catalogSync.ts` contorna, casando nome + preço pela
// Graph API.
//
// Quando o catálogo passa a ser alimentado POR ESTE ARQUIVO, o contorno deixa
// de ser necessário: o `id`/`vehicle_id` do feed é o mesmo `id` da Altimus que
// o pixel já envia em `content_ids`. A correspondência passa a ser exata por
// construção, não por heurística.
//
// DOIS SCHEMAS, PORQUE EXISTEM DOIS TIPOS DE CATÁLOGO
//
// A Meta valida o arquivo contra o tipo do catálogo, e os nomes das colunas
// mudam entre eles. Não dá para adivinhar qual é o nosso sem abrir o
// Gerenciador de Comércio, então geramos os dois e a escolha é de quem cola a
// URL:
//
//   - catálogo "Veículos" (anúncios de inventário automotivo) → `montarVeiculos`
//     Campos: vehicle_id, make, model, mileage.value, state_of_vehicle, ...
//   - catálogo "E-commerce/Produtos" → `montarProdutos`
//     Campos: id, title, availability, condition, price, link, image_link, ...
//
// Referências:
//   Produtos: https://developers.facebook.com/docs/commerce-platform/catalog/fields/
//   Veículos: https://developers.facebook.com/documentation/ads-commerce/marketing-api/auto-ads/reference
//
// O arquivo é gerado na hora a partir do mesmo `getVehicles()` que serve o
// catálogo SSR — não há estado nem arquivo em disco para ficar velho.
// ---------------------------------------------------------------------------

import { DEALER, SITE_URL, type FeedVehicle } from './catalog';

/**
 * Quantas colunas de imagem o CSV carrega.
 *
 * CSV tem cabeçalho fixo: o número precisa ser decidido aqui, não por veículo.
 * A Meta aceita até 20; o estoque hoje chega a 23 fotos por carro, então o teto
 * corta as últimas de alguns anúncios — e não as primeiras, que são as que a
 * loja escolheu para abrir a galeria.
 */
const MAX_IMAGENS = 20;

/** Taxonomia do Google, aceita pela Meta em `google_product_category`. */
const CATEGORIA = 'Vehicles & Parts > Vehicles > Motor Vehicles > Cars, Trucks & Vans';

/**
 * Endereço da loja no formato que o catálogo de veículos espera: um objeto JSON
 * dentro de uma célula do CSV. Todo veículo aponta para a mesma loja física.
 */
const ENDERECO_JSON = JSON.stringify({
  addr1: DEALER.street,
  city: DEALER.city,
  region: DEALER.region,
  postal_code: DEALER.postalCode,
  country: DEALER.country,
});

// ---------------------------------------------------------------------------
// Normalização dos dados da Altimus
// ---------------------------------------------------------------------------

/**
 * Marcas cujo nome tem mais de uma palavra.
 *
 * `marca` no XML da Altimus é um número interno ("28"), não o nome — o nome só
 * existe dentro da `descricao`. Separar por espaço funciona para "Fiat Toro",
 * mas quebraria "Land Rover Discovery" em marca "Land" / modelo "Rover".
 */
const MARCAS_COMPOSTAS = [
  'land rover',
  'alfa romeo',
  'aston martin',
  'great wall',
  'jac motors',
  'rolls royce',
  'mercedes benz',
];

/**
 * Parte da descrição que descreve o carro, sem cor nem ano.
 *
 * O padrão da Altimus é "Marca Modelo Versão - Cor - 2014/2015". A cor e o ano
 * já vão em colunas próprias; repeti-los no `model`/`trim` só polui o anúncio.
 */
function parteDoModelo(title: string): string {
  return (title.split(' - ')[0] || title).replace(/\s+/g, ' ').trim();
}

export interface MarcaModelo {
  make: string;
  model: string;
  trim: string;
}

export function separarMarcaModelo(title: string): MarcaModelo {
  const texto = parteDoModelo(title);
  const minusculo = texto.toLowerCase();
  const composta = MARCAS_COMPOSTAS.find((m) => minusculo.startsWith(m + ' '));

  const palavras = texto.split(' ').filter(Boolean);
  const tamanhoMarca = composta ? composta.split(' ').length : 1;

  const make = palavras.slice(0, tamanhoMarca).join(' ') || DEALER.name;
  const model = palavras[tamanhoMarca] || make;
  const trim = palavras.slice(tamanhoMarca + 1).join(' ');

  return { make, model, trim };
}

/**
 * Carroceria por modelo, para os nomes que o texto não revela.
 *
 * A dedução por palavra-chave ("5p", "hatch", "sedan") cobre a maioria, mas
 * falha justamente nos modelos cujo nome comercial dispensa o sufixo — um
 * "Ford Fusion 2.5L I-VCT Flex Aut." não diz em lugar nenhum que é sedã. Sem
 * esta tabela, um terço do estoque caía em OTHER e saía das segmentações por
 * carroceria.
 *
 * A chave é o token de modelo já isolado por `separarMarcaModelo`.
 */
const CARROCERIA_POR_MODELO: Record<string, string> = {
  // Sedãs
  fusion: 'SEDAN',
  sonata: 'SEDAN',
  hb20s: 'SEDAN',
  corolla: 'SEDAN',
  civic: 'SEDAN',
  cruze: 'SEDAN',
  virtus: 'SEDAN',
  voyage: 'SEDAN',
  prisma: 'SEDAN',
  versa: 'SEDAN',
  cronos: 'SEDAN',
  ka: 'SEDAN',
  // Hatches
  hb20: 'HATCHBACK',
  dolphin: 'HATCHBACK',
  gol: 'HATCHBACK',
  polo: 'HATCHBACK',
  uno: 'HATCHBACK',
  palio: 'HATCHBACK',
  argo: 'HATCHBACK',
  mobi: 'HATCHBACK',
  onix: 'HATCHBACK',
  sandero: 'HATCHBACK',
  march: 'HATCHBACK',
  fox: 'HATCHBACK',
  up: 'HATCHBACK',
  fit: 'HATCHBACK',
  focus: 'HATCHBACK',
  // Nomes comerciais de duas palavras. A chave composta é consultada primeiro:
  // "Corolla" sozinho é sedã, "Corolla Cross" é SUV, e o modelo isolado não
  // distingue os dois.
  'corolla cross': 'SUV',
  'new beetle': 'HATCHBACK',
  'up cross': 'HATCHBACK',
  // SUVs e crossovers
  nivus: 'SUV',
  '2008': 'SUV',
  '3008': 'SUV',
  ex30: 'SUV',
  soul: 'SUV',
  c4: 'SUV',
  haval: 'SUV',
  'hr-v': 'SUV',
  'wr-v': 'SUV',
  tucson: 'SUV',
  sportage: 'SUV',
  outlander: 'SUV',
  asx: 'SUV',
  corvette: 'COUPE',
};

/** Enum `body_style` da Meta, deduzido do texto — o feed não traz carroceria. */
export function deduzirCarroceria(v: FeedVehicle): string {
  // Moto (`tipo` 4 no feed da Altimus) não tem enum próprio no catálogo de
  // veículos da Meta. OTHER é o único valor honesto: classificar como SEDAN
  // colocaria a moto em segmentações de carro.
  if (v.tipo === '4') return 'OTHER';

  const texto = `${v.title} ${v.options.join(' ')}`.toLowerCase();

  // A tabela vem antes das palavras-chave: "Kia Soul" casaria com nada e o
  // "5p" de um "HB20 5p" diria hatch de qualquer jeito — mas "Nivus ... 5p"
  // diria hatch para um SUV. O nome do modelo é a informação mais forte.
  const { model, trim } = separarMarcaModelo(v.title);
  const composto = `${model} ${trim.split(' ')[0] || ''}`.trim().toLowerCase();
  const porModelo =
    CARROCERIA_POR_MODELO[composto] || CARROCERIA_POR_MODELO[model.toLowerCase()];
  if (porModelo) return porModelo;

  if (/roadster|conversivel|convers[ií]vel|cabrio/.test(texto)) return 'CONVERTIBLE';
  if (/\bcoup[eé]\b/.test(texto)) return 'COUPE';
  if (/pick-?up|picape|\bcd\b|cabine dupla|frontier|hilux|ranger|s10|toro|strada|saveiro|montana|amarok|oroch/.test(texto))
    return 'TRUCK';
  if (/minivan|\bspin\b|livina|zafira|grand c4/.test(texto)) return 'MINIVAN';
  if (/\bvan\b|ducato|sprinter|master|daily/.test(texto)) return 'VAN';
  if (/perua|\bsw\b|station|variant|sportwagon/.test(texto)) return 'WAGON';
  // Sem números de modelo aqui: "2008" casaria com o ANO de qualquer carro
  // 2007/2008 e jogaria um New Beetle em SUV. Modelo numérico fica na tabela,
  // que compara o token de modelo e não o texto inteiro.
  if (/\bsuv\b|tracker|compass|renegade|creta|kicks|duster|tiguan|t-cross|taos|hr-v|wr-v|haval|captur|territory|ecosport|pulse|fastback/.test(texto))
    return 'SUV';
  if (/hatch|\b5p\b/.test(texto)) return 'HATCHBACK';
  if (/sedan|\b4p\b/.test(texto)) return 'SEDAN';
  return 'OTHER';
}

/** Enum `fuel_type` da Meta a partir de `<combustivel>`, com a descrição de apoio. */
export function deduzirCombustivel(v: FeedVehicle): string {
  const texto = `${v.fuel} ${v.title}`.toLowerCase();
  // Híbrido antes de elétrico e de gasolina: "Gasolina e Hibrido" (valor real
  // do feed) casaria com os três, e o mais específico é o certo.
  if (/h[ií]brid/.test(texto)) return 'HYBRID';
  if (/el[eé]tric|bateria/.test(texto)) return 'ELECTRIC';
  if (/diesel/.test(texto)) return 'DIESEL';
  if (/flex|[aá]lcool|etanol/.test(texto)) return 'FLEX';
  if (/gasolina/.test(texto)) return 'GASOLINE';
  return 'OTHER';
}

/** Enum `drivetrain`. Vazio quando o texto não diz — chutar tração é pior que omitir. */
export function deduzirTracao(v: FeedVehicle): string {
  const texto = `${v.title} ${v.options.join(' ')}`.toLowerCase();
  if (/\b4x4\b|4wd/.test(texto)) return '4X4';
  if (/\bawd\b/.test(texto)) return 'AWD';
  if (/\b4x2\b/.test(texto)) return '4X2';
  return '';
}

/** `transmission` da Meta ("Automatic"/"Manual") a partir do que o catálogo já deduz. */
function deduzirCambio(v: FeedVehicle): string {
  if (/autom/i.test(v.transmission)) return 'Automatic';
  if (/manual/i.test(v.transmission)) return 'Manual';
  return '';
}

/** `year` é inteiro yyyy. A descrição traz "2014/2015"; `<ano>` já vem limpo. */
function anoInteiro(v: FeedVehicle): string {
  const m = String(v.year).match(/(\d{4})/g);
  return m ? m[m.length - 1] : '';
}

function truncar(texto: string, max: number): string {
  const limpo = (texto || '').replace(/\s+/g, ' ').trim();
  return limpo.length <= max ? limpo : limpo.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Descrição comercial. O XML da Altimus não traz texto de venda — traz a linha
 * de descrição (que vira o título) e os opcionais. O parágrafo é montado com
 * atributos reais do veículo, sem inventar nada que não esteja no feed.
 */
function descrever(v: FeedVehicle, maxOpcionais: number, limite: number): string {
  const atributos = [
    v.year && `ano ${v.year}`,
    v.kmNumber > 0 && v.km,
    v.fuel && `combustível ${v.fuel.toLowerCase()}`,
    v.transmission && `câmbio ${v.transmission.toLowerCase()}`,
    v.color && `cor ${v.color.toLowerCase()}`,
  ].filter(Boolean) as string[];

  const partes = [
    `${v.title} seminovo à venda na ${DEALER.name}, revenda em ${DEALER.city}/${DEALER.region}, no ${DEALER.areaServed}.`,
    atributos.length ? `Ficha: ${atributos.join(', ')}.` : '',
    v.options.length ? `Opcionais: ${v.options.slice(0, maxOpcionais).join(', ')}.` : '',
    'Veículo revisado. Aceitamos seu usado na troca e trabalhamos com financiamento.',
  ].filter(Boolean);

  return truncar(partes.join(' '), limite);
}

/** URL da página SSR do veículo — a mesma que o pixel mede. */
function urlDoVeiculo(v: FeedVehicle): string {
  return `${SITE_URL}/estoque/${v.slug}`;
}

/**
 * Faixa de preço, para segmentar campanha sem depender de intervalo numérico.
 * Vai em `custom_label_1`.
 */
function faixaDePreco(preco: number): string {
  if (preco < 50000) return 'ate-50k';
  if (preco < 80000) return '50k-80k';
  if (preco < 120000) return '80k-120k';
  if (preco < 200000) return '120k-200k';
  return 'acima-200k';
}

/**
 * Veículo que pode virar anúncio.
 *
 * `price` e a primeira imagem são obrigatórios nos dois schemas, e um anúncio
 * sem valor ou sem foto não rodaria de qualquer forma. Descartar aqui evita que
 * a Meta rejeite o arquivo inteiro por causa de uma linha.
 */
function anunciavel(v: FeedVehicle): boolean {
  return v.price > 0 && Boolean(v.images[0]);
}

// ---------------------------------------------------------------------------
// Schema 1 — catálogo de E-COMMERCE / PRODUTOS
// ---------------------------------------------------------------------------

export interface ProdutoMeta {
  id: string;
  title: string;
  description: string;
  availability: string;
  condition: string;
  price: string;
  link: string;
  image_link: string;
  additional_image_link: string;
  brand: string;
  google_product_category: string;
  product_type: string;
  color: string;
  custom_label_0: string;
  custom_label_1: string;
  custom_label_2: string;
  custom_label_3: string;
  custom_label_4: string;
}

export function montarProdutos(vehicles: FeedVehicle[]): ProdutoMeta[] {
  const produtos: ProdutoMeta[] = [];

  for (const v of vehicles) {
    if (!anunciavel(v)) continue;
    const { make, model } = separarMarcaModelo(v.title);

    produtos.push({
      // O MESMO id que o pixel manda em content_ids. É isto que faz a taxa de
      // correspondência sair de 0%.
      id: truncar(v.id, 100),
      title: truncar(v.title, 200),
      description: descrever(v, 40, 9999),
      // Só entra no feed o que está no estoque; o que some do feed sai do ar.
      availability: 'in stock',
      condition: 'used',
      price: `${v.price.toFixed(2)} BRL`,
      link: urlDoVeiculo(v),
      image_link: v.images[0],
      // A Meta lê a lista separada por vírgula dentro da mesma célula.
      additional_image_link: v.images.slice(1, MAX_IMAGENS).join(','),
      brand: truncar(make, 100),
      google_product_category: CATEGORIA,
      product_type: truncar(`Seminovos > ${make} > ${model}`, 750),
      color: truncar(v.color, 200),
      custom_label_0: anoInteiro(v),
      custom_label_1: faixaDePreco(v.price),
      custom_label_2: v.kmNumber > 0 ? String(v.kmNumber) : '',
      custom_label_3: truncar(v.fuel, 100),
      custom_label_4: truncar(v.transmission, 100),
    });
  }

  return produtos;
}

const COLUNAS_PRODUTO: (keyof ProdutoMeta)[] = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
  'google_product_category',
  'product_type',
  'color',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
  'custom_label_3',
  'custom_label_4',
];

// ---------------------------------------------------------------------------
// Schema 2 — catálogo de VEÍCULOS (anúncios de inventário automotivo)
// ---------------------------------------------------------------------------

/** Chaves fixas + as colunas de imagem, que são dinâmicas no nome. */
export type VeiculoMeta = Record<string, string>;

export function montarVeiculos(vehicles: FeedVehicle[]): VeiculoMeta[] {
  const linhas: VeiculoMeta[] = [];

  for (const v of vehicles) {
    if (!anunciavel(v)) continue;
    const { make, model, trim } = separarMarcaModelo(v.title);

    const linha: VeiculoMeta = {
      // Mesmo id do pixel — ver comentário em montarProdutos.
      vehicle_id: truncar(v.id, 100),
      title: truncar(v.title, 500),
      description: descrever(v, 30, 5000),
      url: urlDoVeiculo(v),
      make: truncar(make, 100),
      model: truncar(model, 100),
      trim: truncar(trim, 100),
      year: anoInteiro(v),
      'mileage.value': String(v.kmNumber),
      'mileage.unit': 'KM',
      price: `${v.price.toFixed(2)} BRL`,
      exterior_color: truncar(v.color, 100),
      // A loja vende seminovo; carro zero não entra neste estoque.
      state_of_vehicle: 'Used',
      body_style: deduzirCarroceria(v),
      transmission: deduzirCambio(v),
      fuel_type: deduzirCombustivel(v),
      drivetrain: deduzirTracao(v),
      availability: 'available',
      address: ENDERECO_JSON,
      latitude: String(DEALER.lat),
      longitude: String(DEALER.lng),
      dealer_id: 'dg-rio-do-sul',
      dealer_name: truncar(DEALER.name, 100),
      dealer_phone: DEALER.telephone,
      // Não existe `vin` no feed da Altimus. A placa NÃO é VIN e não pode ir
      // nesse campo — ela vai num rótulo próprio, que também é a chave usada
      // pelo CRM para casar a venda.
      custom_label_0: v.placa,
    };

    // Colunas de imagem sempre presentes, mesmo vazias: CSV exige cabeçalho
    // fixo, e uma linha com menos colunas que o cabeçalho é rejeitada.
    for (let i = 0; i < MAX_IMAGENS; i++) {
      linha[`image[${i}].url`] = v.images[i] || '';
    }

    linhas.push(linha);
  }

  return linhas;
}

function colunasVeiculo(): string[] {
  const fixas = [
    'vehicle_id',
    'title',
    'description',
    'url',
    'make',
    'model',
    'trim',
    'year',
    'mileage.value',
    'mileage.unit',
    'price',
    'exterior_color',
    'state_of_vehicle',
    'body_style',
    'transmission',
    'fuel_type',
    'drivetrain',
    'availability',
    'address',
    'latitude',
    'longitude',
    'dealer_id',
    'dealer_name',
    'dealer_phone',
    'custom_label_0',
  ];
  const imagens = Array.from({ length: MAX_IMAGENS }, (_, i) => `image[${i}].url`);
  return [...fixas, ...imagens];
}

// ---------------------------------------------------------------------------
// Serialização CSV
// ---------------------------------------------------------------------------

/**
 * Uma célula no formato RFC 4180.
 *
 * Aspas e vírgula aparecem de verdade nos nossos dados: o endereço vai como
 * JSON (cheio de aspas) e quase toda descrição tem vírgula. Sem escapar, a
 * Meta lê colunas deslocadas e rejeita o arquivo.
 *
 * Quebra de linha dentro da célula é substituída por espaço em vez de escapada:
 * o parser da Meta aceita, mas o arquivo fica ilegível para depurar — e nenhum
 * campo nosso precisa de várias linhas.
 */
function celula(valor: string): string {
  const texto = String(valor ?? '').replace(/[\r\n]+/g, ' ');
  return /[",]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function paraCsv(linhas: Record<string, string>[], colunas: string[]): string {
  const cabecalho = colunas.join(',');
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c])).join(','));
  return [cabecalho, ...corpo].join('\n') + '\n';
}

export function produtosParaCsv(produtos: ProdutoMeta[]): string {
  return paraCsv(produtos as unknown as Record<string, string>[], COLUNAS_PRODUTO as string[]);
}

export function veiculosParaCsv(linhas: VeiculoMeta[]): string {
  return paraCsv(linhas, colunasVeiculo());
}
