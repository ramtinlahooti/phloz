import { hasEnv, requireEnv } from '@phloz/config';
import { Resend } from 'resend';

let _resend: Resend | null = null;

/**
 * Lazy Resend client. Throws if RESEND_API_KEY isn't set.
 * Callers should gate with `isResendConfigured()` when graceful no-op in dev
 * is acceptable (e.g. invitation emails during local testing).
 */
export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(requireEnv('RESEND_API_KEY'));
  }
  return _resend;
}

export function isResendConfigured(): boolean {
  return hasEnv('RESEND_API_KEY');
}

/**
 * Default `From` address for transactional email. Falls back to a sensible
 * default if `EMAIL_FROM_DOMAIN` isn't set — Zod gives us `phloz.com`.
 */
export function defaultFromAddress(): string {
  const domain = requireEnv('EMAIL_FROM_DOMAIN');
  return `Phloz <no-reply@${domain}>`;
}
