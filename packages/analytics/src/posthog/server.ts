/**
 * PostHog — server side. Wraps `posthog-node` with an init-on-first-use
 * pattern so the SDK's HTTP handle isn't held open in environments that
 * never emit events.
 */

import { PostHog } from 'posthog-node';
import { hasEnv, loadEnv } from '@phloz/config';

let _client: PostHog | null = null;

export function isPostHogServerConfigured(): boolean {
  return hasEnv('NEXT_PUBLIC_POSTHOG_KEY');
}

function getClient(): PostHog | null {
  if (_client) return _client;
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  _client = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
    // Serverless: flush on each capture so nothing gets lost when the
    // lambda freezes. Worth the per-event HTTP cost for webhook volumes.
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
}

/**
 * Capture a server-side event. Requires a `distinctId` — typically a
 * hashed auth uid or workspace id for system events.
 */
export async function captureServer(input: {
  distinctId: string;
  event: string;
  params: Record<string, unknown>;
}): Promise<void> {
  const client = getClient();
  if (!client) return;
  client.capture({
    distinctId: input.distinctId,
    event: input.event,
    properties: input.params,
  });
  await client.flush();
}

/** Clean shutdown — call from process SIGTERM handlers. */
export async function shutdownPostHogServer(): Promise<void> {
  if (_client) {
    await _client.shutdown();
    _client = null;
  }
}
