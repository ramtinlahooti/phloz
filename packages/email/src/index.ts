/**
 * `@phloz/email` — the only place in the monorepo that imports Resend or
 * emits transactional email. Route handlers / server actions call
 * `sendInvitation`, `sendPortalMagicLink`, `sendPasswordReset`, and the
 * webhook handler in `apps/app` calls `verifyResendSignature` +
 * `parseResendInbound`.
 *
 * Templates are React Email components rendered server-side by Resend.
 */

export * from './errors';
export * from './client';
export * from './send';
export * from './templates';
export * from './webhooks';
export * from './inbound-address';
