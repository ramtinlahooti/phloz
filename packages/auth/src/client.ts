import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for client components. Safe to call from any
 * `"use client"` module.
 *
 * IMPORTANT — env-var access must be literal.
 *
 * Next.js inlines `NEXT_PUBLIC_*` env vars at build time, but only when
 * the source code references them as `process.env.NAME_LITERAL` (dot
 * access with a static identifier). Dynamic reads like
 * `process.env[key]` — or anything that reaches them through a helper
 * such as `requireEnv()` — see an empty object on the browser.
 *
 * That's why this file uses the literal `process.env.NEXT_PUBLIC_*`
 * pattern instead of the `@phloz/config/env` helper, and why the
 * equivalent helper is fine on the server.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase env vars missing on the client. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the app\'s .env.local, then restart `next dev` so the values get inlined into the client bundle.',
    );
  }
  return createBrowserClient(url, anonKey);
}
