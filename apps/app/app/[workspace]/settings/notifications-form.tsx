'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button, toast } from '@phloz/ui';

import { DEFAULT_DIGEST_HOUR, formatHour } from '@/lib/format-hour';

import {
  previewDigestAction,
  setDigestEnabledAction,
  setDigestHourAction,
} from './notifications-actions';

type Props = {
  workspaceId: string;
  /** Workspace's IANA tz, used in the dropdown's helper copy so the
   *  user knows whose clock the hour is referenced against. */
  workspaceTimezone: string;
  initial: {
    digestEnabled: boolean;
    /** null = use the workspace default (9 AM); otherwise 0–23. */
    digestHour: number | null;
  };
};

/**
 * Per-member notification preferences. Today: daily-digest opt-in,
 * preferred hour-of-day, and a "Preview today's digest" button that
 * fires the cron's manual path scoped to the caller. Saves on every
 * change (no submit button) since each control owns one column —
 * adding more preferences later flips this back to a form with
 * explicit Save.
 */
export function NotificationsForm({
  workspaceId,
  workspaceTimezone,
  initial,
}: Props) {
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

  function onHourChange(value: string) {
    const hour = value === 'default' ? null : Number.parseInt(value, 10);
    startTransition(async () => {
      const res = await setDigestHourAction({ workspaceId, hour });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        hour === null
          ? `Reset to workspace default (${formatHour(DEFAULT_DIGEST_HOUR)})`
          : `Digest will arrive at ${formatHour(hour)}`,
      );
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

  const effectiveHour = initial.digestHour ?? DEFAULT_DIGEST_HOUR;

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
            One email at {formatHour(effectiveHour)} in this workspace&apos;s
            timezone with your overdue tasks, work due today, and pending
            approvals. Owners and admins also get unreplied client messages
            and audit alerts. Empty mornings are skipped.
          </span>
        </span>
      </label>

      <div className="ml-7 space-y-1">
        <label
          htmlFor="digest-hour"
          className="block text-xs font-medium text-foreground/80"
        >
          Send at
        </label>
        <select
          id="digest-hour"
          disabled={pending || !initial.digestEnabled}
          value={initial.digestHour === null ? 'default' : String(initial.digestHour)}
          onChange={(e) => onHourChange(e.target.value)}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          <option value="default">
            Workspace default ({formatHour(DEFAULT_DIGEST_HOUR)})
          </option>
          {HOURS.map((h) => (
            <option key={h} value={String(h)}>
              {formatHour(h)}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Times are in the workspace timezone ({workspaceTimezone}).
        </p>
      </div>

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

const HOURS: number[] = Array.from({ length: 24 }, (_, i) => i);
