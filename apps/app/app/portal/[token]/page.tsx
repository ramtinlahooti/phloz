import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDashed,
  Mail,
} from 'lucide-react';

import { validatePortalMagicLink } from '@phloz/auth/portal';
import type { TaskPriority, TaskStatus } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

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
        subject: schema.messages.subject,
        body: schema.messages.body,
        createdAt: schema.messages.createdAt,
      })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.workspaceId, link.workspaceId),
          eq(schema.messages.clientId, link.clientId),
          eq(schema.messages.channel, 'email'),
        ),
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(20),
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
              <ul className="divide-y divide-border/60">
                {visibleTasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                    <TaskStatusIcon status={t.status as TaskStatus} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate">{t.title}</span>
                        {(t.priority as TaskPriority) === 'urgent' && (
                          <Badge
                            variant="outline"
                            className="border-red-400/50 text-[10px] text-red-400"
                          >
                            Urgent
                          </Badge>
                        )}
                      </div>
                      {t.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                      {t.dueDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Due {t.dueDate.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Messages */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent messages
        </h2>
        {recentMessages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Updates from your agency will appear here once a conversation starts."
          />
        ) : (
          <div className="space-y-3">
            {recentMessages.map((m) => (
              <Card key={m.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Mail className="size-4 text-muted-foreground" />
                      <span className="truncate">
                        {m.subject ?? '(no subject)'}
                      </span>
                    </span>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={m.createdAt.toISOString()}
                    >
                      {m.createdAt.toLocaleDateString()}
                    </time>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-6 whitespace-pre-wrap text-sm text-foreground/90">
                    {m.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <footer className="rounded-lg border border-border bg-card/30 p-6 text-sm">
        <h3 className="font-semibold">Need something else?</h3>
        <p className="mt-1 text-muted-foreground">
          Reply to any email from your agency and it threads back into
          this portal automatically. Or reach out to your account manager
          directly.
        </p>
      </footer>
    </div>
  );
}

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  const cls = 'mt-0.5 size-4 shrink-0';
  if (status === 'done')
    return (
      <CheckCircle2 className={`${cls} text-[var(--color-health-working)]`} />
    );
  if (status === 'in_progress')
    return <CircleDashed className={`${cls} text-primary`} />;
  if (status === 'blocked')
    return <AlertCircle className={`${cls} text-[var(--color-health-broken)]`} />;
  return <Circle className={`${cls} text-muted-foreground`} />;
}
