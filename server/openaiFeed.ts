// ---------------------------------------------------------------------------
// Product feed para o OpenAI Ads Manager (anúncios de feed dentro do ChatGPT).
//
// O Ads Manager pede uma URL HTTPS pública que devolva um SNAPSHOT COMPLETO em
// Parquet ("file_type=full-parquet"). Este módulo converte o estoque da Altimus
// — o mesmo `getVehicles()` que alimenta o catálogo SSR — para o schema de
// produtos da OpenAI e serializa em Parquet na hora.
//
// Schema: https://developers.openai.com/commerce/specs/file-upload/products
// Ads:    https://developers.openai.com/ads/product-feeds
//
// Duas ressalvas conhecidas, documentadas aqui para não se perderem:
//
//  1. VOLUME. Há relato consistente de um mínimo de ~1.000 produtos por feed.
//     O estoque da loja gira na casa das dezenas, então a ingestão pode ser
//     recusada por volume — não por erro deste arquivo.
//  2. BOOLEANOS. A spec descreve os flags como "lower-case string" (`true` /
//     `false`), porque nasceu de feeds CSV/TSV onde tudo é texto. Parquet é
//     tipado, então aqui eles saem como BOOLEAN de verdade. Se a ingestão
//     reclamar do tipo, troque `type: 'BOOLEAN'` por `type: 'STRING'` em
//     COLUNAS e mapeie para as strings 'true'/'false'.
// ---------------------------------------------------------------------------

import { parquetWriteBuffer } from 'hyparquet-writer';
import { DEALER, SITE_URL, type FeedVehicle } from './catalog';

/** Uma linha do feed, já no vocabulário da OpenAI. */
export interface OpenAIProduct {
  item_id: string;
  title: string;
  description: string;
  url: string;
  brand: string;
  image_url: string;
  price: string;
  availability: string;
  condition: string;
  product_category: string;
  color: string;
  seller_name: string;
  seller_url: string;
  seller_privacy_policy: string;
  target_countries: string;
  store_country: string;
  is_eligible_search: boolean;
  is_eligible_checkout: boolean;
  is_ads_eligible: boolean;
}

// Taxonomia do Google — a spec da OpenAI é compatível com feed do Google e pede
// os níveis separados por '>'.
const CATEGORIA = 'Vehicles & Parts > Vehicles > Motor Vehicles > Cars, Trucks & Vans';

function truncar(texto: string, max: number): string {
  const limpo = (texto || '').replace(/\s+/g, ' ').trim();
  return limpo.length <= max ? limpo : limpo.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Descrição comercial do veículo.
 *
 * O XML da Altimus não traz texto de venda: traz a linha de descrição (que já
 * vira o título) e a lista de opcionais. Montamos aqui um parágrafo com os
 * atributos reais do carro, sem inventar nada que não esteja no feed.
 */
function descrever(v: FeedVehicle): string {
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
    v.options.length ? `Opcionais: ${v.options.slice(0, 40).join(', ')}.` : '',
    'Veículo revisado. Aceitamos seu usado na troca e trabalhamos com financiamento.',
  ].filter(Boolean);

  return truncar(partes.join(' '), 5000);
}

/**
 * Converte o estoque para linhas do feed.
 *
 * Descarta carro sem preço ou sem foto: `price` e `image_url` são obrigatórios
 * na spec, e um anúncio sem valor ou sem imagem não teria como rodar mesmo.
 */
export function montarProdutos(vehicles: FeedVehicle[]): OpenAIProduct[] {
  const produtos: OpenAIProduct[] = [];

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
      availability: 'in_stock',
      condition: 'used',
      product_category: CATEGORIA,
      color: truncar(v.color.toLowerCase(), 40),
      seller_name: truncar(DEALER.name, 70),
      seller_url: DEALER.url,
      seller_privacy_policy: `${SITE_URL}/politica-de-privacidade`,
      target_countries: 'BR',
      store_country: 'BR',
      is_eligible_search: true,
      // Não existe checkout de carro no site: a compra passa por consultor.
      // Marcar como elegível prometeria à OpenAI um fluxo que não temos.
      is_eligible_checkout: false,
      // Exigido pelo Ads. O nome é este — `is_ads_enabled` não existe.
      is_ads_eligible: true,
    });
  }

  return produtos;
}

// Ordem e tipo de cada coluna do Parquet. Manter como tabela deixa explícito o
// contrato com a OpenAI e evita divergência entre schema e dados.
const COLUNAS: { nome: keyof OpenAIProduct; tipo: 'STRING' | 'BOOLEAN' }[] = [
  { nome: 'item_id', tipo: 'STRING' },
  { nome: 'title', tipo: 'STRING' },
  { nome: 'description', tipo: 'STRING' },
  { nome: 'url', tipo: 'STRING' },
  { nome: 'brand', tipo: 'STRING' },
  { nome: 'image_url', tipo: 'STRING' },
  { nome: 'price', tipo: 'STRING' },
  { nome: 'availability', tipo: 'STRING' },
  { nome: 'condition', tipo: 'STRING' },
  { nome: 'product_category', tipo: 'STRING' },
  { nome: 'color', tipo: 'STRING' },
  { nome: 'seller_name', tipo: 'STRING' },
  { nome: 'seller_url', tipo: 'STRING' },
  { nome: 'seller_privacy_policy', tipo: 'STRING' },
  { nome: 'target_countries', tipo: 'STRING' },
  { nome: 'store_country', tipo: 'STRING' },
  { nome: 'is_eligible_search', tipo: 'BOOLEAN' },
  { nome: 'is_eligible_checkout', tipo: 'BOOLEAN' },
  { nome: 'is_ads_eligible', tipo: 'BOOLEAN' },
];

/** Serializa as linhas em um arquivo Parquet (SNAPPY, um row group). */
export function produtosParaParquet(produtos: OpenAIProduct[]): Buffer {
  const columnData = COLUNAS.map((c) => ({
    name: c.nome,
    type: c.tipo,
    data: produtos.map((p) => p[c.nome]),
  }));

  const buffer = parquetWriteBuffer({
    columnData,
    kvMetadata: [
      { key: 'generated_by', value: 'manosveiculoscompra.com' },
      { key: 'generated_at', value: new Date().toISOString() },
    ],
  });

  return Buffer.from(buffer);
}
