/**
 * GA4 Measurement Protocol — server-side event emitter.
 *
 * Use for events that originate off the browser (Stripe webhooks, Inngest
 * jobs, server actions) so GA4 captures them for attribution. Fires over
 * plain fetch; no SDK dependency.
 *
 * Docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

import { loadEnv } from '@phloz/config';

export interface Ga4ServerEventInput {
  /**
   * A stable pseudonymous id for the user. In Phloz this is
   * `crypto.createHash('sha256').update(authUid).digest('hex')`.
   * GA4 calls this `client_id`; it must not be a real user id.
   */
  clientId: string;
  /** GA4 `user_id` — optional, same hashed id if you want cross-device stitching. */
  userId?: string;
  /** Event name; snake_case. */
  name: string;
  /** Event params; values must be primitives or arrays thereof. */
  params: Record<string, string | number | boolean | undefined>;
  /** Unix ms. Defaults to now. */
  timestampMs?: number;
}

export function isGa4ServerConfigured(): boolean {
  const env = loadEnv();
  return Boolean(env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && env.GA4_API_SECRET);
}

/**
 * Fire a server-side event to GA4. No-op if `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
 * or `GA4_API_SECRET` are missing (dev path). Returns `false` when skipped
 * and `true` on successful send.
 *
 * Throws on non-2xx responses so the caller can log via Sentry.
 */
export async function sendGa4ServerEvent(
  input: Ga4ServerEventInput,
): Promise<boolean> {
  const env = loadEnv();
  const measurementId = env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return false;

  // Strip undefined param values — GA4 rejects them.
  const params = Object.fromEntries(
    Object.entries(input.params).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number | boolean>;

  const body = {
    client_id: input.clientId,
    user_id: input.userId,
    timestamp_micros: (input.timestampMs ?? Date.now()) * 1000,
    non_personalized_ads: false,
    events: [{ name: input.name, params }],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    measurementId,
  )}&api_secret=${encodeURIComponent(apiSecret)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `GA4 Measurement Protocol ${res.status}: ${await res.text()}`,
    );
  }
  return true;
}
