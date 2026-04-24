import { and, desc, eq, inArray } from 'drizzle-orm';

import { validatePortalMagicLink } from '@phloz/auth/portal';
import type {
  ApprovalState,
  MessageChannel,
  MessageDirection,
  TaskStatus,
} from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import { Badge, Card, CardContent, EmptyState } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

import { PortalMessages, type PortalMessage } from './portal-messages';
import { PortalTaskCard, type PortalTaskRow } from './portal-task-row';

export const metadata = buildAppMetadata({ title: 'Client portal' });

type RouteParams = { token: string };

/**
 * Client portal dashboard. Read-only at V1 (no reply, no self-update).
 * Shows:
 * - Tasks with `visibility = client_visible` that are still open.
 * - Messages on the `email` channel (not internal notes), most recent
 *   20 — the client sees a conversation without any internal notes or
 *   direction badges.
 * - A footer pointing the client at the reply-by-email path.
 */
export default async function PortalHomePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { token } = await params;
  const link = await validatePortalMagicLink(token);
  if (!link) return null; // layout already 404s

  const db = getDb();

  const [client, visibleTasks, recentMessages] = await Promise.all([
    db
      .select({
        id: schema.clients.id,
        name: schema.clients.name,
        businessName: schema.clients.businessName,
      })
      .from(schema.clients)
      .where(eq(schema.clients.id, link.clientId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        description: schema.tasks.description,
        status: schema.tasks.status,
        priority: schema.tasks.priority,
        dueDate: schema.tasks.dueDate,
        approvalState: schema.tasks.approvalState,
        approvalComment: schema.tasks.approvalComment,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, link.workspaceId),
          eq(schema.tasks.clientId, link.clientId),
          eq(schema.tasks.visibility, 'client_visible'),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
        ),
      )
      .orderBy(desc(schema.tasks.priority))
      .limit(20),
    db
      .select({
        id: schema.messages.id,
        threadId: schema.messages.threadId,
        direction: schema.messages.direction,
        channel: schema.messages.channel,
        subject: schema.messages.subject,
        body: schema.messages.body,
        createdAt: schema.messages.createdAt,
      })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.workspaceId, link.workspaceId),
          eq(schema.messages.clientId, link.clientId),
          // Portal sees agency email + the client's own portal replies.
          // Internal notes are filtered out.
          inArray(schema.messages.channel, ['email', 'portal']),
        ),
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(50),
  ]);

  if (!client) return null;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared by your agency — the latest updates, tasks, and messages
          for {client.businessName ?? client.name}.
        </p>
      </header>

      {/* Tasks */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Open tasks
          </h2>
          {visibleTasks.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {visibleTasks.length}
            </Badge>
          )}
        </div>
        {visibleTasks.length === 0 ? (
          <EmptyState
            title="No open tasks"
            description="Anything your agency shares with you will appear here."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="space-y-3 p-3">
                {visibleTasks.map((t) => {
                  const row: PortalTaskRow = {
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    status: t.status as TaskStatus,
                    priority: t.priority as string,
                    dueDate: t.dueDate,
                    approvalState: t.approvalState as ApprovalState,
                    approvalComment: t.approvalComment,
                  };
                  return <PortalTaskCard key={t.id} token={token} task={row} />;
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Messages */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Conversations
        </h2>
        {recentMessages.length === 0 ? (
          <PortalMessages token={token} messages={[]} />
        ) : (
          <PortalMessages
            token={token}
            messages={recentMessages.map((m) => ({
              id: m.id,
              threadId: m.threadId,
              direction: m.direction as MessageDirection,
              channel: m.channel as MessageChannel,
              subject: m.subject,
              body: m.body,
              createdAt: m.createdAt,
            })) satisfies PortalMessage[]}
          />
        )}
      </section>
    </div>
  );
}
