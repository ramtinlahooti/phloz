import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

/**
 * Newsletter subscribe endpoint. Public — callable from the marketing
 * site (phloz.com) cross-origin. Uses the service-role DB connection
 * to bypass RLS on `newsletter_subscribers` (the table has RLS enabled
 * with no policies; only service-role can write).
 *
 * Idempotent: ON CONFLICT DO NOTHING on the email unique index, so
 * double-submits don't error. Returns `{ ok: true }` either way —
 * we don't leak whether an address was already subscribed.
 *
 * Analytics: always fires `newsletter_signup` with the provided
 * `source` tag. distinctId is synthesized from the email hash since
 * anonymous marketing visitors don't have an auth uid yet.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  source: z.string().trim().min(1).max(80),
});

// Origins that are allowed to POST. Mirrors Vercel's project domains +
// local dev. Anything else gets a 403 — we can't trust the form came
// from us otherwise.
const ALLOWED_ORIGINS = new Set<string>([
  'https://phloz.com',
  'https://www.phloz.com',
  'http://localhost:3000',
  process.env.NEXT_PUBLIC_MARKETING_URL ?? '',
].filter(Boolean));

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  // CORS: reject cross-origin requests from anything not in the allow
  // list. Same-origin requests (origin header matches the host) don't
  // need the Access-Control-Allow-Origin header, so passing an empty
  // string is correct there.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json(
      { error: 'forbidden_origin' },
      { status: 403, headers },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json' },
      { status: 400, headers },
    );
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_email' },
      { status: 400, headers },
    );
  }

  const db = getDb();
  try {
    // Idempotent insert. If the email already exists we silently no-op;
    // we don't re-activate unsubscribed rows automatically — that's a
    // confirmation flow we haven't built yet.
    await db
      .insert(schema.newsletterSubscribers)
      .values({
        email: parsed.data.email,
        source: parsed.data.source,
      })
      .onConflictDoNothing({ target: schema.newsletterSubscribers.email });
  } catch (err) {
    // Unexpected DB error. Log it and surface a generic error; don't
    // leak schema details to the public endpoint.
    console.error('[newsletter.subscribe] insert failed', err);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500, headers },
    );
  }

  // Fire the analytics event. distinctId is a deterministic hash of
  // the email so re-subscribing the same email doesn't create a new
  // PostHog identity. Emails are also the only identifier the
  // marketing visitor has at this point.
  fireTrack(
    'newsletter_signup',
    { source: parsed.data.source },
    serverTrackContext(parsed.data.email),
  );

  return NextResponse.json({ ok: true }, { status: 200, headers });
}
