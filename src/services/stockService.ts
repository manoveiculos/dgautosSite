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
const CACHE_KEY = 'dg_automoveis_stock_cache_v4';
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
export const DG_SHOWROOM_STOCK: Vehicle[] = [];

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
      if (Array.isArray(data)) {
        const vehicles: Vehicle[] = data.map((v: any) => {
          const imgs: string[] = Array.isArray(v.images) && v.images.length > 0
            ? v.images
            : (Array.isArray(v.fotos) && v.fotos.length > 0 ? v.fotos : [v.image || '/logo-dg.png']);
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

    return [];
  } catch (error) {
    console.error('Error fetching stock from live API:', error);
    return [];
  }
}
