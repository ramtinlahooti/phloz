'use client';

import { useEffect } from 'react';

import {
  hashAuthUidClient,
  identifyClient,
} from '@phloz/analytics';

/**
 * Mount inside the authed workspace layout so every product-app page
 * attaches the current user's hashed id to the PostHog session. The
 * hash is computed on the client via SubtleCrypto so the plain uid
 * never leaves the process.
 *
 * No-ops when PostHog isn't initialised (missing key → provider is a
 * no-op → `identifyClient` short-circuits).
 */
export function AnalyticsIdentify({
  userId,
  workspaceId,
  tier,
  role,
}: {
  userId: string;
  workspaceId: string;
  tier: string;
  role: string;
}) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const distinctId = await hashAuthUidClient(userId);
        if (cancelled) return;
        identifyClient(distinctId, {
          workspace_id: workspaceId,
          tier,
          role,
        });
      } catch {
        // SubtleCrypto unavailable (ancient runtime) — skip identify.
        // Pageviews still fire anonymously.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, workspaceId, tier, role]);

  return null;
}
