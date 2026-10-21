export interface Vehicle {
  id: string;
  slug: string;
  description: string;
  brand?: string;
  year: string;
  price: number;
  priceFormatted: string;
  km: string;
  image: string;
  images: string[];
  fuel?: string;
  transmission?: string;
  color?: string;
  options?: string[];
  link: string; // permalink público do veículo (/estoque/<slug>)
}

const STOCK_JSON_URL = '/api/stock';
const CACHE_KEY = 'dg_automoveis_stock_cache_v3';
const CACHE_TTL = 1000 * 60 * 3; // 3 minutes

function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * Estoque oficial em destaque da DG Automóveis (Rio do Sul/SC)
 * Baseado nos veículos reais do pátio e showroom (@dgautomoveis__)
 */
export const DG_SHOWROOM_STOCK: Vehicle[] = [
  {
    id: '101',
    slug: 'vw-golf-1-4-tsi-highline-automatico-teto-solar-101',
    description: 'VW GOLF 1.4 TSI HIGHLINE AUTOMÁTICO C/ TETO SOLAR',
    brand: 'VW',
    year: '2015/2015',
    price: 89900,
    priceFormatted: 'R$ 89.900',
    km: '88.000 km',
    image: '/carros/vw-golf-card.png',
    images: ['/carros/vw-golf.png', '/carros/vw-golf-card.png', '/fachada-dg.png'],
    fuel: 'Gasolina / Flex',
    transmission: 'Automático',
    color: 'Vermelho Tornado',
    options: [
      'Teto Solar Panorâmico',
      'Rodas Esportivas Aro 18 Pretas',
      'Câmbio Automático c/ Paddle Shifts',
      'Ar-Condicionado Digital Dual Zone',
      'Bancos em Couro',
      'Central Multimídia c/ GPS e Bluetooth',
      'Controle de Estabilidade e Tração',
      '7 Airbags',
      'Sensores de Estacionamento Dianteiro e Traseiro',
      'Faróis de Neblina e DRL',
    ],
    link: '/estoque/vw-golf-1-4-tsi-highline-automatico-teto-solar-101',
  },
  {
    id: '102',
    slug: 'bmw-320i-2-0-16v-sport-automatico-teto-solar-102',
    description: 'BMW 320I 2.0 16V AUTOMÁTICO C/ TETO SOLAR',
    brand: 'BMW',
    year: '2012/2012',
    price: 78900,
    priceFormatted: 'R$ 78.900',
    km: '96.000 km',
    image: '/carros/bmw-320i-card.png',
    images: ['/carros/bmw-320i.png', '/carros/bmw-320i-card.png', '/fachada-dg.png'],
    fuel: 'Gasolina',
    transmission: 'Automático',
    color: 'Branco Alpino',
    options: [
      'Teto Solar Elétrico',
      'Bancos em Couro com Ajuste Elétrico',
      'Rodas de Liga Leve Esportivas Pretas',
      'Faróis Bi-Xenon com Angel Eyes',
      'Ar-Condicionado Digital Dual Zone',
      'Partida Start/Stop',
      'Controle de Tração e Estabilidade',
      '6 Airbags',
      'Piloto Automático',
      'Volante Multifuncional em Couro',
    ],
    link: '/estoque/bmw-320i-2-0-16v-sport-automatico-teto-solar-102',
  },
  {
    id: '103',
    slug: 'vw-jetta-2-0-comfortline-automatico-couro-103',
    description: 'VW JETTA 2.0 COMFORTLINE AUTOMÁTICO TIPTRONIC',
    brand: 'VW',
    year: '2014/2014',
    price: 67900,
    priceFormatted: 'R$ 67.900',
    km: '94.000 km',
    image: '/carros/vw-jetta.png',
    images: ['/carros/vw-jetta.png', '/fachada-dg.png'],
    fuel: 'Flex',
    transmission: 'Automático',
    color: 'Branco Cristal',
    options: [
      'Câmbio Automático Tiptronic de 6 Marchas',
      'Bancos em Couro',
      'Rodas de Liga Leve Diamantadas Aro 17',
      'Ar-Condicionado Digital Dual Zone',
      'Sensores de Estacionamento Dianteiro e Traseiro',
      'Volante Multifuncional com Paddle Shifts',
      'Central Multimídia Bluetooth',
      'Piloto Automático',
    ],
    link: '/estoque/vw-jetta-2-0-comfortline-automatico-couro-103',
  },
  {
    id: '104',
    slug: 'chevrolet-spin-1-8-ltz-7-lugares-automatica-104',
    description: 'CHEVROLET SPIN 1.8 LTZ 7 LUGARES AUTOMÁTICA',
    brand: 'CHEVROLET',
    year: '2017/2017',
    price: 62900,
    priceFormatted: 'R$ 62.900',
    km: '82.000 km',
    image: '/carros/chevrolet-spin-card.png',
    images: ['/carros/chevrolet-spin.png', '/carros/chevrolet-spin-card.png', '/fachada-dg.png'],
    fuel: 'Flex',
    transmission: 'Automático',
    color: 'Branco Summit',
    options: [
      '7 Lugares (Espaço Ideal para Família)',
      'Câmbio Automático de 6 Velocidades',
      'Central Multimídia MyLink com Câmera de Ré',
      'Ar-Condicionado e Direção Hidráulica/Elétrica',
      'Rodas de Liga Leve Originais',
      'Rack de Teto Funcional',
      'Sensor de Estacionamento',
      'Vidros e Travas Elétricas nas 4 Portas',
    ],
    link: '/estoque/chevrolet-spin-1-8-ltz-7-lugares-automatica-104',
  },
  {
    id: '105',
    slug: 'fiat-mobi-1-0-like-flex-4p-completo-105',
    description: 'FIAT MOBI 1.0 LIKE FLEX 4P COMPLETO',
    brand: 'FIAT',
    year: '2020/2020',
    price: 47900,
    priceFormatted: 'R$ 47.900',
    km: '54.000 km',
    image: '/carros/fiat-mobi-card.png',
    images: ['/carros/fiat-mobi.png', '/carros/fiat-mobi-card.png', '/fachada-dg.png'],
    fuel: 'Flex',
    transmission: 'Manual',
    color: 'Branco Banchisa',
    options: [
      'Ar-Condicionado Gelando',
      'Direção Assistida',
      'Vidros e Travas Elétricas',
      'Computador de Bordo',
      'Super Econômico (Até 15 km/l)',
      'Freios ABS e Airbags Duplos',
      'Limpador e Desembaçador Traseiro',
    ],
    link: '/estoque/fiat-mobi-1-0-like-flex-4p-completo-105',
  },
  {
    id: '106',
    slug: 'renault-sandero-1-6-expression-8v-flex-completo-106',
    description: 'RENAULT SANDERO 1.6 EXPRESSION 8V FLEX COMPLETO',
    brand: 'RENAULT',
    year: '2014/2014',
    price: 38900,
    priceFormatted: 'R$ 38.900',
    km: '98.000 km',
    image: '/carros/renault-sandero.png',
    images: ['/carros/renault-sandero.png', '/carros/patio-dg-1.png', '/fachada-dg.png'],
    fuel: 'Flex',
    transmission: 'Manual',
    color: 'Prata Étoile',
    options: [
      'Motor 1.6 Forte e Econômico',
      'Ar-Condicionado',
      'Direção Hidráulica',
      'Rodas de Liga Leve',
      'Faróis de Neblina',
      'Vidros e Travas Elétricas',
      'Som com Bluetooth e USB',
    ],
    link: '/estoque/renault-sandero-1-6-expression-8v-flex-completo-106',
  },
  {
    id: '107',
    slug: 'ford-new-fiesta-1-6-se-titanium-flex-107',
    description: 'FORD NEW FIESTA 1.6 SE FLEX COMPLETO',
    brand: 'FORD',
    year: '2015/2015',
    price: 46900,
    priceFormatted: 'R$ 46.900',
    km: '85.000 km',
    image: '/carros/patio-dg-1.png',
    images: ['/carros/patio-dg-1.png', '/fachada-dg.png'],
    fuel: 'Flex',
    transmission: 'Manual',
    color: 'Branco Ártico',
    options: [
      'Direção Elétrica Progressiva',
      'Ar-Condicionado Digital',
      'Assistente de Partida em Rampa',
      'Controle de Estabilidade (AdvanceTrac)',
      'Sistema de Som SYNC com Bluetooth',
      'Rodas de Liga Leve',
      'Vidros Elétricos nas 4 Portas',
    ],
    link: '/estoque/ford-new-fiesta-1-6-se-titanium-flex-107',
  },
  {
    id: '108',
    slug: 'hyundai-i30-2-0-16v-automatico-teto-solar-108',
    description: 'HYUNDAI I30 2.0 16V AUTOMÁTICO C/ TETO SOLAR',
    brand: 'HYUNDAI',
    year: '2012/2012',
    price: 52900,
    priceFormatted: 'R$ 52.900',
    km: '102.000 km',
    image: '/carros/patio-dg-2.png',
    images: ['/carros/patio-dg-2.png', '/fachada-dg.png'],
    fuel: 'Gasolina',
    transmission: 'Automático',
    color: 'Preto',
    options: [
      'Teto Solar Elétrico',
      'Câmbio Automático',
      'Bancos em Couro',
      'Ar-Condicionado Digital',
      'Rodas de Liga Leve Aro 17',
      'Piloto Automático e Comandos no Volante',
      'Rebatimento Elétrico dos Retrovisores',
    ],
    link: '/estoque/hyundai-i30-2-0-16v-automatico-teto-solar-108',
  },
  {
    id: '109',
    slug: 'vw-voyage-1-6-msi-comfortline-flex-completo-109',
    description: 'VW VOYAGE 1.6 MSI COMFORTLINE FLEX COMPLETO',
    brand: 'VW',
    year: '2016/2016',
    price: 48900,
    priceFormatted: 'R$ 48.900',
    km: '89.000 km',
    image: '/fachada-dg.png',
    images: ['/fachada-dg.png', '/carros/patio-dg-2.png'],
    fuel: 'Flex',
    transmission: 'Manual',
    color: 'Branco Cristal',
    options: [
      'Motor 1.6 MSI Flex',
      'Ar-Condicionado',
      'Direção Hidráulica',
      'Porta-Malas Amplo de 480 Litros',
      'Faróis de Neblina',
      'Vidros e Travas Elétricas',
      'Computador de Bordo I-System',
    ],
    link: '/estoque/vw-voyage-1-6-msi-comfortline-flex-completo-109',
  },
];

interface CachedData {
  timestamp: number;
  vehicles: Vehicle[];
}

export async function fetchStock(): Promise<Vehicle[]> {
  try {
    const cachedString = localStorage.getItem(CACHE_KEY);
    if (cachedString) {
      const cached: CachedData = JSON.parse(cachedString);
      if (Array.isArray(cached.vehicles) && cached.vehicles.length > 0 && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.vehicles;
      }
    }

    const response = await fetch(STOCK_JSON_URL);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const vehicles: Vehicle[] = data.map((v: any) => {
          const imgs: string[] = Array.isArray(v.images) && v.images.length > 0
            ? v.images
            : [v.image || '/logo-dg.png'];
          const vSlug = v.slug || `${slugify(v.title || v.description)}-${v.id}`;

          return {
            id: String(v.id),
            slug: vSlug,
            description: v.title || v.description,
            brand: v.brand || (v.title || v.description).split(' ')[0],
            year: String(v.year || ''),
            price: Number(v.price || 0),
            priceFormatted: v.priceFormatted || (v.price ? v.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Consulte'),
            image: imgs[0],
            images: imgs,
            km: v.km ? String(v.km) : '0 km',
            fuel: v.fuel || '',
            transmission: v.transmission || '',
            color: v.color || '',
            options: Array.isArray(v.options) ? v.options : [],
            link: `/estoque/${vSlug}`,
          };
        });

        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), vehicles }));
        return vehicles;
      }
    }

    return DG_SHOWROOM_STOCK;
  } catch (error) {
    console.error('Error fetching stock, using DG Showroom Stock:', error);
    return DG_SHOWROOM_STOCK;
  }
}
