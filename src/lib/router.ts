/**
 * Client-side ultra-fast SPA router helper for DG Automóveis.
 * Enables 0ms latency screen transitions without page reloads on 3G/4G/5G.
 */

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (!to) return;

  // External URLs (WhatsApp, Google Maps, Social Media, etc.)
  if (to.startsWith('http://') || to.startsWith('https://') || to.startsWith('tel:') || to.startsWith('mailto:')) {
    window.location.href = to;
    return;
  }

  const current = window.location.pathname + window.location.search + window.location.hash;
  if (current === to && !options.replace) return;

  if (options.replace) {
    window.history.replaceState({}, '', to);
  } else {
    window.history.pushState({}, '', to);
  }

  // Scroll to top instantly on screen change
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Dispatch custom location event to update React SPA router instantly
  window.dispatchEvent(new Event('popstate'));
}

/**
 * Global event listener that turns ALL internal `<a href="/...">` links into instant 0ms SPA transitions.
 */
export function setupInstantLinkInterceptor(): void {
  if (typeof window === 'undefined') return;

  document.addEventListener('click', (e: MouseEvent) => {
    // Ignore modified clicks (ctrl, cmd, shift, alt) or non-left clicks
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) {
      return;
    }

    const target = e.target as HTMLElement | null;
    const anchor = target?.closest('a') as HTMLAnchorElement | null;

    if (!anchor) return;

    const href = anchor.getAttribute('href');

    // Skip if no href, download attribute, target="_blank", or javascript void
    if (
      !href ||
      anchor.hasAttribute('download') ||
      anchor.target === '_blank' ||
      href.startsWith('#') ||
      href.startsWith('javascript:')
    ) {
      return;
    }

    // Check if it's an internal relative link or same origin
    const isInternal =
      href.startsWith('/') && !href.startsWith('//') ||
      anchor.origin === window.location.origin;

    if (isInternal) {
      // Don't intercept API or static asset downloads
      const pathname = href.startsWith('/') ? href : new URL(href).pathname;
      if (pathname.startsWith('/api/') || pathname.startsWith('/assets/')) {
        return;
      }

      e.preventDefault();
      const fullPath = href.startsWith('/') ? href : new URL(href).pathname + new URL(href).search + new URL(href).hash;
      navigate(fullPath);
    }
  });
}
