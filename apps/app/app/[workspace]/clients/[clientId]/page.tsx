import { and, asc, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import type {
  Department,
  MessageChannel,
  MessageDirection,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@phloz/config';
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

import {
  MessageThread,
  type MessageItem,
} from '../../messages/message-thread';
import { NewTaskDialog } from '../../tasks/new-task-dialog';
import { TaskRow, type TaskRowModel } from '../../tasks/task-row';

export const metadata = buildAppMetadata({ title: 'Client' });

type RouteParams = { workspace: string; clientId: string };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId, clientId } = await params;
  const db = getDb();

  const [client, clientTasks, clientMessages, inboundAddressRow] =
    await Promise.all([
      db
        .select()
        .from(schema.clients)
        .where(
          and(
            eq(schema.clients.id, clientId),
            eq(schema.clients.workspaceId, workspaceId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.workspaceId, workspaceId),
            eq(schema.tasks.clientId, clientId),
          ),
        )
        .orderBy(desc(schema.tasks.priority), asc(schema.tasks.dueDate)),
      db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.workspaceId, workspaceId),
            eq(schema.messages.clientId, clientId),
          ),
        )
        .orderBy(desc(schema.messages.createdAt))
        .limit(200),
      db
        .select({ address: schema.inboundEmailAddresses.address })
        .from(schema.inboundEmailAddresses)
        .where(
          and(
            eq(schema.inboundEmailAddresses.clientId, clientId),
            eq(schema.inboundEmailAddresses.active, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]),
    ]);

  if (!client) notFound();

  const tasksAsRows: TaskRowModel[] = clientTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    department: t.department as Department,
    visibility: t.visibility as TaskVisibility,
    dueDate: t.dueDate,
    clientId: t.clientId,
    clientName: client.name,
  }));
  const openTasks = tasksAsRows.filter(
    (t) => t.status !== 'done' && t.status !== 'archived',
  );

  const messages: MessageItem[] = clientMessages.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    direction: m.direction as MessageDirection,
    channel: m.channel as MessageChannel,
    subject: m.subject,
    body: m.body,
    fromLabel:
      m.fromType === 'member'
        ? 'Team'
        : m.fromType === 'contact'
          ? client.name
          : 'System',
    createdAt: m.createdAt,
  }));

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

            <TabsContent value="tasks" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {tasksAsRows.length} total · {openTasks.length} open
                </p>
                <NewTaskDialog workspaceId={workspaceId} clientId={clientId} />
              </div>
              {tasksAsRows.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-sm text-muted-foreground">
                    No tasks yet. Add one to start tracking work for this
                    client.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-border/60">
                      {tasksAsRows.map((task) => (
                        <TaskRow
                          key={task.id}
                          workspaceId={workspaceId}
                          task={task}
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="messages" className="mt-6">
              <MessageThread
                workspaceId={workspaceId}
                clientId={clientId}
                clientEmail={client.businessEmail ?? null}
                inboundAddress={inboundAddressRow?.address ?? null}
                messages={messages}
              />
            </TabsContent>

            <TabsContent value="map" className="mt-6">
              <Card>
                <CardContent className="p-6 text-sm">
                  <p className="text-muted-foreground">
                    The tracking infrastructure map is a typed graph of every
                    GA4 property, GTM container, pixel, audience, and
                    conversion owned by this client.
                  </p>
                  <Link
                    href={`/${workspaceId}/clients/${clientId}/map`}
                    className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-accent"
                  >
                    Open tracking map →
                  </Link>
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
