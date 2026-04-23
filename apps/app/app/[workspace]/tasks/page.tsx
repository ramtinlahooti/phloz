import { count, eq } from 'drizzle-orm';

import { getDb, schema } from '@phloz/db/client';
import { Card, CardContent } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Tasks' });

type RouteParams = { workspace: string };

export default async function TasksPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  const db = getDb();

  const [total] = await db
    .select({ c: count() })
    .from(schema.tasks)
    .where(eq(schema.tasks.workspaceId, workspaceId));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total?.c ?? 0} total across all clients
        </p>
      </header>

      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">
          Cross-client task views (boards, timelines, departmental filters)
          ship in a follow-up session. For now, tasks live on individual
          client pages.
        </CardContent>
      </Card>
    </div>
  );
}
