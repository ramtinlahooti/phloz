import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireRole } from '@phloz/auth/roles';
import {
  DEPARTMENTS,
  TASK_STATUSES,
  type Department,
  type TaskStatus,
} from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { csvResponseHeaders, toCsv, type CsvRow } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tasks CSV export. Mirrors the filter surface of the `/tasks` page
 * so "Export what I see" is predictable:
 *
 *   ?q           — title substring
 *   ?department  — ppc | seo | social | cro | web_design | other
 *   ?status      — todo | in_progress | blocked | done | archived
 *   ?client      — client uuid, or `unassigned` for workspace-level
 *   ?assignee    — workspace_members.id, or `unassigned`
 *
 * Omitted params = no filter on that dimension.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  try {
    await requireRole(workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const departmentFilter = DEPARTMENTS.includes(
    url.searchParams.get('department') as Department,
  )
    ? (url.searchParams.get('department') as Department)
    : null;
  const statusFilter = TASK_STATUSES.includes(
    url.searchParams.get('status') as TaskStatus,
  )
    ? (url.searchParams.get('status') as TaskStatus)
    : null;
  const clientFilter = url.searchParams.get('client');
  const assigneeFilter = url.searchParams.get('assignee');

  const db = getDb();

  // Fetch tasks + clients + members together so we can join in JS.
  // Same pattern as /tasks/page.tsx; volumes are small at launch.
  const [taskRows, clientRows, memberRows] = await Promise.all([
    db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          // Subtasks are checklist items under their parent — they
          // shouldn't show up as separate rows in the export.
          isNull(schema.tasks.parentTaskId),
        ),
      ),
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(eq(schema.clients.workspaceId, workspaceId)),
    db
      .select({
        id: schema.workspaceMembers.id,
        userId: schema.workspaceMembers.userId,
        displayName: schema.workspaceMembers.displayName,
        email: schema.workspaceMembers.email,
      })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.workspaceId, workspaceId)),
  ]);

  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const memberLabel = new Map(
    memberRows.map((m) => [
      m.id,
      m.displayName?.trim() ||
        m.email?.trim() ||
        `${(m.userId ?? 'unknown').slice(0, 8)}…`,
    ]),
  );

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
    if (q && !t.title.toLowerCase().includes(q)) return false;
    return true;
  });

  const csvRows: CsvRow[] = filtered.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    department: t.department,
    visibility: t.visibility,
    approval_state: t.approvalState,
    client: t.clientId ? clientName.get(t.clientId) ?? '' : '',
    assignee: t.assigneeId ? memberLabel.get(t.assigneeId) ?? '' : '',
    due_date: t.dueDate,
    completed_at: t.completedAt,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    description: t.description,
  }));

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(csvRows), {
    status: 200,
    headers: csvResponseHeaders(`phloz-tasks-${today}`),
  });
}
