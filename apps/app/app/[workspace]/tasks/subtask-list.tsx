'use client';

import { ListTodo, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { toast } from '@phloz/ui';

import {
  createTaskAction,
  deleteTaskAction,
  listSubtasksAction,
  toggleSubtaskAction,
  type SubtaskView,
} from './actions';

/**
 * Checklist UI for a task's subtasks. Renders inside TaskDetailDialog.
 *
 * Behavior:
 * - Lazy-loads subtasks on first render via `listSubtasksAction`.
 * - Checkbox toggles between `todo` and `done` via `toggleSubtaskAction`.
 *   Optimistic: the checkbox flips immediately; on server error we
 *   revert and toast.
 * - "Add subtask" row creates a new child via `createTaskAction` with
 *   `parentTaskId` set. Defaults inherit from the parent (client/
 *   department/etc.) — subtask only needs a title.
 * - Delete icon on each row; confirms via `window.confirm`.
 *
 * Keeps the interface tight intentionally: subtasks are checklist
 * items, not mini-tasks. If someone wants due dates / assignees per
 * subtask, that's a V2 conversation.
 */
export function SubtaskList({
  workspaceId,
  parentTaskId,
  onCountChange,
}: {
  workspaceId: string;
  parentTaskId: string;
  /**
   * Bubbles up the current (total, done) counts so the parent can
   * update its own UI (progress pill) without re-fetching. Fires
   * after every successful mutation.
   */
  onCountChange?: (stats: { total: number; done: number }) => void;
}) {
  const [subtasks, setSubtasks] = useState<SubtaskView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setSubtasks(null);
    setLoadError(null);
    (async () => {
      const res = await listSubtasksAction({ workspaceId, parentTaskId });
      if (cancelled) return;
      if (res.ok) setSubtasks(res.subtasks);
      else setLoadError(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, parentTaskId]);

  useEffect(() => {
    if (!subtasks || !onCountChange) return;
    onCountChange({
      total: subtasks.length,
      done: subtasks.filter((s) => s.status === 'done').length,
    });
  }, [subtasks, onCountChange]);

  function toggle(id: string, nextDone: boolean) {
    // Optimistic flip.
    setSubtasks((prev) =>
      prev
        ? prev.map((s) =>
            s.id === id ? { ...s, status: nextDone ? 'done' : 'todo' } : s,
          )
        : prev,
    );
    startTransition(async () => {
      const res = await toggleSubtaskAction({
        workspaceId,
        subtaskId: id,
        done: nextDone,
      });
      if (!res.ok) {
        toast.error(res.error);
        // Revert.
        setSubtasks((prev) =>
          prev
            ? prev.map((s) =>
                s.id === id
                  ? { ...s, status: nextDone ? 'todo' : 'done' }
                  : s,
              )
            : prev,
        );
      }
    });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      // The server resolves clientId from the parent when parentTaskId
      // is set, and the status/priority/department/visibility defaults
      // still need to be passed because Zod's `.default()` doesn't
      // make the input type optional.
      const res = await createTaskAction({
        workspaceId,
        clientId: null,
        parentTaskId,
        title,
        status: 'todo',
        priority: 'medium',
        department: 'other',
        visibility: 'internal',
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSubtasks((prev) => [
        ...(prev ?? []),
        { id: res.id, title, status: 'todo' },
      ]);
      setNewTitle('');
    } finally {
      setAdding(false);
    }
  }

  function remove(id: string) {
    if (!confirm('Delete this subtask?')) return;
    startTransition(async () => {
      const res = await deleteTaskAction({ workspaceId, id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSubtasks((prev) => (prev ?? []).filter((s) => s.id !== id));
    });
  }

  if (loadError) {
    return (
      <p className="rounded-md border border-border bg-card/30 p-3 text-sm text-[var(--color-destructive)]">
        Couldn&apos;t load subtasks: {loadError}
      </p>
    );
  }

  const doneCount = subtasks?.filter((s) => s.status === 'done').length ?? 0;
  const totalCount = subtasks?.length ?? 0;

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ListTodo className="size-3.5" />
        Subtasks
        {subtasks && (
          <span className="font-normal normal-case text-muted-foreground">
            · {doneCount} / {totalCount}
          </span>
        )}
      </h3>

      {subtasks === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : subtasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/30 p-3 text-center text-xs text-muted-foreground">
          No subtasks yet — use these for multi-step work like audits
          or content briefs.
        </p>
      ) : (
        <ul className="space-y-1">
          {subtasks.map((s) => {
            const done = s.status === 'done';
            return (
              <li
                key={s.id}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 rounded border-border"
                  aria-label={done ? 'Mark not done' : 'Mark done'}
                />
                <span
                  className={`flex-1 text-sm ${
                    done
                      ? 'text-muted-foreground line-through'
                      : 'text-foreground/90'
                  }`}
                >
                  {s.title}
                </span>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  title="Delete subtask"
                  aria-label="Delete subtask"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={add} className="flex items-center gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a subtask…"
          maxLength={200}
          disabled={adding}
          className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-transparent px-3 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>
    </section>
  );
}
