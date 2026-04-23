'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { useEffect } from 'react';

/**
 * Mount once in the product-app root layout. Initializes PostHog once,
 * then captures `$pageview` on every client-side route change.
 *
 * If `NEXT_PUBLIC_POSTHOG_KEY` isn't set, the provider no-ops entirely
 * — no network calls, no stubs. Matches the graceful-degradation
 * pattern used across `@phloz/analytics`.
 */
let initialized = false;

function initPostHog() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    // GTM owns pageviews on the marketing site; inside the product app
    // we track them here because GTM-loaded conversion logic isn't
    // relevant to the dashboard.
    capture_pageview: false,
    autocapture: false,
    persistence: 'localStorage+cookie',
    loaded: (ph) => {
      if (process.env.NODE_ENV !== 'production') ph.debug(false);
    },
  });
  initialized = true;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!initialized || !pathname) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
