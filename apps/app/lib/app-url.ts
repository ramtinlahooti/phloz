import { headers } from 'next/headers';

/**
 * Resolve the canonical public URL of the product app at runtime.
 *
 * Priority:
 *   1. `NEXT_PUBLIC_APP_URL` env var — explicit override used by the
 *      production deploy and the `.env.local` template.
 *   2. The incoming request's Host + forwarded-proto — lets Vercel
 *      preview URLs and custom domains work without any env config.
 *   3. `http://localhost:3001` — dev fallback when there's neither.
 *
 * Solves the class of bug where the invitation / portal magic-link
 * email embeds `https://app.phloz.com` because that was the compiled-in
 * fallback, but DNS for `app.phloz.com` isn't pointed anywhere yet.
 * The derived URL is always reachable as long as the email was sent
 * from a live deploy.
 */
export async function getAppUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.length > 0) return envUrl.replace(/\/$/, '');

  try {
    const h = await headers();
    const host = h.get('host');
    const proto =
      h.get('x-forwarded-proto') ??
      (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() throws when called outside a request context (build
    // time, edge background work). Fall through to the dev default.
  }

  return 'http://localhost:3001';
}

/** Route-handler variant that reads the host off the `Request`. */
export function getAppUrlFromRequest(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.length > 0) return envUrl.replace(/\/$/, '');

  const host = request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  if (host) return `${proto}://${host}`;
  return 'http://localhost:3001';
}
