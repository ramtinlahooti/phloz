/**
 * App-local helpers around `@phloz/analytics`.
 *
 * Two things live here:
 *
 *   1. `serverTrackContext(userId, workspaceId?)` — builds the
 *      `TrackContext` every server-side `track()` call needs. Hashes the
 *      auth uid so no PII leaves the process and tags the event with a
 *      workspace id when available.
 *
 *   2. `fireTrack(event, params, context?)` — fire-and-forget wrapper
 *      around `track()`. Server actions call it without awaiting so the
 *      response isn't gated on PostHog + GA4 network roundtrips; errors
 *      are logged and swallowed so a transient analytics blip never
 *      surfaces to the user as a failed mutation.
 *
 * Client components call `track()` directly — the browser path inside
 * the analytics package is synchronous (dataLayer + PostHog enqueue)
 * so fire-and-forget is unnecessary there.
 */

import {
  hashAuthUidServer,
  track,
  type EventMap,
  type EventName,
  type TrackContext,
} from '@phloz/analytics';

export function serverTrackContext(
  userId: string,
  workspaceId?: string,
): TrackContext {
  return {
    distinctId: hashAuthUidServer(userId),
    ...(workspaceId ? { workspaceId } : {}),
  };
}

/**
 * Fire-and-forget server-side track. Call without `await` — the promise
 * is explicitly voided and any network error is logged but not
 * propagated. PostHog + GA4 are not on the critical path for any user
 * action; dropping the occasional event is strictly better than failing
 * a client create / task create because an analytics backend blipped.
 */
export function fireTrack<E extends EventName>(
  event: E,
  params: EventMap[E],
  context: TrackContext,
): void {
  void track(event, params, context).catch((err) => {
    console.error('[analytics] server track failed', { event, err });
  });
}
