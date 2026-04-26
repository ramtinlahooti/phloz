import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  // Vercel auto-populates `VERCEL_GIT_COMMIT_SHA` on every deploy;
  // `SENTRY_RELEASE` is the explicit override for non-Vercel
  // environments. Tagging events with a release lets us filter
  // Sentry by deploy and watch regressions land.
  release:
    process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.2,
  enabled: Boolean(
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  ),
});
