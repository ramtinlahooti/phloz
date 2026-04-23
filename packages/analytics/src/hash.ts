/**
 * Hash helpers for analytics identifiers.
 *
 * Per ARCHITECTURE.md §11.1, no PII ever lands in analytics params. User
 * ids are hashed; workspace ids are acceptable as-is.
 *
 * We use SHA-256 because GA4's `client_id` accepts arbitrary strings and
 * PostHog's `distinctId` is also opaque; the collision resistance of
 * SHA-256 is more than enough for our scale.
 */

import { createHash } from 'node:crypto';

/** Hash a server-known auth uid for analytics. Stable across sessions. */
export function hashAuthUidServer(authUid: string): string {
  return createHash('sha256').update(authUid).digest('hex');
}

/**
 * Browser-side SHA-256 via SubtleCrypto. Async because Web Crypto is async.
 * Returns hex to match the server helper, so the two produce the same id
 * for the same uid.
 */
export async function hashAuthUidClient(authUid: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') {
    throw new Error('SubtleCrypto unavailable — cannot hash on this runtime');
  }
  const buf = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(authUid),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
