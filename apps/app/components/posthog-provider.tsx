'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import {
  captureClient,
  initClientPostHog,
} from '@phloz/analytics';

/**
 * Mount once in the product-app root layout. Initialises PostHog
 * through `@phloz/analytics` (CLAUDE.md §2 golden rule 4 — no raw
 * PostHog SDK calls outside that package) and captures `$pageview` on
 * every client-side route change.
 *
 * If `NEXT_PUBLIC_POSTHOG_KEY` isn't set, the provider no-ops — no
 * network calls, no stubs. Matches the graceful-degradation pattern
 * used elsewhere in the monorepo.
 *
 * Identify (attaching the hashed user id to the session) happens in a
 * separate `AnalyticsIdentify` component mounted under the authed
 * workspace layout, because the root layout doesn't have a user yet.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) return;
    initClientPostHog({
      apiKey,
      apiHost:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    });
  }, []);

  // Pageview on each client-side nav. GTM owns pageviews on the
  // marketing site; inside the product app we track them here because
  // GTM-loaded conversion logic isn't relevant to the dashboard.
  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    captureClient('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
