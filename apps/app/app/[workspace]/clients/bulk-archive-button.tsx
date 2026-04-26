'use client';

import { Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button, toast } from '@phloz/ui';

import { bulkArchiveDormantClientsAction } from './bulk-actions';

type Props = {
  workspaceId: string;
  dormantCount: number;
  thresholdDays: number;
};

/**
 * One-click "tidy up" button for the workspace clients page. Only
 * renders when at least one client is dormant per the supplied
 * threshold (server-side computed). Native `confirm()` shows the
 * count + threshold so the action is never silent.
 *
 * Errors fall back to a toast; success refreshes the page so the
 * filtered list + count strip update immediately.
 */
export function BulkArchiveDormantButton({
  workspaceId,
  dormantCount,
  thresholdDays,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (dormantCount <= 0) return null;

  function archive() {
    if (
      !confirm(
        `Archive ${dormantCount} client${
          dormantCount === 1 ? '' : 's'
        } with no activity in the last ${thresholdDays} days?\n\nYou can unarchive any of them later from the client page.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await bulkArchiveDormantClientsAction({
        workspaceId,
        thresholdDays,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Archived ${res.archived} dormant client${
          res.archived === 1 ? '' : 's'
        }`,
      );
      router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={archive}
      disabled={pending}
      className="gap-1.5 text-xs"
      title={`Archives every active client with no activity in the last ${thresholdDays} days.`}
    >
      <Archive className="size-3.5" />
      Archive {dormantCount} dormant
    </Button>
  );
}
