'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createServerSupabase } from '@phloz/auth/server';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';

const schemaValidator = z.object({
  fullName: z.string().trim().min(1, 'Required').max(120),
});

/**
 * Update the current user's display name (stored in
 * `auth.users.user_metadata.full_name`). Email changes go through
 * Supabase's email-change flow (confirmation link + separate dialog);
 * password changes live on /reset-password.
 *
 * Also fans out the new name to every `workspace_members.display_name`
 * row for this user so the Team page + task assignee picker pick up the
 * change without waiting for a re-invite. This is a best-effort write —
 * auth update is what we actually await; the fan-out is a cache refresh.
 */
export async function updateUserProfileAction(
  input: z.infer<typeof schemaValidator>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schemaValidator.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }

  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({
    data: {
      ...(user.user_metadata ?? {}),
      full_name: parsed.data.fullName,
    },
  });
  if (error) return { ok: false, error: error.message };

  // Fan out to membership rows. If this fails we don't want to roll back
  // the auth update (the user's name in the sidebar is the primary signal);
  // log and move on. Next profile edit will retry.
  try {
    const db = getDb();
    await db
      .update(schema.workspaceMembers)
      .set({ displayName: parsed.data.fullName })
      .where(eq(schema.workspaceMembers.userId, user.id));
  } catch (err) {
    console.error('[profile] failed to sync display_name to memberships', err);
  }

  // The active-workspace path is passed via the page that called us.
  // Revalidate broadly since the user's name shows in the sidebar
  // user menu on every authenticated page.
  revalidatePath('/', 'layout');
  return { ok: true };
}
