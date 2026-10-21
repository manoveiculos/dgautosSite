/**
 * Unified Analytics & Event Tracker
 */

export function track(evento: string, props: Record<string, any> = {}): void {
  const payload = {
    evento,
    timestamp: new Date().toISOString(),
    pagina: window.location.pathname,
    ...props,
  };

  if ((import.meta as any).env?.DEV) {
    console.log('[TRACK EVENT]', payload);
  }

  try {
    // Custom DOM Event dispatch
    window.dispatchEvent(new CustomEvent('manos_track', { detail: payload }));

    // Google Tag Manager / Analytics dataLayer if present
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push({ event: evento, ...props });
    }
  } catch {
    /* noop fallback */
  }
}

export const trackEvent = track;
