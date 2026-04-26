import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  // Vercel auto-populates `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` on
  // every deploy; the public-prefixed twin is what's available in
  // the browser bundle. See sentry.server.config.ts for the
  // server-side counterpart.
  release:
    process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Product app — higher sample rate, session replay on errors.
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,

  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
});
