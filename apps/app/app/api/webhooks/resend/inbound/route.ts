import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { parseResendInbound, verifyResendSignature } from '@phloz/email';
import { getDb, schema } from '@phloz/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resend inbound email webhook.
 *
 * 1. Verify the svix signature (Standard Webhooks spec).
 * 2. Parse + validate the envelope via Zod.
 * 3. Look up the target client via its opaque inbound address.
 * 4. Insert a `messages` row against that client.
 *
 * Anything we can't parse or verify returns 4xx so Resend retries.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    verifyResendSignature({
      rawBody,
      headers: {
        'svix-id': request.headers.get('svix-id'),
        'svix-timestamp': request.headers.get('svix-timestamp'),
        'svix-signature': request.headers.get('svix-signature'),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `invalid_signature: ${(err as Error).message}` },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseResendInbound(payload);
  } catch (err) {
    return NextResponse.json(
      { error: `invalid_envelope: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const db = getDb();

  // Try each `to:` address — first one that matches an active inbound
  // address routes the message.
  for (const recipient of parsed.allToAddresses) {
    const match = await db
      .select({
        clientId: schema.inboundEmailAddresses.clientId,
        workspaceId: schema.inboundEmailAddresses.workspaceId,
      })
      .from(schema.inboundEmailAddresses)
      .where(
        and(
          eq(schema.inboundEmailAddresses.address, recipient),
          eq(schema.inboundEmailAddresses.active, true),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!match) continue;

    await db.insert(schema.messages).values({
      workspaceId: match.workspaceId,
      clientId: match.clientId,
      threadId: randomUUID(),
      direction: 'inbound',
      channel: 'email',
      fromType: 'contact',
      fromId: null,
      subject: parsed.subject,
      body: parsed.text,
      rawEmail: { html: parsed.html, references: parsed.references },
    });

    return NextResponse.json({ ok: true, routed: true });
  }

  return NextResponse.json({ ok: true, routed: false });
}
