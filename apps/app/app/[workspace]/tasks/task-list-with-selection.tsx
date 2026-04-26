'use client';

import { Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import type { TaskStatus } from '@phloz/config';
import { TASK_STATUSES } from '@phloz/config';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@phloz/ui';

import { bulkUpdateTasksAction } from './actions';
import type { MentionMember } from '@/components/mention-composer';

import { TaskRow, type MemberOption, type TaskRowModel } from './task-row';

/**
 * Selection-aware task list. Renders one Card per status group (same
 * visual as before), but each row gets a checkbox and a floating
 * action bar appears at the bottom of the viewport when > 0 tasks
 * are selected.
 *
 * State is local — we don't persist selection to URL or storage.
 * Refresh clears it, same as selection in Gmail / Linear.
 *
 * Bulk actions shipped in V1:
 *   - Change status (any `TaskStatus`)
 *   - Delete (with `confirm()` guard)
 *
 * Assignee / priority / department are deferred until someone asks —
 * the UI pattern extends cleanly but each adds a dropdown to the
 * floating bar which starts to feel cluttered quickly.
 */
export function TaskListWithSelection({
  workspaceId,
  groups,
  members,
  mentionMembers,
}: {
  workspaceId: string;
  /** Groups rendered top-to-bottom as separate Cards. Empty groups
   *  are pre-filtered by the caller so we don't render empty sections. */
  groups: { status: TaskStatus; tasks: TaskRowModel[] }[];
  members?: MemberOption[];
  /** Forwarded to each TaskRow → TaskDetailDialog for the comment
   *  composer's `@` autocomplete. Optional. */
  mentionMembers?: MentionMember[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  // Clear selection on Escape — same pattern as Gmail / most tools.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && selected.size > 0) {
        // Don't swallow Escape when a dialog is open — if the palette
        // or task-detail is also listening, let them have priority.
        if (
          document.querySelector('[role="dialog"][data-state="open"]')
        ) {
          return;
        }
        setSelected(new Set());
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected.size]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((tasks: TaskRowModel[]) => {
    setSelected((prev) => {
      const allIn = tasks.every((t) => prev.has(t.id));
      const next = new Set(prev);
      if (allIn) {
        for (const t of tasks) next.delete(t.id);
      } else {
        for (const t of tasks) next.add(t.id);
      }
      return next;
    });
  }, []);

  async function changeStatus(status: TaskStatus) {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await bulkUpdateTasksAction({
        workspaceId,
        taskIds: Array.from(selected),
        action: { kind: 'status', status },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Updated ${res.affected} task${res.affected === 1 ? '' : 's'}`,
      );
      setSelected(new Set());
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} task${selected.size === 1 ? '' : 's'}?`)) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await bulkUpdateTasksAction({
        workspaceId,
        taskIds: Array.from(selected),
        action: { kind: 'delete' },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Deleted ${res.affected} task${res.affected === 1 ? '' : 's'}`,
      );
      setSelected(new Set());
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map(({ status, tasks }) => {
          const allSelected =
            tasks.length > 0 && tasks.every((t) => selected.has(t.id));
          const someSelected =
            !allSelected && tasks.some((t) => selected.has(t.id));
          return (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={() => toggleGroup(tasks)}
                      className="size-3.5 cursor-pointer rounded border-border"
                      aria-label={`Select all ${status} tasks`}
                    />
                    <span className="capitalize">
                      {status.replace('_', ' ')}
                    </span>
                  </label>
                  <Badge variant="outline" className="text-xs">
                    {tasks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/60">
                  {tasks.map((task) => {
                    const isSelected = selected.has(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`flex items-stretch ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <label className="flex shrink-0 cursor-pointer items-center pl-4 pr-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(task.id)}
                            className="size-3.5 cursor-pointer rounded border-border"
                            aria-label={`Select task: ${task.title}`}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          <TaskRow
                            workspaceId={workspaceId}
                            task={task}
                            members={members}
                            mentionMembers={mentionMembers}
                          />
                        </div>
                      </div>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur-sm">
            <span className="text-sm">
              <strong>{selected.size}</strong>{' '}
              selected
            </span>
            <span className="h-5 w-px bg-border" aria-hidden />
            <Select
              value=""
              onValueChange={(v) => changeStatus(v as TaskStatus)}
            >
              <SelectTrigger
                className="h-8 w-[140px] text-xs"
                disabled={submitting}
              >
                <SelectValue placeholder="Change status…" />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.filter((s) => s !== 'archived').map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    Mark {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={bulkDelete}
              disabled={submitting}
              className="h-8 gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear selection"
              disabled={submitting}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
