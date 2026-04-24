import { describe, expect, it, beforeEach } from 'vitest';
import { envSchema } from './env';

describe('envSchema', () => {
  beforeEach(() => {
    // no-op; we parse fresh copies per test
  });

  it('defaults NODE_ENV to development', () => {
    const parsed = envSchema.parse({});
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('defaults GTM container to GTM-W3MGZ8V7', () => {
    const parsed = envSchema.parse({});
    expect(parsed.NEXT_PUBLIC_GTM_CONTAINER_ID).toBe('GTM-W3MGZ8V7');
  });

  it('rejects invalid URLs for SUPABASE_URL', () => {
    const result = envSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepts empty env (all optional)', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // Regression: empty-string values are common in .env.local templates
  // (e.g. `NEXT_PUBLIC_SENTRY_DSN=`). They must be treated as absent
  // so optional URL fields don't trip the `.url()` parser.
  it('treats empty-string URL fields as undefined', () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_SENTRY_DSN: '',
      SENTRY_DSN: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      DATABASE_URL: '',
      NEXT_PUBLIC_POSTHOG_HOST: '',
      NEXT_PUBLIC_APP_URL: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
      expect(result.data.DATABASE_URL).toBeUndefined();
      // Empty-string fields with defaults fall back to the default.
      expect(result.data.NEXT_PUBLIC_POSTHOG_HOST).toBe(
        'https://us.i.posthog.com',
      );
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3001');
    }
  });

  it('treats empty-string text fields as undefined when optional', () => {
    const result = envSchema.safeParse({
      STRIPE_SECRET_KEY: '',
      RESEND_API_KEY: '',
      INNGEST_EVENT_KEY: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.STRIPE_SECRET_KEY).toBeUndefined();
      expect(result.data.RESEND_API_KEY).toBeUndefined();
      expect(result.data.INNGEST_EVENT_KEY).toBeUndefined();
    }
  });
});
