import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Client' });

type RouteParams = { workspace: string; clientId: string };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId, clientId } = await params;
  const db = getDb();

  const client = await db
    .select()
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.id, clientId),
        eq(schema.clients.workspaceId, workspaceId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!client) notFound();

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border/60 bg-card/30 px-6 py-5">
        <nav className="mb-2 text-xs">
          <Link
            href={`/${workspaceId}/clients`}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Clients
          </Link>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {client.name}
            </h1>
            {client.businessName && (
              <p className="mt-1 text-sm text-muted-foreground">
                {client.businessName}
              </p>
            )}
          </div>
          {client.archivedAt && (
            <Badge variant="outline">Archived</Badge>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Main pane */}
        <div className="flex-1 min-w-0 overflow-auto">
          <Tabs defaultValue="overview" className="p-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="map">Tracking map</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {client.notes ?? (
                    <span className="text-muted-foreground">
                      No notes yet.
                    </span>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="mt-6">
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Tasks for this client will appear here. (V1 MVP — full
                  task board ships in a follow-up session.)
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages" className="mt-6">
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Email threads and internal comments for this client will
                  appear here. Forward client email to the client&apos;s
                  inbound address to auto-thread.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="map" className="mt-6">
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  The tracking infrastructure map ships in Prompt 2 (see
                  docs/ROADMAP.md). For now you can add GA4 properties,
                  pixels, and conversion actions manually once that session
                  lands.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="mt-6">
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  File uploads via Supabase Storage ship in a follow-up
                  session.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <aside className="hidden w-80 shrink-0 border-l border-border/60 bg-card/20 p-6 lg:block">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Details
              </h3>
              <dl className="space-y-2 text-sm">
                {client.websiteUrl && (
                  <div>
                    <dt className="text-muted-foreground">Website</dt>
                    <dd>
                      <a
                        href={client.websiteUrl}
                        className="text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {client.websiteUrl}
                      </a>
                    </dd>
                  </div>
                )}
                {client.industry && (
                  <div>
                    <dt className="text-muted-foreground">Industry</dt>
                    <dd>{client.industry}</dd>
                  </div>
                )}
                {client.businessEmail && (
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{client.businessEmail}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Added</dt>
                  <dd>{new Date(client.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
