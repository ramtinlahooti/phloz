'use client';

import { GripVertical, ListTodo, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { toast } from '@phloz/ui';

import {
  createTaskAction,
  deleteTaskAction,
  listSubtasksAction,
  reorderSubtasksAction,
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
 * - Drag the grip handle to reorder. The reorder is optimistic — the
 *   list rearranges immediately on drop and `reorderSubtasksAction`
 *   persists the new sequence; on error we revert + toast.
 * - "Add subtask" row creates a new child via `createTaskAction` with
 *   `parentTaskId` set; the server places new subtasks at the end of
 *   the sibling group via `MAX(sort_order) + 1024`.
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
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

  // ---- Reorder helpers (shared by DnD + keyboard) -----------------------

  function applyReorder(nextIds: string[], previous: SubtaskView[]) {
    const lookup = new Map(previous.map((s) => [s.id, s]));
    const next = nextIds.flatMap((id) => {
      const row = lookup.get(id);
      return row ? [row] : [];
    });
    setSubtasks(next);
    startTransition(async () => {
      const res = await reorderSubtasksAction({
        workspaceId,
        parentTaskId,
        orderedIds: nextIds,
      });
      if (!res.ok) {
        toast.error(res.error);
        setSubtasks(previous);
      }
    });
  }

  function moveBy(id: string, delta: -1 | 1) {
    if (!subtasks) return;
    const idx = subtasks.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const target = idx + delta;
    if (target < 0 || target >= subtasks.length) return;
    const nextIds = subtasks.map((s) => s.id);
    const [moved] = nextIds.splice(idx, 1);
    if (!moved) return;
    nextIds.splice(target, 0, moved);
    applyReorder(nextIds, subtasks);
  }

  // ---- DnD --------------------------------------------------------------

  function onDragStart(id: string) {
    return (e: React.DragEvent) => {
      setDraggingId(id);
      e.dataTransfer.effectAllowed = 'move';
      // Some browsers refuse to fire drag events without payload.
      e.dataTransfer.setData('text/plain', id);
    };
  }

  function onDragOver(id: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overId !== id) setOverId(id);
    };
  }

  function onDrop(targetId: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const sourceId = draggingId;
      setDraggingId(null);
      setOverId(null);
      if (!sourceId || sourceId === targetId || !subtasks) return;

      const fromIdx = subtasks.findIndex((s) => s.id === sourceId);
      const toIdx = subtasks.findIndex((s) => s.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return;

      const nextIds = subtasks.map((s) => s.id);
      const [moved] = nextIds.splice(fromIdx, 1);
      if (!moved) return;
      nextIds.splice(toIdx, 0, moved);
      applyReorder(nextIds, subtasks);
    };
  }

  // ---- Keyboard reorder (Cmd/Ctrl + ↑/↓) --------------------------------

  function onRowKeyDown(id: string) {
    return (e: React.KeyboardEvent) => {
      // Only handle Cmd/Ctrl + arrow up/down. Plain arrow keys still
      // navigate inside the dialog (focus traversal) — we don't want
      // to swallow them.
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveBy(id, -1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveBy(id, 1);
      }
    };
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
            const isDragging = draggingId === s.id;
            const isDragTarget = overId === s.id && draggingId !== s.id;
            return (
              <li
                key={s.id}
                draggable
                tabIndex={0}
                onDragStart={onDragStart(s.id)}
                onDragOver={onDragOver(s.id)}
                onDrop={onDrop(s.id)}
                onDragEnd={() => {
                  setDraggingId(null);
                  setOverId(null);
                }}
                onKeyDown={onRowKeyDown(s.id)}
                onFocus={() => setFocusedId(s.id)}
                onBlur={() => setFocusedId((prev) => (prev === s.id ? null : prev))}
                aria-label={`${s.title}. Cmd-Up or Cmd-Down to reorder.`}
                className={`group flex items-start gap-2 rounded-md px-1 py-1.5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  isDragging
                    ? 'opacity-40'
                    : isDragTarget
                      ? 'bg-primary/10'
                      : focusedId === s.id
                        ? 'bg-muted/40'
                        : 'hover:bg-muted/50'
                }`}
              >
                <span
                  className="mt-0.5 cursor-grab text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                  aria-hidden
                >
                  <GripVertical className="size-3.5" />
                </span>
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
