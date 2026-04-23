import Link from 'next/link';

import { FOOTER_NAV, SITE_CONFIG } from '@/lib/site-config';

/**
 * Site-wide footer. Five columns on desktop; collapses to two on
 * mobile. The column registry lives in `site-config.ts` so the
 * footer + sitemap + programmatic-SEO pages stay in sync.
 */
export function SiteFooter() {
  const columns = Object.values(FOOTER_NAV);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {columns.map((col) => (
            <div key={col.label}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {col.label}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-8 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className="inline-block size-5 rounded-md bg-primary"
              aria-hidden
            />
            <span>
              © {year} {SITE_CONFIG.name}. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <a
              href={`https://twitter.com/${SITE_CONFIG.twitter.replace('@', '')}`}
              className="hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              Twitter
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
