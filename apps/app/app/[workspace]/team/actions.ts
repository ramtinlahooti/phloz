'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdminOrOwner, requireOwner } from '@phloz/auth/roles';
import { ROLES, type Role } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';
import { inngest } from '@/inngest';

const uuid = z.string().uuid();

const changeRoleSchema = z.object({
  workspaceId: uuid,
  memberId: uuid,
  role: z.enum(ROLES),
});

/**
 * Change a workspace member's role. Rules:
 * - Requires owner/admin (via requireAdminOrOwner).
 * - Admins can't promote someone to `owner` — that's a transfer of
 *   ownership and needs a dedicated flow (V2).
 * - Admins can't demote an owner — only the owner can.
 * - Nobody can change their own role (avoids accidental self-demotion
 *   from the only owner slot).
 */
export async function changeMemberRoleAction(
  input: z.infer<typeof changeRoleSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  let actor;
  try {
    actor = await requireAdminOrOwner(parsed.data.workspaceId);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const target = await db
    .select({
      id: schema.workspaceMembers.id,
      userId: schema.workspaceMembers.userId,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.id, parsed.data.memberId),
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!target) return { ok: false, error: 'not_found' };
  if (target.userId === actor.user.id) {
    return { ok: false, error: "You can't change your own role." };
  }
  if (parsed.data.role === 'owner') {
    // Promoting to owner is a transfer of ownership. Route users to
    // the dedicated `transferOwnershipAction` (which demotes the
    // current owner atomically) rather than silently allowing two
    // owners.
    return {
      ok: false,
      error: 'Use "Transfer ownership…" in the member menu to promote to owner.',
    };
  }
  if (target.role === 'owner' && actor.role !== 'owner') {
    return {
      ok: false,
      error: "Only the workspace owner can demote an owner.",
    };
  }

  await db
    .update(schema.workspaceMembers)
    .set({ role: parsed.data.role as Role })
    .where(eq(schema.workspaceMembers.id, parsed.data.memberId));

  fireTrack(
    'member_role_changed',
    { from_role: target.role as Role, to_role: parsed.data.role as Role },
    serverTrackContext(actor.user.id, parsed.data.workspaceId),
  );

  revalidatePath(`/${parsed.data.workspaceId}/team`);
  return { ok: true };
}

/**
 * Remove a member from the workspace (deletes the membership row;
 * Supabase auth.users row is untouched). Same guards as role
 * changes: no self-remove, only the owner can remove an owner.
 */
export async function removeMemberAction(input: {
  workspaceId: string;
  memberId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.memberId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }

  let actor;
  try {
    actor = await requireAdminOrOwner(input.workspaceId);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const target = await db
    .select({
      id: schema.workspaceMembers.id,
      userId: schema.workspaceMembers.userId,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.id, input.memberId),
        eq(schema.workspaceMembers.workspaceId, input.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!target) return { ok: false, error: 'not_found' };
  if (target.userId === actor.user.id) {
    return { ok: false, error: "You can't remove yourself from this workspace." };
  }
  if (target.role === 'owner' && actor.role !== 'owner') {
    return { ok: false, error: 'Only the owner can remove an owner.' };
  }

  await db
    .delete(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.id, input.memberId));

  fireTrack(
    'member_removed',
    {},
    serverTrackContext(actor.user.id, input.workspaceId),
  );

  revalidatePath(`/${input.workspaceId}/team`);
  return { ok: true };
}

/**
 * Transfer workspace ownership to another member.
 *
 * This is a sensitive, atomic operation: the current owner is demoted
 * to `admin`, the target member is promoted to `owner`, and
 * `workspaces.owner_user_id` is updated. All three writes happen in a
 * single transaction so the workspace is never left without an owner.
 *
 * Guard rails:
 * - Only the current owner can initiate (enforced by `requireOwner`).
 * - Target must be an existing non-owner member of this workspace.
 * - Target must not be the current owner (no-op).
 * - Confirmation phrase must match the literal `"TRANSFER"` string —
 *   the UI dialog collects this to prevent fat-finger execution.
 *
 * An `ownership_transferred` audit-log row is written inside the same
 * transaction so the trail is consistent with the row changes.
 */
const transferOwnershipSchema = z.object({
  workspaceId: uuid,
  /** The target member row id (not userId). */
  memberId: uuid,
  /** Client-collected confirmation string — must equal "TRANSFER". */
  confirmation: z.string(),
});

export async function transferOwnershipAction(
  input: z.infer<typeof transferOwnershipSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = transferOwnershipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  if (parsed.data.confirmation !== 'TRANSFER') {
    return {
      ok: false,
      error: 'Type TRANSFER to confirm — the check is case-sensitive.',
    };
  }

  let actor;
  try {
    actor = await requireOwner(parsed.data.workspaceId);
  } catch {
    return {
      ok: false,
      error: 'Only the workspace owner can transfer ownership.',
    };
  }

  const db = getDb();

  // Fetch the target + current owner's membership row in one query so
  // we have both ids before entering the transaction. Also needed to
  // fail early with a clear error if the target is bogus.
  const memberships = await db
    .select({
      id: schema.workspaceMembers.id,
      userId: schema.workspaceMembers.userId,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId));

  const target = memberships.find((m) => m.id === parsed.data.memberId);
  if (!target) {
    return { ok: false, error: 'Target member not found in this workspace.' };
  }
  if (target.userId === actor.user.id) {
    return {
      ok: false,
      error: "You can't transfer ownership to yourself.",
    };
  }
  if (target.role === 'owner') {
    return { ok: false, error: 'That member is already the owner.' };
  }

  const currentOwnerMembership = memberships.find(
    (m) => m.userId === actor.user.id && m.role === 'owner',
  );
  if (!currentOwnerMembership) {
    // requireOwner already asserted this, but belt + braces — if the
    // JWT claims and the membership rows disagree, better to refuse
    // than to leave the workspace without an owner.
    return { ok: false, error: 'Owner membership row missing — refresh and retry.' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.workspaceMembers)
        .set({ role: 'admin' as Role })
        .where(eq(schema.workspaceMembers.id, currentOwnerMembership.id));

      await tx
        .update(schema.workspaceMembers)
        .set({ role: 'owner' as Role })
        .where(eq(schema.workspaceMembers.id, target.id));

      await tx
        .update(schema.workspaces)
        .set({ ownerUserId: target.userId, updatedAt: new Date() })
        .where(eq(schema.workspaces.id, parsed.data.workspaceId));

      await tx.insert(schema.auditLog).values({
        workspaceId: parsed.data.workspaceId,
        actorType: 'member',
        actorId: actor.user.id,
        action: 'ownership_transferred',
        entityType: 'workspace',
        entityId: parsed.data.workspaceId,
        metadata: {
          from_user_id: actor.user.id,
          to_user_id: target.userId,
          from_membership_id: currentOwnerMembership.id,
          to_membership_id: target.id,
        },
      });
    });
  } catch (err) {
    return {
      ok: false,
      error: `Transfer failed: ${(err as Error).message}`,
    };
  }

  // Analytics: fire both sides of the swap under the existing
  // `member_role_changed` event so dashboards don't need a new schema.
  // The audit_log row is the authoritative record of the transfer
  // itself.
  const ctx = serverTrackContext(actor.user.id, parsed.data.workspaceId);
  fireTrack(
    'member_role_changed',
    { from_role: 'owner' as Role, to_role: 'admin' as Role },
    ctx,
  );
  fireTrack(
    'member_role_changed',
    { from_role: target.role as Role, to_role: 'owner' as Role },
    ctx,
  );

  revalidatePath(`/${parsed.data.workspaceId}/team`);
  revalidatePath(`/${parsed.data.workspaceId}/billing`);
  return { ok: true };
}

/**
 * Revoke a pending invitation (e.g. sent to the wrong email).
 * Role-gated the usual way.
 */
export async function revokeInvitationAction(input: {
  workspaceId: string;
  invitationId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.invitationId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireAdminOrOwner(input.workspaceId);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  await db
    .delete(schema.invitations)
    .where(
      and(
        eq(schema.invitations.id, input.invitationId),
        eq(schema.invitations.workspaceId, input.workspaceId),
      ),
    );

  revalidatePath(`/${input.workspaceId}/team`);
  return { ok: true };
}

const nudgeSchema = z.object({
  workspaceId: uuid,
  memberId: uuid,
});

/**
 * Send the daily digest to one specific member right now. Owner /
 * admin only — for nudging a teammate who muted the digest, or just
 * sharing what the morning email looks like with someone who hasn't
 * configured it yet.
 *
 * Implementation: fires the `digest/send-daily` Inngest event with
 * the target member's `membershipId`. The cron's manual path
 * filters its `workspace_members` query to that single row even
 * when the target has `digest_enabled = false` — a nudge to a muted
 * teammate still goes through.
 *
 * Inngest's API key being absent returns 200 (no-op); `ok: true`
 * doesn't guarantee delivery. Toast caveat lives in the UI.
 */
export async function nudgeMemberDigestAction(
  input: z.infer<typeof nudgeSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = nudgeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let actor;
  try {
    actor = await requireAdminOrOwner(parsed.data.workspaceId);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  // Validate the target membership belongs to this workspace before
  // emitting an event — defense-in-depth against a stale UI pushing
  // a foreign membership id.
  const db = getDb();
  const [target] = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.id, parsed.data.memberId),
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
      ),
    )
    .limit(1);
  if (!target) {
    return { ok: false, error: 'member_not_found' };
  }

  try {
    await inngest.send({
      name: 'digest/send-daily',
      data: {
        workspaceId: parsed.data.workspaceId,
        membershipId: target.id,
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `inngest_send_failed: ${(err as Error).message}`,
    };
  }

  void actor;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Per-member client access (workspace_member_client_access)
// ---------------------------------------------------------------------------

const setClientAccessSchema = z.object({
  workspaceId: uuid,
  memberId: uuid,
  /** Replace the full assignment list. Empty array = no clients
   *  visible (member sees only workspace-level surfaces). */
  clientIds: z.array(uuid).max(500),
});

/**
 * Replace a member's `workspace_member_client_access` rows with the
 * supplied `clientIds`. Owner / admin only — same gate as role
 * changes. Owners + admins are exempt at the RLS layer
 * (`phloz_is_assigned_to` returns true unconditionally for them) so
 * setting an access list for an owner/admin is a no-op as far as
 * visibility goes; we still let the rows be written so a future
 * downgrade to member surfaces a sensible default.
 *
 * Diff-based write: we fetch the current set, compute add/remove
 * deltas, and only INSERT new rows + DELETE stale ones. Avoids a
 * delete-all-then-insert pattern that would briefly hide every
 * client from the member if a concurrent reader sliced through the
 * gap.
 */
export async function setMemberClientAccessAction(
  input: z.infer<typeof setClientAccessSchema>,
): Promise<{ ok: true; added: number; removed: number } | { ok: false; error: string }> {
  const parsed = setClientAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  let actor;
  try {
    actor = await requireAdminOrOwner(parsed.data.workspaceId);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();

  // Confirm the target member belongs to this workspace before we
  // write — the unique index would catch a cross-workspace mismatch
  // but we'd silently leak which membership ids exist.
  const [member] = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.id, parsed.data.memberId),
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
      ),
    )
    .limit(1);
  if (!member) return { ok: false, error: 'member_not_found' };

  const existing = await db
    .select({ clientId: schema.workspaceMemberClientAccess.clientId })
    .from(schema.workspaceMemberClientAccess)
    .where(
      eq(
        schema.workspaceMemberClientAccess.workspaceMemberId,
        parsed.data.memberId,
      ),
    );

  const existingSet = new Set(existing.map((r) => r.clientId));
  const targetSet = new Set(parsed.data.clientIds);
  const toAdd = parsed.data.clientIds.filter((id) => !existingSet.has(id));
  const toRemove = [...existingSet].filter((id) => !targetSet.has(id));

  if (toAdd.length > 0) {
    await db
      .insert(schema.workspaceMemberClientAccess)
      .values(
        toAdd.map((clientId) => ({
          workspaceMemberId: parsed.data.memberId,
          clientId,
        })),
      )
      .onConflictDoNothing();
  }
  if (toRemove.length > 0) {
    for (const clientId of toRemove) {
      await db
        .delete(schema.workspaceMemberClientAccess)
        .where(
          and(
            eq(
              schema.workspaceMemberClientAccess.workspaceMemberId,
              parsed.data.memberId,
            ),
            eq(schema.workspaceMemberClientAccess.clientId, clientId),
          ),
        );
    }
  }

  fireTrack(
    'client_assigned',
    { assignee_role: 'member' },
    serverTrackContext(actor.user.id, parsed.data.workspaceId),
  );

  revalidatePath(`/${parsed.data.workspaceId}/team`);
  revalidatePath(`/${parsed.data.workspaceId}/clients`);
  return { ok: true, added: toAdd.length, removed: toRemove.length };
}

// ---------------------------------------------------------------------------
// Workspace setting: all_members_see_all_clients
// ---------------------------------------------------------------------------

const setAllSeeAllSchema = z.object({
  workspaceId: uuid,
  enabled: z.boolean(),
});

/**
 * Toggle the workspace `settings.all_members_see_all_clients` flag.
 * When true (the default for new workspaces), every member +
 * viewer sees every client regardless of explicit assignments —
 * the simplest model for small agencies. When false, members and
 * viewers only see clients they've been assigned to via
 * `setMemberClientAccessAction`. Owner/admin always see everything
 * regardless.
 *
 * Owner/admin gate. The setting lives in `workspaces.settings` (a
 * JSONB column) so we read-modify-write to avoid clobbering
 * sibling settings.
 */
export async function setAllMembersSeeAllClientsAction(
  input: z.infer<typeof setAllSeeAllSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = setAllSeeAllSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  let actor;
  try {
    actor = await requireAdminOrOwner(parsed.data.workspaceId);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const [row] = await db
    .select({ settings: schema.workspaces.settings })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, parsed.data.workspaceId))
    .limit(1);
  if (!row) return { ok: false, error: 'workspace_not_found' };

  const currentSettings =
    (row.settings as Record<string, unknown> | null) ?? {};
  const nextSettings = {
    ...currentSettings,
    all_members_see_all_clients: parsed.data.enabled,
  };

  await db
    .update(schema.workspaces)
    .set({ settings: nextSettings, updatedAt: new Date() })
    .where(eq(schema.workspaces.id, parsed.data.workspaceId));

  fireTrack(
    'workspace_settings_updated',
    { setting_key: 'all_members_see_all_clients' },
    serverTrackContext(actor.user.id, parsed.data.workspaceId),
  );

  revalidatePath(`/${parsed.data.workspaceId}/team`);
  revalidatePath(`/${parsed.data.workspaceId}/settings`);
  revalidatePath(`/${parsed.data.workspaceId}/clients`);
  return { ok: true };
}
