'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef, MouseEvent } from 'react';

import { track } from '@phloz/analytics';

/**
 * Drop-in replacement for `<Link>` that fires a `cta_click` analytics
 * event before the navigation begins. The original `onClick` (if
 * supplied) still runs.
 *
 * We can't `await` the `track()` call — the browser path resolves
 * synchronously (dataLayer push + PostHog enqueue) so we just fire
 * and let `Link` handle the navigation.
 *
 * Keep the prop list thin: if a caller wants richer CTA logic (e.g.
 * scroll tracking, visibility tracking) they should use `track()`
 * directly rather than stretching this component.
 */
export function TrackedCtaLink({
  ctaLocation,
  ctaLabel,
  onClick,
  href,
  ...rest
}: Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> & {
  href: string;
  /** Where on the page this CTA lives — e.g. `homepage_hero`, `site_header`. */
  ctaLocation: string;
  /** The semantic label for this CTA — e.g. `start_free`, `view_pricing`. */
  ctaLabel: string;
}) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    void track('cta_click', {
      cta_location: ctaLocation,
      cta_label: ctaLabel,
      destination: href,
    });
    onClick?.(e);
  }

  return <Link {...rest} href={href} onClick={handleClick} />;
}
