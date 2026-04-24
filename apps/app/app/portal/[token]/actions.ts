'use server';

import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { validatePortalMagicLink } from '@phloz/auth/portal';
import { createServiceRoleSupabase } from '@phloz/auth/server';
import type { ApprovalState } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import { sendPlainEmail } from '@phloz/email';

import { fireTrack, serverTrackContext } from '@/lib/analytics';
import { getAppUrl } from '@/lib/app-url';

/**
 * Portal-session-aware approval action. Unlike agency actions which
 * rely on `requireRole` + a Supabase user, this one validates a
 * magic-link token and scopes writes to that client only.
 *
 * Guardrails:
 * - Token must be valid + unexpired.
 * - Task must exist within the token's workspace + client.
 * - Task must have `visibility = client_visible` (portal users never
 *   see internal tasks).
 * - State must be one of the client-side terminal states —
 *   `approved`, `rejected`, `needs_changes`. Clients can't go back to
 *   `pending` themselves (agency resets that).
 */
const schema_ = z.object({
  token: z.string().min(10).max(80),
  taskId: z.string().uuid(),
  state: z.enum(['approved', 'rejected', 'needs_changes']),
  comment: z.string().trim().max(2000).optional(),
});

export async function setClientApprovalAction(
  input: z.infer<typeof schema_>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema_.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  const link = await validatePortalMagicLink(parsed.data.token);
  if (!link) return { ok: false, error: 'invalid_or_expired_token' };

  const db = getDb();
  const task = await db
    .select({
      id: schema.tasks.id,
      visibility: schema.tasks.visibility,
      clientId: schema.tasks.clientId,
      workspaceId: schema.tasks.workspaceId,
    })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.id, parsed.data.taskId),
        eq(schema.tasks.workspaceId, link.workspaceId),
        eq(schema.tasks.clientId, link.clientId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!task) return { ok: false, error: 'not_found' };
  if (task.visibility !== 'client_visible') {
    return { ok: false, error: 'forbidden' };
  }

  await db
    .update(schema.tasks)
    .set({
      approvalState: parsed.data.state as ApprovalState,
      approvalComment: parsed.data.comment ?? null,
      approvalUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, parsed.data.taskId));

  // Fire-and-forget notification to the workspace owner so the agency
  // discovers the client action. Swallow failures — the approval was
  // recorded and is the source of truth.
  void notifyAgencyOfApproval({
    workspaceId: link.workspaceId,
    clientId: link.clientId,
    taskId: parsed.data.taskId,
    state: parsed.data.state,
    comment: parsed.data.comment ?? null,
  }).catch((err: unknown) => {
    console.error('[portal.approval] notify failed', err);
  });

  revalidatePath(`/portal/${parsed.data.token}`);
  revalidatePath(`/${link.workspaceId}/clients/${link.clientId}`);
  revalidatePath(`/${link.workspaceId}/tasks`);
  return { ok: true };
}

/**
 * Send a plain email to the workspace owner summarising the client's
 * action. Best-effort — no-ops silently if Resend isn't configured
 * or the owner's email is missing.
 */
async function notifyAgencyOfApproval(input: {
  workspaceId: string;
  clientId: string;
  taskId: string;
  state: 'approved' | 'rejected' | 'needs_changes';
  comment: string | null;
}) {
  const db = getDb();

  const [workspace, task, client] = await Promise.all([
    db
      .select({
        id: schema.workspaces.id,
        name: schema.workspaces.name,
        ownerUserId: schema.workspaces.ownerUserId,
      })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, input.workspaceId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, input.taskId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ name: schema.clients.name })
      .from(schema.clients)
      .where(eq(schema.clients.id, input.clientId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!workspace || !task || !client || !workspace.ownerUserId) return;

  const supabase = await createServiceRoleSupabase();
  const { data: userData } = await supabase.auth.admin.getUserById(
    workspace.ownerUserId,
  );
  const ownerEmail = userData?.user?.email;
  if (!ownerEmail) return;

  const stateLabel =
    input.state === 'approved'
      ? 'approved'
      : input.state === 'rejected'
        ? 'rejected'
        : 'asked for changes on';

  const subject = `[${workspace.name}] ${client.name} ${stateLabel} "${task.title}"`;
  const commentLine = input.comment
    ? `\n\nTheir comment:\n"${input.comment}"`
    : '';
  const appUrl = await getAppUrl();
  const taskUrl = `${appUrl}/${workspace.id}/clients/${input.clientId}`;
  const text = [
    `${client.name} just ${stateLabel} the task "${task.title}" in the portal.${commentLine}`,
    '',
    `Review it here: ${taskUrl}`,
  ].join('\n');

  await sendPlainEmail({
    to: ownerEmail,
    subject,
    text,
    tags: [
      { name: 'category', value: 'portal_approval' },
      { name: 'state', value: input.state },
    ],
  });
}

// --- portal reply (client → agency) -----------------------------------
const replySchema = z.object({
  token: z.string().min(10).max(80),
  threadId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(10_000),
});

/**
 * Portal-session reply. Creates a `messages` row with:
 *   direction = 'inbound'  (into the agency)
 *   channel   = 'portal'   (distinct from email — agency can filter)
 *   fromType  = 'contact'
 *   threadId  = supplied (continues a thread) or fresh UUID.
 *
 * Subject is left null — the agency's unified inbox shows channel +
 * client name, which is enough context for portal-originated messages.
 */
export async function sendPortalReplyAction(
  input: z.infer<typeof replySchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  const link = await validatePortalMagicLink(parsed.data.token);
  if (!link) return { ok: false, error: 'invalid_or_expired_token' };

  const db = getDb();
  const [row] = await db
    .insert(schema.messages)
    .values({
      workspaceId: link.workspaceId,
      clientId: link.clientId,
      threadId: parsed.data.threadId ?? randomUUID(),
      direction: 'inbound',
      channel: 'portal',
      fromType: 'contact',
      fromId: link.clientContactId,
      subject: null,
      body: parsed.data.body,
    })
    .returning({ id: schema.messages.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  // `message_received` fires from the agency's perspective — a portal
  // reply is "inbound" to them, same as an email. distinctId is the
  // hashed client_contact_id since the portal user is the actor.
  fireTrack(
    'message_received',
    { channel: 'portal' },
    serverTrackContext(link.clientContactId, link.workspaceId),
  );

  revalidatePath(`/portal/${parsed.data.token}`);
  // Agency-side surfaces need re-rendering too.
  revalidatePath(`/${link.workspaceId}/clients/${link.clientId}`);
  revalidatePath(`/${link.workspaceId}/messages`);
  return { ok: true, id: row.id };
}

// --- portal signed download URL ---------------------------------------
const signedUrlSchema = z.object({
  token: z.string().min(10).max(80),
  assetId: z.string().uuid(),
});

/**
 * Issue a 5-minute signed URL for a client_visible asset. Validates the
 * magic-link token, confirms the asset belongs to the link's workspace +
 * client + is marked `client_visible`, then uses the service-role
 * Supabase client to mint the URL (portal users have no Supabase
 * session, so the normal cookie-bound client can't read storage).
 */
export async function getPortalAssetSignedUrlAction(
  input: z.infer<typeof signedUrlSchema>,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = signedUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  const link = await validatePortalMagicLink(parsed.data.token);
  if (!link) return { ok: false, error: 'invalid_or_expired_token' };

  const db = getDb();
  const asset = await db
    .select({
      url: schema.clientAssets.url,
      clientVisible: schema.clientAssets.clientVisible,
    })
    .from(schema.clientAssets)
    .where(
      and(
        eq(schema.clientAssets.id, parsed.data.assetId),
        eq(schema.clientAssets.workspaceId, link.workspaceId),
        eq(schema.clientAssets.clientId, link.clientId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!asset) return { ok: false, error: 'not_found' };
  if (!asset.clientVisible) return { ok: false, error: 'forbidden' };

  const supabase = await createServiceRoleSupabase();
  const { data, error } = await supabase.storage
    .from('client-assets')
    .createSignedUrl(asset.url, 300);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'signed_url_failed' };
  }

  return { ok: true, url: data.signedUrl };
}
