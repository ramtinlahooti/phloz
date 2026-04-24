'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import * as Sentry from '@sentry/nextjs';

import { buttonVariants } from '@phloz/ui';

/**
 * Route-level error boundary. Wraps every non-root route in `apps/app`
 * (any route segment below the root layout). Renders a friendly
 * fallback UI instead of exposing the raw Next.js dev overlay / a
 * blank white page to users in production.
 *
 * Errors are captured to Sentry via `captureException`; the fingerprint
 * is the thrown error itself so duplicates roll up naturally. The
 * `digest` prop (added by Next.js for server-side errors) is included
 * in the extra payload so Sentry events link back to the server log.
 *
 * `reset()` is provided by Next.js — it re-renders the route segment,
 * useful for transient failures (e.g. a failed Drizzle query on cold
 * start).
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: 'app_route_error' },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-destructive)]">
        Something went wrong
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        We hit an unexpected error.
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The issue has been logged — our team will look into it. Try
        again, or head back to your dashboard.
      </p>
      {error.digest && (
        <code className="mt-4 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          Error ID: {error.digest}
        </code>
      )}
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className={buttonVariants({ size: 'sm' })}
        >
          Try again
        </button>
        <Link
          href="/"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
