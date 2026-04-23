import Link from 'next/link';

import { buttonVariants } from '@phloz/ui';

import { PRIMARY_NAV, SITE_CONFIG } from '@/lib/site-config';

/**
 * Sticky site header. Server component — no interactivity beyond
 * standard links, so no `"use client"` needed.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 header-fade backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground hover:text-foreground"
        >
          <span className="inline-block size-6 rounded-md bg-primary" aria-hidden />
          {SITE_CONFIG.name}
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={`${SITE_CONFIG.appUrl}/login`}
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
          >
            Sign in
          </Link>
          <Link
            href={`${SITE_CONFIG.appUrl}/signup`}
            className={buttonVariants({ size: 'sm' })}
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}
