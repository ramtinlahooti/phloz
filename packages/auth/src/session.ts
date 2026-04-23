import type { User } from '@supabase/supabase-js';

import { AuthError } from './errors';
import { createServerSupabase } from './server';

export type PhlozUser = User & {
  /** Populated from user_metadata.active_workspace_id. */
  activeWorkspaceId: string | null;
};

/**
 * Read the current authenticated user from the Supabase cookies. Returns
 * null for unauthenticated requests — never throws.
 */
export async function getCurrentUser(): Promise<PhlozUser | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const activeWorkspaceId =
    (user.user_metadata?.active_workspace_id as string | undefined) ?? null;
  return { ...user, activeWorkspaceId };
}

/**
 * Same as getCurrentUser but throws AuthError('unauthenticated') if there's
 * no session. Use in route handlers and server actions where anonymous
 * access is not expected.
 */
export async function requireUser(): Promise<PhlozUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('unauthenticated');
  return user;
}

/**
 * Resolve the active workspace id from the user metadata. Callers should
 * handle `null` (the user hasn't completed onboarding yet).
 */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.activeWorkspaceId ?? null;
}

/** Throws if the user has no active workspace set. */
export async function requireActiveWorkspaceId(): Promise<string> {
  const id = await getActiveWorkspaceId();
  if (!id) throw new AuthError('invalid_workspace', 'No active workspace');
  return id;
}
