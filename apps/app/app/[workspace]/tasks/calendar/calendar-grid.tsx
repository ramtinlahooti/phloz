'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import type { TaskPriority, TaskStatus } from '@phloz/config';
import { toast } from '@phloz/ui';

import { updateTaskAction } from '../actions';

const PRIORITY_TONE: Record<TaskPriority, string> = {
  urgent: 'bg-red-500/10 text-red-300 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  medium: 'bg-card border-border text-foreground/90',
  low: 'bg-card border-border text-muted-foreground',
};

const STATUS_DONE_TONE = 'bg-muted text-muted-foreground line-through';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type CalendarTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO timestamp; the calendar bucket is derived from the local date. */
  dueDate: string;
  clientId: string | null;
};

export type CalendarClient = { id: string; name: string };

/**
 * Month-grid renderer with drag-to-reschedule. Pills click through to
 * the list view's detail dialog (handled by the parent <Link>).
 * Dragging a pill onto a different cell calls `updateTaskAction` with
 * the new dueDate (preserving time-of-day) and updates local state
 * optimistically. Done tasks are not draggable — rescheduling a
 * completed task is rarely the user's intent and would silently move
 * the visible pill into a "completed" cell.
 *
 * Tasks past the visible "+N more" overflow aren't draggable; users
 * fall through to the detail dialog to set a new date manually. This
 * keeps the surface area honest without re-implementing the dialog
 * here.
 *
 * Native HTML5 DnD (no extra dep) — same primitive the subtask
 * checklist uses for keyboard / mouse reorder.
 */
export function CalendarMonthGrid({
  workspaceId,
  initialTasks,
  clients,
  monthStartKey,
  todayKey,
}: {
  workspaceId: string;
  initialTasks: CalendarTask[];
  clients: CalendarClient[];
  /** YYYY-MM-DD pinned to the 1st of the rendered month. */
  monthStartKey: string;
  /** YYYY-MM-DD for the "today" highlight, server-evaluated to avoid
   *  hydration jitter when the client is in a different timezone. */
  todayKey: string;
}) {
  const [tasks, setTasks] = useState<CalendarTask[]>(initialTasks);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const clientName = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  const monthStart = parseDateKey(monthStartKey);

  // Grid range: Sunday-on-or-before monthStart through 42 cells out.
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  // Bucket tasks by date key on every render — the source of truth is
  // the `tasks` state, not the cell layout.
  const byDay = new Map<string, CalendarTask[]>();
  for (const t of tasks) {
    const key = dateKey(new Date(t.dueDate));
    const list = byDay.get(key) ?? [];
    list.push(t);
    byDay.set(key, list);
  }

  const cells: Array<{
    key: string;
    date: Date;
    inMonth: boolean;
    isToday: boolean;
    items: CalendarTask[];
  }> = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const key = dateKey(date);
    cells.push({
      key,
      date,
      inMonth: date.getMonth() === monthStart.getMonth(),
      isToday: key === todayKey,
      items: byDay.get(key) ?? [],
    });
  }

  function handleDrop(targetKey: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const id = draggingId;
      setDraggingId(null);
      setOverKey(null);
      if (!id) return;
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const sourceKey = dateKey(new Date(task.dueDate));
      if (sourceKey === targetKey) return;

      // Preserve time-of-day so a "due 5pm" task doesn't silently shift
      // to midnight when rescheduled. We replace year/month/day on the
      // existing Date and keep hours/minutes/seconds untouched.
      const next = new Date(task.dueDate);
      const target = parseDateKey(targetKey);
      next.setFullYear(
        target.getFullYear(),
        target.getMonth(),
        target.getDate(),
      );
      const nextIso = next.toISOString();

      const previous = tasks;
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, dueDate: nextIso } : t)),
      );

      startTransition(async () => {
        const res = await updateTaskAction({
          workspaceId,
          id,
          dueDate: nextIso,
        });
        if (!res.ok) {
          setTasks(previous);
          toast.error(`Couldn't reschedule: ${res.error}`);
          return;
        }
        toast.success(
          `Rescheduled to ${target.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}`,
        );
      });
    };
  }

  function cellDragOver(targetKey: string) {
    return (e: React.DragEvent) => {
      if (!draggingId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overKey !== targetKey) setOverKey(targetKey);
    };
  }

  function cellDragLeave(targetKey: string) {
    return (e: React.DragEvent) => {
      // Ignore leaves that go into a child of this cell — the pill has
      // its own drag events that bubble through. Only clear when the
      // pointer crosses the cell boundary.
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      if (overKey === targetKey) setOverKey(null);
    };
  }

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
      {WEEKDAY_LABELS.map((label) => (
        <div
          key={label}
          className="bg-card/50 px-2 py-1.5 text-center text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </div>
      ))}
      {cells.map((cell) => {
        const isOver = overKey === cell.key && draggingId !== null;
        return (
          <div
            key={cell.key}
            className={`min-h-[110px] p-1.5 text-xs transition-colors ${
              cell.inMonth ? '' : 'opacity-40'
            } ${
              isOver
                ? 'bg-primary/10 ring-1 ring-inset ring-primary/50'
                : 'bg-card/30'
            }`}
            onDragOver={cellDragOver(cell.key)}
            onDragLeave={cellDragLeave(cell.key)}
            onDrop={handleDrop(cell.key)}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-medium ${
                  cell.isToday
                    ? 'inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground'
                    : 'text-foreground/80'
                }`}
              >
                {cell.date.getDate()}
              </span>
            </div>
            <ul className="mt-1 space-y-1">
              {cell.items.slice(0, 3).map((t) => {
                const tone =
                  t.status === 'done'
                    ? STATUS_DONE_TONE
                    : PRIORITY_TONE[t.priority];
                const subtitle = t.clientId
                  ? clientName.get(t.clientId) ?? null
                  : null;
                const isDragging = draggingId === t.id;
                const draggable = t.status !== 'done' && t.status !== 'archived';
                return (
                  <li key={t.id}>
                    <Link
                      href={`/${workspaceId}/tasks?task=${t.id}`}
                      className={`block truncate rounded border px-1.5 py-0.5 text-[10px] transition-opacity ${tone} ${
                        isDragging
                          ? 'opacity-40'
                          : draggable
                            ? 'cursor-grab hover:opacity-80 active:cursor-grabbing'
                            : 'hover:opacity-80'
                      }`}
                      title={
                        draggable
                          ? subtitle
                            ? `${t.title} · ${subtitle} · drag to reschedule`
                            : `${t.title} · drag to reschedule`
                          : subtitle
                            ? `${t.title} · ${subtitle}`
                            : t.title
                      }
                      draggable={draggable}
                      onDragStart={
                        draggable
                          ? (e) => {
                              setDraggingId(t.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', t.id);
                            }
                          : undefined
                      }
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverKey(null);
                      }}
                    >
                      {t.title}
                    </Link>
                  </li>
                );
              })}
              {cell.items.length > 3 && (
                <li className="px-1 text-[10px] text-muted-foreground">
                  +{cell.items.length - 3} more
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((s) => Number.parseInt(s, 10));
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
