'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import * as Sentry from '@sentry/nextjs';

import { buttonVariants } from '@phloz/ui';

/**
 * Route-level error boundary for the marketing site. Keeps the header
 * + footer (they're rendered by the root layout, above this boundary),
 * so visitors can still navigate away.
 *
 * Sends the error to Sentry with a `marketing` tag so in the Sentry UI
 * we can separate product errors from marketing errors.
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
      tags: { boundary: 'web_route_error' },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-destructive)]">
        Something went wrong
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        We hit an unexpected error.
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The issue has been logged. Try reloading, or head back home.
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
          Home
        </Link>
      </div>
    </div>
  );
}
