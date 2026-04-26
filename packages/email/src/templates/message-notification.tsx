import { Button, Heading, Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './layout';

/**
 * Inbound-message notification email. Fired when a client emails
 * the workspace's inbound address (or replies via the portal).
 * Sent to owners + admins by default; per-member preferences gate
 * the actual delivery.
 *
 * Kept separate from `TaskNotificationEmail` because the payload
 * differs structurally — a message has a subject + body preview,
 * not a task title + due date.
 */
export interface MessageNotificationEmailProps {
  recipientName: string;
  workspaceName: string;
  /** The client whose inbound address received the email. */
  clientName: string;
  /** Email subject (or null when the client replied via the portal
   *  and didn't supply one). */
  subject: string | null;
  /** First ~200 chars of the body so the recipient can triage from
   *  the email itself. */
  bodyPreview: string;
  /** Deep link to the client's inbox in the product app. */
  inboxUrl: string;
}

export function MessageNotificationEmail({
  recipientName,
  workspaceName,
  clientName,
  subject,
  bodyPreview,
  inboxUrl,
}: MessageNotificationEmailProps) {
  const headline = subject
    ? `${clientName} replied: ${subject}`
    : `${clientName} sent a new message`;
  return (
    <EmailLayout preview={headline}>
      <Heading className="m-0 mb-2 text-2xl font-semibold tracking-tight">
        {headline}
      </Heading>
      <Text className="m-0 mb-4 text-sm leading-6 text-neutral-700">
        Hi {recipientName} — heads up from {workspaceName}.
      </Text>
      <div className="mb-5 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <Text className="m-0 text-base font-semibold text-neutral-900">
          {clientName}
        </Text>
        {subject && (
          <Text className="m-0 mt-1 text-xs font-medium text-neutral-700">
            {subject}
          </Text>
        )}
        <Text className="m-0 mt-2 whitespace-pre-wrap text-xs text-neutral-600">
          {bodyPreview}
        </Text>
      </div>
      <Text className="m-0 mb-5 text-sm leading-6 text-neutral-700">
        Open the inbox to read the full thread and reply.
      </Text>
      <Button
        href={inboxUrl}
        className="rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white"
      >
        Open inbox
      </Button>
      <Text className="m-0 mt-6 text-xs leading-5 text-neutral-500">
        Or open this link directly:
        <br />
        <Link href={inboxUrl} className="text-neutral-500 underline">
          {inboxUrl}
        </Link>
      </Text>
      <Text className="m-0 mt-4 text-xs leading-5 text-neutral-500">
        Don&apos;t want these? Adjust your preferences at
        Settings → Notifications inside Phloz.
      </Text>
    </EmailLayout>
  );
}

MessageNotificationEmail.PreviewProps = {
  recipientName: 'Alex',
  workspaceName: 'Acme Agency',
  clientName: 'ClientCo',
  subject: 'Re: Q2 reporting',
  bodyPreview:
    'Thanks for sending these over. Quick question on the conversion column — is that the GA4 event count or the imported one?',
  inboxUrl: 'https://app.phloz.com/<workspace>/messages',
} satisfies MessageNotificationEmailProps;

export default MessageNotificationEmail;
