import { requireEnv } from '@phloz/config';
import { customAlphabet } from 'nanoid';

/**
 * Opaque inbound-address IDs. No workspace slug, no client slug — see
 * ARCHITECTURE.md §10.1 for why.
 *
 * Alphabet drops vowels + ambiguous chars (0/O, 1/l/I) so the address
 * reads cleanly when a user is asked to quote it. 12 chars yields
 * ~2.1 trillion combinations — ample for V1's scale.
 */
const INBOUND_ALPHABET = '23456789bcdfghjkmnpqrstvwxyz';
const INBOUND_ID_LENGTH = 12;

const generateInboundId = customAlphabet(INBOUND_ALPHABET, INBOUND_ID_LENGTH);

/** Generate a unique opaque address for a client. */
export function generateInboundAddress(): string {
  const domain = requireEnv('INBOUND_EMAIL_DOMAIN');
  return `client-${generateInboundId()}@${domain}`;
}

/**
 * Parse `client-xxxx@inbound.phloz.com` and return the opaque id portion.
 * Returns `null` if the address doesn't match the expected shape — in
 * which case the caller should treat it as an unknown inbound.
 */
export function extractInboundId(address: string): string | null {
  const match = /^client-([a-z0-9]+)@/i.exec(address.trim().toLowerCase());
  return match?.[1] ?? null;
}
