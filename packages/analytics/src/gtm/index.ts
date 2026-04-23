/**
 * GTM integration — browser-only. `track()` in this package is the only
 * caller; nothing else in the monorepo touches `window.dataLayer` directly
 * (see CLAUDE.md §2 golden rule 4).
 */

export const DEFAULT_CONTAINER_ID = 'GTM-W3MGZ8V7';

interface DataLayerObject {
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: DataLayerObject[];
  }
}

/** True when we're in a browser context with a dataLayer wired up. */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Ensure `window.dataLayer` exists (GTM snippet creates it, but we also
 * want `track()` to work if someone calls it before GTM has loaded).
 */
function ensureDataLayer(): DataLayerObject[] {
  if (!isBrowser()) return [];
  if (!window.dataLayer) window.dataLayer = [];
  return window.dataLayer;
}

/**
 * Push an event onto the dataLayer. No-op on the server.
 * GTM forwards this to GA4 via the configured tag.
 */
export function pushDataLayer(
  event: string,
  params: Record<string, unknown>,
): void {
  if (!isBrowser()) return;
  ensureDataLayer().push({ event, ...params });
}

/**
 * Build the inline `<script>` tag that bootstraps GTM. Rendered once in
 * each app's root layout. Placed here (not in the app) so the container
 * id comes from the analytics package single source of truth.
 */
export function gtmBootstrapScript(containerId: string): string {
  // Google's canonical loader, reformatted for readability. Safe to inline.
  return `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`.trim();
}

/** The `<noscript>` iframe fallback that goes immediately after <body>. */
export function gtmNoscriptIframeSrc(containerId: string): string {
  return `https://www.googletagmanager.com/ns.html?id=${containerId}`;
}
