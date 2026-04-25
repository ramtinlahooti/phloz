'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { toast } from '@phloz/ui';

import { setDigestEnabledAction } from './notifications-actions';

type Props = {
  workspaceId: string;
  initial: { digestEnabled: boolean };
};

/**
 * Per-member notification preferences. Today: just the daily-digest
 * opt-in. Saves on toggle (no submit button) since there's only one
 * field — adding more preferences later flips this back to a form
 * with explicit Save.
 */
export function NotificationsForm({ workspaceId, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle(checked: boolean) {
    startTransition(async () => {
      const res = await setDigestEnabledAction({
        workspaceId,
        enabled: checked,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(checked ? 'Daily digest on' : 'Daily digest off');
      router.refresh();
    });
  }

  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        defaultChecked={initial.digestEnabled}
        disabled={pending}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 size-4 rounded border-border accent-primary"
      />
      <span>
        <span className="font-medium text-foreground">
          Send me the daily digest
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          One email at 9 AM in this workspace&apos;s timezone with your
          overdue tasks, work due today, and pending approvals. Owners
          and admins also get unreplied client messages and audit
          alerts. Empty mornings are skipped.
        </span>
      </span>
    </label>
  );
}
