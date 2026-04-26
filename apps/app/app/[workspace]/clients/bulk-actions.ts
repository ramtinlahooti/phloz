'use server';

import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { getDb, schema } from '@phloz/db/client';

const uuid = z.string().uuid();

const inputSchema = z.object({
  workspaceId: uuid,
  /** Days of inactivity required before a client counts as dormant.
   *  60 = matches the active-client window we already use for tier
   *  counting. 90 is the sensible "deeply dormant" default surfaced
   *  in the UI. Capped at 365 to stop a client from passing absurd
   *  values that would archive everyone. */
  thresholdDays: z.number().int().min(30).max(365).default(90),
});

/**
 * Archive every active client whose last activity is older than
 * `thresholdDays` (or who has no activity AND was created more than
 * `thresholdDays` ago). Owner / admin only.
 *
 * "Dormant" is defined as:
 *   archived_at IS NULL
 *   AND (
 *     last_activity_at < now() - thresholdDays
 *     OR (last_activity_at IS NULL AND created_at < now() - thresholdDays)
 *   )
 *
 * Returns the count archived. Single SQL UPDATE so the operation is
 * atomic — either every match flips to archived or none of them do.
 *
 * Recovery: archived clients can be unarchived per-row from the
 * client detail page (subject to the existing throttle gate). There's
 * no "undo" button on the bulk action itself — the per-row
 * unarchive is the audit trail.
 */
export async function bulkArchiveDormantClientsAction(
  input: z.infer<typeof inputSchema>,
): Promise<{ ok: true; archived: number } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const now = new Date();
  const cutoffMs =
    now.getTime() - parsed.data.thresholdDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffMs);

  const result = await db
    .update(schema.clients)
    .set({ archivedAt: now, updatedAt: now })
    .where(
      and(
        eq(schema.clients.workspaceId, parsed.data.workspaceId),
        isNull(schema.clients.archivedAt),
        or(
          lt(schema.clients.lastActivityAt, cutoff),
          and(
            isNull(schema.clients.lastActivityAt),
            lt(schema.clients.createdAt, cutoff),
          ),
        ),
      ),
    )
    .returning({ id: schema.clients.id });

  // Touch the path so the count + filtered list refresh immediately.
  revalidatePath(`/${parsed.data.workspaceId}/clients`);
  // The dashboard reads active-client counts too — bust that as well
  // since archiving frees capacity against the tier limit.
  revalidatePath(`/${parsed.data.workspaceId}`);

  void sql; // keep import; future pgRoom for raw cutoff arithmetic.
  return { ok: true, archived: result.length };
}
