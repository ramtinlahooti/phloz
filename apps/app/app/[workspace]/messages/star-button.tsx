'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { toast } from '@phloz/ui';

import { toggleMessageStarAction } from './actions';

/**
 * Per-row star toggle on the messages inbox. Optimistic — flip the
 * icon immediately, revert + toast on server error. Stops the parent
 * <Link>'s navigation by stopping propagation + preventing default
 * (the row link wraps the entire row, so a button inside it would
 * otherwise trigger both).
 *
 * Calls router.refresh() on success so the inbox sort picks up the
 * new starred ordering without a full reload.
 */
export function MessageStarButton({
  workspaceId,
  messageId,
  initialStarred,
}: {
  workspaceId: string;
  messageId: string;
  initialStarred: boolean;
}) {
  const router = useRouter();
  const [starred, setStarred] = useState(initialStarred);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !starred;
    setStarred(next);
    startTransition(async () => {
      const res = await toggleMessageStarAction({
        workspaceId,
        messageId,
        starred: next,
      });
      if (!res.ok) {
        setStarred(!next);
        toast.error(`Couldn't ${next ? 'star' : 'unstar'} message: ${res.error}`);
        return;
      }
      // Refresh the server component so the inbox re-sorts (starred
      // rows pin to the top).
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={starred ? 'Unstar' : 'Star (pin to top)'}
      aria-label={starred ? 'Unstar message' : 'Star message'}
      aria-pressed={starred}
      className={`shrink-0 rounded p-1 transition-colors disabled:opacity-50 ${
        starred
          ? 'text-amber-400 hover:text-amber-300'
          : 'text-muted-foreground/40 hover:text-amber-400'
      }`}
    >
      <Star
        className="size-4"
        fill={starred ? 'currentColor' : 'none'}
        strokeWidth={2}
      />
    </button>
  );
}
