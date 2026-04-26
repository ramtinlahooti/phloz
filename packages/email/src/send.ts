import * as React from 'react';
import { EmailError } from './errors';
import { defaultFromAddress, getResend, isResendConfigured } from './client';
import {
  DailyDigestEmail,
  type DailyDigestEmailProps,
  InvitationEmail,
  type InvitationEmailProps,
  MessageNotificationEmail,
  type MessageNotificationEmailProps,
  PasswordResetEmail,
  type PasswordResetEmailProps,
  PortalMagicLinkEmail,
  type PortalMagicLinkEmailProps,
  TaskNotificationEmail,
  type TaskNotificationEmailProps,
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

/**
 * Send the daily-digest email. Caller owns the subject (lets the
 * Inngest function format it with the workspace name + day,
 * e.g. "Monday at Acme Agency"). `unsubscribeUrl` not wired yet —
 * see the note at the bottom of the template about reply-to opt-out
 * until we add the setting.
 */
export async function sendDailyDigest(
  input: BaseSendInput & DailyDigestEmailProps & { subject: string },
): Promise<SendResult> {
  const { to, from, replyTo, subject, ...templateProps } = input;
  return sendReactEmail({
    to,
    from: from ?? defaultFromAddress(),
    replyTo,
    subject,
    react: React.createElement(DailyDigestEmail, templateProps),
    tags: [{ name: 'category', value: 'daily_digest' }],
  });
}

/**
 * Send a per-task notification email. The caller (a server action
 * or Inngest function) is responsible for the recipient + the
 * preference checks BEFORE calling this. Subject derives from the
 * variant + task title so the inbox row reads correctly without
 * the caller composing it. `tags.event_type` mirrors the variant
 * so Resend's analytics can break down volume per kind.
 */
export async function sendTaskNotification(
  input: BaseSendInput & TaskNotificationEmailProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...templateProps } = input;
  const subject = buildTaskNotificationSubject(templateProps);
  return sendReactEmail({
    to,
    from: from ?? defaultFromAddress(),
    replyTo,
    subject,
    react: React.createElement(TaskNotificationEmail, templateProps),
    tags: [
      { name: 'category', value: 'task_notification' },
      { name: 'event_type', value: templateProps.variant },
    ],
  });
}

/**
 * Send an inbound-message notification email. Caller (the Resend
 * webhook + per-member preference helper) is responsible for
 * deciding the recipient + checking their gates BEFORE calling
 * this. Tagged `category: message_notification` for Resend
 * analytics.
 */
export async function sendMessageNotification(
  input: BaseSendInput & MessageNotificationEmailProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...templateProps } = input;
  const subject = templateProps.subject
    ? `[${templateProps.clientName}] ${templateProps.subject}`
    : `[${templateProps.clientName}] new message`;
  return sendReactEmail({
    to,
    from: from ?? defaultFromAddress(),
    replyTo,
    subject,
    react: React.createElement(MessageNotificationEmail, templateProps),
    tags: [
      { name: 'category', value: 'message_notification' },
      { name: 'event_type', value: 'inbound_message' },
    ],
  });
}

function buildTaskNotificationSubject(p: TaskNotificationEmailProps): string {
  switch (p.variant) {
    case 'task_assignment':
      return p.actorName
        ? `${p.actorName} assigned you "${p.taskTitle}"`
        : `New task: "${p.taskTitle}"`;
    case 'task_mention':
      return p.actorName
        ? `${p.actorName} mentioned you on "${p.taskTitle}"`
        : `You were mentioned on "${p.taskTitle}"`;
    case 'task_approval':
      return `Approval update — "${p.taskTitle}"`;
    case 'recurring_task_created':
      return `Recurring task ready — "${p.taskTitle}"`;
  }
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

/**
 * Send a plain email (no React template). Used by the messaging module
 * for agency → client replies where the body is whatever the team typed
 * in the compose box. Pass `inReplyTo` + `references` to thread the
 * reply on the recipient's client. `replyTo` defaults to the per-client
 * inbound address so the client's response comes back into Phloz.
 */
export async function sendPlainEmail(input: {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
  tags?: { name: string; value: string }[];
}): Promise<SendResult> {
  if (!isResendConfigured()) {
    // eslint-disable-next-line no-console
    console.info('[email] RESEND_API_KEY not set — skipping plain send', {
      to: input.to,
      subject: input.subject,
    });
    return { id: null, sent: false };
  }

  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers['In-Reply-To'] = input.inReplyTo;
  if (input.references?.length)
    headers['References'] = input.references.join(' ');

  const { data, error } = await getResend().emails.send({
    from: input.from ?? defaultFromAddress(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    tags: input.tags ?? [{ name: 'category', value: 'client_message' }],
  });

  if (error) throw new EmailError('send_failed', error.message);
  return { id: data?.id ?? null, sent: true };
}
