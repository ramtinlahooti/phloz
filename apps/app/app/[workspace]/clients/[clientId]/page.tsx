import { and, asc, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireUser } from '@phloz/auth/session';
import type {
  ApprovalState,
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
  Breadcrumbs,
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

import { ArchiveButton } from './archive-button';
import { ClientOverviewForm } from './client-overview-form';
import { ClientNotesEditor } from './notes-editor';
import {
  ContactsPanel,
  type ContactRow,
} from './contacts/contacts-panel';
import { FilesPanel, type AssetRow } from './files/files-panel';
import { ApplyTemplateButton } from '../../tasks/apply-template-button';
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
  const user = await requireUser();

  const [
    client,
    clientTasks,
    clientMessages,
    inboundAddressRow,
    clientAssets,
    clientContactRows,
    memberRows,
  ] = await Promise.all([
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
      db
        .select()
        .from(schema.clientAssets)
        .where(
          and(
            eq(schema.clientAssets.workspaceId, workspaceId),
            eq(schema.clientAssets.clientId, clientId),
          ),
        )
        .orderBy(desc(schema.clientAssets.createdAt))
        .limit(200),
      db
        .select({
          id: schema.clientContacts.id,
          name: schema.clientContacts.name,
          email: schema.clientContacts.email,
          phone: schema.clientContacts.phone,
          role: schema.clientContacts.role,
          portalAccess: schema.clientContacts.portalAccess,
        })
        .from(schema.clientContacts)
        .where(
          and(
            eq(schema.clientContacts.workspaceId, workspaceId),
            eq(schema.clientContacts.clientId, clientId),
          ),
        )
        .orderBy(asc(schema.clientContacts.name)),
      // Members for the task assignee picker (NewTaskDialog + detail
      // dialog edit mode). Kept in the same Promise.all so the page
      // stays one roundtrip.
      db
        .select({
          id: schema.workspaceMembers.id,
          userId: schema.workspaceMembers.userId,
          role: schema.workspaceMembers.role,
          displayName: schema.workspaceMembers.displayName,
          email: schema.workspaceMembers.email,
        })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, workspaceId)),
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
    approvalState: t.approvalState as ApprovalState,
    assigneeMembershipId: t.assigneeId,
  }));

  // Build assignee options with the same label precedence as the
  // workspace-wide Tasks page. See `/tasks/page.tsx` for the ordering
  // logic.
  const memberOptions = memberRows
    .map((m) => {
      const isSelf = m.userId === user.id;
      const primary = isSelf
        ? 'You'
        : (m.displayName?.trim() ||
           m.email?.trim() ||
           `${(m.userId ?? 'unknown').slice(0, 8)}…`);
      return {
        id: m.id,
        label: `${primary} · ${m.role}`,
        sortKey: isSelf ? '' : primary.toLowerCase(),
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ id, label }) => ({ id, label }));
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

  const assetRows: AssetRow[] = clientAssets.map((a) => ({
    id: a.id,
    name: a.name,
    assetType: a.assetType,
    notes: a.notes,
    clientVisible: a.clientVisible,
    createdAt: a.createdAt,
  }));

  const contactRows: ContactRow[] = clientContactRows.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: c.role,
    portalAccess: c.portalAccess,
  }));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border/60 bg-card/30 px-6 py-5">
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: 'Clients', href: `/${workspaceId}/clients` },
            { label: client.name },
          ]}
        />
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
          <div className="flex shrink-0 items-center gap-2">
            {client.archivedAt && (
              <Badge variant="outline">Archived</Badge>
            )}
            <ArchiveButton
              workspaceId={workspaceId}
              clientId={clientId}
              archived={client.archivedAt !== null}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Main pane */}
        <div className="flex-1 min-w-0 overflow-auto">
          <Tabs defaultValue="overview" className="p-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="map">Tracking map</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <ClientOverviewForm
                workspaceId={workspaceId}
                clientId={clientId}
                initial={{
                  name: client.name,
                  businessName: client.businessName,
                  businessEmail: client.businessEmail,
                  businessPhone: client.businessPhone,
                  websiteUrl: client.websiteUrl,
                  industry: client.industry,
                }}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <ClientNotesEditor
                    workspaceId={workspaceId}
                    clientId={clientId}
                    initialNotes={client.notes ?? null}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="mt-6">
              <ContactsPanel
                workspaceId={workspaceId}
                clientId={clientId}
                contacts={contactRows}
              />
            </TabsContent>

            <TabsContent value="tasks" className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {tasksAsRows.length} total · {openTasks.length} open
                </p>
                <div className="flex items-center gap-2">
                  <ApplyTemplateButton
                    workspaceId={workspaceId}
                    clientId={clientId}
                  />
                  <NewTaskDialog
                    workspaceId={workspaceId}
                    clientId={clientId}
                    members={memberOptions}
                  />
                </div>
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
                          members={memberOptions}
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
              <FilesPanel
                workspaceId={workspaceId}
                clientId={clientId}
                assets={assetRows}
              />
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
