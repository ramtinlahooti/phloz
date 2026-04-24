/**
 * `@phloz/analytics` — the only place in the monorepo that calls GTM,
 * GA4, or PostHog directly. Everything else uses `track(event, params)`.
 *
 * **Public surface (client-safe + isomorphic only):**
 *   - `track()` — typed dispatcher, fans out to GTM + PostHog + GA4 MP.
 *     Runs isomorphically; server paths are loaded via dynamic `import()`
 *     so they don't end up in client bundles.
 *   - `EventMap` / `EventName` — event taxonomy (ARCHITECTURE.md §11.2)
 *   - GTM bootstrap helpers for app root layouts
 *   - PostHog *client* init + identify + reset + hashAuthUidClient
 *
 * **Server-only APIs** (anything that pulls `posthog-node` / Node built-ins)
 * live under subpaths to keep them out of client bundles:
 *   - `@phloz/analytics/server` — aggregated server-only helpers
 *     (`hashAuthUidServer`, `sendGa4ServerEvent`, `captureServer`, …).
 *   - `@phloz/analytics/posthog/server` — raw PostHog-node wrapper.
 *   - `@phloz/analytics/ga4` — GA4 Measurement Protocol emitter
 *     (fetch-only; safe in either environment but grouped with server
 *     for discoverability).
 *
 * If a client component tries to import a server-only symbol from
 * this barrel, TypeScript will complain — that's by design. Turbopack
 * previously failed at build time with
 *   "the chunking context (unknown) does not support external modules
 *    (request: node:fs)"
 * when `posthog-node` leaked into a client chunk via this file.
 */

export { track, type TrackContext } from './track';
export * from './events';
export {
  DEFAULT_CONTAINER_ID,
  pushDataLayer,
  gtmBootstrapScript,
  gtmNoscriptIframeSrc,
} from './gtm';
export {
  initClientPostHog,
  captureClient,
  identifyClient,
  resetClient,
} from './posthog/client';
export { hashAuthUidClient } from './hash';
