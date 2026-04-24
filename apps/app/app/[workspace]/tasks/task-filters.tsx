'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@phloz/ui';

export type TaskSort =
  | 'priority'
  | 'due_soonest'
  | 'due_latest'
  | 'recently_updated'
  | 'recently_created';

const SORT_LABELS: Record<TaskSort, string> = {
  priority: 'Priority (high → low)',
  due_soonest: 'Due date (soonest)',
  due_latest: 'Due date (latest)',
  recently_updated: 'Recently updated',
  recently_created: 'Recently created',
};

/**
 * Client / Assignee / Sort selectors for the Tasks page. Each one
 * updates the URL (query params) and lets the server component
 * re-filter. Reset chips per active filter for one-click clearing.
 */
export function TaskFilters({
  workspaceId,
  clients,
  members,
  activeClient,
  activeAssignee,
  activeSort,
}: {
  workspaceId: string;
  /** Passed through from the page but we read fresh params here. */
  searchParams: Record<string, string | undefined>;
  clients: { id: string; name: string }[];
  members: { id: string; label: string }[];
  activeClient: string | null;
  activeAssignee: string | null;
  activeSort: TaskSort;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (value && value.length > 0 && value !== '__all__') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    startTransition(() => {
      const qs = next.toString();
      router.push(
        qs ? `/${workspaceId}/tasks?${qs}` : `/${workspaceId}/tasks`,
      );
    });
  }

  const clientLabel =
    activeClient === 'unassigned'
      ? 'Unassigned'
      : clients.find((c) => c.id === activeClient)?.name ?? null;
  const assigneeLabel =
    activeAssignee === 'unassigned'
      ? 'Unassigned'
      : members.find((m) => m.id === activeAssignee)?.label ?? null;

  const hasChips =
    activeClient !== null ||
    activeAssignee !== null ||
    activeSort !== 'priority';

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-card/30 p-3">
      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Client
        </label>
        <Select
          value={activeClient ?? '__all__'}
          onValueChange={(v) => setParam('client', v === '__all__' ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All clients</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Assignee
        </label>
        <Select
          value={activeAssignee ?? '__all__'}
          onValueChange={(v) =>
            setParam('assignee', v === '__all__' ? null : v)
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Anyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Anyone</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-[220px] flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Sort
        </label>
        <Select
          value={activeSort}
          onValueChange={(v) => setParam('sort', v === 'priority' ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as TaskSort[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasChips && (
        <div className="flex flex-wrap items-center gap-1">
          {clientLabel && (
            <FilterChip
              label={`Client · ${clientLabel}`}
              onClear={() => setParam('client', null)}
            />
          )}
          {assigneeLabel && (
            <FilterChip
              label={`Assignee · ${assigneeLabel}`}
              onClear={() => setParam('assignee', null)}
            />
          )}
          {activeSort !== 'priority' && (
            <FilterChip
              label={`Sort · ${SORT_LABELS[activeSort]}`}
              onClear={() => setParam('sort', null)}
            />
          )}
          <Link
            href={`/${workspaceId}/tasks`}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Link>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <Badge
      variant="outline"
      className="flex items-center gap-1 text-[10px]"
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-muted"
        aria-label={`Clear ${label}`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}
