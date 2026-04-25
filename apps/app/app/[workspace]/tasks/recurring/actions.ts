'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { canAddRecurringTemplate } from '@phloz/billing';
import {
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_VISIBILITIES,
} from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

import { RECURRING_CADENCES } from './cadence';

const uuid = z.string().uuid();

const baseTemplateSchema = z.object({
  workspaceId: uuid,
  clientId: uuid.nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  department: z.enum(DEPARTMENTS).default('other'),
  visibility: z.enum(TASK_VISIBILITIES).default('internal'),
  assigneeMembershipId: uuid.nullable().optional(),
  dueOffsetDays: z.number().int().min(0).max(365).default(0),
  cadence: z.enum(RECURRING_CADENCES),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
});

function refineCadenceFields<T extends z.infer<typeof baseTemplateSchema>>(
  input: T,
): { ok: true; data: T } | { ok: false; error: string } {
  if (input.cadence === 'weekly') {
    if (input.weekday === null || input.weekday === undefined) {
      return { ok: false, error: 'Pick a weekday for a weekly cadence.' };
    }
  }
  if (input.cadence === 'monthly') {
    if (input.dayOfMonth === null || input.dayOfMonth === undefined) {
      return {
        ok: false,
        error: 'Pick a day of the month for a monthly cadence.',
      };
    }
  }
  return { ok: true, data: input };
}

export async function createRecurringTemplateAction(
  input: z.infer<typeof baseTemplateSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = baseTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const refined = refineCadenceFields(parsed.data);
  if (!refined.ok) return refined;

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const gate = await canAddRecurringTemplate(parsed.data.workspaceId);
  if (!gate.allowed) {
    return { ok: false, error: gate.message ?? gate.reason };
  }

  const user = await requireUser();
  const db = getDb();

  const [row] = await db
    .insert(schema.recurringTaskTemplates)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority,
      department: parsed.data.department,
      visibility: parsed.data.visibility,
      assigneeId: parsed.data.assigneeMembershipId ?? null,
      dueOffsetDays: parsed.data.dueOffsetDays,
      cadence: parsed.data.cadence,
      weekday:
        parsed.data.cadence === 'weekly' ? parsed.data.weekday ?? null : null,
      dayOfMonth:
        parsed.data.cadence === 'monthly'
          ? parsed.data.dayOfMonth ?? null
          : null,
      createdBy: user.id,
    })
    .returning({ id: schema.recurringTaskTemplates.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  fireTrack(
    'task_created',
    {
      department: parsed.data.department,
      has_due_date: parsed.data.dueOffsetDays > 0,
      has_assignee:
        parsed.data.assigneeMembershipId !== null &&
        parsed.data.assigneeMembershipId !== undefined,
    },
    serverTrackContext(user.id, parsed.data.workspaceId),
  );

  revalidatePath(`/${parsed.data.workspaceId}/tasks/recurring`);
  return { ok: true, id: row.id };
}

export async function setRecurringEnabledAction(input: {
  workspaceId: string;
  id: string;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.id).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  await db
    .update(schema.recurringTaskTemplates)
    .set({ enabled: input.enabled, updatedAt: new Date() })
    .where(
      and(
        eq(schema.recurringTaskTemplates.id, input.id),
        eq(schema.recurringTaskTemplates.workspaceId, input.workspaceId),
      ),
    );

  revalidatePath(`/${input.workspaceId}/tasks/recurring`);
  return { ok: true };
}

export async function deleteRecurringTemplateAction(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.id).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, ['owner', 'admin']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  await db
    .delete(schema.recurringTaskTemplates)
    .where(
      and(
        eq(schema.recurringTaskTemplates.id, input.id),
        eq(schema.recurringTaskTemplates.workspaceId, input.workspaceId),
      ),
    );

  revalidatePath(`/${input.workspaceId}/tasks/recurring`);
  return { ok: true };
}
