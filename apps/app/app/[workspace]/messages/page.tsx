import { and, desc, eq } from 'drizzle-orm';
import { Mail, MessageSquare, StickyNote } from 'lucide-react';
import Link from 'next/link';

import type { MessageChannel, MessageDirection } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import { Badge, Card, CardContent, EmptyState } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Messages' });

type RouteParams = { workspace: string };
type SearchParams = {
  direction?: string;
  channel?: string;
};

export default async function MessagesInboxPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { workspace: workspaceId } = await params;
  const sp = await searchParams;

  const directionFilter =
    sp.direction === 'inbound' || sp.direction === 'outbound'
      ? (sp.direction as MessageDirection)
      : null;
  const channelFilter =
    sp.channel === 'email' ||
    sp.channel === 'internal_note' ||
    sp.channel === 'portal'
      ? (sp.channel as MessageChannel)
      : null;

  const db = getDb();
  const conditions = [eq(schema.messages.workspaceId, workspaceId)];
  if (directionFilter)
    conditions.push(eq(schema.messages.direction, directionFilter));
  if (channelFilter)
    conditions.push(eq(schema.messages.channel, channelFilter));

  const [rows, clients] = await Promise.all([
    db
      .select()
      .from(schema.messages)
      .where(and(...conditions))
      .orderBy(desc(schema.messages.createdAt))
      .limit(200),
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(eq(schema.clients.workspaceId, workspaceId)),
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inbound email forwarded via{' '}
          <code className="font-mono">client-*@inbound.phloz.com</code>,
          outbound replies, and internal notes across every client.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <FilterPill
          href={`/${workspaceId}/messages`}
          active={!directionFilter && !channelFilter}
        >
          All
        </FilterPill>
        <FilterPill
          href={`/${workspaceId}/messages?direction=inbound`}
          active={directionFilter === 'inbound'}
        >
          Inbound
        </FilterPill>
        <FilterPill
          href={`/${workspaceId}/messages?direction=outbound`}
          active={directionFilter === 'outbound'}
        >
          Outbound
        </FilterPill>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <FilterPill
          href={`/${workspaceId}/messages?channel=email`}
          active={channelFilter === 'email'}
        >
          Email
        </FilterPill>
        <FilterPill
          href={`/${workspaceId}/messages?channel=internal_note`}
          active={channelFilter === 'internal_note'}
        >
          Internal notes
        </FilterPill>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No messages"
          description="Forward a client email to its inbound address or compose a reply from the client page."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {rows.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/${workspaceId}/clients/${m.clientId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50"
                  >
                    <ChannelIcon channel={m.channel as MessageChannel} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">
                          {clientById.get(m.clientId) ?? 'Unknown client'}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {m.direction}
                        </Badge>
                        {m.channel === 'internal_note' && (
                          <Badge
                            variant="outline"
                            className="border-amber-400/50 text-[10px] text-amber-400"
                          >
                            Internal
                          </Badge>
                        )}
                      </div>
                      {m.subject && (
                        <div className="mt-0.5 truncate text-sm text-foreground/90">
                          {m.subject}
                        </div>
                      )}
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {m.body}
                      </div>
                    </div>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={m.createdAt.toISOString()}
                    >
                      {formatRelative(m.createdAt)}
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

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  );
}

function ChannelIcon({ channel }: { channel: MessageChannel }) {
  if (channel === 'email')
    return <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
  if (channel === 'internal_note')
    return <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-400" />;
  return (
    <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
  );
}

function formatRelative(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}
