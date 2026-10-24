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
const CACHE_KEY = 'dg_automoveis_stock_cache_v5';
const CACHE_TTL = 1000 * 30; // 30 segundos para manter sempre sincronizado

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

import { supabase } from '../lib/supabase';

export async function fetchStock(): Promise<Vehicle[]> {
  try {
    const cachedString = localStorage.getItem(CACHE_KEY);
    if (cachedString) {
      const cached: CachedData = JSON.parse(cachedString);
      if (Array.isArray(cached.vehicles) && cached.vehicles.length > 0 && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.vehicles;
      }
    }

    try {
      const response = await fetch(STOCK_JSON_URL);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
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
    } catch {}

    // Consulta direta e oficial ao banco de dados Supabase DGAUTOS (com todas as fotos)
    try {
      const [resVeics, resFotos] = await Promise.all([
        supabase.from('veiculos_DGAUTOS').select('*').order('id', { ascending: false }),
        supabase.from('veiculos_fotos_DGAUTOS').select('*').order('ordem', { ascending: true })
      ]);

      const data = resVeics.data;
      const fotosData = Array.isArray(resFotos.data) ? resFotos.data : [];

      if (!resVeics.error && Array.isArray(data) && data.length > 0) {
        const listaAlvo = data.filter((v: any) => v.publicar_site !== false);

        const vehicles: Vehicle[] = listaAlvo.map((v: any) => {
          // 1. Fotos salvas na tabela veiculos_fotos_DGAUTOS
          const fotosTabela = fotosData
            .filter((f: any) => Number(f.veiculo_id) === Number(v.id))
            .map((f: any) => f.url_foto)
            .filter(Boolean);

          // 2. Fotos no payload JSON dados_altimus
          const altimusFotos = Array.isArray(v.dados_altimus?.fotos) ? v.dados_altimus.fotos : [];
          const fotosProprias = Array.isArray(v.fotos) ? v.fotos : [];

          let imgs: string[] = [];
          if (fotosTabela.length > 0) {
            imgs = fotosTabela;
          } else if (altimusFotos.length > 0) {
            imgs = altimusFotos;
          } else if (fotosProprias.length > 0) {
            imgs = fotosProprias;
          } else if (v.foto_capa) {
            imgs = [v.foto_capa];
          } else {
            imgs = ['/logo-dg.png'];
          }

          const vSlug = `${slugify(`${v.marca} ${v.modelo}`)}-${v.id}`;
          const vAno = v.ano || `${v.ano_fabricacao || ''}/${v.ano_modelo || ''}`.replace(/^\/|\/$/g, '');
          const precoNum = Number(v.preco || v.preco_venda || 0);

          return {
            id: String(v.id),
            slug: vSlug,
            description: `${v.marca} ${v.modelo} ${v.modelo_complemento || ''}`.trim(),
            brand: v.marca,
            year: vAno,
            price: precoNum,
            priceFormatted: precoNum ? precoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Consulte',
            image: imgs[0],
            images: imgs,
            km: v.km ? `${Number(v.km).toLocaleString('pt-BR')} km` : '0 km',
            fuel: v.combustivel || '',
            transmission: v.cambio || '',
            color: v.cor || '',
            options: Array.isArray(v.opcionais) ? v.opcionais : (v.dados_altimus?.itens_opcionais || []),
            link: `/estoque/${vSlug}`,
            status: v.status || 'disponivel',
          };
        });

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), vehicles }));
        } catch {}
        return vehicles;
      }
    } catch (errSupabase) {
      console.warn('Erro ao consultar estoque no Supabase:', errSupabase);
    }

    return [];
  } catch (error) {
    console.error('Error fetching stock:', error);
    return [];
  }
}
