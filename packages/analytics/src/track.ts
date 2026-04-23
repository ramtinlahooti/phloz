/**
 * `track()` — the only function in the codebase that emits analytics events.
 * Dispatches to GTM (browser) + PostHog (browser) + GA4 Measurement
 * Protocol (server, for `SERVER_GA4_EVENTS`) + PostHog-node (server).
 *
 * Detects execution context by `typeof window`:
 *   - browser  → pushDataLayer + captureClient
 *   - server   → sendGa4ServerEvent (if the event is in SERVER_GA4_EVENTS)
 *                + captureServer
 *
 * CLAUDE.md §2 golden rule 4: no other code in the monorepo may call
 * `dataLayer.push`, `gtag()`, or `posthog.capture()` directly.
 */

import type { EventMap, EventName } from './events/types';
import { SERVER_GA4_EVENTS } from './events/types';
import { pushDataLayer } from './gtm';
import { captureClient } from './posthog/client';
import { captureServer } from './posthog/server';
import { sendGa4ServerEvent } from './ga4';

export interface TrackContext {
  /**
   * Hashed auth uid. Used as GA4 `client_id` + PostHog `distinctId`.
   * Required server-side; optional browser-side (PH/GA4 persist their own
   * anonymous id until identify() runs).
   */
  distinctId?: string;
  /**
   * Optional workspace id to tag every event with. Not PII; useful for
   * segmentation in PostHog.
   */
  workspaceId?: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Fire a tracked event. Overloads enforce that `params` matches the
 * event's declared shape in `EventMap`.
 *
 * Returns a promise only because the server path hits GA4 + PostHog over
 * the network; the browser path resolves synchronously.
 */
export async function track<E extends EventName>(
  event: E,
  params: EventMap[E],
  context?: TrackContext,
): Promise<void> {
  const merged = {
    ...params,
    ...(context?.workspaceId ? { workspace_id: context.workspaceId } : {}),
  } as Record<string, unknown>;

  if (isBrowser()) {
    pushDataLayer(event as string, merged);
    captureClient(event as string, merged);
    return;
  }

  // Server path. No distinctId → no server emit; caller is expected to
  // provide one (the helper enforces this at the call site by needing a
  // hashed uid; anonymous marketing-site server events are rare and would
  // synthesize a request-scoped id).
  if (!context?.distinctId) {
    // eslint-disable-next-line no-console
    console.warn('[analytics] track() called server-side without distinctId', {
      event,
    });
    return;
  }

  const tasks: Promise<unknown>[] = [];

  tasks.push(
    captureServer({
      distinctId: context.distinctId,
      event: event as string,
      params: merged,
    }),
  );

  if ((SERVER_GA4_EVENTS as readonly string[]).includes(event as string)) {
    // Coerce to the subset of primitive values GA4 accepts. Objects would
    // blow up the Measurement Protocol; we haven't declared any yet, but
    // keep the filter defensive.
    const ga4Params = Object.fromEntries(
      Object.entries(merged).filter(
        ([, v]) =>
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean',
      ),
    ) as Record<string, string | number | boolean>;
    tasks.push(
      sendGa4ServerEvent({
        clientId: context.distinctId,
        userId: context.distinctId,
        name: event as string,
        params: ga4Params,
      }),
    );
  }

  await Promise.all(tasks);
}
