'use client';

import { Bookmark, Check, Trash2 } from 'lucide-react';
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
  type SavedViewSummary,
} from './saved-views-actions';

type Props = {
  workspaceId: string;
};

/**
 * Saved-view picker for `/tasks`. Click the trigger → dropdown lists
 * the user's saved views (each navigates to `/tasks?<searchParams>`)
 * plus a "Save current view…" inline form. Per-row × deletes the
 * view. Personal preference — every other workspace member has their
 * own list.
 */
export function SavedViewsPicker({ workspaceId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentParams = searchParams.toString();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedViewSummary[] | null>(null);
  const [name, setName] = useState('');
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
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved "${trimmed}"`);
      setName('');
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
      <DropdownMenuContent align="end" className="w-72">
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
                {isActive && <Check className="mr-1 size-3.5" />}
                <span className="truncate">{v.name}</span>
              </DropdownMenuItem>
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
            </div>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Save current view
        </DropdownMenuLabel>
        <div className="flex items-center gap-2 px-2 pb-2 pt-1">
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
        <p className="px-2 pb-2 text-[11px] text-muted-foreground">
          Saves the current filter URL. Re-using a name overwrites it.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
