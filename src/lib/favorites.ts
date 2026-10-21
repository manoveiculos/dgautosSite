/**
 * Favorites Manager & WhatsApp Share Helper
 */

import { waLink } from './manos';
import { track } from './track';

const FAV_KEY = 'manos_favorites_v1';

export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}

export function toggleFavorite(id: string): string[] {
  const current = getFavorites();
  let updated: string[];
  if (current.includes(id)) {
    updated = current.filter((item) => item !== id);
    track('fav_remove', { vehicleId: id });
  } else {
    updated = [...current, id];
    track('fav_add', { vehicleId: id });
  }

  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(updated));
  } catch {
    /* noop */
  }

  window.dispatchEvent(new CustomEvent('manos_fav_change', { detail: updated }));
  return updated;
}

export function shareFavoritesWhatsApp(vehicleTitles: string[]): string {
  if (vehicleTitles.length === 0) return waLink();
  const list = vehicleTitles.map((t) => `• ${t}`).join('\n');
  const msg = `Olá! Gostaria de consultar estes veículos que salvei como favoritos no site:\n\n${list}`;
  return waLink(msg);
}
