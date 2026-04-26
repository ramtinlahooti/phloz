'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';

const schema_ = z.object({
  workspaceId: z.string().uuid(),
});

/**
 * Stamp the calling member's `mentions_seen_at` with `now()` so the
 * sidebar's "new since I last looked" badge resets to zero. Idempotent
 * — repeat calls just push the timestamp forward.
 *
 * Open to every role that can hit the inbox (owner / admin / member /
 * viewer). The action self-targets via `requireUser`; an admin can't
 * mark another member's mentions seen.
 */
export async function markMentionsSeenAction(
  input: z.infer<typeof schema_>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema_.safeParse(input);
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
    .set({ mentionsSeenAt: new Date() })
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

  // The layout's nav-badges query reads this column; revalidating
  // every workspace path keeps the sidebar count accurate
  // immediately. Cheap — Next.js's cache invalidation is per-path
  // and our pages are dynamic.
  revalidatePath(`/${parsed.data.workspaceId}`, 'layout');
  return { ok: true };
}
