'use server';

import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';

const uuid = z.string().uuid();

const createSchema = z.object({
  workspaceId: uuid,
  scope: z.literal('tasks'),
  name: z.string().trim().min(1).max(60),
  searchParams: z.string().max(2000),
});

export type SavedViewSummary = {
  id: string;
  name: string;
  searchParams: string;
};

/**
 * List the current user's saved views for a given scope, oldest first.
 * Personal preference; never returns rows owned by other members
 * thanks to the `user_id = auth.uid()` clause backstopping the RLS
 * policy.
 */
export async function listSavedViewsAction(input: {
  workspaceId: string;
  scope: 'tasks';
}): Promise<{ ok: true; views: SavedViewSummary[] } | { ok: false; error: string }> {
  if (!uuid.safeParse(input.workspaceId).success) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, [
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const user = await requireUser();
  const db = getDb();
  const rows = await db
    .select({
      id: schema.savedViews.id,
      name: schema.savedViews.name,
      searchParams: schema.savedViews.searchParams,
    })
    .from(schema.savedViews)
    .where(
      and(
        eq(schema.savedViews.workspaceId, input.workspaceId),
        eq(schema.savedViews.userId, user.id),
        eq(schema.savedViews.scope, input.scope),
      ),
    )
    .orderBy(asc(schema.savedViews.name));
  return { ok: true, views: rows };
}

/**
 * Save (or update by-name) the current filter combo. Re-using a name
 * upserts the existing row's `search_params` instead of failing on the
 * unique constraint — keeps the picker tidy when iterating on a view.
 */
export async function createSavedViewAction(
  input: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }
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
  const user = await requireUser();
  const db = getDb();
  const [row] = await db
    .insert(schema.savedViews)
    .values({
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
      scope: parsed.data.scope,
      name: parsed.data.name,
      searchParams: parsed.data.searchParams,
    })
    .onConflictDoUpdate({
      target: [
        schema.savedViews.workspaceId,
        schema.savedViews.userId,
        schema.savedViews.scope,
        schema.savedViews.name,
      ],
      set: {
        searchParams: parsed.data.searchParams,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.savedViews.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  return { ok: true, id: row.id };
}

export async function deleteSavedViewAction(input: {
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
    await requireRole(input.workspaceId, [
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const user = await requireUser();
  const db = getDb();
  await db
    .delete(schema.savedViews)
    .where(
      and(
        eq(schema.savedViews.id, input.id),
        eq(schema.savedViews.workspaceId, input.workspaceId),
        eq(schema.savedViews.userId, user.id),
      ),
    );
  revalidatePath(`/${input.workspaceId}/tasks`);
  return { ok: true };
}
