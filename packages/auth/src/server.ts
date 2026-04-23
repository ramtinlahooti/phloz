import { requireEnv } from '@phloz/config';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client bound to the current request cookies, for server components
 * and server actions (Next.js App Router).
 *
 * Never pass this client to the browser — the anon key is public, but the
 * cookie binding is request-scoped and not useful across requests.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll is called from server components as part of the SSR
            // middleware rotation; writes from server components throw.
            // This branch is expected.
          }
        },
      },
    },
  );
}

/**
 * Supabase client with the service role key. Bypasses RLS. Use only in
 * webhook handlers, Inngest jobs, and onboarding server actions that have
 * already performed their own authorisation check.
 *
 * Lazily imports `@supabase/supabase-js` so it isn't pulled into bundles
 * that only use the SSR client.
 */
export async function createServiceRoleSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
