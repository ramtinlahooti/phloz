import * as Sentry from '@sentry/nextjs';

/**
 * Client-side Sentry init for the marketing site. Runs once per page
 * load. If `NEXT_PUBLIC_SENTRY_DSN` is absent (dev / self-hosted),
 * `Sentry.init` still no-ops gracefully.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

  // Marketing pages are heavily cached — low sample rate is plenty.
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,

  // Don't report the dev tunnel noise.
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
