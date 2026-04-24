'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Last-resort error boundary for the marketing site. Replaces the
 * root layout, so it has to render its own `<html>` + `<body>` with
 * zero dependency on shared UI primitives (those might be the thing
 * that threw).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: 'web_global_error' },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#0b0f17',
          color: '#e6e9ef',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
          Something went very wrong.
        </h1>
        <p style={{ maxWidth: '28rem', marginTop: '0.5rem', opacity: 0.7 }}>
          The page crashed before it could recover. Refreshing usually
          fixes it. The issue has been logged.
        </p>
        {error.digest && (
          <code
            style={{
              marginTop: '1rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              opacity: 0.8,
            }}
          >
            Error ID: {error.digest}
          </code>
        )}
        <a
          href="/"
          style={{
            marginTop: '1.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'inherit',
            textDecoration: 'none',
            fontSize: '0.875rem',
          }}
        >
          Reload
        </a>
      </body>
    </html>
  );
}
