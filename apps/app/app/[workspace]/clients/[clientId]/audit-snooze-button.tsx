'use client';

import { BellOff, BellRing } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { toast } from '@phloz/ui';

import {
  suppressAuditFindingAction,
  unsuppressAuditFindingAction,
} from './audit-suppressions-actions';

/**
 * Per-finding "Snooze rule" link. Click → optional reason prompt →
 * server action → router.refresh. Inline because each finding card
 * has its own button; the prompt is `window.prompt` rather than a
 * full dialog to keep the UX cheap (snoozing is a low-stakes action;
 * users can edit/un-snooze anytime).
 */
export function AuditSnoozeButton({
  workspaceId,
  clientId,
  ruleId,
}: {
  workspaceId: string;
  clientId: string;
  ruleId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function snooze() {
    const reason = window.prompt(
      'Optional reason — why is this rule suppressed for this client?',
      '',
    );
    if (reason === null) return; // user cancelled
    startTransition(async () => {
      const res = await suppressAuditFindingAction({
        workspaceId,
        clientId,
        // The server validates this against the AUDIT_RULE_IDS enum,
        // so a bad string is caught there.
        ruleId: ruleId as Parameters<
          typeof suppressAuditFindingAction
        >[0]['ruleId'],
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Rule snoozed for this client');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={snooze}
      disabled={pending}
      className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      title="Hide this rule for this client"
    >
      <BellOff className="inline size-3" /> Snooze
    </button>
  );
}

/** "Un-snooze" affordance for the suppressed-rules section at the
 *  bottom of the audit tab. Doesn't prompt — the action is a single
 *  click, undoing a low-stakes choice. */
export function AuditUnsnoozeButton({
  workspaceId,
  suppressionId,
}: {
  workspaceId: string;
  suppressionId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function unsnooze() {
    setPending(true);
    try {
      const res = await unsuppressAuditFindingAction({
        workspaceId,
        suppressionId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Rule un-snoozed');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={unsnooze}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      <BellRing className="size-3" />
      {pending ? 'Un-snoozing…' : 'Un-snooze'}
    </button>
  );
}
