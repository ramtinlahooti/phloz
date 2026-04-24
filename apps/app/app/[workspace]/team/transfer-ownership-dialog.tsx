'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from '@phloz/ui';

import { transferOwnershipAction } from './actions';

/**
 * Confirmation dialog for transferring workspace ownership.
 *
 * Typed-confirmation pattern: the user must type `TRANSFER` exactly
 * (case-sensitive) to enable the submit button. Prevents accidental
 * clicks — ownership transfer is irreversible without the new owner's
 * cooperation.
 *
 * On success: the UI refreshes, the current owner loses owner-only
 * access (billing, transfer, etc.) on the next page load. No optimistic
 * UI — the whole screen needs to re-render against the new role.
 */
export function TransferOwnershipDialog({
  workspaceId,
  memberId,
  memberLabel,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  memberId: string;
  memberLabel: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = confirmation === 'TRANSFER' && !submitting;

  async function submit() {
    setSubmitting(true);
    try {
      const res = await transferOwnershipAction({
        workspaceId,
        memberId,
        confirmation,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Ownership transferred to ${memberLabel}`);
      onOpenChange(false);
      setConfirmation('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) {
          onOpenChange(o);
          if (!o) setConfirmation('');
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer ownership to {memberLabel}</DialogTitle>
          <DialogDescription>
            You&apos;ll be demoted to <strong>Admin</strong>.{' '}
            {memberLabel} will gain full control of this workspace
            including billing, member management, and the ability to
            delete the workspace. This cannot be undone without the new
            owner transferring back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <Label htmlFor="transfer-confirm">
            Type <code className="rounded bg-muted px-1 font-mono text-xs">TRANSFER</code> to confirm
          </Label>
          <Input
            id="transfer-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="TRANSFER"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              setConfirmation('');
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {submitting ? 'Transferring…' : 'Transfer ownership'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
