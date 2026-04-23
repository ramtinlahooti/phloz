import { redirect } from 'next/navigation';

import { getCurrentUser } from '@phloz/auth/session';

/**
 * Root entry point. Routes authenticated users to their workspace
 * dashboard and anonymous users to /login.
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.activeWorkspaceId) redirect('/onboarding');
  redirect(`/${user.activeWorkspaceId}`);
}
