'use server';

import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';

import { inngest } from '@/inngest';

const runAuditNowSchema = z.object({
  workspaceId: z.string().uuid(),
  /** When set, scopes the audit to a single client. The cron writes
   *  only that client's `audit_run.client_summary` row and skips the
   *  workspace_summary — see audit-weekly.ts for the contract. */
  clientId: z.string().uuid().optional(),
});

/**
 * Trigger an immediate audit run. Fires the same `audit/run-weekly`
 * event the cron uses, scoped to a single workspace (and optionally
 * one client within it) so we don't repeat the full sweep just to
 * refresh one rollup.
 *
 * Owner/admin only — workspace-scoped runs affect the dashboard
 * sparkline for everyone; per-client runs write a client_summary
 * row that surfaces in the per-client Audit tab's history.
 *
 * Inngest queues the event; the function runs asynchronously. The
 * action's `ok: true` confirms the queue write succeeded — it does
 * not guarantee the audit has finished. Page reload after a minute
 * surfaces the new snapshot.
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
      data: {
        workspaceId: parsed.data.workspaceId,
        ...(parsed.data.clientId
          ? { clientId: parsed.data.clientId }
          : {}),
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `inngest_send_failed: ${(err as Error).message}`,
    };
  }

  return { ok: true };
}
