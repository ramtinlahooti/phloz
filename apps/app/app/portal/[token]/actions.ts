'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { validatePortalMagicLink } from '@phloz/auth/portal';
import type { ApprovalState } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

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

  revalidatePath(`/portal/${parsed.data.token}`);
  return { ok: true };
}
