import { Button, Heading, Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './layout';

export interface InvitationEmailProps {
  workspaceName: string;
  inviterName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  acceptUrl: string;
}

/**
 * Sent when an owner/admin invites someone to a workspace.
 * The `acceptUrl` contains the invitation token as a path param.
 */
export function InvitationEmail({
  workspaceName,
  inviterName,
  role,
  acceptUrl,
}: InvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to ${workspaceName} on Phloz`}
    >
      <Heading className="m-0 mb-4 text-2xl font-semibold tracking-tight">
        Join {workspaceName}
      </Heading>
      <Text className="m-0 mb-4 text-sm leading-6 text-neutral-700">
        {inviterName} invited you to join <strong>{workspaceName}</strong> on
        Phloz as a <strong>{role}</strong>.
      </Text>
      <Text className="m-0 mb-6 text-sm leading-6 text-neutral-700">
        Phloz is the CRM and tracking infrastructure platform for digital
        marketing agencies. Click below to accept the invitation and create
        your account.
      </Text>
      <Button
        href={acceptUrl}
        className="rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white"
      >
        Accept invitation
      </Button>
      <Text className="m-0 mt-6 text-xs leading-5 text-neutral-500">
        Or open this link directly:
        <br />
        <Link href={acceptUrl} className="text-neutral-500 underline">
          {acceptUrl}
        </Link>
      </Text>
      <Text className="m-0 mt-4 text-xs leading-5 text-neutral-500">
        This invitation expires in 7 days. If you didn&apos;t expect this
        email, you can safely ignore it.
      </Text>
    </EmailLayout>
  );
}

InvitationEmail.PreviewProps = {
  workspaceName: 'Acme Agency',
  inviterName: 'Ramtin Lahooti',
  role: 'member',
  acceptUrl: 'https://app.phloz.com/invite/abc123',
} satisfies InvitationEmailProps;

export default InvitationEmail;
