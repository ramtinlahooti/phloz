'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createServerSupabase } from '@phloz/auth/server';
import { requireUser } from '@phloz/auth/session';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Required').max(120),
});

/**
 * Update the current user's display name (stored in
 * `auth.users.user_metadata.full_name`). Email changes go through
 * Supabase's email-change flow (confirmation link + separate dialog);
 * password changes live on /reset-password.
 */
export async function updateUserProfileAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
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

  // The active-workspace path is passed via the page that called us.
  // Revalidate broadly since the user's name shows in the sidebar
  // user menu on every authenticated page.
  revalidatePath('/', 'layout');
  return { ok: true };
}
