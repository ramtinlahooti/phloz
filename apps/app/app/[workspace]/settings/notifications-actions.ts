'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  enabled: z.boolean(),
});

/**
 * Toggle the current user's daily-digest opt-in for one workspace.
 * Each membership row owns its own preference, so a user in two
 * workspaces can opt in for one and out of the other.
 *
 * Self-targeting only — the action looks up the caller's membership
 * via `requireUser`. There's no admin override path because the
 * preference is personal.
 */
export async function setDigestEnabledAction(
  input: z.infer<typeof inputSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
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

  const user = await requireUser();
  const db = getDb();
  const result = await db
    .update(schema.workspaceMembers)
    .set({ digestEnabled: parsed.data.enabled })
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .returning({ id: schema.workspaceMembers.id });

  if (result.length === 0) {
    return { ok: false, error: 'membership_not_found' };
  }

  revalidatePath(`/${parsed.data.workspaceId}/settings`);
  return { ok: true };
}
