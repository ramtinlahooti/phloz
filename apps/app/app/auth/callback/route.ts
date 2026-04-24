import { NextResponse, type NextRequest } from 'next/server';

import { createServerSupabase } from '@phloz/auth/server';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Prevent open redirects: only allow relative paths.
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/';

  // Fire `login` for successful magic-link sign-ins. `sign_up` is fired
  // from the signup form on credential submit, so we skip it here even
  // for the email-confirmation flow (would double-fire). `/reset-password`
  // is a password-reset click → user hasn't finished auth yet, skip.
  if (
    data.user &&
    safeRedirect !== '/reset-password' &&
    !safeRedirect.startsWith('/onboarding')
  ) {
    fireTrack(
      'login',
      { method: 'magic_link' },
      serverTrackContext(data.user.id),
    );
  }

  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
