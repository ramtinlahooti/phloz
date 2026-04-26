'use client';

import { useTransition } from 'react';

import { toast } from '@phloz/ui';

import { runAuditNowAction } from './audit-actions';

/**
 * Owner/admin-only button that fires the `audit/run-weekly` Inngest
 * event for either the whole workspace (no `clientId`) or one client
 * (when `clientId` is set). The cron's per-client path writes only
 * the `audit_run.client_summary` row and skips the workspace
 * summary, keeping the dashboard sparkline accurate.
 *
 * Optimistic toast — the audit runs asynchronously. The user reloads
 * the page after a minute to see the new snapshot land in the
 * sparkline (workspace) or History list (per-client).
 */
export function RunAuditButton({
  workspaceId,
  clientId,
}: {
  workspaceId: string;
  /** When set, the run is scoped to one client. */
  clientId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const isClientScope = !!clientId;

  function trigger() {
    startTransition(async () => {
      const res = await runAuditNowAction({
        workspaceId,
        ...(clientId ? { clientId } : {}),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Audit queued', {
        description: isClientScope
          ? "A new snapshot for this client will land in a minute or two. Reload the page to see it in the History list."
          : 'A new workspace snapshot will land in a minute or two. Reload the page to refresh the sparkline.',
      });
    });
  }

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={pending}
      className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-50"
      title={
        isClientScope
          ? 'Re-run the audit for this client and write a fresh history snapshot'
          : 'Re-run the audit now and write a fresh weekly summary row'
      }
    >
      {pending ? 'Queueing…' : 'Run now'}
    </button>
  );
}
