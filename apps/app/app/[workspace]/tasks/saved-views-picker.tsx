'use client';

import { Bookmark, Check, Pencil, Trash2, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  toast,
} from '@phloz/ui';

import {
  createSavedViewAction,
  deleteSavedViewAction,
  listSavedViewsAction,
  renameSavedViewAction,
  type SavedViewSummary,
} from './saved-views-actions';

type Props = {
  workspaceId: string;
  /** When false, the "Share with workspace" toggle is hidden (member /
   *  viewer can save personal views but not publish team-wide). */
  canShare: boolean;
};

/**
 * Saved-view picker for `/tasks`. Click the trigger → dropdown lists
 * the user's saved views plus any workspace-shared views from
 * teammates (each navigates to `/tasks?<searchParams>`). Per-row
 * rename / × deletes the view, but only for rows the caller owns —
 * shared rows from teammates are read-only here.
 *
 * Save section at the bottom captures the current URL search-params
 * string. Owners + admins also see a "Share with workspace" checkbox
 * that flips the row's `is_shared` flag so every member sees it.
 */
export function SavedViewsPicker({ workspaceId, canShare }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentParams = searchParams.toString();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedViewSummary[] | null>(null);
  const [name, setName] = useState('');
  const [shareNew, setShareNew] = useState(false);
  const [pending, startTransition] = useTransition();

  // Lazy-load views when the dropdown opens. Avoids hitting the DB
  // on every /tasks render for a feature most users won't use.
  useEffect(() => {
    if (!open || views !== null) return;
    listSavedViewsAction({ workspaceId, scope: 'tasks' }).then((res) => {
      if (res.ok) setViews(res.views);
    });
  }, [open, views, workspaceId]);

  function reload() {
    listSavedViewsAction({ workspaceId, scope: 'tasks' }).then((res) => {
      if (res.ok) setViews(res.views);
    });
  }

  function applyView(view: SavedViewSummary) {
    setOpen(false);
    const target = view.searchParams
      ? `/${workspaceId}/tasks?${view.searchParams}`
      : `/${workspaceId}/tasks`;
    router.push(target);
  }

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    startTransition(async () => {
      const res = await createSavedViewAction({
        workspaceId,
        scope: 'tasks',
        name: trimmed,
        searchParams: currentParams,
        isShared: canShare && shareNew,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved "${trimmed}"`);
      setName('');
      setShareNew(false);
      reload();
    });
  }

  function handleRename(view: SavedViewSummary) {
    const next = prompt(`Rename "${view.name}" to:`, view.name);
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed.length === 0 || trimmed === view.name) return;
    startTransition(async () => {
      const res = await renameSavedViewAction({
        workspaceId,
        id: view.id,
        name: trimmed,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Renamed');
      reload();
    });
  }

  function handleDelete(view: SavedViewSummary) {
    if (!confirm(`Delete saved view "${view.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteSavedViewAction({
        workspaceId,
        id: view.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Deleted');
      reload();
    });
  }

  const matchingView =
    views?.find((v) => v.searchParams === currentParams) ?? null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
        >
          <Bookmark className="size-3.5" />
          {matchingView ? matchingView.name : 'Views'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Saved views
        </DropdownMenuLabel>
        {views === null && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Loading…
          </div>
        )}
        {views && views.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            None yet. Set some filters then save the combo below.
          </div>
        )}
        {views?.map((v) => {
          const isActive = v.searchParams === currentParams;
          return (
            <div
              key={v.id}
              className="flex items-center gap-1 px-1 py-0.5"
            >
              <DropdownMenuItem
                className="flex-1"
                onSelect={(e) => {
                  e.preventDefault();
                  applyView(v);
                }}
              >
                {isActive && <Check className="mr-1 size-3.5 shrink-0" />}
                <span className="truncate">{v.name}</span>
                {v.isShared && (
                  <span
                    className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0 text-[10px] text-muted-foreground"
                    title={
                      v.isMine
                        ? 'You shared this view with the workspace'
                        : 'Shared by a teammate'
                    }
                  >
                    <Users className="size-2.5" />
                    Shared
                  </span>
                )}
              </DropdownMenuItem>
              {v.isMine && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRename(v);
                    }}
                    disabled={pending}
                    aria-label={`Rename ${v.name}`}
                    className="h-7 px-2"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(v);
                    }}
                    disabled={pending}
                    aria-label={`Delete ${v.name}`}
                    className="h-7 px-2"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Save current view
        </DropdownMenuLabel>
        <div className="flex items-center gap-2 px-2 pb-1 pt-1">
          <Input
            value={name}
            placeholder="View name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={pending || name.trim().length === 0}
          >
            Save
          </Button>
        </div>
        {canShare && (
          <label className="flex cursor-pointer items-center gap-2 px-2 pb-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={shareNew}
              onChange={(e) => setShareNew(e.target.checked)}
              className="size-3 rounded border-border accent-primary"
            />
            Share with the workspace (every member sees it)
          </label>
        )}
        <p className="px-2 pb-2 text-[11px] text-muted-foreground">
          Saves the current filter URL. Re-using a name overwrites it.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
