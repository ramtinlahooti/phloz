import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@phloz/auth/middleware';

/**
 * Next.js 16 edge proxy (formerly `middleware`). Two responsibilities,
 * in this order:
 *
 *  1. **Refresh the Supabase auth session cookie on every request**
 *     so server components always see a fresh JWT before it expires.
 *     `updateSession()` rotates the cookies + returns the current
 *     user (or null) for the protected-route check.
 *
 *  2. **Redirect unauthenticated visits to protected routes** to
 *     `/login?next=<original-path>` so the user lands back where
 *     they came from after signing in. Replaces the previous "page
 *     layout calls requireUser() and throws" pattern, which gave
 *     visitors a generic error page instead of the login form.
 *
 * "Protected" here means anything that isn't on the explicit allow
 * list below — every workspace dashboard, settings page, tasks
 * surface, etc. requires a session. The allow list covers the
 * auth pages themselves, the portal magic-link landing, the
 * Supabase auth callback, the API webhooks (Stripe / Resend /
 * Inngest sign their own payloads), and the public root.
 */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
];
const PUBLIC_PREFIXES = [
  '/portal/', // Portal magic-link landing — auth via cookie, not Supabase user
  '/api/webhooks/', // Stripe / Resend / Inngest — signature-verified server-side
  '/api/inngest', // Inngest's own signed envelope
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (user) return response;

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return response;

  // Unauthenticated visit to a protected path → bounce to /login
  // with `?next=<original>` so the post-login redirect lands the
  // user back where they were heading.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - images, fonts, static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
