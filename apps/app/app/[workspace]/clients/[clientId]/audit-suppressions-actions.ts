'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { getDb, schema } from '@phloz/db/client';
import { AUDIT_RULE_IDS } from '@phloz/tracking-map';

/**
 * Server actions for audit-rule suppression.
 *
 * Snoozing is per-(workspace, client, rule). Re-snoozing the same
 * rule for the same client is a silent no-op (ON CONFLICT DO NOTHING)
 * via the unique index on the table — we don't want a UI error if a
 * stale page tries to re-snooze something already suppressed.
 *
 * Owner / admin / member can snooze + un-snooze. Viewers can read
 * (via RLS) but not mutate; they get the same "forbidden" response
 * as other write actions.
 */

const uuid = z.string().uuid();

const suppressSchema = z.object({
  workspaceId: uuid,
  clientId: uuid,
  ruleId: z.enum(AUDIT_RULE_IDS),
  reason: z.string().trim().max(280).optional(),
});

export async function suppressAuditFindingAction(
  input: z.infer<typeof suppressSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = suppressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let actor;
  try {
    actor = await requireRole(parsed.data.workspaceId, [
      'owner',
      'admin',
      'member',
    ]);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  await db
    .insert(schema.auditSuppressions)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
      ruleId: parsed.data.ruleId,
      reason: parsed.data.reason ?? null,
      createdBy: actor.user.id,
    })
    // Unique index on (workspace_id, client_id, rule_id) means a
    // re-snooze tries to insert the same row twice. We swallow it
    // rather than treat it as an error.
    .onConflictDoNothing({
      target: [
        schema.auditSuppressions.workspaceId,
        schema.auditSuppressions.clientId,
        schema.auditSuppressions.ruleId,
      ],
    });

  revalidatePath(
    `/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`,
  );
  revalidatePath(`/${parsed.data.workspaceId}`); // dashboard rollup
  return { ok: true };
}

const unsuppressSchema = z.object({
  workspaceId: uuid,
  /**
   * Either pass the suppression's id directly (if you have it from the
   * suppressed-rules list UI) or pass `clientId + ruleId` to look it up.
   * Both shapes accepted to keep callers ergonomic.
   */
  suppressionId: uuid.optional(),
  clientId: uuid.optional(),
  ruleId: z.enum(AUDIT_RULE_IDS).optional(),
});

export async function unsuppressAuditFindingAction(
  input: z.infer<typeof unsuppressSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = unsuppressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  // At least one identification path must be provided.
  if (
    !parsed.data.suppressionId &&
    (!parsed.data.clientId || !parsed.data.ruleId)
  ) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  if (parsed.data.suppressionId) {
    await db
      .delete(schema.auditSuppressions)
      .where(
        and(
          eq(schema.auditSuppressions.id, parsed.data.suppressionId),
          eq(
            schema.auditSuppressions.workspaceId,
            parsed.data.workspaceId,
          ),
        ),
      );
  } else if (parsed.data.clientId && parsed.data.ruleId) {
    await db
      .delete(schema.auditSuppressions)
      .where(
        and(
          eq(
            schema.auditSuppressions.workspaceId,
            parsed.data.workspaceId,
          ),
          eq(schema.auditSuppressions.clientId, parsed.data.clientId),
          eq(schema.auditSuppressions.ruleId, parsed.data.ruleId),
        ),
      );
  }

  revalidatePath(
    parsed.data.clientId
      ? `/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`
      : `/${parsed.data.workspaceId}`,
  );
  revalidatePath(`/${parsed.data.workspaceId}`);
  return { ok: true };
}
