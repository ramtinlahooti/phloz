import { and, count, desc, eq, inArray } from 'drizzle-orm';
import {
  CheckCircle2,
  FilePlus2,
  ListChecks,
  Mail,
  MessageSquare,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import { getActiveClientCount, getTier } from '@phloz/billing';
import type {
  ApprovalState,
  MessageChannel,
  MessageDirection,
  TaskStatus,
} from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Overview' });

type RouteParams = { workspace: string };

type FeedItem = {
  id: string;
  at: Date;
  kind: 'task' | 'message' | 'asset' | 'approval';
  title: string;
  subtitle?: string;
  clientId: string | null;
  clientName: string | null;
  badge?: { label: string; tone: 'primary' | 'green' | 'red' | 'amber' };
};

const FEED_LIMIT = 20;

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  const db = getDb();

  const [
    workspace,
    activeClientCount,
    openTaskCount,
    memberCount,
    recentTasks,
    recentMessages,
    recentAssets,
    recentApprovals,
    clientRows,
  ] = await Promise.all([
    db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .limit(1)
      .then((rows) => rows[0]),
    getActiveClientCount(workspaceId),
    db
      .select({ c: count() })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
        ),
      )
      .then((rows) => rows[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.workspaceId, workspaceId))
      .then((rows) => rows[0]?.c ?? 0),
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        status: schema.tasks.status,
        createdAt: schema.tasks.createdAt,
        completedAt: schema.tasks.completedAt,
        clientId: schema.tasks.clientId,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.workspaceId, workspaceId))
      .orderBy(desc(schema.tasks.updatedAt))
      .limit(FEED_LIMIT),
    db
      .select({
        id: schema.messages.id,
        direction: schema.messages.direction,
        channel: schema.messages.channel,
        subject: schema.messages.subject,
        body: schema.messages.body,
        createdAt: schema.messages.createdAt,
        clientId: schema.messages.clientId,
      })
      .from(schema.messages)
      .where(eq(schema.messages.workspaceId, workspaceId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(FEED_LIMIT),
    db
      .select({
        id: schema.clientAssets.id,
        name: schema.clientAssets.name,
        createdAt: schema.clientAssets.createdAt,
        clientId: schema.clientAssets.clientId,
      })
      .from(schema.clientAssets)
      .where(eq(schema.clientAssets.workspaceId, workspaceId))
      .orderBy(desc(schema.clientAssets.createdAt))
      .limit(FEED_LIMIT),
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        approvalState: schema.tasks.approvalState,
        approvalUpdatedAt: schema.tasks.approvalUpdatedAt,
        approvalComment: schema.tasks.approvalComment,
        clientId: schema.tasks.clientId,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          inArray(schema.tasks.approvalState, [
            'approved',
            'rejected',
            'needs_changes',
          ]),
        ),
      )
      .orderBy(desc(schema.tasks.approvalUpdatedAt))
      .limit(FEED_LIMIT),
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(eq(schema.clients.workspaceId, workspaceId)),
  ]);

  if (!workspace) return null;

  const tier = getTier(workspace.tier);
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const nameFor = (id: string | null) =>
    id ? clientName.get(id) ?? null : null;

  const feed: FeedItem[] = [];

  for (const t of recentTasks) {
    const done =
      (t.status as TaskStatus) === 'done' && t.completedAt !== null;
    feed.push({
      id: `task-${t.id}-${done ? 'done' : 'new'}`,
      at: done && t.completedAt ? t.completedAt : t.createdAt,
      kind: 'task',
      title: done ? `Completed: ${t.title}` : `New task: ${t.title}`,
      clientId: t.clientId,
      clientName: nameFor(t.clientId),
      badge: done
        ? { label: 'Done', tone: 'green' }
        : { label: 'New', tone: 'primary' },
    });
  }

  for (const m of recentMessages) {
    const channel = m.channel as MessageChannel;
    const direction = m.direction as MessageDirection;
    feed.push({
      id: `msg-${m.id}`,
      at: m.createdAt,
      kind: 'message',
      title: `${direction === 'inbound' ? 'Received' : 'Sent'}: ${
        m.subject ?? m.body.slice(0, 60)
      }`,
      subtitle:
        channel === 'internal_note'
          ? 'Internal note'
          : channel === 'portal'
            ? 'Portal'
            : 'Email',
      clientId: m.clientId,
      clientName: nameFor(m.clientId),
      badge:
        direction === 'inbound'
          ? { label: 'Inbound', tone: 'primary' }
          : channel === 'internal_note'
            ? { label: 'Note', tone: 'amber' }
            : undefined,
    });
  }

  for (const a of recentAssets) {
    feed.push({
      id: `asset-${a.id}`,
      at: a.createdAt,
      kind: 'asset',
      title: `File uploaded: ${a.name}`,
      clientId: a.clientId,
      clientName: nameFor(a.clientId),
    });
  }

  for (const t of recentApprovals) {
    if (!t.approvalUpdatedAt) continue;
    const state = t.approvalState as ApprovalState;
    const label =
      state === 'approved'
        ? 'Approved'
        : state === 'rejected'
          ? 'Rejected'
          : 'Changes requested';
    feed.push({
      id: `approval-${t.id}`,
      at: t.approvalUpdatedAt,
      kind: 'approval',
      title: `Client ${label.toLowerCase()}: ${t.title}`,
      subtitle: t.approvalComment ?? undefined,
      clientId: t.clientId,
      clientName: nameFor(t.clientId),
      badge:
        state === 'approved'
          ? { label, tone: 'green' }
          : state === 'rejected'
            ? { label, tone: 'red' }
            : { label, tone: 'amber' },
    });
  }

  feed.sort((a, b) => b.at.getTime() - a.at.getTime());
  const trimmed = feed.slice(0, 30);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{tier.displayName}</Badge>
            <span>
              {activeClientCount} of{' '}
              {tier.clientLimit === 'unlimited' ? '∞' : tier.clientLimit} active
              clients
            </span>
          </div>
        </div>
        <Link
          href={`/${workspaceId}/clients/new`}
          className={buttonVariants({ size: 'sm' })}
        >
          Add client
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active clients
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {activeClientCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {openTaskCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team members
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {memberCount}
          </CardContent>
        </Card>
      </div>

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        {/* Activity feed — 2/3 width on desktop */}
        <div className="md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent activity
          </h2>
          {trimmed.length === 0 ? (
            <EmptyState
              title="Nothing has happened yet"
              description="Add a client, post a note, upload a file — this feed will catch it."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/60">
                  {trimmed.map((item) => (
                    <FeedRow
                      key={item.id}
                      item={item}
                      workspaceId={workspaceId}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right rail — quick-start + plan */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Getting started</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <span
                    className="inline-block size-1.5 rounded-full bg-primary"
                    aria-hidden
                  />
                  <Link
                    className="hover:text-primary"
                    href={`/${workspaceId}/clients/new`}
                  >
                    Add your first client
                  </Link>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="inline-block size-1.5 rounded-full bg-primary"
                    aria-hidden
                  />
                  <Link
                    className="hover:text-primary"
                    href={`/${workspaceId}/team`}
                  >
                    Invite a teammate
                  </Link>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="inline-block size-1.5 rounded-full bg-primary"
                    aria-hidden
                  />
                  <Link
                    className="hover:text-primary"
                    href={`/${workspaceId}/settings`}
                  >
                    Customize your workspace
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                You&apos;re on the <strong>{tier.displayName}</strong> tier.
                {tier.monthlyPriceUsd !== null && (
                  <> ${tier.monthlyPriceUsd}/mo when billed monthly.</>
                )}
              </p>
              <Link
                href={`/${workspaceId}/billing`}
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                })}
              >
                Manage billing
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// --- Feed row --------------------------------------------------------

function FeedRow({
  item,
  workspaceId,
}: {
  item: FeedItem;
  workspaceId: string;
}) {
  const Icon = kindIcon(item);
  const href = item.clientId
    ? `/${workspaceId}/clients/${item.clientId}`
    : `/${workspaceId}`;

  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="truncate">{item.title}</span>
            {item.badge && (
              <Badge variant="outline" className={`text-[10px] ${badgeClass(item.badge.tone)}`}>
                {item.badge.label}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {item.clientName && (
              <>
                <span>{item.clientName}</span>
                <span>·</span>
              </>
            )}
            {item.subtitle && (
              <>
                <span className="truncate">{item.subtitle}</span>
                <span>·</span>
              </>
            )}
            <time dateTime={item.at.toISOString()}>
              {formatRelative(item.at)}
            </time>
          </div>
        </div>
      </Link>
    </li>
  );
}

function kindIcon(item: FeedItem) {
  if (item.kind === 'asset') return FilePlus2;
  if (item.kind === 'message') {
    return item.subtitle === 'Email' ? Mail : MessageSquare;
  }
  if (item.kind === 'approval') {
    if (item.badge?.label === 'Approved') return CheckCircle2;
    if (item.badge?.label === 'Rejected') return XCircle;
    return RefreshCw;
  }
  return item.title.startsWith('Completed') ? CheckCircle2 : ListChecks;
}

function badgeClass(tone: 'primary' | 'green' | 'red' | 'amber'): string {
  if (tone === 'green') return 'border-emerald-400/50 text-emerald-400';
  if (tone === 'red') return 'border-red-400/50 text-red-400';
  if (tone === 'amber') return 'border-amber-400/50 text-amber-400';
  return 'border-primary/40 text-primary';
}

function formatRelative(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

