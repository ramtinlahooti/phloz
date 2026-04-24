'use client';

import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button, toast } from '@phloz/ui';

import { updateClientAction } from './update-actions';

/**
 * Inline editor for the client `notes` field. Starts in read-only
 * mode; clicking Edit swaps to a textarea. Save commits via
 * `updateClientAction` + `router.refresh()`; Cancel reverts.
 */
export function ClientNotesEditor({
  workspaceId,
  clientId,
  initialNotes,
}: {
  workspaceId: string;
  clientId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNotes ?? '');
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(initialNotes ?? '');
    setEditing(true);
  }

  function cancel() {
    setDraft(initialNotes ?? '');
    setEditing(false);
  }

  function save() {
    setSaving(true);
    startTransition(async () => {
      const normalized = draft.trim();
      const res = await updateClientAction({
        workspaceId,
        clientId,
        notes: normalized ? normalized : null,
      });
      setSaving(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Notes saved');
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="relative">
        {initialNotes ? (
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {initialNotes}
          </p>
        ) : (
          <span className="text-muted-foreground">
            No notes yet. Add internal context, account history, anything
            your team should know when picking up work on this client.
          </span>
        )}
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={startEdit}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3.5" />
            {initialNotes ? 'Edit notes' : 'Add notes'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        placeholder="Internal notes — context, history, account idiosyncrasies…"
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        maxLength={10_000}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={cancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save notes'}
        </Button>
      </div>
    </div>
  );
}
