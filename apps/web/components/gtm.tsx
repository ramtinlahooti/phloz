import Script from 'next/script';

import { DEFAULT_CONTAINER_ID, gtmBootstrapScript } from '@phloz/analytics';

/**
 * Google Tag Manager bootstrap. Rendered once at the top of the root
 * layout. Uses `next/script` with `strategy="afterInteractive"` so the
 * container loads without blocking LCP.
 *
 * The container ID comes from `NEXT_PUBLIC_GTM_CONTAINER_ID` (falls
 * back to the production container `GTM-W3MGZ8V7` defined in
 * `@phloz/analytics`).
 */
export function GtmScript() {
  const containerId =
    process.env.NEXT_PUBLIC_GTM_CONTAINER_ID ?? DEFAULT_CONTAINER_ID;

  return (
    <Script
      id="gtm-bootstrap"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: gtmBootstrapScript(containerId) }}
    />
  );
}

/**
 * The `<noscript>` counterpart — rendered once at the top of <body>
 * so the GTM container can still fire for users without JavaScript.
 */
export function GtmNoscript() {
  const containerId =
    process.env.NEXT_PUBLIC_GTM_CONTAINER_ID ?? DEFAULT_CONTAINER_ID;
  const src = `https://www.googletagmanager.com/ns.html?id=${containerId}`;
  return (
    <noscript>
      <iframe
        src={src}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
