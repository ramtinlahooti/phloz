import { z } from 'zod';

/**
 * Zod schema for every environment variable used in the monorepo.
 *
 * In production, all "required at runtime" vars below must be set. Because this
 * scaffold also runs locally before services are provisioned, the schema treats
 * most vars as optional and lets callers use `requireEnv('X')` at the point of
 * use to assert presence.
 *
 * When a new service is added, update this file and `.env.example` together.
 */
/**
 * Top-level preprocess: treat empty strings as "not provided" so that
 * empty-but-present env vars (common in `.env.local` templates and
 * Vercel projects) pass `.optional()` fields without tripping
 * `.url()` / `.email()` parsers. Keys that omit the value in `.env`
 * also come through as empty strings — same treatment.
 */
const emptyStringsToUndefined = z.preprocess((raw) => {
  if (raw === null || typeof raw !== 'object') return raw;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = v === '' ? undefined : v;
  }
  return out;
}, z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().url().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Resend + email
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_FROM_DOMAIN: z.string().default('phloz.com'),
  INBOUND_EMAIL_DOMAIN: z.string().default('inbound.phloz.com'),

  // Analytics
  NEXT_PUBLIC_GTM_CONTAINER_ID: z.string().default('GTM-W3MGZ8V7'),
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().optional(),
  GA4_API_SECRET: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://us.i.posthog.com'),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Inngest
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // App URLs
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_MARKETING_URL: z.string().url().default('http://localhost:3000'),
}));

export const envSchema = emptyStringsToUndefined;
export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parse and cache process.env. Call at app boot to fail fast on bad config.
 * Safe to call multiple times — result is memoized.
 */
export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[env] Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  cached = parsed.data;
  return cached;
}

/**
 * Assert a single env var is present. Use at the call site of code paths that
 * actually need a given service (e.g. the Stripe client only runs when billing
 * code is invoked; in a fresh scaffold without Stripe credentials, other flows
 * should not blow up at boot).
 */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const env = loadEnv();
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Required env var ${String(key)} is not set`);
  }
  return value as NonNullable<Env[K]>;
}

/** Handy for feature-flag-style checks: "is Stripe configured?" */
export function hasEnv<K extends keyof Env>(key: K): boolean {
  const env = loadEnv();
  const value = env[key];
  return value !== undefined && value !== null && value !== '';
}
