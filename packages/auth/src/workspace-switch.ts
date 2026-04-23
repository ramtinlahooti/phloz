import { AuthError } from './errors';
import { getMembershipRole } from './roles';
import { createServerSupabase } from './server';
import { requireUser } from './session';

/**
 * Switch the user's active workspace. Updates user_metadata.active_workspace_id
 * and refreshes the session so a new JWT is issued with the updated claim
 * (the Supabase Custom Access Token hook copies the metadata into claims —
 * see packages/db/src/hooks/custom-access-token-hook.sql).
 *
 * Throws AuthError('not_a_member') if the user isn't a member of the target
 * workspace.
 */
export async function switchWorkspace(workspaceId: string) {
  const user = await requireUser();
  const role = await getMembershipRole(user.id, workspaceId);
  if (!role) throw new AuthError('not_a_member');

  const supabase = await createServerSupabase();
  const { error: updateError } = await supabase.auth.updateUser({
    data: { active_workspace_id: workspaceId },
  });
  if (updateError) throw new AuthError('forbidden', updateError.message);

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw new AuthError('forbidden', refreshError.message);

  return { workspaceId, role };
}
