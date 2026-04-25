import { and, eq } from 'drizzle-orm';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';
import { Card, CardContent, CardHeader, CardTitle } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import { NotificationsForm } from './notifications-form';
import { ProfileForm } from './profile-form';
import { WorkspaceSettingsForm } from './workspace-settings-form';

export const metadata = buildAppMetadata({ title: 'Settings' });

type RouteParams = { workspace: string };

export default async function SettingsPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  assertValidWorkspaceId(workspaceId);
  // Personal preferences (profile name, daily-digest opt-in) belong to
  // every member; only the agency card is owner/admin-gated.
  const actor = await requireRole(workspaceId, [
    'owner',
    'admin',
    'member',
    'viewer',
  ]);
  const isPrivileged = actor.role === 'owner' || actor.role === 'admin';

  const db = getDb();
  const [workspace, user, membership] = await Promise.all([
    db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .limit(1)
      .then((rows) => rows[0]),
    requireUser(),
    db
      .select({ digestEnabled: schema.workspaceMembers.digestEnabled })
      .from(schema.workspaceMembers)
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, workspaceId),
          eq(schema.workspaceMembers.userId, actor.user.id),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!workspace) return null;

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? '';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <header className="mb-2">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your profile, your workspace, and how things show up for clients.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              fullName,
              email: user.email ?? '',
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationsForm
            workspaceId={workspaceId}
            initial={{ digestEnabled: membership?.digestEnabled ?? true }}
          />
        </CardContent>
      </Card>

      {isPrivileged && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agency / Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkspaceSettingsForm
              workspace={{
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                description: workspace.description ?? '',
                websiteUrl: workspace.websiteUrl ?? '',
                timezone: workspace.timezone ?? 'UTC',
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
