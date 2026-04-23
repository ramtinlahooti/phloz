import { NextResponse, type NextRequest } from 'next/server';

import { createServerSupabase } from '@phloz/auth/server';

/**
 * Supabase auth callback. Handles:
 * - OAuth provider redirects (when we add them in V2)
 * - Magic-link clicks (single-use OTP in URL)
 * - Email-confirmation clicks (post-signup)
 * - Password-reset clicks (redirects to /reset-password)
 *
 * The URL has `?code=<PKCE code>` for supabase v2. We exchange it for
 * a session, then redirect to the requested destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect_to') ?? searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Prevent open redirects: only allow relative paths.
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/';
  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
