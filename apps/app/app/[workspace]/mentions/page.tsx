import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { AtSign, MessageSquare, StickyNote } from 'lucide-react';
import Link from 'next/link';

import { requireRole } from '@phloz/auth/roles';
import { getDb, schema } from '@phloz/db/client';
import { Card, CardContent, EmptyState } from '@phloz/ui';

import { MentionBody } from '@/components/mention-body';
import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import { MarkMentionsSeen } from './mark-seen';

export const metadata = buildAppMetadata({ title: 'Mentions' });

type RouteParams = { workspace: string };

/**
 * Unified inbox for the calling user's `@`-mentions across:
 *   - `comments.mentions` — task / tracking-node / message comments
 *   - `messages.mentions` — internal notes on client threads
 *
 * Both columns are populated server-side by the mention-fan-out
 * paths and indexed (GIN). The page joins both feeds, sorts by
 * createdAt desc, and renders one row per mention with a deep-link
 * back to the source.
 *
 * Owner / admin / member / viewer can all see this page — viewers
 * see only mentions on entities their assigned-clients RLS allows
 * (the same `phloz_is_assigned_to` gate that scopes everything
 * else). No new policy work needed.
 */
export default async function MentionsInboxPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  assertValidWorkspaceId(workspaceId);
  const actor = await requireRole(workspaceId, [
    'owner',
    'admin',
    'member',
    'viewer',
  ]);
  const userId = actor.user.id;

  const db = getDb();

  // Both feeds in parallel. `sql` template uses an array-contains
  // expression — Drizzle's higher-level helpers don't currently
  // expose `@>` directly so we lean on the raw SQL escape hatch.
  const [commentRows, messageRows, clientRows, memberRows] =
    await Promise.all([
      db
        .select({
          id: schema.comments.id,
          body: schema.comments.body,
          parentType: schema.comments.parentType,
          parentId: schema.comments.parentId,
          authorId: schema.comments.authorId,
          authorType: schema.comments.authorType,
          createdAt: schema.comments.createdAt,
        })
        .from(schema.comments)
        .where(
          and(
            eq(schema.comments.workspaceId, workspaceId),
            sql`${schema.comments.mentions} @> ARRAY[${userId}]::uuid[]`,
          ),
        )
        .orderBy(desc(schema.comments.createdAt))
        .limit(50),
      db
        .select({
          id: schema.messages.id,
          body: schema.messages.body,
          clientId: schema.messages.clientId,
          fromId: schema.messages.fromId,
          fromType: schema.messages.fromType,
          createdAt: schema.messages.createdAt,
          channel: schema.messages.channel,
        })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.workspaceId, workspaceId),
            isNotNull(schema.messages.fromId),
            sql`${schema.messages.mentions} @> ARRAY[${userId}]::uuid[]`,
          ),
        )
        .orderBy(desc(schema.messages.createdAt))
        .limit(50),
      // Client name lookup for the message context line.
      db
        .select({ id: schema.clients.id, name: schema.clients.name })
        .from(schema.clients)
        .where(eq(schema.clients.workspaceId, workspaceId)),
      // Member display-name lookup for the actor labels. Comments use
      // workspace_members.id as authorId; messages use it as fromId
      // (when fromType='member'). One lookup, two consumers.
      db
        .select({
          id: schema.workspaceMembers.id,
          displayName: schema.workspaceMembers.displayName,
          email: schema.workspaceMembers.email,
        })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, workspaceId)),
    ]);

  const clientNameById = new Map(clientRows.map((c) => [c.id, c.name]));
  const memberLabelById = new Map(
    memberRows.map((m) => [
      m.id,
      m.displayName?.trim() || m.email || 'Teammate',
    ]),
  );

  // Look up the parent task for every task-comment mention so we can
  // render its title + a deep link. Scoped to comments where
  // parentType='task' (other parent types live on different
  // surfaces; we ignore them in v1 to keep the inbox focused).
  const taskIds = Array.from(
    new Set(
      commentRows
        .filter((c) => c.parentType === 'task')
        .map((c) => c.parentId),
    ),
  );
  const taskById = taskIds.length
    ? new Map(
        (
          await db
            .select({
              id: schema.tasks.id,
              title: schema.tasks.title,
              clientId: schema.tasks.clientId,
            })
            .from(schema.tasks)
            .where(eq(schema.tasks.workspaceId, workspaceId))
        ).map((t) => [t.id, t]),
      )
    : new Map<
        string,
        { id: string; title: string; clientId: string | null }
      >();

  type Row = {
    id: string;
    kind: 'comment' | 'note';
    body: string;
    actorLabel: string;
    contextLabel: string;
    contextHref: string;
    createdAt: Date;
  };

  const rows: Row[] = [];

  for (const c of commentRows) {
    if (c.parentType !== 'task') continue;
    const task = taskById.get(c.parentId);
    if (!task) continue;
    const actorLabel =
      c.authorType === 'member'
        ? memberLabelById.get(c.authorId) ?? 'Teammate'
        : c.authorType === 'system'
          ? 'System'
          : 'Client';
    const clientLabel = task.clientId
      ? clientNameById.get(task.clientId) ?? null
      : null;
    rows.push({
      id: c.id,
      kind: 'comment',
      body: c.body,
      actorLabel,
      contextLabel: clientLabel
        ? `${clientLabel} · ${task.title}`
        : task.title,
      contextHref: task.clientId
        ? `/${workspaceId}/clients/${task.clientId}?task=${task.id}`
        : `/${workspaceId}/tasks?task=${task.id}`,
      createdAt: c.createdAt,
    });
  }

  for (const m of messageRows) {
    if (m.channel !== 'internal_note') continue;
    const actorLabel =
      m.fromType === 'member' && m.fromId
        ? memberLabelById.get(m.fromId) ?? 'Teammate'
        : 'Teammate';
    rows.push({
      id: m.id,
      kind: 'note',
      body: m.body,
      actorLabel,
      contextLabel:
        clientNameById.get(m.clientId) ?? 'Client thread',
      contextHref: `/${workspaceId}/clients/${m.clientId}`,
      createdAt: m.createdAt,
    });
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <MarkMentionsSeen workspaceId={workspaceId} />
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Mentions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comments + internal notes that tag <strong>you</strong>. The
          50 most recent on each surface. Email goes out as soon as
          you&apos;re mentioned (unless your{' '}
          <Link
            href={`/${workspaceId}/settings#notifications`}
            className="text-primary underline-offset-2 hover:underline"
          >
            notification preferences
          </Link>{' '}
          say otherwise) — this page is the receiving-end view.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="When a teammate @-mentions you in a task comment or an internal note, it'll land here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {rows.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <Link
                    href={r.contextHref}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50"
                  >
                    <KindIcon kind={r.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{r.actorLabel}</span>
                        <span className="text-muted-foreground">
                          mentioned you in
                        </span>
                        <span className="font-medium text-foreground/90">
                          {r.contextLabel}
                        </span>
                        {r.kind === 'note' && (
                          <span className="rounded-full border border-amber-400/50 px-1.5 text-[10px] text-amber-400">
                            Internal note
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-3 text-sm text-foreground/85">
                        <MentionBody text={r.body} />
                      </p>
                    </div>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={r.createdAt.toISOString()}
                    >
                      {formatRelative(r.createdAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: 'comment' | 'note' }) {
  if (kind === 'note')
    return (
      <StickyNote
        className="mt-0.5 size-4 shrink-0 text-amber-400"
        aria-label="internal note"
      />
    );
  return (
    <MessageSquare
      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      aria-label="task comment"
    />
  );
}

void AtSign; // imported for future header polish; keep for tree-shake

function formatRelative(d: Date): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - d.getTime()) / 1000),
  );
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}
