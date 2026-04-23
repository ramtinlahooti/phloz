import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireEnv } from '@phloz/config';
import { EmailError } from '../errors';

/**
 * Verify a Resend webhook signature.
 *
 * Resend uses the Standard Webhooks spec (svix-compatible): the server signs
 * `${id}.${timestamp}.${rawBody}` with the webhook secret using HMAC-SHA256
 * and sends the result in the `svix-signature` header (space-separated list
 * of `v1,<base64>` entries so secrets can rotate).
 *
 * Reference: https://www.standardwebhooks.com/
 *
 * Throws `EmailError('invalid_webhook_signature')` on any failure so the
 * route handler can return 401 uniformly.
 */
export function verifyResendSignature(input: {
  /** Raw request body as received — do NOT JSON.parse first. */
  rawBody: string;
  headers: {
    'svix-id'?: string | null;
    'svix-timestamp'?: string | null;
    'svix-signature'?: string | null;
  };
  /** Reject webhooks older than this many seconds. Default: 5 minutes. */
  toleranceSeconds?: number;
}): void {
  const id = input.headers['svix-id'];
  const timestamp = input.headers['svix-timestamp'];
  const signatureHeader = input.headers['svix-signature'];

  if (!id || !timestamp || !signatureHeader) {
    throw new EmailError(
      'invalid_webhook_signature',
      'Missing svix-id / svix-timestamp / svix-signature header',
    );
  }

  const tolerance = input.toleranceSeconds ?? 5 * 60;
  const receivedAt = Number(timestamp);
  if (!Number.isFinite(receivedAt)) {
    throw new EmailError(
      'invalid_webhook_signature',
      'svix-timestamp is not a unix timestamp',
    );
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - receivedAt) > tolerance) {
    throw new EmailError(
      'invalid_webhook_signature',
      'Webhook timestamp outside tolerance window',
    );
  }

  // Secret may be stored with or without the `whsec_` prefix. Strip it if
  // present; the raw secret bytes are what HMAC needs.
  const rawSecret = requireEnv('RESEND_WEBHOOK_SECRET');
  const secretBase64 = rawSecret.startsWith('whsec_')
    ? rawSecret.slice('whsec_'.length)
    : rawSecret;
  const secretBytes = Buffer.from(secretBase64, 'base64');

  const toSign = `${id}.${timestamp}.${input.rawBody}`;
  const expected = createHmac('sha256', secretBytes)
    .update(toSign)
    .digest('base64');

  // Header format: "v1,<base64> v1,<base64>" — any one match is sufficient.
  const candidates = signatureHeader
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [version, value] = part.split(',');
      return { version, value };
    });

  const anyMatch = candidates.some(({ version, value }) => {
    if (version !== 'v1' || !value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  });

  if (!anyMatch) {
    throw new EmailError(
      'invalid_webhook_signature',
      'No valid v1 signature matched',
    );
  }
}
