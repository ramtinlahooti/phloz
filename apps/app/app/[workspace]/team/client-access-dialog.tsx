'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

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

import { setMemberClientAccessAction } from './actions';

type ClientOption = { id: string; name: string };

/**
 * Dialog that lets an owner/admin pick which clients a specific
 * teammate can see. Only meaningful when the workspace's "Restricted
 * by assignment" policy is on (otherwise everyone sees everything
 * regardless of these rows). The dialog tells the user when the
 * policy makes the assignment moot.
 *
 * UI contract:
 *  - All workspace clients listed alphabetically with a checkbox.
 *  - Search box filters by name (typeahead).
 *  - Save sends the diff to setMemberClientAccessAction. Cancel
 *    discards local state.
 *  - "Select all" / "Clear all" shortcuts at the top.
 */
export function ClientAccessDialog({
  workspaceId,
  memberId,
  memberLabel,
  clients,
  initialClientIds,
  policyEnforced,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  memberId: string;
  memberLabel: string;
  clients: ClientOption[];
  initialClientIds: string[];
  /** True when `all_members_see_all_clients = false`. When false,
   *  the dialog still saves but warns the user that the policy
   *  override is active. */
  policyEnforced: boolean;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialClientIds),
  );
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();

  // Reset local state every time the dialog opens with a fresh
  // initial set — keeps the UI honest if the parent re-fetches in
  // the background.
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialClientIds));
      setSearch('');
    }
  }, [open, initialClientIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  const initialSet = useMemo(
    () => new Set(initialClientIds),
    [initialClientIds],
  );
  const dirty =
    selected.size !== initialSet.size ||
    [...selected].some((id) => !initialSet.has(id));

  function toggle(clientId: string, next: boolean) {
    setSelected((prev) => {
      const out = new Set(prev);
      if (next) out.add(clientId);
      else out.delete(clientId);
      return out;
    });
  }

  function selectAll() {
    setSelected(new Set(clients.map((c) => c.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  function save() {
    startTransition(async () => {
      const res = await setMemberClientAccessAction({
        workspaceId,
        memberId,
        clientIds: [...selected],
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const summary =
        res.added === 0 && res.removed === 0
          ? 'No changes'
          : [
              res.added > 0 && `+${res.added}`,
              res.removed > 0 && `−${res.removed}`,
            ]
              .filter(Boolean)
              .join(' / ');
      toast.success(`Saved access for ${memberLabel} (${summary})`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage client access</DialogTitle>
          <DialogDescription>
            Pick which clients <span className="font-medium">{memberLabel}</span>{' '}
            can see. Owner / admin always see everything; this only
            affects the member or viewer role.
          </DialogDescription>
        </DialogHeader>

        {!policyEnforced && (
          <div className="rounded-md border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-xs text-amber-400">
            Workspace policy is currently <strong>Everyone sees everything</strong>.
            These assignments save, but won&apos;t take effect until you
            switch to <strong>Restricted by assignment</strong> in
            Settings → Client access.
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={selectAll}
            disabled={pending || clients.length === 0}
          >
            Select all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearAll}
            disabled={pending || selected.size === 0}
          >
            Clear
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border border-border/60">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {clients.length === 0
                ? 'No clients in this workspace yet.'
                : 'No matches.'}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pending}
                      onChange={(e) => toggle(c.id, e.target.checked)}
                      className="size-4 rounded border-border accent-primary"
                    />
                    <span
                      className={
                        checked ? 'text-foreground' : 'text-muted-foreground'
                      }
                    >
                      {c.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            {selected.size} of {clients.length} selected
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={pending || !dirty}
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
