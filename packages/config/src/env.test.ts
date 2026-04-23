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
});
