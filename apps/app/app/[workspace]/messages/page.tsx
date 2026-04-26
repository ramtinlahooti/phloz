import { and, desc, eq, not } from 'drizzle-orm';
import { Mail, MailOpen, MessageSquare, StickyNote } from 'lucide-react';
import Link from 'next/link';

import type { MessageChannel, MessageDirection } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import { Badge, Card, CardContent, EmptyState } from '@phloz/ui';

import { SearchInput } from '@/components/search-input';
import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import { InboxKeyboardNav } from './inbox-keyboard-nav';

export const metadata = buildAppMetadata({ title: 'Messages' });

type RouteParams = { workspace: string };
type SearchParams = {
  direction?: string;
  channel?: string;
  q?: string;
  /** `?needs_reply=1` shows only inbound messages newer than the last
   *  outbound for the same client — i.e. the conversations we owe a
   *  response on. Same logic as the dashboard's "Waiting on a reply"
   *  widget. */
  needs_reply?: string;
};

/**
 * How far back the "needs reply" pill looks. Anything older than this
 * we assume the user has already triaged elsewhere or given up on;
 * surfacing month-old unanswered emails in the needs-reply filter
 * would just be noise.
 */
const NEEDS_REPLY_WINDOW_DAYS = 60;

export default async function MessagesInboxPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { workspace: workspaceId } = await params;
  assertValidWorkspaceId(workspaceId);
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
  const searchQuery = (sp.q ?? '').trim().toLowerCase();
  const needsReply = sp.needs_reply === '1';

  const db = getDb();
  const conditions = [eq(schema.messages.workspaceId, workspaceId)];
  if (directionFilter)
    conditions.push(eq(schema.messages.direction, directionFilter));
  if (channelFilter)
    conditions.push(eq(schema.messages.channel, channelFilter));

  const [rows, outboundForNeedsReply, clients] = await Promise.all([
    db
      .select()
      .from(schema.messages)
      .where(and(...conditions))
      .orderBy(desc(schema.messages.createdAt))
      .limit(200),
    // For the needs-reply filter: one row per outbound message
    // (any channel except internal_note, since internal notes aren't
    // client-facing). We reduce to "latest outbound per client" in JS.
    needsReply
      ? db
          .select({
            clientId: schema.messages.clientId,
            createdAt: schema.messages.createdAt,
          })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.workspaceId, workspaceId),
              eq(schema.messages.direction, 'outbound'),
              not(eq(schema.messages.channel, 'internal_note')),
            ),
          )
      : Promise.resolve([] as { clientId: string; createdAt: Date }[]),
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(eq(schema.clients.workspaceId, workspaceId)),
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c.name]));

  // Needs-reply logic: for each client, find the most recent outbound
  // message timestamp. An inbound message "needs reply" if its
  // createdAt is after that timestamp (or there's no outbound at all).
  let filteredRows = rows;
  if (needsReply) {
    const lastOutboundByClient = new Map<string, Date>();
    for (const m of outboundForNeedsReply) {
      const existing = lastOutboundByClient.get(m.clientId);
      if (!existing || m.createdAt > existing) {
        lastOutboundByClient.set(m.clientId, m.createdAt);
      }
    }
    const cutoff = new Date(
      Date.now() - NEEDS_REPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    filteredRows = filteredRows.filter((m) => {
      if (m.direction !== 'inbound') return false;
      if (m.channel === 'internal_note') return false;
      if (m.createdAt < cutoff) return false;
      const lastOut = lastOutboundByClient.get(m.clientId) ?? null;
      return lastOut === null || m.createdAt > lastOut;
    });
  }

  // Text search (subject + body) applied after direction/channel/
  // needs-reply filters so "show me matches for X in my inbox"
  // composes cleanly.
  if (searchQuery) {
    filteredRows = filteredRows.filter((m) => {
      const hay = `${m.subject ?? ''} ${m.body}`.toLowerCase();
      return hay.includes(searchQuery);
    });
  }

  const hasAnyFilter =
    directionFilter !== null ||
    channelFilter !== null ||
    needsReply ||
    searchQuery !== '';

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inbound email forwarded via{' '}
            <code className="font-mono">client-*@inbound.phloz.com</code>,
            outbound replies, and internal notes across every client.
            {(searchQuery || needsReply) && (
              <>
                {' · '}
                <span className="text-foreground">
                  {filteredRows.length} match
                  {filteredRows.length === 1 ? '' : 'es'}
                </span>
              </>
            )}
          </p>
        </div>
        <SearchInput
          placeholder="Search subject / body…"
          className="w-full sm:w-64"
        />
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <FilterPill
          href={`/${workspaceId}/messages`}
          active={!hasAnyFilter}
        >
          All
        </FilterPill>
        <FilterPill
          href={hrefWith(
            workspaceId,
            sp,
            'needs_reply',
            needsReply ? null : '1',
          )}
          active={needsReply}
        >
          <span className="inline-flex items-center gap-1">
            <MailOpen className="size-3" />
            Needs reply
          </span>
        </FilterPill>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <FilterPill
          href={hrefWith(
            workspaceId,
            sp,
            'direction',
            directionFilter === 'inbound' ? null : 'inbound',
          )}
          active={directionFilter === 'inbound'}
        >
          Inbound
        </FilterPill>
        <FilterPill
          href={hrefWith(
            workspaceId,
            sp,
            'direction',
            directionFilter === 'outbound' ? null : 'outbound',
          )}
          active={directionFilter === 'outbound'}
        >
          Outbound
        </FilterPill>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <FilterPill
          href={hrefWith(
            workspaceId,
            sp,
            'channel',
            channelFilter === 'email' ? null : 'email',
          )}
          active={channelFilter === 'email'}
        >
          Email
        </FilterPill>
        <FilterPill
          href={hrefWith(
            workspaceId,
            sp,
            'channel',
            channelFilter === 'internal_note' ? null : 'internal_note',
          )}
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
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title={
            needsReply
              ? 'Inbox is clear'
              : searchQuery
                ? `No messages match "${searchQuery}"`
                : 'No messages match these filters'
          }
          description={
            needsReply
              ? 'Every inbound message in the last 60 days has a later outbound reply.'
              : 'Try a different filter or clear the search.'
          }
          action={
            hasAnyFilter ? (
              <Link
                href={`/${workspaceId}/messages`}
                className="text-sm text-primary hover:underline"
              >
                Reset filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <InboxKeyboardNav />
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {filteredRows.map((m) => (
                <li
                  key={m.id}
                  data-inbox-row={m.id}
                  className="data-[focused=true]:bg-primary/5 data-[focused=true]:ring-1 data-[focused=true]:ring-primary/40"
                >
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

/**
 * Build a filter-pill href that toggles one search param while
 * preserving the rest (including `q`). Passing `value = null` clears
 * the param.
 */
function hrefWith(
  workspaceId: string,
  sp: SearchParams,
  key: keyof SearchParams,
  value: string | null,
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v !== 'string' || v.length === 0) continue;
    if (k === key) continue;
    next.set(k, v);
  }
  if (value !== null) next.set(key as string, value);
  const qs = next.toString();
  return qs
    ? `/${workspaceId}/messages?${qs}`
    : `/${workspaceId}/messages`;
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
