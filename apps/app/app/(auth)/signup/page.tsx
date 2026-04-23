import Link from 'next/link';
import { Suspense } from 'react';

import { buildAppMetadata } from '@/lib/metadata';

import { SignupForm } from './signup-form';

export const metadata = buildAppMetadata({ title: 'Sign up' });

// useSearchParams() in SignupForm forces dynamic rendering.
export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create your workspace
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          14 days free on any paid plan. No credit card required.
        </p>
      </header>

      <Suspense fallback={<div className="h-64" />}>
        <SignupForm />
      </Suspense>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        By signing up, you agree to our{' '}
        <a
          href={`${process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://phloz.com'}/legal/terms`}
          className="underline-offset-4 hover:underline"
        >
          Terms
        </a>{' '}
        and{' '}
        <a
          href={`${process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://phloz.com'}/legal/privacy`}
          className="underline-offset-4 hover:underline"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
