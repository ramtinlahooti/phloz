import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';

import { AnalyticsIdentify } from '@/components/analytics-identify';
import { DashboardShell } from '@/components/dashboard-shell';

type LayoutParams = { workspace: string };

/**
 * RFC-4122 UUID shape. Any segment that doesn't match is a stray
 * request (favicon.ico, apple-touch-icon, .well-known probes, etc.).
 * 404 those at the layout so they never reach the DB.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Workspace layout. Runs on every page under `/[workspace]/...`.
 *
 * Responsibilities:
 * - Require an authenticated user (middleware already refreshes the
 *   session; `requireUser` throws if there is no user at all).
 * - Verify the user is a member of this workspace. If not, redirect
 *   to their active workspace or onboarding.
 * - Load the workspace row + membership role and pass them to the
 *   dashboard shell for rendering.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<LayoutParams>;
}) {
  const { workspace: workspaceId } = await params;

  // Reject obviously-invalid segments (favicon.ico, robots.txt, etc.)
  // before we hit Supabase. The DB would throw a uuid-cast error
  // otherwise, which surfaces to Sentry as a noisy "Failed query".
  if (!UUID_RE.test(workspaceId)) notFound();

  const user = await requireUser();

  const db = getDb();
  const membership = await db
    .select()
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!membership) {
    if (user.activeWorkspaceId && user.activeWorkspaceId !== workspaceId) {
      redirect(`/${user.activeWorkspaceId}`);
    }
    redirect('/onboarding');
  }

  const workspace = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!workspace) redirect('/onboarding');

  // Every workspace the user belongs to — for the switcher.
  const allWorkspaces = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .innerJoin(
      schema.workspaces,
      eq(schema.workspaceMembers.workspaceId, schema.workspaces.id),
    )
    .where(eq(schema.workspaceMembers.userId, user.id));

  return (
    <>
      <AnalyticsIdentify
        userId={user.id}
        workspaceId={workspace.id}
        tier={workspace.tier}
        role={membership.role}
      />
      <DashboardShell
        workspace={{
          id: workspace.id,
          name: workspace.name,
          tier: workspace.tier,
        }}
        role={membership.role}
        user={{
          id: user.id,
          email: user.email ?? '',
          name:
            (user.user_metadata?.full_name as string | undefined) ??
            user.email ??
            'You',
        }}
        allWorkspaces={allWorkspaces}
      >
        {children}
      </DashboardShell>
    </>
  );
}
