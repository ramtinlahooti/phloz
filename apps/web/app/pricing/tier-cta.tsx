'use client';

import Link from 'next/link';

import { track } from '@phloz/analytics';

/**
 * CTA button for a specific pricing tier. Fires two analytics events
 * on click, in order:
 *   1. `pricing_page_view_tier` — semantic "user engaged with this
 *      tier". We fire on click rather than on-mount because mount
 *      would emit N events per pageview (one per tier displayed),
 *      which is noise; click indicates real engagement.
 *   2. `cta_click` — generic CTA signal so the tier-specific button
 *      shows up in the unified cta funnel alongside header/homepage
 *      CTAs.
 *
 * The Link handles the navigation as usual.
 */
export function PricingTierCta({
  tier,
  href,
  label,
  className,
}: {
  tier: 'starter' | 'pro' | 'growth' | 'business' | 'scale' | 'enterprise';
  href: string;
  label: string;
  className: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        void track('pricing_page_view_tier', { tier });
        void track('cta_click', {
          cta_location: 'pricing_page',
          cta_label: `pricing_tier_${tier}`,
          destination: href,
        });
      }}
    >
      {label}
    </Link>
  );
}
