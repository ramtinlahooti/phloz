import { z } from 'zod';

/**
 * Lenient URL helpers for free-text website inputs.
 *
 * Why this exists: forms using `z.string().url()` reject inputs like
 * `domain.com` and `www.domain.com` — users have to type the full
 * `https://domain.com` every time. Most agency users just paste the
 * bare domain. This module:
 *
 *   - Exports `optionalWebsiteSchema`: a validator that accepts the
 *     input shape (bare domain or full URL) without transforming it.
 *     Form values stay `string | undefined` so RHF + Input round-trip
 *     the user's keystrokes cleanly.
 *   - Exports `normaliseWebsiteInput()`: a pure function that turns
 *     any accepted shape into a canonical fully-qualified URL — call
 *     it at submit time on the client (so the request payload is
 *     already canonical) and on the server (defense-in-depth).
 *
 * Accepted inputs:
 *   - empty / whitespace-only / null / undefined → null
 *   - bare domain ("acme.com", "www.acme.com")
 *   - full URL ("http(s)://...")
 *
 * Rejected:
 *   - whitespace inside the value
 *   - hosts without a dot ("localhost" intentionally not supported
 *     here — this is a client-website input, not a dev URL field)
 */

const SCHEME_RE = /^https?:\/\//i;
const HOST_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/.*)?$/i;

function looksLikeWebsite(raw: string): boolean {
  const candidate = raw.replace(SCHEME_RE, '');
  return HOST_RE.test(candidate);
}

/**
 * Normalise a website input to a fully-qualified URL or null.
 * Returns null for blank input or anything that can't be parsed —
 * pair with `optionalWebsiteSchema` for upstream validation when
 * "I gave you garbage" needs to surface a Zod error.
 */
export function normaliseWebsiteInput(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const withScheme = SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Server-action validator. Accepts `string | null | undefined` so
 * actions can take either shape — forms send `null` to clear,
 * server-side callers may send `undefined` to skip the field.
 * Empty / whitespace passes; anything else must look like a domain
 * or full URL.
 *
 * Pair with `normaliseWebsiteInput()` at the action layer to turn
 * the validated input into a canonical fully-qualified URL or null
 * before persisting.
 */
export const optionalWebsiteSchema = z
  .string()
  .max(500)
  .nullable()
  .optional()
  .refine(
    (v) => {
      if (v === null || v === undefined) return true;
      const trimmed = v.trim();
      if (trimmed.length === 0) return true;
      return looksLikeWebsite(trimmed);
    },
    { message: 'Enter a website (acme.com or https://acme.com)' },
  );

/**
 * Form-side validator. Same accepted shapes as
 * `optionalWebsiteSchema` but the runtime type stays `string |
 * undefined` so React Hook Form + the Input component don't have
 * to handle `null` values. Use this in the schema you pass to
 * `useForm`; the form's submit handler can still send `null` to
 * the action when the user has cleared the field.
 */
export const websiteFormFieldSchema = z
  .string()
  .max(500)
  .optional()
  .refine(
    (v) => {
      if (v === undefined) return true;
      const trimmed = v.trim();
      if (trimmed.length === 0) return true;
      return looksLikeWebsite(trimmed);
    },
    { message: 'Enter a website (acme.com or https://acme.com)' },
  );
