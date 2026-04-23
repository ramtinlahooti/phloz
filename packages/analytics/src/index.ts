/**
 * `@phloz/analytics` — the only place in the monorepo that calls GTM,
 * GA4, or PostHog directly. Everything else uses `track(event, params)`.
 *
 * Public surface:
 *   - `track()` — typed dispatcher, fans out to GTM + PostHog + GA4 MP
 *   - `EventMap` / `EventName` — event taxonomy (ARCHITECTURE.md §11.2)
 *   - GTM bootstrap helpers for the app root layouts
 *   - PostHog init + identify + reset (client + server)
 *   - `sendGa4ServerEvent` + `hashAuthUid*` for server code paths
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
  captureServer,
  shutdownPostHogServer,
  isPostHogServerConfigured,
} from './posthog';
export {
  sendGa4ServerEvent,
  isGa4ServerConfigured,
  type Ga4ServerEventInput,
} from './ga4';
export { hashAuthUidServer, hashAuthUidClient } from './hash';
