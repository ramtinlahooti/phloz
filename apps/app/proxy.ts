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
  return updateSession(request);
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
