import { requireEnv } from '@phloz/config';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for client components. Reads cookies via the browser API.
 * Safe to use anywhere `"use client"` is present.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
}
