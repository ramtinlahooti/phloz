import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

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
