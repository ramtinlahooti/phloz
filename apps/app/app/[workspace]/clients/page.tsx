import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, not } from 'drizzle-orm';
import Link from 'next/link';

import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  EmptyState,
} from '@phloz/ui';

import { ExportButton } from '@/components/export-button';
import { SearchInput } from '@/components/search-input';
import {
  HEALTH_COLORS,
  computeClientHealth,
  type HealthResult,
} from '@/lib/client-health';
import { buildAppMetadata } from '@/lib/metadata';

import { collectPlatformIds } from './[clientId]/platform-ids';

export const metadata = buildAppMetadata({ title: 'Clients' });

const SORT_OPTIONS = [
  'recently_active',
  'name',
  'recently_added',
  'oldest_activity',
] as const;
type ClientsSort = (typeof SORT_OPTIONS)[number];

const SORT_LABELS: Record<ClientsSort, string> = {
  recently_active: 'Recently active',
  name: 'Name (A→Z)',
  recently_added: 'Recently added',
  oldest_activity: 'Most dormant',
};

const STATUS_OPTIONS = ['active', 'archived', 'all'] as const;
type ClientsStatus = (typeof STATUS_OPTIONS)[number];

type RouteParams = { workspace: string };
type ClientsSearchParams = {
  q?: string;
  sort?: string;
  status?: string;
  industry?: string;
};

function isSort(v: string | undefined): v is ClientsSort {
  return !!v && (SORT_OPTIONS as readonly string[]).includes(v);
}
function isStatus(v: string | undefined): v is ClientsStatus {
  return !!v && (STATUS_OPTIONS as readonly string[]).includes(v);
}

export default async function ClientsListPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<ClientsSearchParams>;
}) {
  const { workspace: workspaceId } = await params;
  const sp = await searchParams;
  const searchQuery = (sp.q ?? '').trim().toLowerCase();
  const sort: ClientsSort = isSort(sp.sort) ? sp.sort : 'recently_active';
  const statusFilter: ClientsStatus = isStatus(sp.status) ? sp.status : 'active';
  const industryFilter = (sp.industry ?? '').trim() || null;
  const db = getDb();

  const now = new Date();

  const [
    clients,
    overdueTaskRows,
    inboundMessageRows,
    outboundMessageRows,
    trackingNodeRows,
  ] = await Promise.all([
    db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.workspaceId, workspaceId))
      .orderBy(desc(schema.clients.updatedAt)),
    // Overdue tasks with a client_id — count per client. Excludes
    // subtasks so a task with 5 overdue subtasks doesn't double-count.
    db
      .select({ clientId: schema.tasks.clientId })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
          isNotNull(schema.tasks.clientId),
          isNotNull(schema.tasks.dueDate),
          lt(schema.tasks.dueDate, now),
          isNull(schema.tasks.parentTaskId),
        ),
      ),
    // Last 60 days of inbound messages (excluding internal notes)
    // — we compare against outbound to decide which are "unreplied".
    db
      .select({
        clientId: schema.messages.clientId,
        createdAt: schema.messages.createdAt,
      })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.workspaceId, workspaceId),
          eq(schema.messages.direction, 'inbound'),
          not(eq(schema.messages.channel, 'internal_note')),
        ),
      ),
    db
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
      ),
    // Tracking node health + ID rollup per client. The metadata
    // payload is small (one tracking node per client averages ~150
    // bytes) so fetching the JSON inline beats a separate query.
    db
      .select({
        id: schema.trackingNodes.id,
        clientId: schema.trackingNodes.clientId,
        nodeType: schema.trackingNodes.nodeType,
        label: schema.trackingNodes.label,
        metadata: schema.trackingNodes.metadata,
        healthStatus: schema.trackingNodes.healthStatus,
      })
      .from(schema.trackingNodes)
      .where(eq(schema.trackingNodes.workspaceId, workspaceId)),
  ]);

  // Aggregate per-client inputs for the health scorer.
  const overdueCount = new Map<string, number>();
  for (const t of overdueTaskRows) {
    if (!t.clientId) continue;
    overdueCount.set(t.clientId, (overdueCount.get(t.clientId) ?? 0) + 1);
  }

  // Last outbound per client, then compare inbound dates to decide
  // which inbound messages are newer than the last reply.
  const lastOutboundByClient = new Map<string, Date>();
  for (const m of outboundMessageRows) {
    if (!m.clientId) continue;
    const existing = lastOutboundByClient.get(m.clientId);
    if (!existing || m.createdAt > existing) {
      lastOutboundByClient.set(m.clientId, m.createdAt);
    }
  }
  const unrepliedCount = new Map<string, number>();
  for (const m of inboundMessageRows) {
    if (!m.clientId) continue;
    const lastOut = lastOutboundByClient.get(m.clientId) ?? null;
    if (lastOut === null || m.createdAt > lastOut) {
      unrepliedCount.set(m.clientId, (unrepliedCount.get(m.clientId) ?? 0) + 1);
    }
  }

  const brokenNodeCount = new Map<string, number>();
  const missingNodeCount = new Map<string, number>();
  for (const n of trackingNodeRows) {
    if (!n.clientId) continue;
    if (n.healthStatus === 'broken') {
      brokenNodeCount.set(
        n.clientId,
        (brokenNodeCount.get(n.clientId) ?? 0) + 1,
      );
    } else if (n.healthStatus === 'missing') {
      missingNodeCount.set(
        n.clientId,
        (missingNodeCount.get(n.clientId) ?? 0) + 1,
      );
    }
  }

  const healthById = new Map<string, HealthResult>();
  for (const c of clients) {
    healthById.set(
      c.id,
      computeClientHealth({
        archived: c.archivedAt !== null,
        lastActivityAt: c.lastActivityAt,
        overdueTaskCount: overdueCount.get(c.id) ?? 0,
        unrepliedInboundCount: unrepliedCount.get(c.id) ?? 0,
        brokenNodeCount: brokenNodeCount.get(c.id) ?? 0,
        missingNodeCount: missingNodeCount.get(c.id) ?? 0,
      }),
    );
  }

  const active = clients.filter((c) => c.archivedAt === null);
  const archived = clients.filter((c) => c.archivedAt !== null);

  // Per-client first GTM container ID (if any). Aggregated from the
  // same tracking_node rows the health rollup uses — no extra query.
  const nodesByClient = new Map<
    string,
    Array<{
      id: string;
      nodeType: typeof schema.trackingNodes.$inferSelect['nodeType'];
      label: string | null;
      metadata: Record<string, unknown> | null;
    }>
  >();
  for (const n of trackingNodeRows) {
    if (!n.clientId) continue;
    const list = nodesByClient.get(n.clientId) ?? [];
    list.push({
      id: n.id,
      nodeType: n.nodeType,
      label: n.label,
      metadata: (n.metadata as Record<string, unknown> | null) ?? null,
    });
    nodesByClient.set(n.clientId, list);
  }
  const platformIdSummary = new Map<string, string | null>();
  for (const [clientId, nodes] of nodesByClient) {
    const ids = collectPlatformIds(nodes);
    // Pick the most identifying ID we have, in order of usefulness.
    // GTM and GA4 are the headline integrations agencies copy most.
    const headline =
      ids.find((r) => r.label.startsWith('GTM container')) ??
      ids.find((r) => r.label.startsWith('GA4 measurement')) ??
      ids[0] ??
      null;
    platformIdSummary.set(clientId, headline?.value ?? null);
  }

  // Distinct industries for the filter dropdown.
  const industryOptions = Array.from(
    new Set(
      clients
        .map((c) => c.industry?.trim())
        .filter((i): i is string => typeof i === 'string' && i.length > 0),
    ),
  ).sort();

  // Status filter (default active).
  let scoped = clients;
  if (statusFilter === 'active') {
    scoped = active;
  } else if (statusFilter === 'archived') {
    scoped = archived;
  }

  if (industryFilter) {
    scoped = scoped.filter(
      (c) =>
        (c.industry ?? '').trim().toLowerCase() ===
        industryFilter.toLowerCase(),
    );
  }

  // Text search — matches on name, business_name, industry, and website.
  // Case-insensitive substring. Runs on whatever's already filtered by
  // status + industry so search narrows further inside the chosen scope.
  const filteredClients = searchQuery
    ? scoped.filter((c) => {
        const hay = [
          c.name,
          c.businessName,
          c.industry,
          c.websiteUrl,
          c.businessEmail,
          platformIdSummary.get(c.id) ?? null,
        ]
          .filter((x): x is string => typeof x === 'string' && x.length > 0)
          .join(' ')
          .toLowerCase();
        return hay.includes(searchQuery);
      })
    : scoped;

  // Sort the filtered set in JS — small N, simple semantics.
  filteredClients.sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'recently_added':
        return b.createdAt.getTime() - a.createdAt.getTime();
      case 'oldest_activity': {
        const aT = a.lastActivityAt?.getTime() ?? a.createdAt.getTime();
        const bT = b.lastActivityAt?.getTime() ?? b.createdAt.getTime();
        return aT - bT;
      }
      case 'recently_active':
      default: {
        const aT = a.lastActivityAt?.getTime() ?? a.updatedAt.getTime();
        const bT = b.lastActivityAt?.getTime() ?? b.updatedAt.getTime();
        return bT - aT;
      }
    }
  });

  // URL helpers for sort + filter pills. Each click flips one
  // dimension while preserving the others; clicking the same value
  // toggles back to the default.
  function hrefWith(updates: Partial<ClientsSearchParams>): string {
    const next = new URLSearchParams();
    const merged = { ...sp, ...updates } as ClientsSearchParams;
    for (const [k, v] of Object.entries(merged)) {
      if (typeof v === 'string' && v.length > 0) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `/${workspaceId}/clients?${qs}` : `/${workspaceId}/clients`;
  }

  const anyFilterActive =
    statusFilter !== 'active' ||
    industryFilter !== null ||
    sort !== 'recently_active' ||
    searchQuery !== '';

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length} active · {archived.length} archived
            {searchQuery && (
              <>
                {' · '}
                <span className="text-foreground">
                  {filteredClients.length} match
                  {filteredClients.length === 1 ? '' : 'es'}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:flex-shrink-0">
          <SearchInput
            placeholder="Search clients…"
            className="w-full sm:w-56"
          />
          <ExportButton
            route={`/api/workspaces/${workspaceId}/clients/export`}
            extraParams={{ includeArchived: 'true' }}
          />
          <Link
            href={`/${workspaceId}/clients/new`}
            className={buttonVariants({ size: 'sm' })}
          >
            Add client
          </Link>
        </div>
      </header>

      {/* Status pills + sort + industry filter */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={hrefWith({ status: s === 'active' ? undefined : s })}
            className={`rounded-full border px-3 py-1 capitalize transition-colors ${
              statusFilter === s
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
            }`}
          >
            {s === 'all' ? 'All' : s}
          </Link>
        ))}

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        <SortMenu
          current={sort}
          hrefFor={(value) =>
            hrefWith({
              sort: value === 'recently_active' ? undefined : value,
            })
          }
        />

        {industryOptions.length > 0 && (
          <IndustryMenu
            current={industryFilter}
            options={industryOptions}
            hrefFor={(value) => hrefWith({ industry: value ?? undefined })}
          />
        )}

        {anyFilterActive && (
          <Link
            href={`/${workspaceId}/clients`}
            className="ml-1 text-muted-foreground hover:text-foreground"
          >
            Reset
          </Link>
        )}
      </div>

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
      ) : filteredClients.length === 0 ? (
        <EmptyState
          title={`No clients match "${searchQuery}"`}
          description="Try a shorter search, or clear it to see all clients."
          action={
            <Link
              href={`/${workspaceId}/clients`}
              className={`${buttonVariants({ size: 'sm', variant: 'outline' })}`}
            >
              Clear search
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {filteredClients.map((client) => {
                const health = healthById.get(client.id)!;
                const colors = HEALTH_COLORS[health.tier];
                const tooltip = health.reasons.join(' · ') || 'All signals good';
                return (
                  <li key={client.id}>
                    <Link
                      href={`/${workspaceId}/clients/${client.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Health dot. Archived clients render a dim grey
                            dot since their score is always 0 and that's
                            misleading without context. */}
                        <span
                          title={client.archivedAt ? 'Archived' : tooltip}
                          className={`inline-block size-2 shrink-0 rounded-full ${
                            client.archivedAt
                              ? 'bg-muted-foreground/40'
                              : colors.dot
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">
                              {client.name}
                            </span>
                            {client.archivedAt && (
                              <Badge variant="outline" className="text-xs">
                                Archived
                              </Badge>
                            )}
                            {!client.archivedAt &&
                              health.tier !== 'healthy' && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${colors.badge}`}
                                  title={tooltip}
                                >
                                  {colors.label} · {health.score}
                                </Badge>
                              )}
                          </div>
                          <ClientRowDetails
                            businessName={client.businessName}
                            industry={client.industry}
                            websiteUrl={client.websiteUrl}
                            platformId={platformIdSummary.get(client.id) ?? null}
                          />
                        </div>
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

/**
 * Sort menu rendered as a tiny inline `<details>`. No client-side
 * state — the `<a>` href changes the URL which re-renders the page
 * server-side. Keeps this page a single server component.
 */
function SortMenu({
  current,
  hrefFor,
}: {
  current: ClientsSort;
  hrefFor: (value: ClientsSort) => string;
}) {
  return (
    <details className="relative">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        Sort: <span className="text-foreground">{SORT_LABELS[current]}</span>
        <span aria-hidden>▾</span>
      </summary>
      <div className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-md border border-border bg-card p-1 text-xs shadow-md">
        {SORT_OPTIONS.map((s) => (
          <Link
            key={s}
            href={hrefFor(s)}
            className={`block rounded px-2 py-1.5 transition-colors hover:bg-muted ${
              current === s ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {SORT_LABELS[s]}
          </Link>
        ))}
      </div>
    </details>
  );
}

function IndustryMenu({
  current,
  options,
  hrefFor,
}: {
  current: string | null;
  options: string[];
  hrefFor: (value: string | null) => string;
}) {
  return (
    <details className="relative">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        Industry:{' '}
        <span className="text-foreground">{current ?? 'Any'}</span>
        <span aria-hidden>▾</span>
      </summary>
      <div className="absolute left-0 top-full z-20 mt-1 max-h-72 min-w-[12rem] overflow-y-auto rounded-md border border-border bg-card p-1 text-xs shadow-md">
        <Link
          href={hrefFor(null)}
          className={`block rounded px-2 py-1.5 transition-colors hover:bg-muted ${
            current === null ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          Any industry
        </Link>
        {options.map((opt) => (
          <Link
            key={opt}
            href={hrefFor(opt)}
            className={`block rounded px-2 py-1.5 transition-colors hover:bg-muted ${
              current === opt ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {opt}
          </Link>
        ))}
      </div>
    </details>
  );
}

/**
 * Per-row sub-line. Joins business name (when set), industry, the
 * truncated hostname, and the headline platform ID with `·`. Empty
 * fields are skipped — the line just disappears when the client has
 * none of these set.
 */
function ClientRowDetails({
  businessName,
  industry,
  websiteUrl,
  platformId,
}: {
  businessName: string | null;
  industry: string | null;
  websiteUrl: string | null;
  platformId: string | null;
}) {
  const host =
    websiteUrl && websiteUrl.length > 0
      ? websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
      : null;
  const segments = [
    businessName,
    industry,
    host,
    platformId,
  ].filter((s): s is string => typeof s === 'string' && s.length > 0);
  if (segments.length === 0) return null;
  return (
    <div className="mt-0.5 truncate text-xs text-muted-foreground">
      {segments.join(' · ')}
    </div>
  );
}
