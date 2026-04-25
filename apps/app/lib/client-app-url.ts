/**
 * Browser-safe canonical app URL. Used by the auth forms
 * (`signInWithOtp`, `signUp`, `resetPasswordForEmail`) to build the
 * `emailRedirectTo` URL that ends up in the magic-link email.
 *
 * Prefers `NEXT_PUBLIC_APP_URL` (compiled into the client bundle by
 * Next.js) so emails always embed the canonical app domain — even
 * when the user's browser is on a non-canonical host (e.g. while
 * `phloz.com` still DNS-resolves to the app project pre-marketing-
 * project split). Falls back to `window.location.origin` when the
 * env var isn't set, which keeps Vercel preview URLs working without
 * any per-deploy config.
 *
 * Lives in its own file (not `app-url.ts`) because the latter
 * imports `next/headers` and is therefore server-only — pulling it
 * into a `'use client'` component would break the build.
 */
export function getClientAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.length > 0) return envUrl.replace(/\/$/, '');
  return window.location.origin;
}
