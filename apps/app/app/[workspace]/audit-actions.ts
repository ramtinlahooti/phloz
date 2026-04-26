'use server';

import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';

import { inngest } from '@/inngest';

const runAuditNowSchema = z.object({
  workspaceId: z.string().uuid(),
});

/**
 * Trigger an immediate audit run for one workspace. Fires the same
 * `audit/run-weekly` event the cron uses, scoped to a single workspace
 * so we don't repeat the full sweep just to refresh one rollup.
 *
 * Owner/admin only — the audit is workspace-scoped and the resulting
 * `audit_run.workspace_summary` row affects the dashboard rollup +
 * sparkline for everyone, so it shouldn't be a member-level operation.
 *
 * Inngest queues the event; the function runs asynchronously. The
 * action's `ok: true` confirms the queue write succeeded — it does
 * not guarantee the audit has finished. Page reload after a minute
 * surfaces the new snapshot in the dashboard's sparkline.
 */
export async function runAuditNowAction(
  input: z.infer<typeof runAuditNowSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = runAuditNowSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  try {
    await inngest.send({
      name: 'audit/run-weekly',
      data: { workspaceId: parsed.data.workspaceId },
    });
  } catch (err) {
    return {
      ok: false,
      error: `inngest_send_failed: ${(err as Error).message}`,
    };
  }

  return { ok: true };
}
