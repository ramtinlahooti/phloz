'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createServerSupabase, createServiceRoleSupabase } from '@phloz/auth/server';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';

/**
 * Create the user's first workspace.
 *
 * Runs service-role writes so the initial rows exist before RLS kicks in
 * (the user has no membership yet at the moment of INSERT).
 *
 * Steps:
 * 1. Generate a unique slug from the workspace name.
 * 2. Insert the workspace row (owner = user.id, tier = starter).
 * 3. Insert the workspace_members row (role = owner).
 * 4. Update the user's user_metadata.active_workspace_id so the next
 *    JWT refresh includes it via the custom access token hook.
 *
 * Returns `{ ok: true, workspaceId }` on success; throws otherwise.
 */
const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export async function createWorkspaceAction(
  _prevState: { error: string | null } | undefined,
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = createSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid name' };
  }

  const user = await requireUser();
  const db = getDb();

  const baseSlug = slugify(parsed.data.name) || 'workspace';
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.query.workspaces.findFirst({
      where: (w, { eq }) => eq(w.slug, slug),
      columns: { id: true },
    });
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: parsed.data.name,
      slug,
      ownerUserId: user.id,
      tier: 'starter',
    })
    .returning({ id: schema.workspaces.id });

  if (!workspace) {
    return { error: 'Could not create workspace. Try again.' };
  }

  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
    acceptedAt: new Date(),
  });

  // Persist the active workspace in user_metadata so the JWT hook reads it.
  const supabase = await createServerSupabase();
  await supabase.auth.updateUser({
    data: { active_workspace_id: workspace.id },
  });

  // Also sync via service role in case the user call's RLS policies
  // refuse — belt and braces for the onboarding path.
  const admin = await createServiceRoleSupabase();
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      active_workspace_id: workspace.id,
    },
  });

  redirect(`/${workspace.id}`);
}
