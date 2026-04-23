import { eq } from 'drizzle-orm';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import { getDb, schema } from '@phloz/db/client';
import { Card, CardContent, CardHeader, CardTitle } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

import { WorkspaceSettingsForm } from './workspace-settings-form';

export const metadata = buildAppMetadata({ title: 'Settings' });

type RouteParams = { workspace: string };

export default async function SettingsPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  await requireAdminOrOwner(workspaceId);

  const db = getDb();
  const workspace = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace name, slug, and visibility.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceSettingsForm
            workspace={{
              id: workspace.id,
              name: workspace.name,
              slug: workspace.slug,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
