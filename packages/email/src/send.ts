import * as React from 'react';
import { EmailError } from './errors';
import { defaultFromAddress, getResend, isResendConfigured } from './client';
import {
  InvitationEmail,
  type InvitationEmailProps,
  PasswordResetEmail,
  type PasswordResetEmailProps,
  PortalMagicLinkEmail,
  type PortalMagicLinkEmailProps,
} from './templates';

export interface SendResult {
  /** Resend message ID when configured; `null` when the key is absent (dev). */
  id: string | null;
  /** True if we actually called Resend; false if we no-op'd in unconfigured dev. */
  sent: boolean;
}

interface BaseSendInput {
  to: string;
  /** Optional override for the From header. Defaults to `defaultFromAddress()`. */
  from?: string;
  /** Optional reply-to. Agencies may override with a team address. */
  replyTo?: string;
}

/**
 * Shared send implementation. Handles the no-op path when Resend isn't
 * configured (local dev without a key) and wraps errors uniformly.
 */
async function sendReactEmail(params: {
  to: string;
  from: string;
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}): Promise<SendResult> {
  if (!isResendConfigured()) {
    // eslint-disable-next-line no-console
    console.info('[email] RESEND_API_KEY not set — skipping send', {
      to: params.to,
      subject: params.subject,
    });
    return { id: null, sent: false };
  }

  const { data, error } = await getResend().emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    react: params.react,
    replyTo: params.replyTo,
    tags: params.tags,
  });

  if (error) {
    throw new EmailError('send_failed', error.message);
  }
  if (!data?.id) {
    throw new EmailError('send_failed', 'Resend returned no message id');
  }
  return { id: data.id, sent: true };
}

/**
 * Send a workspace invitation email.
 * Caller owns `acceptUrl` construction (so the app layer controls the
 * invitation token and any query params).
 */
export async function sendInvitation(
  input: BaseSendInput & InvitationEmailProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...templateProps } = input;
  return sendReactEmail({
    to,
    from: from ?? defaultFromAddress(),
    replyTo,
    subject: `You've been invited to ${templateProps.workspaceName} on Phloz`,
    react: React.createElement(InvitationEmail, templateProps),
    tags: [{ name: 'category', value: 'invitation' }],
  });
}

/** Send a client-portal magic link to a client contact. */
export async function sendPortalMagicLink(
  input: BaseSendInput & PortalMagicLinkEmailProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...templateProps } = input;
  return sendReactEmail({
    to,
    from: from ?? defaultFromAddress(),
    replyTo,
    subject: `Your ${templateProps.workspaceName} client portal`,
    react: React.createElement(PortalMagicLinkEmail, templateProps),
    tags: [{ name: 'category', value: 'portal_magic_link' }],
  });
}

/** Send a Supabase-backed password reset link. */
export async function sendPasswordReset(
  input: BaseSendInput & PasswordResetEmailProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...templateProps } = input;
  return sendReactEmail({
    to,
    from: from ?? defaultFromAddress(),
    replyTo,
    subject: 'Reset your Phloz password',
    react: React.createElement(PasswordResetEmail, templateProps),
    tags: [{ name: 'category', value: 'password_reset' }],
  });
}
