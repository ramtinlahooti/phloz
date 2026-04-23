import Link from 'next/link';
import { Suspense } from 'react';

import { buildAppMetadata } from '@/lib/metadata';

import { LoginForm } from './login-form';

export const metadata = buildAppMetadata({ title: 'Sign in' });

// useSearchParams() in LoginForm forces dynamic rendering.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your Phloz workspace.
        </p>
      </header>

      <Suspense fallback={<div className="h-48" />}>
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
