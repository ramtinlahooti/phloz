/**
 * PostHog — browser side. Lazy-loaded singleton so the SDK only ships
 * in bundles that render client components that need it.
 *
 * We expose `getClientPostHog()` + `captureClient()`; apps never import
 * `posthog-js` directly.
 */

import posthog, { type PostHog } from 'posthog-js';

let initialised = false;

interface InitOptions {
  apiKey: string;
  apiHost: string;
  /** User distinct id (hashed auth uid). Optional at boot. */
  distinctId?: string;
}

/**
 * Initialise the PostHog client. Safe to call multiple times — the first
 * call wins. Returns the PostHog instance or `null` when not in a browser
 * (makes the helper a no-op in SSR).
 */
export function initClientPostHog(options: InitOptions): PostHog | null {
  if (typeof window === 'undefined') return null;
  if (initialised) return posthog;

  posthog.init(options.apiKey, {
    api_host: options.apiHost,
    capture_pageview: false, // GTM/GA4 owns pageviews; PH captures events
    capture_pageleave: true,
    person_profiles: 'identified_only',
    autocapture: false, // explicit track() only — tight taxonomy
  });
  if (options.distinctId) posthog.identify(options.distinctId);
  initialised = true;
  return posthog;
}

/** Emit a PostHog event from the client. No-op when not initialised / SSR. */
export function captureClient(
  event: string,
  params: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  if (!initialised) return;
  posthog.capture(event, params);
}

/** Identify a user post-login. */
export function identifyClient(
  distinctId: string,
  traits?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  if (!initialised) return;
  posthog.identify(distinctId, traits);
}

/** Reset on logout so subsequent events are anonymous. */
export function resetClient(): void {
  if (typeof window === 'undefined') return;
  if (!initialised) return;
  posthog.reset();
}
