import Link from 'next/link';

import { buildAppMetadata } from '@/lib/metadata';

import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = buildAppMetadata({ title: 'Forgot password' });

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </header>

      <ForgotPasswordForm />

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
