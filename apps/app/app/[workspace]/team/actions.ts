'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import { ROLES, type Role } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

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
    return {
      ok: false,
      error:
        'Promoting to owner is a transfer of ownership and isn\'t supported yet.',
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

  revalidatePath(`/${input.workspaceId}/team`);
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
