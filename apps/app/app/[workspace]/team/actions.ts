'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdminOrOwner, requireOwner } from '@phloz/auth/roles';
import { ROLES, type Role } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

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
