import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import Link from 'next/link';

import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';
import type {
  ApprovalState,
  Department,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@phloz/config';
import { DEPARTMENTS, TASK_STATUSES } from '@phloz/config';
import { EmptyState } from '@phloz/ui';

import { ExportButton } from '@/components/export-button';
import { SearchInput } from '@/components/search-input';
import { buildAppMetadata } from '@/lib/metadata';

import { NewTaskDialog } from './new-task-dialog';
import { TaskListWithSelection } from './task-list-with-selection';
import { type TaskRowModel } from './task-row';
import { TaskFilters, type TaskSort } from './task-filters';

export const metadata = buildAppMetadata({ title: 'Tasks' });

type RouteParams = { workspace: string };
type SearchParams = {
  department?: string;
  status?: string;
  client?: string;
  assignee?: string;
  sort?: string;
  /** Free-text search across task titles. */
  q?: string;
};

const DISPLAY_GROUPS: TaskStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'done',
];

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const SORT_OPTIONS: TaskSort[] = [
  'priority',
  'due_soonest',
  'due_latest',
  'recently_updated',
  'recently_created',
];

function isSort(v: string | undefined): v is TaskSort {
  return !!v && (SORT_OPTIONS as string[]).includes(v);
}

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { workspace: workspaceId } = await params;
  const sp = await searchParams;
  const departmentFilter = DEPARTMENTS.includes(sp.department as Department)
    ? (sp.department as Department)
    : null;
  const statusFilter = TASK_STATUSES.includes(sp.status as TaskStatus)
    ? (sp.status as TaskStatus)
    : null;
  const clientFilter = sp.client ?? null;
  const assigneeFilter = sp.assignee ?? null;
  const searchQuery = (sp.q ?? '').trim().toLowerCase();
  const sort: TaskSort = isSort(sp.sort) ? sp.sort : 'priority';

  const db = getDb();
  const user = await requireUser();

  const [taskRows, clientRows, memberRows, subtaskRollupRows] =
    await Promise.all([
      db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.workspaceId, workspaceId),
            // Subtasks live under their parent's detail dialog — they
            // shouldn't clutter the main task list.
            isNull(schema.tasks.parentTaskId),
          ),
        ),
      db
        .select({ id: schema.clients.id, name: schema.clients.name })
        .from(schema.clients)
        .where(eq(schema.clients.workspaceId, workspaceId))
        .orderBy(asc(schema.clients.name)),
      db
        .select({
          id: schema.workspaceMembers.id,
          userId: schema.workspaceMembers.userId,
          role: schema.workspaceMembers.role,
          displayName: schema.workspaceMembers.displayName,
          email: schema.workspaceMembers.email,
        })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, workspaceId)),
      // Subtask rollup per parent: one row per subtask with its parent
      // id + status, aggregated in JS. Small volumes at launch; swap
      // to a GROUP BY when a workspace has thousands of subtasks.
      db
        .select({
          parentTaskId: schema.tasks.parentTaskId,
          status: schema.tasks.status,
        })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.workspaceId, workspaceId),
            isNotNull(schema.tasks.parentTaskId),
          ),
        ),
    ]);

  // Aggregate subtask totals per parent.
  const subtaskStats = new Map<string, { total: number; done: number }>();
  for (const row of subtaskRollupRows) {
    if (!row.parentTaskId) continue;
    const stats = subtaskStats.get(row.parentTaskId) ?? { total: 0, done: 0 };
    stats.total += 1;
    if (row.status === 'done') stats.done += 1;
    subtaskStats.set(row.parentTaskId, stats);
  }

  // Current user's membership — used by the "Mine" quick-filter pill.
  // Previously this was a separate query that fetched the *first*
  // member (bug), now we just find it in the rows we already fetched.
  const currentMembershipId =
    memberRows.find((m) => m.userId === user.id)?.id ?? null;

  const clientById = new Map(clientRows.map((c) => [c.id, c.name]));
  // Membership options for the assignee filter + dialog pickers.
  // Label precedence: "You" for current user → cached display_name →
  // cached email → UUID prefix. Sorted so "You" is first, then
  // alphabetical. Portal contacts are never assignees.
  const memberOptions = memberRows
    .map((m) => {
      const isSelf = m.userId === user.id;
      const primary =
        isSelf
          ? 'You'
          : (m.displayName?.trim() ||
             m.email?.trim() ||
             `${(m.userId ?? 'unknown').slice(0, 8)}…`);
      return {
        id: m.id,
        label: `${primary} · ${m.role}`,
        /** Used for sorting only. */
        sortKey: isSelf ? '' : primary.toLowerCase(),
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ id, label }) => ({ id, label }));

  // Filter rows.
  const filtered = taskRows.filter((t) => {
    if (departmentFilter && t.department !== departmentFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (clientFilter) {
      if (clientFilter === 'unassigned') {
        if (t.clientId !== null) return false;
      } else if (t.clientId !== clientFilter) return false;
    }
    if (assigneeFilter) {
      if (assigneeFilter === 'unassigned') {
        if (t.assigneeId !== null) return false;
      } else if (t.assigneeId !== assigneeFilter) return false;
    }
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery)) {
      return false;
    }
    return true;
  });

  // Sort within each status group.
  filtered.sort((a, b) => compare(a, b, sort));

  const byStatus: Record<TaskStatus, TaskRowModel[]> = {
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
    archived: [],
  };
  // Build a lookup from membership id → { label, isSelf } so each task
  // row can render its assignee without refetching. Labels mirror the
  // precedence used by the assignee filter/picker (You → display_name
  // → email → UUID prefix).
  const assigneeDetails = new Map<
    string,
    { label: string; isSelf: boolean }
  >();
  for (const m of memberRows) {
    const isSelf = m.userId === user.id;
    assigneeDetails.set(m.id, {
      label: isSelf
        ? 'You'
        : (m.displayName?.trim() ||
           m.email?.trim() ||
           `${(m.userId ?? 'unknown').slice(0, 8)}…`),
      isSelf,
    });
  }

  for (const t of filtered) {
    const assignee = t.assigneeId ? assigneeDetails.get(t.assigneeId) : null;
    const stats = subtaskStats.get(t.id);
    byStatus[t.status].push({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority as TaskPriority,
      department: t.department as Department,
      visibility: t.visibility as TaskVisibility,
      dueDate: t.dueDate,
      clientId: t.clientId,
      clientName: t.clientId ? clientById.get(t.clientId) ?? null : null,
      approvalState: t.approvalState as ApprovalState,
      assigneeMembershipId: t.assigneeId,
      assigneeLabel: assignee?.label ?? null,
      assigneeIsSelf: assignee?.isSelf ?? false,
      subtaskStats: stats,
    });
  }

  const anyFilterOn =
    departmentFilter !== null ||
    statusFilter !== null ||
    clientFilter !== null ||
    assigneeFilter !== null ||
    searchQuery !== '';

  const mineActive =
    currentMembershipId !== null && assigneeFilter === currentMembershipId;
  const mineHref = currentMembershipId
    ? hrefWithAssignee(
        mineActive ? null : currentMembershipId,
        { workspaceId, sp },
      )
    : `/${workspaceId}/tasks`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {taskRows.length} total ·{' '}
            {
              taskRows.filter(
                (t) => t.status !== 'done' && t.status !== 'archived',
              ).length
            }{' '}
            open
            {searchQuery && (
              <>
                {' · '}
                <span className="text-foreground">
                  {filtered.length} match
                  {filtered.length === 1 ? '' : 'es'}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:flex-shrink-0">
          <SearchInput
            placeholder="Search tasks…"
            className="w-full sm:w-56"
          />
          <ExportButton
            route={`/api/workspaces/${workspaceId}/tasks/export`}
          />
          <NewTaskDialog
            workspaceId={workspaceId}
            clients={clientRows}
            members={memberOptions}
          />
        </div>
      </header>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <FilterPill
          href={`/${workspaceId}/tasks`}
          active={!anyFilterOn && sort === 'priority'}
        >
          All
        </FilterPill>
        {currentMembershipId && (
          <FilterPill href={mineHref} active={mineActive}>
            Mine
          </FilterPill>
        )}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {DEPARTMENTS.map((d) => (
          <FilterPill
            key={d}
            href={hrefWith({ department: d }, { workspaceId, sp })}
            active={departmentFilter === d}
          >
            <span className="capitalize">{d.replace('_', ' ')}</span>
          </FilterPill>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {TASK_STATUSES.filter((s) => s !== 'archived').map((s) => (
          <FilterPill
            key={s}
            href={hrefWith({ status: s }, { workspaceId, sp })}
            active={statusFilter === s}
          >
            <span className="capitalize">{s.replace('_', ' ')}</span>
          </FilterPill>
        ))}
      </div>

      <TaskFilters
        workspaceId={workspaceId}
        searchParams={sp}
        clients={clientRows.map((c) => ({ id: c.id, name: c.name }))}
        members={memberOptions}
        activeClient={clientFilter}
        activeAssignee={assigneeFilter}
        activeSort={sort}
      />

      {taskRows.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create your first task to track work across clients."
          action={
            <NewTaskDialog
              workspaceId={workspaceId}
              clients={clientRows}
              members={memberOptions}
            />
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No tasks match these filters"
          description="Try clearing a filter or adjusting the sort."
          action={
            <Link
              href={`/${workspaceId}/tasks`}
              className="text-sm text-primary hover:underline"
            >
              Reset all filters
            </Link>
          }
        />
      ) : (
        <TaskListWithSelection
          workspaceId={workspaceId}
          members={memberOptions}
          groups={DISPLAY_GROUPS.flatMap((group) => {
            const rows = byStatus[group];
            if (statusFilter && group !== statusFilter) return [];
            if (rows.length === 0) return [];
            return [{ status: group, tasks: rows }];
          })}
        />
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * Build an href that targets a specific assignee (or clears it when
 * `assigneeId` is null). Keeps the other search params intact. Used
 * by the "Mine" quick-filter pill.
 */
function hrefWithAssignee(
  assigneeId: string | null,
  ctx: { workspaceId: string; sp: SearchParams },
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(ctx.sp)) {
    if (k === 'assignee') continue;
    if (typeof v === 'string' && v.length > 0) next.set(k, v);
  }
  if (assigneeId) next.set('assignee', assigneeId);
  const qs = next.toString();
  return qs
    ? `/${ctx.workspaceId}/tasks?${qs}`
    : `/${ctx.workspaceId}/tasks`;
}

/**
 * Build an href that keeps the non-toggling search params and sets
 * (or toggles off) the one the pill is for.
 */
function hrefWith(
  update: { department?: string; status?: string },
  ctx: { workspaceId: string; sp: SearchParams },
): string {
  const next = new URLSearchParams();
  const base = { ...ctx.sp, ...update } as SearchParams;
  // Toggle off when the pill is already active — caller handles
  // that via `active` + this href; clicking the same pill goes
  // back to "all of this dimension".
  if (update.department !== undefined) {
    if (ctx.sp.department === update.department) {
      delete base.department;
    }
  }
  if (update.status !== undefined) {
    if (ctx.sp.status === update.status) {
      delete base.status;
    }
  }
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'string' && v.length > 0) next.set(k, v);
  }
  const qs = next.toString();
  return qs
    ? `/${ctx.workspaceId}/tasks?${qs}`
    : `/${ctx.workspaceId}/tasks`;
}

// --- sorting ---------------------------------------------------------

function compare(
  a: { dueDate: Date | null; priority: string; createdAt: Date; updatedAt: Date },
  b: { dueDate: Date | null; priority: string; createdAt: Date; updatedAt: Date },
  sort: TaskSort,
): number {
  switch (sort) {
    case 'priority': {
      const diff =
        PRIORITY_RANK[b.priority as TaskPriority] -
        PRIORITY_RANK[a.priority as TaskPriority];
      if (diff !== 0) return diff;
      // tiebreaker: closest due date first, null dates last
      return compareDueDate(a.dueDate, b.dueDate);
    }
    case 'due_soonest':
      return compareDueDate(a.dueDate, b.dueDate);
    case 'due_latest':
      return -compareDueDate(a.dueDate, b.dueDate);
    case 'recently_created':
      return b.createdAt.getTime() - a.createdAt.getTime();
    case 'recently_updated':
      return b.updatedAt.getTime() - a.updatedAt.getTime();
  }
}

function compareDueDate(a: Date | null, b: Date | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // tasks with no due date sort last
  if (b === null) return -1;
  return a.getTime() - b.getTime();
}
