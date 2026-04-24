import { type NextRequest } from 'next/server';

import { updateSession } from '@phloz/auth/middleware';

/**
 * Next.js 16 edge proxy (formerly `middleware`). Runs on every request
 * that matches the config below. Refreshes the Supabase auth session
 * cookie so server components always see a fresh JWT.
 *
 * The actual auth enforcement happens per-route: protected layouts
 * call `requireUser()` from `@phloz/auth`, which redirects to /login
 * if there's no session.
 */
export default async function proxy(request: NextRequest) {
  // updateSession returns `{ response, user }` — the proxy only needs
  // the response (a NextResponse with refreshed Supabase cookies).
  // Page-level `requireUser()` handles actual auth enforcement.
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - images, fonts, static assets
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
