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
import { CalendarWeekGrid } from './calendar-week-grid';

export const metadata = buildAppMetadata({ title: 'Task calendar' });

type RouteParams = { workspace: string };
type CalendarSearchParams = {
  month?: string;
  week?: string;
  view?: string;
};

type CalendarView = 'month' | 'week';

const VALID_VIEWS: CalendarView[] = ['month', 'week'];

function parseView(raw: string | undefined): CalendarView {
  return (VALID_VIEWS as string[]).includes(raw ?? '')
    ? (raw as CalendarView)
    : 'month';
}

/**
 * Parse `?month=YYYY-MM` to a Date pinned at the 1st of that month
 * in the **server's** local time. Falls back to "now" for invalid /
 * missing values.
 */
function parseMonth(raw: string | undefined): Date {
  if (raw && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(raw)) {
    const [y, m] = raw.split('-').map((s) => parseInt(s, 10));
    return new Date(y!, (m ?? 1) - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Parse `?week=YYYY-MM-DD` to the Sunday-on-or-before that date.
 * Falls back to the Sunday-on-or-before today.
 */
function parseWeekStart(raw: string | undefined): Date {
  let anchor: Date;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map((s) => parseInt(s, 10));
    anchor = new Date(y!, (m ?? 1) - 1, d ?? 1);
  } else {
    anchor = new Date();
  }
  const sunday = new Date(anchor);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return sunday;
}

function fmtMonthParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Calendar view of every task with a due date in the selected
 * month or week. Pills click through to the list view's detail
 * dialog and can be dragged onto a different cell to reschedule
 * (handled by the client-side grid component).
 *
 * View defaults to month. `?view=week` switches to a 7-column
 * day-of-week grid with full task lists per cell (no overflow cap)
 * — useful when planning the week's work in detail.
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
  const view = parseView(sp.view);

  // Compute the date range to fetch based on view.
  let gridStart: Date;
  let gridEnd: Date; // exclusive
  let monthStart: Date | null = null;
  let weekStart: Date | null = null;

  if (view === 'week') {
    weekStart = parseWeekStart(sp.week);
    gridStart = weekStart;
    gridEnd = new Date(weekStart);
    gridEnd.setDate(weekStart.getDate() + 7);
  } else {
    monthStart = parseMonth(sp.month);
    gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    gridEnd = new Date(gridStart);
    gridEnd.setDate(gridStart.getDate() + 42);
  }

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
        // Subtasks are checklist items inside their parent's dialog.
        isNull(schema.tasks.parentTaskId),
      ),
    )
    .orderBy(asc(schema.tasks.dueDate));

  const clientRows = await db
    .select({ id: schema.clients.id, name: schema.clients.name })
    .from(schema.clients)
    .where(eq(schema.clients.workspaceId, workspaceId));

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
  const todayKey = fmtDateKey(today);

  // Header label + nav links depend on the active view.
  let headerLabel: string;
  let prevHref: string;
  let nextHref: string;
  let todayHref: string;
  if (view === 'week' && weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
    headerLabel = sameMonth
      ? `${weekStart.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
        })} – ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
      : `${weekStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} – ${weekEnd.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}, ${weekEnd.getFullYear()}`;
    const prevWeek = new Date(weekStart);
    prevWeek.setDate(weekStart.getDate() - 7);
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(weekStart.getDate() + 7);
    prevHref = `/${workspaceId}/tasks/calendar?view=week&week=${fmtDateKey(prevWeek)}`;
    nextHref = `/${workspaceId}/tasks/calendar?view=week&week=${fmtDateKey(nextWeek)}`;
    todayHref = `/${workspaceId}/tasks/calendar?view=week`;
  } else if (monthStart) {
    headerLabel = monthStart.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
    const prevMonth = new Date(monthStart);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    prevHref = `/${workspaceId}/tasks/calendar?month=${fmtMonthParam(prevMonth)}`;
    nextHref = `/${workspaceId}/tasks/calendar?month=${fmtMonthParam(nextMonth)}`;
    todayHref = `/${workspaceId}/tasks/calendar`;
  } else {
    // Defensive — shouldn't reach here. Render today's month.
    headerLabel = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
    prevHref = `/${workspaceId}/tasks/calendar`;
    nextHref = `/${workspaceId}/tasks/calendar`;
    todayHref = `/${workspaceId}/tasks/calendar`;
  }

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
            {headerLabel}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tasks.length} task
            {tasks.length === 1 ? '' : 's'} on the grid · subtasks are
            inside their parent.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-xs">
          <ViewToggle workspaceId={workspaceId} active={view} />
          <span className="hidden text-border sm:inline">·</span>
          <Link
            href={prevHref}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            ← Previous
          </Link>
          <Link
            href={todayHref}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            Today
          </Link>
          <Link
            href={nextHref}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            Next →
          </Link>
        </nav>
      </header>

      {view === 'week' && weekStart ? (
        <CalendarWeekGrid
          workspaceId={workspaceId}
          initialTasks={calendarTasks}
          clients={clientRows}
          weekStartKey={fmtDateKey(weekStart)}
          todayKey={todayKey}
        />
      ) : monthStart ? (
        <CalendarMonthGrid
          workspaceId={workspaceId}
          initialTasks={calendarTasks}
          clients={clientRows}
          monthStartKey={fmtDateKey(monthStart)}
          todayKey={todayKey}
        />
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Click a task pill to open it inside the list view. Drag a pill
        to a different day to reschedule. Tasks without a due date
        don&apos;t appear here — set one in the task detail dialog.
      </p>
    </div>
  );
}

/**
 * Month/Week toggle pill. Always navigates to "today's" period in
 * the new view — losing context across the toggle is the price of
 * a simple URL shape; users can navigate prev/next from there.
 */
function ViewToggle({
  workspaceId,
  active,
}: {
  workspaceId: string;
  active: CalendarView;
}) {
  const base = `/${workspaceId}/tasks/calendar`;
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border bg-card text-[11px]">
      <Link
        href={base}
        className={`px-2.5 py-1 transition-colors ${
          active === 'month'
            ? 'bg-primary/15 text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Month
      </Link>
      <Link
        href={`${base}?view=week`}
        className={`border-l border-border px-2.5 py-1 transition-colors ${
          active === 'week'
            ? 'bg-primary/15 text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Week
      </Link>
    </div>
  );
}
