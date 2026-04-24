'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import {
  APPROVAL_STATES,
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_VISIBILITIES,
  type ApprovalState,
  type Department,
  type TaskStatus,
} from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

import { findTaskTemplate } from './templates';

/**
 * Server actions for tasks. Role gate: `owner`, `admin`, `member` can
 * create/update; `viewer` can read-only. Portal users never reach
 * these actions.
 */

const uuid = z.string().uuid();

const createTaskSchema = z.object({
  workspaceId: uuid,
  clientId: uuid.nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  department: z.enum(DEPARTMENTS).default('other'),
  visibility: z.enum(TASK_VISIBILITIES).default('internal'),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeMembershipId: uuid.optional().nullable(),
  /**
   * When set, this task is a subtask of the parent task. The server
   * enforces a one-level rule: the parent task must itself have no
   * parent. Subtasks inherit the parent's `client_id` (whatever is
   * passed in `clientId` is ignored when `parentTaskId` is set).
   */
  parentTaskId: uuid.optional().nullable(),
});

export async function createTaskAction(
  input: z.infer<typeof createTaskSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const user = await requireUser();
  const db = getDb();

  // Subtask mode: enforce one-level nesting + inherit client from
  // parent. The DB doesn't self-enforce depth (per tasks.ts comment),
  // so we do it here. Also scope the parent fetch to the same
  // workspace — belt and braces against cross-tenant trickery.
  let resolvedClientId: string | null = parsed.data.clientId;
  if (parsed.data.parentTaskId) {
    const parent = await db
      .select({
        id: schema.tasks.id,
        parentTaskId: schema.tasks.parentTaskId,
        clientId: schema.tasks.clientId,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.id, parsed.data.parentTaskId),
          eq(schema.tasks.workspaceId, parsed.data.workspaceId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);
    if (!parent) {
      return { ok: false, error: 'parent_task_not_found' };
    }
    if (parent.parentTaskId !== null) {
      return {
        ok: false,
        error: 'Subtasks cannot have subtasks — only one level of nesting.',
      };
    }
    // Subtasks always share their parent's client.
    resolvedClientId = parent.clientId;
  }

  const [row] = await db
    .insert(schema.tasks)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: resolvedClientId,
      parentTaskId: parsed.data.parentTaskId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      department: parsed.data.department,
      visibility: parsed.data.visibility,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assigneeId: parsed.data.assigneeMembershipId ?? null,
      createdBy: user.id,
    })
    .returning({ id: schema.tasks.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  fireTrack(
    'task_created',
    {
      department: parsed.data.department,
      has_due_date: parsed.data.dueDate !== null && parsed.data.dueDate !== undefined,
      has_assignee:
        parsed.data.assigneeMembershipId !== null &&
        parsed.data.assigneeMembershipId !== undefined,
    },
    serverTrackContext(user.id, parsed.data.workspaceId),
  );

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  if (parsed.data.clientId) {
    revalidatePath(
      `/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`,
    );
  }

  return { ok: true, id: row.id };
}

const updateTaskSchema = z.object({
  workspaceId: uuid,
  id: uuid,
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  visibility: z.enum(TASK_VISIBILITIES).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeMembershipId: uuid.nullable().optional(),
});

export async function updateTaskAction(
  input: z.infer<typeof updateTaskSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  let actor;
  try {
    actor = await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();

  // Fetch the existing row only when we need to emit an analytics event
  // that depends on the prior state (status change → from_status +
  // time_to_complete_hours). Saves a round-trip on plain edits.
  const needsPrior = parsed.data.status !== undefined;
  const prior = needsPrior
    ? await db
        .select({
          status: schema.tasks.status,
          department: schema.tasks.department,
          createdAt: schema.tasks.createdAt,
        })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.id, parsed.data.id),
            eq(schema.tasks.workspaceId, parsed.data.workspaceId),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null)
    : null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    updates.completedAt =
      parsed.data.status === 'done' ? new Date() : null;
  }
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.department !== undefined) updates.department = parsed.data.department;
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility;
  if (parsed.data.dueDate !== undefined) {
    updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }
  if (parsed.data.assigneeMembershipId !== undefined) {
    updates.assigneeId = parsed.data.assigneeMembershipId;
  }

  await db
    .update(schema.tasks)
    .set(updates)
    .where(
      and(
        eq(schema.tasks.id, parsed.data.id),
        eq(schema.tasks.workspaceId, parsed.data.workspaceId),
      ),
    );

  // Status-change events. task_completed is the activation signal we
  // care most about (PostHog retention cohorts hang off it), so we
  // compute time-to-complete in hours from the original createdAt.
  if (
    prior &&
    parsed.data.status !== undefined &&
    prior.status !== parsed.data.status
  ) {
    const ctx = serverTrackContext(actor.user.id, parsed.data.workspaceId);
    const department = (parsed.data.department ?? prior.department) as Department;
    fireTrack(
      'task_status_changed',
      {
        from_status: prior.status as TaskStatus,
        to_status: parsed.data.status as TaskStatus,
        department,
      },
      ctx,
    );
    if (parsed.data.status === 'done') {
      const hours =
        (Date.now() - prior.createdAt.getTime()) / (1000 * 60 * 60);
      fireTrack(
        'task_completed',
        {
          department,
          time_to_complete_hours: Math.round(hours * 10) / 10,
        },
        ctx,
      );
    }
  }

  // Assignee-change event (fires whether or not a status change also
  // happened on the same update — the two are independent signals).
  if (
    parsed.data.assigneeMembershipId !== undefined &&
    parsed.data.assigneeMembershipId !== null
  ) {
    fireTrack(
      'task_assigned',
      {
        department: (parsed.data.department ??
          prior?.department ??
          'other') as Department,
      },
      serverTrackContext(actor.user.id, parsed.data.workspaceId),
    );
  }

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  return { ok: true };
}

export async function deleteTaskAction(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!uuid.safeParse(input.workspaceId).success || !uuid.safeParse(input.id).success) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  // parent_task_id has ON DELETE CASCADE, so deleting a parent task
  // also removes its subtasks — no dangling rows.
  await db
    .delete(schema.tasks)
    .where(
      and(
        eq(schema.tasks.id, input.id),
        eq(schema.tasks.workspaceId, input.workspaceId),
      ),
    );

  revalidatePath(`/${input.workspaceId}/tasks`);
  return { ok: true };
}

// --- bulk task actions -------------------------------------------------

/**
 * Apply the same mutation to many tasks in one server roundtrip.
 * Shape of the action lives here rather than generalising
 * `updateTaskAction` because bulk ops are a different intent:
 *   - no per-task analytics fan-out (would spam PostHog)
 *   - no approval-state side effects
 *   - no prior-row fetch (used only for status-changed events today)
 *
 * For V1 the allowed mutations are `status` and `delete`. Both are
 * the operations agencies actually want for weekly-review workflows:
 * "mark these done", "clear out done tasks from last quarter".
 * Adding assignee/priority/department bulk later is a one-line
 * extension to the update schema.
 */
const bulkUpdateSchema = z.object({
  workspaceId: uuid,
  taskIds: z.array(uuid).min(1).max(200),
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('status'), status: z.enum(TASK_STATUSES) }),
    z.object({ kind: z.literal('delete') }),
  ]),
});

export async function bulkUpdateTasksAction(
  input: z.infer<typeof bulkUpdateSchema>,
): Promise<
  | { ok: true; affected: number }
  | { ok: false; error: string }
> {
  const parsed = bulkUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const wsId = parsed.data.workspaceId;
  const ids = parsed.data.taskIds;

  if (parsed.data.action.kind === 'delete') {
    // parent_task_id cascades, so deleting parents also drops their
    // subtasks. Bulk deletes of mixed parent/subtask ids are allowed
    // but rare — the UI only surfaces top-level rows.
    await db
      .delete(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, wsId),
          inArray(schema.tasks.id, ids),
        ),
      );
  } else {
    const nextStatus = parsed.data.action.status;
    await db
      .update(schema.tasks)
      .set({
        status: nextStatus,
        completedAt: nextStatus === 'done' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.tasks.workspaceId, wsId),
          inArray(schema.tasks.id, ids),
        ),
      );
  }

  revalidatePath(`/${wsId}/tasks`);
  // The client detail page lists tasks per-client; revalidate there too
  // even though we don't know which clients were touched (worst case
  // an over-revalidation of an empty path, which is a no-op).
  revalidatePath(`/${wsId}/clients`, 'layout');
  return { ok: true, affected: ids.length };
}

// --- subtasks ----------------------------------------------------------

/**
 * List the subtasks of a given parent task, oldest first (creation
 * order). Called from the task-detail dialog when it opens. Lightweight
 * payload — just what the checklist needs.
 */
const listSubtasksSchema = z.object({
  workspaceId: uuid,
  parentTaskId: uuid,
});

export type SubtaskView = {
  id: string;
  title: string;
  status: TaskStatus;
};

export async function listSubtasksAction(
  input: z.infer<typeof listSubtasksSchema>,
): Promise<{ ok: true; subtasks: SubtaskView[] } | { ok: false; error: string }> {
  const parsed = listSubtasksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  try {
    await requireRole(parsed.data.workspaceId, [
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const rows = await db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      status: schema.tasks.status,
    })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.workspaceId, parsed.data.workspaceId),
        eq(schema.tasks.parentTaskId, parsed.data.parentTaskId),
      ),
    )
    .orderBy(schema.tasks.createdAt);

  return {
    ok: true,
    subtasks: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as TaskStatus,
    })),
  };
}

/**
 * Quick-toggle a subtask's status between `todo` and `done`. This is
 * its own action (rather than going through `updateTaskAction`) so
 * the dialog can fire-and-forget a single-purpose call with minimal
 * payload — no analytics chaining, no approval-state side effects.
 */
const toggleSubtaskSchema = z.object({
  workspaceId: uuid,
  subtaskId: uuid,
  done: z.boolean(),
});

export async function toggleSubtaskAction(
  input: z.infer<typeof toggleSubtaskSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = toggleSubtaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const nextStatus: TaskStatus = parsed.data.done ? 'done' : 'todo';
  await db
    .update(schema.tasks)
    .set({
      status: nextStatus,
      completedAt: parsed.data.done ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.tasks.id, parsed.data.subtaskId),
        eq(schema.tasks.workspaceId, parsed.data.workspaceId),
      ),
    );

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  return { ok: true };
}

// --- approval (agency side) --------------------------------------------
const setApprovalSchema = z.object({
  workspaceId: uuid,
  id: uuid,
  state: z.enum(APPROVAL_STATES),
});

/**
 * Agency-side approval update. Use cases:
 * - Request approval: state='pending' on a client-visible task.
 * - Reset after client action: state='none' to clear.
 * Agency cannot `approve` a client-visible task on the client's behalf
 * — UI guards, and the portal action is the only path that sets
 * `approved` / `rejected` / `needs_changes`.
 */
export async function setTaskApprovalAction(
  input: z.infer<typeof setApprovalSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = setApprovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  // Agency can only move between none <-> pending. Client-terminal
  // states flow from the portal action.
  if (
    parsed.data.state !== 'none' &&
    parsed.data.state !== 'pending'
  ) {
    return {
      ok: false,
      error: 'Agency can only request or reset approval; clients set the outcome.',
    };
  }

  const db = getDb();
  const task = await db
    .select({
      id: schema.tasks.id,
      visibility: schema.tasks.visibility,
      clientId: schema.tasks.clientId,
    })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.id, parsed.data.id),
        eq(schema.tasks.workspaceId, parsed.data.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!task) return { ok: false, error: 'not_found' };
  if (task.visibility !== 'client_visible') {
    return {
      ok: false,
      error: 'Only client-visible tasks can go through approval.',
    };
  }

  await db
    .update(schema.tasks)
    .set({
      approvalState: parsed.data.state as ApprovalState,
      approvalUpdatedAt: new Date(),
      approvalComment: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, parsed.data.id));

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  if (task.clientId) {
    revalidatePath(`/${parsed.data.workspaceId}/clients/${task.clientId}`);
  }
  return { ok: true };
}

// --- apply template ----------------------------------------------------
const applyTemplateSchema = z.object({
  workspaceId: uuid,
  clientId: uuid,
  templateId: z.string().min(1),
});

/**
 * Instantiate a built-in task template against a client. Creates N
 * tasks in one batch insert. `dueInDays` items get a concrete
 * `dueDate = now + N days`.
 */
export async function applyTaskTemplateAction(
  input: z.infer<typeof applyTemplateSchema>,
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const parsed = applyTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const template = findTaskTemplate(parsed.data.templateId);
  if (!template) return { ok: false, error: 'template_not_found' };

  const user = await requireUser();
  const db = getDb();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const rows = template.items.map((item) => ({
    workspaceId: parsed.data.workspaceId,
    clientId: parsed.data.clientId,
    title: item.title,
    description: item.description ?? null,
    status: 'todo' as const,
    priority: item.priority ?? ('medium' as const),
    department: item.department ?? ('other' as const),
    visibility: item.visibility ?? ('internal' as const),
    dueDate: item.dueInDays
      ? new Date(now + item.dueInDays * day)
      : null,
    createdBy: user.id,
  }));

  if (rows.length === 0) return { ok: true, created: 0 };

  await db.insert(schema.tasks).values(rows);

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  revalidatePath(`/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`);
  return { ok: true, created: rows.length };
}
