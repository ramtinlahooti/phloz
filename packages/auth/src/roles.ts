import type { Role } from '@phloz/config';
import { getDb, schema, and, eq } from '@phloz/db';

import { AuthError } from './errors';
import { requireUser } from './session';

/**
 * Return the user's role in the given workspace, or null if not a member.
 * RLS on `workspace_members` lets users read their own memberships, so this
 * works from any server context.
 */
export async function getMembershipRole(
  userId: string,
  workspaceId: string,
): Promise<Role | null> {
  const db = getDb();
  const rows = await db
    .select({ role: schema.workspaceMembers.role })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.userId, userId),
        eq(schema.workspaceMembers.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return rows[0]?.role ?? null;
}

/**
 * Assert the current user has at least one of the allowed roles in the
 * workspace. Returns the resolved user + role on success; throws on denial.
 *
 * Usage:
 *   const { user, role } = await requireRole(workspaceId, ['owner', 'admin']);
 */
export async function requireRole(
  workspaceId: string,
  allowed: readonly Role[],
): Promise<{ user: Awaited<ReturnType<typeof requireUser>>; role: Role }> {
  const user = await requireUser();
  const role = await getMembershipRole(user.id, workspaceId);
  if (!role) throw new AuthError('not_a_member');
  if (!allowed.includes(role)) throw new AuthError('role_denied', `role ${role}`);
  return { user, role };
}

/** Convenience wrapper for the most common "owner/admin only" check. */
export const requireAdminOrOwner = (workspaceId: string) =>
  requireRole(workspaceId, ['owner', 'admin']);

/** Convenience wrapper for "owner only" (delete workspace, billing). */
export const requireOwner = (workspaceId: string) => requireRole(workspaceId, ['owner']);
