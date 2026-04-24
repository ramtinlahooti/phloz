import { and, desc, eq, inArray, isNotNull, lt, not } from 'drizzle-orm';
import Link from 'next/link';

import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  EmptyState,
} from '@phloz/ui';

import { SearchInput } from '@/components/search-input';
import {
  HEALTH_COLORS,
  computeClientHealth,
  type HealthResult,
} from '@/lib/client-health';
import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Clients' });

type RouteParams = { workspace: string };
type ClientsSearchParams = { q?: string };

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
    // Overdue tasks with a client_id — count per client.
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
    // Tracking node health rollup per client.
    db
      .select({
        clientId: schema.trackingNodes.clientId,
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

  // Text search — matches on name, business_name, industry, and website.
  // Case-insensitive substring. Runs on the full client list (not just
  // active) so a search can surface archived matches too.
  const filteredClients = searchQuery
    ? clients.filter((c) => {
        const hay = [
          c.name,
          c.businessName,
          c.industry,
          c.websiteUrl,
          c.businessEmail,
        ]
          .filter((x): x is string => typeof x === 'string' && x.length > 0)
          .join(' ')
          .toLowerCase();
        return hay.includes(searchQuery);
      })
    : clients;

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
          <Link
            href={`/${workspaceId}/clients/new`}
            className={buttonVariants({ size: 'sm' })}
          >
            Add client
          </Link>
        </div>
      </header>

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
                          {client.businessName && (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {client.businessName}
                            </div>
                          )}
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
