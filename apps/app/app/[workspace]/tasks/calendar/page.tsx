import { and, asc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import Link from 'next/link';

import { requireUser } from '@phloz/auth/session';
import type { TaskPriority, TaskStatus } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import {
  CalendarMonthGrid,
  type CalendarTask,
} from './calendar-grid';

export const metadata = buildAppMetadata({ title: 'Task calendar' });

type RouteParams = { workspace: string };
type CalendarSearchParams = { month?: string };

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

function fmtDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Month-grid view of every task with a due date in the selected
 * month. Pills click through to the list view's detail dialog and
 * can be dragged onto a different cell to reschedule (handled by the
 * client-side <CalendarMonthGrid />).
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

  // Project to serializable shape for the client grid. dueDate is
  // non-null here (the query filters it).
  const calendarTasks: CalendarTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    dueDate: t.dueDate!.toISOString(),
    clientId: t.clientId,
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

      <CalendarMonthGrid
        workspaceId={workspaceId}
        initialTasks={calendarTasks}
        clients={clientRows}
        monthStartKey={fmtDateKey(monthStart)}
        todayKey={fmtDateKey(today)}
      />

      <p className="mt-4 text-xs text-muted-foreground">
        Click a task pill to open it inside the list view. Drag a pill
        to a different day to reschedule. Tasks without a due date
        don&apos;t appear here — set one in the task detail dialog.
      </p>
    </div>
  );
}
