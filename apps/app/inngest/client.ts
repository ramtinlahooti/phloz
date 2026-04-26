import { Inngest } from 'inngest';

/**
 * Event catalog. Names are `<domain>/<action>`; data shapes are
 * enforced at the call site (server actions + route handlers) via Zod
 * where it matters, rather than through Inngest's typed event catalog.
 *
 * Inngest v4 moved strict event typing to per-trigger schemas via
 * `eventType()` — we opt out of that for now because our events are
 * narrow and runtime validation already lives in `@phloz/config` /
 * per-module Zod schemas.
 */
export const INNGEST_EVENT_NAMES = [
  'workspace/created',
  'workspace/client-added',
  'billing/recompute-active-clients',
  'billing/trial-ending',
  'stripe/subscription-updated',
  /** Fired on-demand to send a daily digest to one workspace's owner
   *  (for testing) OR fired by the cron over every workspace. */
  'digest/send-daily',
  /** Fired on-demand to process recurring task templates for one
   *  workspace, ignoring the local-hour gate. Cron path uses no
   *  event name. */
  'recurring/process',
  /** Fired on-demand to run the weekly tracking-map audit for one
   *  workspace. Cron path runs over every workspace; this manual
   *  variant is useful for backfills + replays from the Inngest
   *  dashboard. */
  'audit/run-weekly',
] as const;
export type PhlozInngestEventName = (typeof INNGEST_EVENT_NAMES)[number];

/**
 * Singleton Inngest client. `INNGEST_SIGNING_KEY` and
 * `INNGEST_EVENT_KEY` are read from the environment automatically in
 * v4; no need to wire them through the constructor.
 */
export const inngest = new Inngest({
  id: 'phloz',
});
