/**
 * Server-only public surface of `@phloz/analytics`.
 *
 * Import from `@phloz/analytics/server` in server code (route handlers,
 * server actions, webhooks, Inngest functions) that needs to:
 *   - Build a `TrackContext` via `hashAuthUidServer`.
 *   - Fire events off the browser (GA4 Measurement Protocol, PostHog
 *     node SDK) directly — normally `track()` handles this for you.
 *
 * These must not appear in client bundles: `posthog-node` statically
 * imports `node:fs` and friends, and Turbopack rejects client chunks
 * that reference Node built-ins. Keep this file out of the main barrel
 * (`./index.ts`) — that's why it exists.
 */

export { hashAuthUidServer } from './hash';
export {
  sendGa4ServerEvent,
  isGa4ServerConfigured,
  type Ga4ServerEventInput,
} from './ga4';
export {
  captureServer,
  shutdownPostHogServer,
  isPostHogServerConfigured,
} from './posthog/server';
