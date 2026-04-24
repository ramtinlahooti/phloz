'use server';

import { and, eq } from 'drizzle-orm';
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
} from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

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

  const [row] = await db
    .insert(schema.tasks)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
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

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
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
