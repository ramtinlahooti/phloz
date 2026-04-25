'use server';

import { and, asc, eq, or } from 'drizzle-orm';
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
  isShared: z.boolean().default(false),
});

export type SavedViewSummary = {
  id: string;
  name: string;
  searchParams: string;
  isShared: boolean;
  /** Whether the calling user owns this row — only the owner can
   *  rename / delete / re-share. Workspace-shared rows from teammates
   *  are read-only for everyone else. */
  isMine: boolean;
  /** Whether this is the calling user's auto-apply default. Bare
   *  `/tasks` redirects to the default's `searchParams`. */
  isDefault: boolean;
};

/**
 * List saved views for a scope, oldest first. Returns:
 *   - Every row the calling user created in this workspace
 *   - Plus every workspace-shared row (any creator)
 *
 * Each row carries `isMine` so the picker can render a creator-only
 * affordance (rename / delete) without an extra round-trip.
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
  const [rows, membership] = await Promise.all([
    db
      .select({
        id: schema.savedViews.id,
        name: schema.savedViews.name,
        searchParams: schema.savedViews.searchParams,
        isShared: schema.savedViews.isShared,
        userId: schema.savedViews.userId,
      })
      .from(schema.savedViews)
      .where(
        and(
          eq(schema.savedViews.workspaceId, input.workspaceId),
          eq(schema.savedViews.scope, input.scope),
          or(
            eq(schema.savedViews.userId, user.id),
            eq(schema.savedViews.isShared, true),
          ),
        ),
      )
      .orderBy(asc(schema.savedViews.name)),
    db
      .select({
        defaultSavedViewId: schema.workspaceMembers.defaultSavedViewId,
      })
      .from(schema.workspaceMembers)
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, input.workspaceId),
          eq(schema.workspaceMembers.userId, user.id),
        ),
      )
      .limit(1)
      .then((m) => m[0] ?? null),
  ]);
  const defaultId = membership?.defaultSavedViewId ?? null;
  return {
    ok: true,
    views: rows.map((r) => ({
      id: r.id,
      name: r.name,
      searchParams: r.searchParams,
      isShared: r.isShared,
      isMine: r.userId === user.id,
      isDefault: r.id === defaultId,
    })),
  };
}

const setDefaultSchema = z.object({
  workspaceId: uuid,
  /** Pass `null` to clear the default. */
  viewId: uuid.nullable(),
});

/**
 * Set (or clear) the calling user's default saved view for this
 * workspace. Self-targeting via `requireUser`. The viewId is
 * validated against the user's accessible views — the SELECT
 * filter mirrors `listSavedViewsAction` (own + shared) so a member
 * can default to a workspace-shared view but not to a teammate's
 * private view.
 */
export async function setDefaultSavedViewAction(
  input: z.infer<typeof setDefaultSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = setDefaultSchema.safeParse(input);
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

  const user = await requireUser();
  const db = getDb();

  if (parsed.data.viewId !== null) {
    const accessible = await db
      .select({ id: schema.savedViews.id })
      .from(schema.savedViews)
      .where(
        and(
          eq(schema.savedViews.id, parsed.data.viewId),
          eq(schema.savedViews.workspaceId, parsed.data.workspaceId),
          or(
            eq(schema.savedViews.userId, user.id),
            eq(schema.savedViews.isShared, true),
          ),
        ),
      )
      .limit(1);
    if (accessible.length === 0) {
      return { ok: false, error: 'view_not_found' };
    }
  }

  const updated = await db
    .update(schema.workspaceMembers)
    .set({ defaultSavedViewId: parsed.data.viewId })
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .returning({ id: schema.workspaceMembers.id });

  if (updated.length === 0) {
    return { ok: false, error: 'membership_not_found' };
  }

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  return { ok: true };
}

/**
 * Save (or update by-name) the current filter combo. Re-using a name
 * upserts the existing row's `search_params` (and `is_shared` flag)
 * instead of failing on the unique constraint — keeps the picker
 * tidy when iterating on a view.
 *
 * Workspace-shared views are gated to owner/admin: members can save
 * personal views but not publish them to the team. The role check
 * runs only when `isShared = true`.
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

  if (parsed.data.isShared) {
    try {
      await requireRole(parsed.data.workspaceId, ['owner', 'admin']);
    } catch {
      return {
        ok: false,
        error: 'Only owners and admins can share views with the workspace.',
      };
    }
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
      isShared: parsed.data.isShared,
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
        isShared: parsed.data.isShared,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.savedViews.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  return { ok: true, id: row.id };
}

const renameSchema = z.object({
  workspaceId: uuid,
  id: uuid,
  name: z.string().trim().min(1).max(60),
});

/**
 * Rename a saved view in-place. Self-targeting only: the
 * `userId = auth.uid()` clause + RLS make this a no-op for rows the
 * caller didn't create, even if they're shared with the workspace.
 */
export async function renameSavedViewAction(
  input: z.infer<typeof renameSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = renameSchema.safeParse(input);
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
  const result = await db
    .update(schema.savedViews)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(
      and(
        eq(schema.savedViews.id, parsed.data.id),
        eq(schema.savedViews.workspaceId, parsed.data.workspaceId),
        eq(schema.savedViews.userId, user.id),
      ),
    )
    .returning({ id: schema.savedViews.id });

  if (result.length === 0) {
    return { ok: false, error: 'not_found_or_not_owner' };
  }

  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  return { ok: true };
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
