import { and, asc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import Link from 'next/link';

import { requireUser } from '@phloz/auth/session';
import type { TaskPriority } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

export const metadata = buildAppMetadata({ title: 'Task calendar' });

type RouteParams = { workspace: string };
type CalendarSearchParams = { month?: string };

const PRIORITY_TONE: Record<TaskPriority, string> = {
  urgent: 'bg-red-500/10 text-red-300 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  medium: 'bg-card border-border text-foreground/90',
  low: 'bg-card border-border text-muted-foreground',
};

const STATUS_DONE_TONE = 'bg-muted text-muted-foreground line-through';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Parse `?month=YYYY-MM` to a Date pinned at the 1st of that month
 * in the **server's** local time (good enough for the visual grid;
 * we don't need workspace-tz precision here). Falls back to "now"
 * for invalid / missing values.
 */
function parseMonth(raw: string | undefined): Date {
  if (raw && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(raw)) {
    const [y, m] = raw.split('-').map((s) => parseInt(s, 10));
    return new Date(y!, (m ?? 1) - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function fmtMonthParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Month-grid view of every task with a due date in the selected
 * month. Pills link back to the list view with `?task=<id>` so the
 * detail dialog opens — keeps the dialog implementation in one
 * place.
 */
export default async function TasksCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<CalendarSearchParams>;
}) {
  const { workspace: workspaceId } = await params;
  assertValidWorkspaceId(workspaceId);
  const sp = await searchParams;
  const monthStart = parseMonth(sp.month);

  // Grid range: from the Sunday-on-or-before monthStart to the
  // Saturday-on-or-after the last day of the month. Always 6 rows
  // for visual consistency.
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42); // exclusive end

  const db = getDb();
  await requireUser();

  const tasks = await db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
      dueDate: schema.tasks.dueDate,
      clientId: schema.tasks.clientId,
      approvalState: schema.tasks.approvalState,
    })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.workspaceId, workspaceId),
        isNotNull(schema.tasks.dueDate),
        gte(schema.tasks.dueDate, gridStart),
        lte(schema.tasks.dueDate, gridEnd),
        // Exclude subtasks from the calendar — they're checklist
        // items inside the parent's detail dialog, not standalone
        // calendar entries.
        isNull(schema.tasks.parentTaskId),
      ),
    )
    .orderBy(asc(schema.tasks.dueDate));

  const clientRows = await db
    .select({ id: schema.clients.id, name: schema.clients.name })
    .from(schema.clients)
    .where(eq(schema.clients.workspaceId, workspaceId));
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  // Bucket tasks into a Map<YYYY-MM-DD, task[]> so the grid render
  // is O(1) per cell.
  const byDay = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const key = `${t.dueDate.getFullYear()}-${String(
      t.dueDate.getMonth() + 1,
    ).padStart(2, '0')}-${String(t.dueDate.getDate()).padStart(2, '0')}`;
    const list = byDay.get(key) ?? [];
    list.push(t);
    byDay.set(key, list);
  }

  // Build the 6×7 cell grid.
  const cells: Array<{
    date: Date;
    inMonth: boolean;
    isToday: boolean;
    tasks: typeof tasks;
  }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const key = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayTasks = byDay.get(key) ?? [];
    cells.push({
      date,
      inMonth: date.getMonth() === monthStart.getMonth(),
      isToday: date.getTime() === today.getTime(),
      tasks: dayTasks,
    });
  }

  const prevMonth = new Date(monthStart);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const monthLabel = monthStart.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            <Link
              href={`/${workspaceId}/tasks`}
              className="hover:text-foreground"
            >
              Tasks
            </Link>{' '}
            / Calendar
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {monthLabel}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tasks.length} task
            {tasks.length === 1 ? '' : 's'} on the grid · subtasks are
            inside their parent.
          </p>
        </div>
        <nav className="flex items-center gap-2 text-xs">
          <Link
            href={`/${workspaceId}/tasks/calendar?month=${fmtMonthParam(prevMonth)}`}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            ← Previous
          </Link>
          <Link
            href={`/${workspaceId}/tasks/calendar`}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            Today
          </Link>
          <Link
            href={`/${workspaceId}/tasks/calendar?month=${fmtMonthParam(nextMonth)}`}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            Next →
          </Link>
        </nav>
      </header>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-card/50 px-2 py-1.5 text-center text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {cells.map((cell, idx) => (
          <div
            key={idx}
            className={`min-h-[110px] bg-card/30 p-1.5 text-xs ${
              cell.inMonth ? '' : 'opacity-40'
            }`}
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
              {cell.tasks.slice(0, 3).map((t) => {
                const tone =
                  t.status === 'done'
                    ? STATUS_DONE_TONE
                    : PRIORITY_TONE[t.priority as TaskPriority];
                const subtitle = t.clientId
                  ? clientName.get(t.clientId) ?? null
                  : null;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/${workspaceId}/tasks?task=${t.id}`}
                      className={`block truncate rounded border px-1.5 py-0.5 text-[10px] transition-opacity hover:opacity-80 ${tone}`}
                      title={subtitle ? `${t.title} · ${subtitle}` : t.title}
                    >
                      {t.title}
                    </Link>
                  </li>
                );
              })}
              {cell.tasks.length > 3 && (
                <li className="px-1 text-[10px] text-muted-foreground">
                  +{cell.tasks.length - 3} more
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Click a task pill to open it inside the list view. Tasks
        without a due date don&apos;t appear here — set one in the
        task detail dialog.
      </p>
    </div>
  );
}
