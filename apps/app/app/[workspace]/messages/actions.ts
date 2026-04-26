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
import {
  extractMentionTokens,
  resolveMentionTokens,
} from '@/lib/mentions';

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

  // Fan out @-mention notifications. Internal notes are team-only,
  // so a mention here means "I'm tagging a teammate to look at
  // this client" — we route through the same `task_mention`
  // event-pref the comments path uses (one toggle controls all
  // mention emails per the user's mental model). Best-effort —
  // log + swallow errors so a Resend hiccup doesn't fail the
  // note write.
  void fanOutNoteMentions({
    workspaceId: parsed.data.workspaceId,
    clientId: parsed.data.clientId,
    actorUserId: user.id,
    body: parsed.data.body,
  }).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[internal-note] mention fan-out failed', err);
  });

  revalidatePath(`/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`);
  revalidatePath(`/${parsed.data.workspaceId}/messages`);
  return { ok: true, id: row.id };
}

/**
 * Send an `@`-mention notification to every workspace member tagged
 * in an internal note. Each recipient is gated by:
 *
 *  1. `workspace_members.paused_until` — vacation mode
 *  2. `notification_preferences` `task_mention` — per-event opt-out
 *  3. `notification_subscriptions, entity_type='client'` — mute
 *
 * Match logic mirrors comments-actions: full-email or local-part
 * resolves a token to a workspace_members row. Self-mentions
 * skipped.
 *
 * Plain email body — no React template today since the shape
 * ("teammate mentioned you in a note about ClientCo") is
 * structurally simpler than the dedicated TaskNotification +
 * MessageNotification templates and a third one would be debt.
 * Future v2 can collapse all three into a generic mention shell
 * if it stops fitting.
 */
async function fanOutNoteMentions(input: {
  workspaceId: string;
  clientId: string;
  actorUserId: string;
  body: string;
}): Promise<void> {
  const tokens = extractMentionTokens(input.body);
  if (tokens.length === 0) return;
  const matched = await resolveMentionTokens({
    workspaceId: input.workspaceId,
    tokens,
  });
  if (matched.length === 0) return;

  const db = getDb();
  const recipientIds = matched
    .filter((m) => m.userId !== input.actorUserId)
    .map((m) => m.membershipId);
  if (recipientIds.length === 0) return;

  // Single round-trip to load the gate inputs across every matched
  // recipient + the workspace + client context for the email body.
  const [memberStates, prefRows, muteRows, workspace, client, actor] =
    await Promise.all([
      db
        .select({
          id: schema.workspaceMembers.id,
          email: schema.workspaceMembers.email,
          displayName: schema.workspaceMembers.displayName,
          pausedUntil: schema.workspaceMembers.pausedUntil,
        })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, input.workspaceId)),
      db
        .select({
          workspaceMemberId: schema.notificationPreferences.workspaceMemberId,
          enabled: schema.notificationPreferences.enabled,
        })
        .from(schema.notificationPreferences)
        .where(
          and(
            eq(
              schema.notificationPreferences.workspaceId,
              input.workspaceId,
            ),
            eq(
              schema.notificationPreferences.eventType,
              'task_mention',
            ),
          ),
        ),
      db
        .select({
          workspaceMemberId:
            schema.notificationSubscriptions.workspaceMemberId,
        })
        .from(schema.notificationSubscriptions)
        .where(
          and(
            eq(
              schema.notificationSubscriptions.workspaceId,
              input.workspaceId,
            ),
            eq(schema.notificationSubscriptions.mode, 'mute'),
            eq(schema.notificationSubscriptions.entityType, 'client'),
            eq(schema.notificationSubscriptions.entityId, input.clientId),
          ),
        ),
      db
        .select({ name: schema.workspaces.name })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.id, input.workspaceId))
        .limit(1)
        .then((r) => r[0]),
      db
        .select({ name: schema.clients.name })
        .from(schema.clients)
        .where(eq(schema.clients.id, input.clientId))
        .limit(1)
        .then((r) => r[0]),
      db
        .select({
          displayName: schema.workspaceMembers.displayName,
          email: schema.workspaceMembers.email,
        })
        .from(schema.workspaceMembers)
        .where(
          and(
            eq(schema.workspaceMembers.workspaceId, input.workspaceId),
            eq(schema.workspaceMembers.userId, input.actorUserId),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

  if (!workspace || !client) return;

  const eventDisabled = new Set(
    prefRows.filter((p) => p.enabled === false).map((p) => p.workspaceMemberId),
  );
  const clientMuted = new Set(muteRows.map((s) => s.workspaceMemberId));
  const stateById = new Map(memberStates.map((m) => [m.id, m]));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com';
  const threadUrl = `${appUrl}/${input.workspaceId}/clients/${input.clientId}`;
  const preferencesUrl = `${appUrl}/${input.workspaceId}/settings#notifications`;
  const actorName =
    actor?.displayName?.trim() || actor?.email || 'A teammate';
  const noteExcerpt = input.body.slice(0, 240).trim();

  for (const id of recipientIds) {
    const member = stateById.get(id);
    if (!member?.email) continue;
    if (member.pausedUntil && member.pausedUntil > new Date()) continue;
    if (eventDisabled.has(id)) continue;
    if (clientMuted.has(id)) continue;

    const recipientName =
      member.displayName?.trim() || member.email || 'there';
    const subject = `[${client.name}] ${actorName} mentioned you in a note`;
    const text = [
      `Hi ${recipientName},`,
      '',
      `${actorName} mentioned you in an internal note about ${client.name} on ${workspace.name}:`,
      '',
      `"${noteExcerpt}"`,
      '',
      `Open the thread: ${threadUrl}`,
      '',
      `— Sent by Phloz on behalf of ${workspace.name}.`,
      `Manage your notification preferences: ${preferencesUrl}`,
    ].join('\n');

    try {
      await sendPlainEmail({
        to: member.email,
        subject,
        text,
        tags: [
          { name: 'category', value: 'note_mention' },
          { name: 'event_type', value: 'task_mention' },
        ],
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[note-mention] send failed', {
        recipientMemberId: id,
        error: (err as Error).message,
      });
    }
  }
}

const toggleStarSchema = z.object({
  workspaceId: uuid,
  messageId: uuid,
  starred: z.boolean(),
});

/**
 * Toggle a message's `starred` flag. Starred messages pin to the top
 * of the inbox so they aren't pushed off the first page by newer
 * traffic. Open to any role that can see the inbox (owner / admin /
 * member / viewer) — starring is a personal triage tool, not a
 * mutation that affects other members' workflow.
 */
export async function toggleMessageStarAction(
  input: z.infer<typeof toggleStarSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = toggleStarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }

  try {
    await requireRole(parsed.data.workspaceId, [
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const result = await db
    .update(schema.messages)
    .set({ starred: parsed.data.starred })
    .where(
      and(
        eq(schema.messages.id, parsed.data.messageId),
        eq(schema.messages.workspaceId, parsed.data.workspaceId),
      ),
    )
    .returning({
      id: schema.messages.id,
      clientId: schema.messages.clientId,
    });

  if (result.length === 0) {
    return { ok: false, error: 'not_found' };
  }

  revalidatePath(`/${parsed.data.workspaceId}/messages`);
  if (result[0]?.clientId) {
    revalidatePath(
      `/${parsed.data.workspaceId}/clients/${result[0].clientId}`,
    );
  }
  return { ok: true };
}
