import { Button, Heading, Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './layout';

export interface PasswordResetEmailProps {
  resetUrl: string;
  /** Minutes until the link expires (default 60, matching Supabase default). */
  expiresInMinutes?: number;
}

/**
 * Sent when a user requests a password reset. The link delivers them to a
 * Supabase-backed password-reset route on app.phloz.com.
 */
export function PasswordResetEmail({
  resetUrl,
  expiresInMinutes = 60,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your Phloz password">
      <Heading className="m-0 mb-4 text-2xl font-semibold tracking-tight">
        Reset your password
      </Heading>
      <Text className="m-0 mb-4 text-sm leading-6 text-neutral-700">
        We received a request to reset the password on your Phloz account.
        Click below to choose a new one.
      </Text>
      <Button
        href={resetUrl}
        className="rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white"
      >
        Reset password
      </Button>
      <Text className="m-0 mt-6 text-xs leading-5 text-neutral-500">
        Or open this link directly:
        <br />
        <Link href={resetUrl} className="text-neutral-500 underline">
          {resetUrl}
        </Link>
      </Text>
      <Text className="m-0 mt-4 text-xs leading-5 text-neutral-500">
        This link is valid for {expiresInMinutes} minutes. If you didn&apos;t
        request a password reset, you can safely ignore this email — your
        password won&apos;t change until you use the link.
      </Text>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  resetUrl: 'https://app.phloz.com/auth/reset?token=abc123',
  expiresInMinutes: 60,
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
