'use client';

import { useTransition } from 'react';

import { toast } from '@phloz/ui';

import { runAuditNowAction } from './audit-actions';

/**
 * Owner/admin-only button on the dashboard's audit rollup card. Fires
 * the `audit/run-weekly` Inngest event scoped to this workspace so a
 * fresh snapshot lands in `audit_run.workspace_summary` without
 * waiting for Monday's cron. Optimistic toast — the audit runs
 * asynchronously; the user reloads after a minute to see the new
 * sparkline datapoint.
 */
export function RunAuditButton({ workspaceId }: { workspaceId: string }) {
  const [pending, startTransition] = useTransition();

  function trigger() {
    startTransition(async () => {
      const res = await runAuditNowAction({ workspaceId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Audit queued', {
        description:
          'A new snapshot will appear in a minute or two. Reload the page to refresh the sparkline.',
      });
    });
  }

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={pending}
      className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-50"
      title="Re-run the audit now and write a fresh weekly summary row"
    >
      {pending ? 'Queueing…' : 'Run now'}
    </button>
  );
}
