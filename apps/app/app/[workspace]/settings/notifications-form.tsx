'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button, toast } from '@phloz/ui';

import {
  previewDigestAction,
  setDigestEnabledAction,
} from './notifications-actions';

type Props = {
  workspaceId: string;
  initial: { digestEnabled: boolean };
};

/**
 * Per-member notification preferences. Today: daily-digest opt-in
 * + a "Preview today's digest" button that fires the cron's manual
 * path scoped to the caller. Saves on toggle (no submit button)
 * since there's only one boolean — adding more preferences later
 * flips this back to a form with explicit Save.
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

  function onPreview() {
    startTransition(async () => {
      const res = await previewDigestAction({ workspaceId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Preview queued', {
        description:
          'Check your inbox in a few seconds. Empty mornings still skip the send.',
      });
    });
  }

  return (
    <div className="space-y-4">
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
            overdue tasks, work due today, and pending approvals.
            Owners and admins also get unreplied client messages and
            audit alerts. Empty mornings are skipped.
          </span>
        </span>
      </label>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPreview}
          disabled={pending}
        >
          {pending ? 'Sending…' : 'Preview today\u2019s digest'}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends the digest to your email right now using today&apos;s
          actual data. Teammates aren&apos;t notified.
        </p>
      </div>
    </div>
  );
}
