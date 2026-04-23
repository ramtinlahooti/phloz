import { asc, desc, eq } from 'drizzle-orm';
import Link from 'next/link';

import { getDb, schema } from '@phloz/db/client';
import type {
  Department,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@phloz/config';
import { DEPARTMENTS, TASK_STATUSES } from '@phloz/config';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

import { NewTaskDialog } from './new-task-dialog';
import { TaskRow, type TaskRowModel } from './task-row';

export const metadata = buildAppMetadata({ title: 'Tasks' });

type RouteParams = { workspace: string };
type SearchParams = {
  department?: string;
  status?: string;
};

const DISPLAY_GROUPS: TaskStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'done',
];

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

  const db = getDb();

  const [taskRows, clientRows] = await Promise.all([
    db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.workspaceId, workspaceId))
      .orderBy(desc(schema.tasks.priority), asc(schema.tasks.dueDate)),
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(eq(schema.clients.workspaceId, workspaceId))
      .orderBy(asc(schema.clients.name)),
  ]);

  const clientById = new Map(clientRows.map((c) => [c.id, c.name]));

  const filtered = taskRows.filter((t) => {
    if (departmentFilter && t.department !== departmentFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  const byStatus: Record<TaskStatus, TaskRowModel[]> = {
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
    archived: [],
  };
  for (const t of filtered) {
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
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
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
          </p>
        </div>
        <NewTaskDialog workspaceId={workspaceId} clients={clientRows} />
      </header>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <FilterPill
          href={`/${workspaceId}/tasks`}
          active={!departmentFilter && !statusFilter}
        >
          All
        </FilterPill>
        {DEPARTMENTS.map((d) => (
          <FilterPill
            key={d}
            href={`/${workspaceId}/tasks?department=${d}`}
            active={departmentFilter === d}
          >
            <span className="capitalize">{d.replace('_', ' ')}</span>
          </FilterPill>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {TASK_STATUSES.filter((s) => s !== 'archived').map((s) => (
          <FilterPill
            key={s}
            href={`/${workspaceId}/tasks?status=${s}`}
            active={statusFilter === s}
          >
            <span className="capitalize">{s.replace('_', ' ')}</span>
          </FilterPill>
        ))}
      </div>

      {taskRows.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create your first task to track work across clients."
          action={
            <NewTaskDialog workspaceId={workspaceId} clients={clientRows} />
          }
        />
      ) : (
        <div className="space-y-4">
          {DISPLAY_GROUPS.map((group) => {
            const rows = byStatus[group];
            if (statusFilter && group !== statusFilter) return null;
            if (rows.length === 0) return null;
            return (
              <Card key={group}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span className="capitalize">
                      {group.replace('_', ' ')}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {rows.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/60">
                    {rows.map((task) => (
                      <TaskRow
                        key={task.id}
                        workspaceId={workspaceId}
                        task={task}
                      />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
