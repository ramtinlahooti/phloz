import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';

import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  EmptyState,
} from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Clients' });

type RouteParams = { workspace: string };

export default async function ClientsListPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  const db = getDb();
  const clients = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.workspaceId, workspaceId))
    .orderBy(desc(schema.clients.updatedAt));

  const active = clients.filter((c) => c.archivedAt === null);
  const archived = clients.filter((c) => c.archivedAt !== null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length} active · {archived.length} archived
          </p>
        </div>
        <Link
          href={`/${workspaceId}/clients/new`}
          className={buttonVariants({ size: 'sm' })}
        >
          Add client
        </Link>
      </header>

      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add your first client to start tracking work, messages, and their tracking setup."
          action={
            <Link
              href={`/${workspaceId}/clients/new`}
              className={buttonVariants({ size: 'sm' })}
            >
              Add your first client
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {clients.map((client) => {
                const lastActivity = client.lastActivityAt ?? client.updatedAt;
                const daysInactive = Math.floor(
                  (Date.now() - new Date(lastActivity).getTime()) /
                    (1000 * 60 * 60 * 24),
                );
                const atRisk =
                  !client.archivedAt && daysInactive >= 30 && daysInactive < 60;
                const inactive =
                  !client.archivedAt && daysInactive >= 60;
                return (
                  <li key={client.id}>
                    <Link
                      href={`/${workspaceId}/clients/${client.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {client.name}
                          </span>
                          {client.archivedAt && (
                            <Badge variant="outline" className="text-xs">
                              Archived
                            </Badge>
                          )}
                          {atRisk && (
                            <Badge
                              variant="outline"
                              className="border-amber-400/50 text-[10px] text-amber-400"
                            >
                              At risk · {daysInactive}d
                            </Badge>
                          )}
                          {inactive && (
                            <Badge
                              variant="outline"
                              className="border-red-400/50 text-[10px] text-red-400"
                            >
                              Inactive · {daysInactive}d
                            </Badge>
                          )}
                        </div>
                        {client.businessName && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {client.businessName}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {client.lastActivityAt
                          ? `Active ${new Date(client.lastActivityAt).toLocaleDateString()}`
                          : `Updated ${new Date(client.updatedAt).toLocaleDateString()}`}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
