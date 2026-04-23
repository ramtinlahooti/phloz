import { loadGeistFonts } from '@phloz/ui/fonts';

import { GtmNoscript, GtmScript } from '@/components/gtm';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { buildMetadata, organizationJsonLd } from '@/lib/metadata';

import './globals.css';

export const metadata = buildMetadata();

/**
 * Root layout for the marketing site.
 *
 * - Loads Geist Sans + Mono via `@phloz/ui/fonts` (lazy so `next/font`
 *   only resolves in a Next context, not from Storybook/tests).
 * - Injects GTM (`GTM-W3MGZ8V7` by default) via `next/script` +
 *   `<noscript>` at the top of `<body>`.
 * - Renders an Organization JSON-LD block site-wide.
 * - Leaves theme dark by default — marketing pages opt into light via
 *   `className="light"` on individual routes if ever needed.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fonts = await loadGeistFonts();

  return (
    <html lang="en" className={fonts.className} suppressHydrationWarning>
      <head>
        <GtmScript />
        <script
          type="application/ld+json"
          // Static JSON — no user input, safe to inline.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd()),
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <GtmNoscript />
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
