'use server';

import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';
import { sendPlainEmail } from '@phloz/email';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

/**
 * Server actions for the messages module.
 *
 * Three kinds of writes live here:
 * - `sendEmailReplyAction` — agency → client email. Records an outbound
 *   `messages` row and calls Resend. Threads on the source message's
 *   `threadId` when provided.
 * - `postInternalNoteAction` — a team-only note on a client. Never
 *   emailed; visible to members only, not portal users.
 * - `markThreadReadAction` — opaque read-receipt update so the inbox
 *   can show unread counts later.
 */

const uuid = z.string().uuid();

// --- email reply -------------------------------------------------------
const replySchema = z.object({
  workspaceId: uuid,
  clientId: uuid,
  toContactId: uuid.optional(),
  to: z.string().email(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50_000),
  threadId: uuid.optional(),
  inReplyToExternalId: z.string().optional(),
});

export async function sendEmailReplyAction(
  input: z.infer<typeof replySchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const user = await requireUser();
  const db = getDb();

  // Find this client's inbound address so replies thread back in.
  const inboundRow = await db
    .select({ address: schema.inboundEmailAddresses.address })
    .from(schema.inboundEmailAddresses)
    .where(
      and(
        eq(schema.inboundEmailAddresses.clientId, parsed.data.clientId),
        eq(schema.inboundEmailAddresses.active, true),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  // Send via Resend (no-ops in dev without RESEND_API_KEY).
  let sendResult;
  try {
    sendResult = await sendPlainEmail({
      to: parsed.data.to,
      replyTo: inboundRow?.address,
      subject: parsed.data.subject,
      text: parsed.data.body,
      inReplyTo: parsed.data.inReplyToExternalId,
    });
  } catch (err) {
    return {
      ok: false,
      error: `email_send_failed: ${(err as Error).message}`,
    };
  }

  // Find the workspace_members.id for this user (messages.fromId is the
  // membership id, not the auth.users id).
  const membership = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  const [row] = await db
    .insert(schema.messages)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
      threadId: parsed.data.threadId ?? randomUUID(),
      direction: 'outbound',
      channel: 'email',
      fromType: 'member',
      fromId: membership?.id ?? null,
      subject: parsed.data.subject,
      body: parsed.data.body,
      rawEmail: {
        resendId: sendResult.id,
        sent: sendResult.sent,
        to: parsed.data.to,
      },
    })
    .returning({ id: schema.messages.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  fireTrack(
    'message_sent',
    { channel: 'email', direction: 'outbound' },
    serverTrackContext(user.id, parsed.data.workspaceId),
  );

  revalidatePath(`/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`);
  revalidatePath(`/${parsed.data.workspaceId}/messages`);
  return { ok: true, id: row.id };
}

// --- internal note -----------------------------------------------------
const noteSchema = z.object({
  workspaceId: uuid,
  clientId: uuid,
  body: z.string().trim().min(1).max(10_000),
  threadId: uuid.optional(),
});

export async function postInternalNoteAction(
  input: z.infer<typeof noteSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const user = await requireUser();
  const db = getDb();

  const membership = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  const [row] = await db
    .insert(schema.messages)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
      threadId: parsed.data.threadId ?? randomUUID(),
      direction: 'outbound',
      channel: 'internal_note',
      fromType: 'member',
      fromId: membership?.id ?? null,
      subject: null,
      body: parsed.data.body,
    })
    .returning({ id: schema.messages.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  fireTrack(
    'message_sent',
    { channel: 'internal_note', direction: 'outbound' },
    serverTrackContext(user.id, parsed.data.workspaceId),
  );

  revalidatePath(`/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`);
  revalidatePath(`/${parsed.data.workspaceId}/messages`);
  return { ok: true, id: row.id };
}
