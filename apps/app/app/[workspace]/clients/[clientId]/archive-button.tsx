'use client';

import { Archive, ArchiveRestore } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from '@phloz/ui';

import {
  archiveClientAction,
  unarchiveClientAction,
} from './archive-actions';

export function ArchiveButton({
  workspaceId,
  clientId,
  archived,
}: {
  workspaceId: string;
  clientId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleArchive() {
    setBusy(true);
    try {
      const res = await archiveClientAction({
        workspaceId,
        clientId,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Client archived');
      setOpen(false);
      setReason('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleUnarchive() {
    startTransition(async () => {
      const res = await unarchiveClientAction({ workspaceId, clientId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Client restored');
      router.refresh();
    });
  }

  if (archived) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleUnarchive}
        className="gap-1.5"
      >
        <ArchiveRestore className="size-3.5" />
        Unarchive
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Archive className="size-3.5" />
        Archive
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive client?</DialogTitle>
            <DialogDescription>
              Archived clients drop off your active-client count and
              stop appearing in the default views. You can unarchive
              anytime if the tier has room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional) — e.g. Contract ended"
              maxLength={280}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={handleArchive} disabled={busy}>
              {busy ? 'Archiving…' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
