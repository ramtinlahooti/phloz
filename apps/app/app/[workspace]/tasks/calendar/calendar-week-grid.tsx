'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import type { TaskPriority } from '@phloz/config';
import { toast } from '@phloz/ui';

import { updateTaskAction } from '../actions';

import type { CalendarClient, CalendarTask } from './calendar-grid';

const PRIORITY_TONE: Record<TaskPriority, string> = {
  urgent: 'bg-red-500/10 text-red-300 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  medium: 'bg-card border-border text-foreground/90',
  low: 'bg-card border-border text-muted-foreground',
};

const STATUS_DONE_TONE = 'bg-muted text-muted-foreground line-through';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Week-grid renderer. Same drag-to-reschedule contract as the month
 * grid (preserves time-of-day, optimistic + revert on error), but
 * laid out as 7 stacked columns with full task lists per day instead
 * of the month grid's 3-pill cap. No time-of-day axis yet — every
 * task on a day shows in chronological order based on its dueDate.
 *
 * Click-through opens the list view's detail dialog (same href
 * pattern as the month grid). Done/archived tasks aren't draggable.
 */
export function CalendarWeekGrid({
  workspaceId,
  initialTasks,
  clients,
  weekStartKey,
  todayKey,
}: {
  workspaceId: string;
  initialTasks: CalendarTask[];
  clients: CalendarClient[];
  /** YYYY-MM-DD pinned to the Sunday at the start of the rendered week. */
  weekStartKey: string;
  /** YYYY-MM-DD for the "today" highlight, server-evaluated. */
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

  const weekStart = parseDateKey(weekStartKey);

  // Bucket tasks by date key on every render so optimistic moves
  // re-render in the right cell.
  const byDay = new Map<string, CalendarTask[]>();
  for (const t of tasks) {
    const key = dateKey(new Date(t.dueDate));
    const list = byDay.get(key) ?? [];
    list.push(t);
    byDay.set(key, list);
  }
  // Sort within each day by the original dueDate timestamp so AM
  // tasks sit above PM tasks. Stable across re-renders.
  for (const list of byDay.values()) {
    list.sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
  }

  const cells: Array<{
    key: string;
    date: Date;
    isToday: boolean;
    items: CalendarTask[];
  }> = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const key = dateKey(date);
    cells.push({
      key,
      date,
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

      // Preserve time-of-day so a "due 5pm" task doesn't silently
      // shift to midnight. Same contract as the month grid.
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
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      if (overKey === targetKey) setOverKey(null);
    };
  }

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
      {cells.map((cell) => {
        const isOver = overKey === cell.key && draggingId !== null;
        return (
          <div
            key={cell.key}
            className={`flex min-h-[320px] flex-col bg-card/30 p-2 transition-colors ${
              isOver
                ? 'bg-primary/10 ring-1 ring-inset ring-primary/50'
                : ''
            }`}
            onDragOver={cellDragOver(cell.key)}
            onDragLeave={cellDragLeave(cell.key)}
            onDrop={handleDrop(cell.key)}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {WEEKDAY_LABELS[cell.date.getDay()]}
              </span>
              <span
                className={`text-sm font-semibold ${
                  cell.isToday
                    ? 'inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground'
                    : 'text-foreground/80'
                }`}
              >
                {cell.date.getDate()}
              </span>
            </div>
            <ul className="flex-1 space-y-1">
              {cell.items.length === 0 ? (
                <li className="text-[10px] italic text-muted-foreground/60">
                  &nbsp;
                </li>
              ) : (
                cell.items.map((t) => {
                  const tone =
                    t.status === 'done'
                      ? STATUS_DONE_TONE
                      : PRIORITY_TONE[t.priority];
                  const subtitle = t.clientId
                    ? clientName.get(t.clientId) ?? null
                    : null;
                  const isDragging = draggingId === t.id;
                  const draggable =
                    t.status !== 'done' && t.status !== 'archived';
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/${workspaceId}/tasks?task=${t.id}`}
                        className={`block truncate rounded border px-1.5 py-1 text-[11px] transition-opacity ${tone} ${
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
                        <div className="truncate font-medium">{t.title}</div>
                        {subtitle && (
                          <div className="truncate text-[9px] opacity-70">
                            {subtitle}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })
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
