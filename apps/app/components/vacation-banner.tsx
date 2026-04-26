'use client';

import { Pause } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { toast } from '@phloz/ui';

import { setPausedUntilAction } from '@/app/[workspace]/settings/notifications-actions';

/**
 * Persistent banner that surfaces vacation mode at the top of every
 * page in the workspace. Renders only when `pausedUntil > now`. The
 * "Turn off" button clears the pause inline so the user doesn't have
 * to navigate to Settings to come back online — but the date label
 * + "Manage" link still point at the full preferences page when they
 * want fine-grained control.
 *
 * Self-dismissing — once the user clicks Turn off, local state hides
 * the banner immediately (optimistic) and the server action +
 * router.refresh() persists.
 */
export function VacationBanner({
  workspaceId,
  pausedUntil,
}: {
  workspaceId: string;
  /** ISO timestamp; the parent layout passes this only when it's
   *  set in the future. The component itself doesn't recompute the
   *  comparison since the layout already gates rendering. */
  pausedUntil: string;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  const target = new Date(pausedUntil);
  const dateLabel = target.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  function turnOff() {
    setHidden(true);
    startTransition(async () => {
      const res = await setPausedUntilAction({ workspaceId, until: null });
      if (!res.ok) {
        setHidden(false);
        toast.error(res.error);
        return;
      }
      toast.success('Vacation mode off');
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 border-b border-amber-400/30 bg-amber-400/10 px-6 py-2 text-xs">
      <Pause
        className="size-3.5 shrink-0 text-amber-400"
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-foreground">
        <span className="font-medium">Vacation mode</span> is on until{' '}
        {dateLabel}. You won&apos;t get notification emails until then.
      </span>
      <Link
        href={`/${workspaceId}/settings#notifications`}
        className="shrink-0 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Manage
      </Link>
      <button
        type="button"
        onClick={turnOff}
        disabled={pending}
        className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-amber-400 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
      >
        {pending ? 'Turning off…' : 'Turn off'}
      </button>
    </div>
  );
}
