import { Button, Heading, Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './layout';

export interface PortalMagicLinkEmailProps {
  workspaceName: string;
  contactName: string;
  magicLinkUrl: string;
  /** How many days the link is valid (default 7). */
  expiresInDays?: number;
}

/**
 * Sent to a client contact to grant them access to their portal. Contains
 * the magic-link URL; no password. See ARCHITECTURE.md §6.3.
 */
export function PortalMagicLinkEmail({
  workspaceName,
  contactName,
  magicLinkUrl,
  expiresInDays = 7,
}: PortalMagicLinkEmailProps) {
  return (
    <EmailLayout
      preview={`Your secure link to ${workspaceName}'s client portal`}
    >
      <Heading className="m-0 mb-4 text-2xl font-semibold tracking-tight">
        Your portal access
      </Heading>
      <Text className="m-0 mb-4 text-sm leading-6 text-neutral-700">
        Hi {contactName},
      </Text>
      <Text className="m-0 mb-4 text-sm leading-6 text-neutral-700">
        <strong>{workspaceName}</strong> has shared a secure portal with you.
        You can view shared tasks, reply to messages, and see the assets your
        agency has prepared for you.
      </Text>
      <Button
        href={magicLinkUrl}
        className="rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white"
      >
        Open portal
      </Button>
      <Text className="m-0 mt-6 text-xs leading-5 text-neutral-500">
        Or open this link directly:
        <br />
        <Link href={magicLinkUrl} className="text-neutral-500 underline">
          {magicLinkUrl}
        </Link>
      </Text>
      <Text className="m-0 mt-4 text-xs leading-5 text-neutral-500">
        This link is valid for {expiresInDays} days. If it expires, request
        a new one from your agency contact.
      </Text>
    </EmailLayout>
  );
}

PortalMagicLinkEmail.PreviewProps = {
  workspaceName: 'Acme Agency',
  contactName: 'Jamie Chen',
  magicLinkUrl: 'https://app.phloz.com/portal/abc123def456',
  expiresInDays: 7,
} satisfies PortalMagicLinkEmailProps;

export default PortalMagicLinkEmail;
