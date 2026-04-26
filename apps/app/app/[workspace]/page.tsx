import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, not } from 'drizzle-orm';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  FilePlus2,
  Hourglass,
  ListChecks,
  Mail,
  MailOpen,
  MessageSquare,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import { requireRole } from '@phloz/auth/roles';
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

import {
  auditMap,
  type Finding,
  type TrackingEdgeDto,
  type TrackingNodeDto,
} from '@phloz/tracking-map';

import { AuditSparkline } from '@/components/audit-sparkline';

import { RunAuditButton } from './run-audit-button';
import {
  HEALTH_COLORS,
  computeClientHealth,
  type HealthResult,
} from '@/lib/client-health';
import { buildAppMetadata } from '@/lib/metadata';
import {
  computeOnboardingState,
  type OnboardingStep,
} from '@/lib/onboarding-checklist';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

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

const ACTIVITY_PAGE_SIZE = 30;
const ACTIVITY_MAX_SHOW = 240; // 8 pages — anything beyond is rarely useful

type ActivityFilter = 'all' | 'task' | 'message' | 'asset' | 'approval';
const ACTIVITY_FILTERS: ActivityFilter[] = [
  'all',
  'task',
  'message',
  'asset',
  'approval',
];
const ACTIVITY_LABELS: Record<ActivityFilter, string> = {
  all: 'All',
  task: 'Tasks',
  message: 'Messages',
  asset: 'Files',
  approval: 'Approvals',
};

function isActivityFilter(v: string | undefined): v is ActivityFilter {
  return !!v && (ACTIVITY_FILTERS as string[]).includes(v);
}

/** Parse `?activity_show=N`. Clamps to a sensible window so a stray
 *  hand-typed URL can't ask the server for 100k rows. Defaults to one
 *  page (30) when missing or malformed. */
function parseActivityShow(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < ACTIVITY_PAGE_SIZE) {
    return ACTIVITY_PAGE_SIZE;
  }
  return Math.min(parsed, ACTIVITY_MAX_SHOW);
}

type WorkspaceSearchParams = { activity?: string; activity_show?: string };

export default async function WorkspaceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<WorkspaceSearchParams>;
}) {
  const { workspace: workspaceId } = await params;
  // Hard guard against stray non-UUID segments (favicon.ico, robots.txt,
  // .well-known probes…). The layout has the same check but renders in
  // parallel — without this the page's Promise.all fires DB queries
  // with a malformed workspace id and burns Supabase pool connections.
  assertValidWorkspaceId(workspaceId);
  const sp = await searchParams;
  const activityFilter: ActivityFilter = isActivityFilter(sp.activity)
    ? sp.activity
    : 'all';
  const activityShow = parseActivityShow(sp.activity_show);
  // Role gates the "Run audit now" button on the audit rollup card —
  // owner/admin only because the resulting workspace-summary row
  // affects the dashboard for everyone.
  const actor = await requireRole(workspaceId, [
    'owner',
    'admin',
    'member',
    'viewer',
  ]);
  const isPrivileged = actor.role === 'owner' || actor.role === 'admin';
  const db = getDb();

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

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
    overdueTasks,
    dueThisWeekTasks,
    pendingApprovalTasks,
    allInboundMessages,
    allOutboundMessages,
    contactProbe,
    trackingNodeProbe,
    messageProbe,
    overdueTaskClientRows,
    trackingNodeRows,
    trackingEdgeRows,
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
          // Exclude subtasks — a task with 5 subtasks shouldn't count
          // as 6 open items. Same rule applies to every top-level
          // task query in this file.
          isNull(schema.tasks.parentTaskId),
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
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(desc(schema.tasks.updatedAt))
      .limit(activityShow),
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
      .limit(activityShow),
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
      .limit(activityShow),
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
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(desc(schema.tasks.approvalUpdatedAt))
      .limit(activityShow),
    // Clients: full rows needed so the health scorer has
    // last_activity_at + archived_at per client.
    db
      .select({
        id: schema.clients.id,
        name: schema.clients.name,
        archivedAt: schema.clients.archivedAt,
        lastActivityAt: schema.clients.lastActivityAt,
      })
      .from(schema.clients)
      .where(eq(schema.clients.workspaceId, workspaceId)),
    // Overdue: open tasks with a due_date in the past.
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        dueDate: schema.tasks.dueDate,
        clientId: schema.tasks.clientId,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
          isNotNull(schema.tasks.dueDate),
          lt(schema.tasks.dueDate, now),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(schema.tasks.dueDate)
      .limit(5),
    // Due this week: open tasks with due_date between now and +7d.
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        dueDate: schema.tasks.dueDate,
        clientId: schema.tasks.clientId,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
          isNotNull(schema.tasks.dueDate),
          gte(schema.tasks.dueDate, now),
          lte(schema.tasks.dueDate, weekFromNow),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(schema.tasks.dueDate)
      .limit(5),
    // Pending client approval: tasks we've asked the client to approve.
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        approvalUpdatedAt: schema.tasks.approvalUpdatedAt,
        clientId: schema.tasks.clientId,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          eq(schema.tasks.approvalState, 'pending'),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(desc(schema.tasks.approvalUpdatedAt))
      .limit(5),
    // For unreplied-inbound: fetch the last 60 days of messages per
    // direction. Volume is small at launch; when it isn't we can
    // rewrite as a SQL aggregate.
    db
      .select({
        id: schema.messages.id,
        clientId: schema.messages.clientId,
        createdAt: schema.messages.createdAt,
        subject: schema.messages.subject,
        body: schema.messages.body,
        channel: schema.messages.channel,
      })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.workspaceId, workspaceId),
          eq(schema.messages.direction, 'inbound'),
          // Exclude internal_note — those aren't from the client.
          not(eq(schema.messages.channel, 'internal_note')),
          gte(
            schema.messages.createdAt,
            new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .orderBy(desc(schema.messages.createdAt)),
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
    // Onboarding-checklist signals. Each is a presence probe (LIMIT 1)
    // rather than a full count — we only care whether any row exists.
    db
      .select({ id: schema.clientContacts.id })
      .from(schema.clientContacts)
      .where(eq(schema.clientContacts.workspaceId, workspaceId))
      .limit(1),
    db
      .select({ id: schema.trackingNodes.id })
      .from(schema.trackingNodes)
      .where(eq(schema.trackingNodes.workspaceId, workspaceId))
      .limit(1),
    db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(eq(schema.messages.workspaceId, workspaceId))
      .limit(1),
    // All overdue open tasks (client_id only). We already fetch the
    // top-5 for the widget above, but the health scorer needs the
    // full count per client.
    db
      .select({ clientId: schema.tasks.clientId })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
          isNotNull(schema.tasks.dueDate),
          lt(schema.tasks.dueDate, now),
          isNull(schema.tasks.parentTaskId),
        ),
      ),
    // Full tracking-node rows for the workspace — powers both the
    // client-health scorer (only needs healthStatus) and the audit-
    // rollup card (needs full node data to run auditMap per client).
    // One fetch, two uses.
    db
      .select()
      .from(schema.trackingNodes)
      .where(eq(schema.trackingNodes.workspaceId, workspaceId)),
    // Tracking edges — feeds the audit engine's orphan-gtm +
    // graph-shape rules.
    db
      .select()
      .from(schema.trackingEdges)
      .where(eq(schema.trackingEdges.workspaceId, workspaceId)),
  ]);

  if (!workspace) return null;

  // Last 8 workspace-summary audit_log rows (newest first). Two of
  // them feed the "↓ N critical from last run" trend line; all 8 feed
  // the inline sparkline that visualises the trajectory. Eight rows
  // ≈ two months of weekly history — enough for the sparkline to
  // mean something without making the card noisy.
  const recentAuditSummaries = await db
    .select({
      metadata: schema.auditLog.metadata,
      createdAt: schema.auditLog.createdAt,
    })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.workspaceId, workspaceId),
        eq(schema.auditLog.action, 'audit_run.workspace_summary'),
      ),
    )
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(8);

  const tier = getTier(workspace.tier);
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const nameFor = (id: string | null) =>
    id ? clientName.get(id) ?? null : null;

  // Unreplied inbound: for each client, the most recent inbound message
  // is newer than any outbound message we've sent. Surfaces the "client
  // emailed us, we haven't answered" backlog without needing a complex
  // SQL aggregate.
  const lastOutboundByClient = new Map<string, Date>();
  for (const m of allOutboundMessages) {
    if (!m.clientId) continue;
    const existing = lastOutboundByClient.get(m.clientId);
    if (!existing || m.createdAt > existing) {
      lastOutboundByClient.set(m.clientId, m.createdAt);
    }
  }
  const seenClients = new Set<string>();
  const unrepliedInbound: {
    id: string;
    clientId: string;
    clientName: string;
    at: Date;
    preview: string;
  }[] = [];
  for (const m of allInboundMessages) {
    if (!m.clientId || seenClients.has(m.clientId)) continue;
    const lastOut = lastOutboundByClient.get(m.clientId) ?? null;
    if (lastOut === null || m.createdAt > lastOut) {
      seenClients.add(m.clientId);
      unrepliedInbound.push({
        id: m.id,
        clientId: m.clientId,
        clientName: nameFor(m.clientId) ?? 'Unknown',
        at: m.createdAt,
        preview: (m.subject ?? m.body).slice(0, 80),
      });
    }
  }
  unrepliedInbound.sort((a, b) => a.at.getTime() - b.at.getTime()); // oldest waiting first
  const topUnreplied = unrepliedInbound.slice(0, 5);

  const onboarding = computeOnboardingState({
    workspaceId,
    clientCount: clientRows.length,
    hasContact: contactProbe.length > 0,
    hasTask: recentTasks.length > 0,
    hasTrackingNode: trackingNodeProbe.length > 0,
    hasMessage: messageProbe.length > 0,
    memberCount,
  });

  // Per-client health aggregation for the "Needs attention" card.
  // Uses the same scorer + weights as /clients so the numbers line up
  // across pages.
  const overdueCountByClient = new Map<string, number>();
  for (const t of overdueTaskClientRows) {
    if (!t.clientId) continue;
    overdueCountByClient.set(
      t.clientId,
      (overdueCountByClient.get(t.clientId) ?? 0) + 1,
    );
  }
  const unrepliedCountByClient = new Map<string, number>();
  for (const u of unrepliedInbound) {
    unrepliedCountByClient.set(
      u.clientId,
      (unrepliedCountByClient.get(u.clientId) ?? 0) + 1,
    );
  }
  const brokenNodeCountByClient = new Map<string, number>();
  const missingNodeCountByClient = new Map<string, number>();
  for (const n of trackingNodeRows) {
    if (!n.clientId) continue;
    if (n.healthStatus === 'broken') {
      brokenNodeCountByClient.set(
        n.clientId,
        (brokenNodeCountByClient.get(n.clientId) ?? 0) + 1,
      );
    } else if (n.healthStatus === 'missing') {
      missingNodeCountByClient.set(
        n.clientId,
        (missingNodeCountByClient.get(n.clientId) ?? 0) + 1,
      );
    }
  }

  type AttentionEntry = {
    id: string;
    name: string;
    health: HealthResult;
  };
  const nonHealthy: AttentionEntry[] = [];
  for (const c of clientRows) {
    if (c.archivedAt !== null) continue;
    const health = computeClientHealth({
      archived: false,
      lastActivityAt: c.lastActivityAt,
      overdueTaskCount: overdueCountByClient.get(c.id) ?? 0,
      unrepliedInboundCount: unrepliedCountByClient.get(c.id) ?? 0,
      brokenNodeCount: brokenNodeCountByClient.get(c.id) ?? 0,
      missingNodeCount: missingNodeCountByClient.get(c.id) ?? 0,
    });
    if (health.tier === 'healthy') continue;
    nonHealthy.push({ id: c.id, name: c.name, health });
  }
  // Worst first. `needs_attention` beats `at_risk` on tier; within a
  // tier, lower score wins.
  nonHealthy.sort((a, b) => {
    if (a.health.tier !== b.health.tier) {
      return a.health.tier === 'needs_attention' ? -1 : 1;
    }
    return a.health.score - b.health.score;
  });
  const attentionClients = nonHealthy.slice(0, 5);

  // Group nodes + edges by clientId, then run auditMap per client.
  // Kept on the dashboard (not a separate route) so Ramtin sees the
  // moat feature on every login without having to click through to
  // a client. Cheap at launch scale (<100 clients × <50 nodes).
  const nodesByClient = new Map<string, TrackingNodeDto[]>();
  for (const n of trackingNodeRows) {
    if (!n.clientId) continue;
    const list = nodesByClient.get(n.clientId) ?? [];
    list.push({
      id: n.id,
      clientId: n.clientId,
      workspaceId: n.workspaceId,
      nodeType: n.nodeType,
      label: n.label,
      metadata: (n.metadata as Record<string, unknown>) ?? {},
      healthStatus: n.healthStatus,
      lastVerifiedAt: n.lastVerifiedAt,
      position: n.position ?? null,
    });
    nodesByClient.set(n.clientId, list);
  }
  const edgesByClient = new Map<string, TrackingEdgeDto[]>();
  for (const e of trackingEdgeRows) {
    if (!e.clientId) continue;
    const list = edgesByClient.get(e.clientId) ?? [];
    list.push({
      id: e.id,
      clientId: e.clientId,
      workspaceId: e.workspaceId,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      edgeType: e.edgeType,
      label: e.label,
      metadata: (e.metadata as Record<string, unknown>) ?? {},
    });
    edgesByClient.set(e.clientId, list);
  }

  type AuditRollupEntry = {
    id: string;
    name: string;
    findings: Finding[];
    criticalCount: number;
    warningCount: number;
  };
  const auditRollup: AuditRollupEntry[] = [];
  let totalCritical = 0;
  let totalWarning = 0;
  for (const c of clientRows) {
    if (c.archivedAt !== null) continue;
    const findings = auditMap({
      nodes: nodesByClient.get(c.id) ?? [],
      edges: edgesByClient.get(c.id) ?? [],
    });
    const criticals = findings.filter((f) => f.severity === 'critical').length;
    const warnings = findings.filter((f) => f.severity === 'warning').length;
    // Skip clients with only `info` findings — too low-signal for the
    // dashboard card. They still show the Audit tab with advice.
    if (criticals + warnings === 0) continue;
    totalCritical += criticals;
    totalWarning += warnings;
    auditRollup.push({
      id: c.id,
      name: c.name,
      findings,
      criticalCount: criticals,
      warningCount: warnings,
    });
  }
  // Most-critical-first; within a severity bucket more findings wins.
  auditRollup.sort((a, b) => {
    if (a.criticalCount !== b.criticalCount) {
      return b.criticalCount - a.criticalCount;
    }
    return b.warningCount - a.warningCount;
  });
  const topAuditEntries = auditRollup.slice(0, 4);

  // Compute the audit trend vs last week's cron run. The newest row
  // is the latest persisted snapshot — ideally last week's cron, but
  // any prior pass works; we treat the second row as "previous" and
  // show the delta. Skip the trend display if there's no prior row.
  const previousAuditSnapshot = recentAuditSummaries[1] ?? null;
  const previousAuditMeta =
    (previousAuditSnapshot?.metadata as
      | { critical?: number; warning?: number }
      | undefined) ?? null;
  const auditTrend =
    previousAuditMeta &&
    typeof previousAuditMeta.critical === 'number' &&
    typeof previousAuditMeta.warning === 'number'
      ? {
          previousCritical: previousAuditMeta.critical,
          previousWarning: previousAuditMeta.warning,
          previousAt: previousAuditSnapshot?.createdAt ?? null,
        }
      : null;

  // Sparkline series: oldest → newest, critical-count per snapshot.
  // We pull from the same `recentAuditSummaries` (newest-first) and
  // reverse for chronological order. Skipped when fewer than two
  // datapoints exist — a single bar isn't a trend.
  const auditSparkline =
    recentAuditSummaries.length >= 2
      ? recentAuditSummaries
          .slice()
          .reverse()
          .map((r) => {
            const meta =
              (r.metadata as { critical?: number; warning?: number }) ?? {};
            return {
              critical: typeof meta.critical === 'number' ? meta.critical : 0,
              warning: typeof meta.warning === 'number' ? meta.warning : 0,
            };
          })
      : null;

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
  // Optional kind filter from `?activity=`. Apply BEFORE the slice so
  // a busy task week doesn't push messages off the feed when the
  // user has filtered to messages.
  const filteredFeed =
    activityFilter === 'all'
      ? feed
      : feed.filter((item) => item.kind === activityFilter);
  const trimmed = filteredFeed.slice(0, activityShow);
  // Show the "Show more" affordance when (a) the slice was bounded by
  // activityShow rather than by exhausted history, and (b) we haven't
  // already hit the safety cap. The first signal is approximate — we
  // can't tell server-side whether the source queries themselves were
  // capped, but if `filteredFeed.length >= activityShow` it's almost
  // certainly the case that more rows exist somewhere.
  const hasMoreActivity =
    filteredFeed.length >= activityShow && activityShow < ACTIVITY_MAX_SHOW;
  const nextActivityShow = Math.min(
    activityShow + ACTIVITY_PAGE_SIZE,
    ACTIVITY_MAX_SHOW,
  );
  const moreActivityHref = (() => {
    const params = new URLSearchParams();
    if (activityFilter !== 'all') params.set('activity', activityFilter);
    params.set('activity_show', String(nextActivityShow));
    return `/${workspaceId}?${params.toString()}`;
  })();

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

      {/* This week — what needs attention. Shown above the vanity
          counters because these are action prompts, not just metrics. */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          This week
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AttentionCard
            tone="red"
            icon={AlertTriangle}
            title="Overdue"
            count={overdueTasks.length}
            items={overdueTasks.map((t) => ({
              id: t.id,
              title: t.title,
              subtitle:
                t.dueDate !== null
                  ? `${daysAgo(t.dueDate)}d overdue${
                      t.clientId
                        ? ` · ${nameFor(t.clientId) ?? ''}`
                        : ''
                    }`
                  : undefined,
              // Deep-link via ?task=<id> so the detail dialog opens
              // directly on the destination page.
              href: t.clientId
                ? `/${workspaceId}/clients/${t.clientId}?task=${t.id}`
                : `/${workspaceId}/tasks?task=${t.id}`,
            }))}
            ctaHref={`/${workspaceId}/tasks?status=todo`}
            ctaLabel="See all tasks"
            emptyLabel="Nothing overdue — nice."
          />
          <AttentionCard
            tone="amber"
            icon={CalendarClock}
            title="Due this week"
            count={dueThisWeekTasks.length}
            items={dueThisWeekTasks.map((t) => ({
              id: t.id,
              title: t.title,
              subtitle:
                t.dueDate !== null
                  ? `${daysUntil(t.dueDate)}${
                      t.clientId
                        ? ` · ${nameFor(t.clientId) ?? ''}`
                        : ''
                    }`
                  : undefined,
              // Deep-link via ?task=<id> so the detail dialog opens
              // directly on the destination page.
              href: t.clientId
                ? `/${workspaceId}/clients/${t.clientId}?task=${t.id}`
                : `/${workspaceId}/tasks?task=${t.id}`,
            }))}
            ctaHref={`/${workspaceId}/tasks?sort=due_soonest`}
            ctaLabel="Sort by due"
            emptyLabel="Clear runway this week."
          />
          <AttentionCard
            tone="primary"
            icon={Hourglass}
            title="Pending client approval"
            count={pendingApprovalTasks.length}
            items={pendingApprovalTasks.map((t) => ({
              id: t.id,
              title: t.title,
              subtitle: t.clientId
                ? (nameFor(t.clientId) ?? undefined)
                : undefined,
              // Deep-link via ?task=<id> so the detail dialog opens
              // directly on the destination page.
              href: t.clientId
                ? `/${workspaceId}/clients/${t.clientId}?task=${t.id}`
                : `/${workspaceId}/tasks?task=${t.id}`,
            }))}
            ctaHref={`/${workspaceId}/tasks`}
            ctaLabel="View approvals"
            emptyLabel="No pending approvals."
          />
          <AttentionCard
            tone="purple"
            icon={MailOpen}
            title="Waiting on a reply"
            count={topUnreplied.length}
            items={topUnreplied.map((u) => ({
              id: u.id,
              title: u.preview,
              subtitle: `${u.clientName} · ${daysAgo(u.at)}d waiting`,
              href: `/${workspaceId}/clients/${u.clientId}`,
            }))}
            ctaHref={`/${workspaceId}/messages`}
            ctaLabel="Open inbox"
            emptyLabel="Inbox is clear."
          />
        </div>
      </section>

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent activity
            </h2>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {ACTIVITY_FILTERS.map((f) => {
                const isActive = activityFilter === f;
                const href =
                  f === 'all'
                    ? `/${workspaceId}`
                    : `/${workspaceId}?activity=${f}`;
                return (
                  <Link
                    key={f}
                    href={href}
                    className={`rounded-full border px-2.5 py-0.5 transition-colors ${
                      isActive
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
                    }`}
                  >
                    {ACTIVITY_LABELS[f]}
                  </Link>
                );
              })}
            </div>
          </div>
          {trimmed.length === 0 ? (
            <EmptyState
              title={
                activityFilter === 'all'
                  ? 'Nothing has happened yet'
                  : `No ${ACTIVITY_LABELS[activityFilter].toLowerCase()} yet`
              }
              description={
                activityFilter === 'all'
                  ? 'Add a client, post a note, upload a file — this feed will catch it.'
                  : 'Switch the filter back to All or try a different category.'
              }
            />
          ) : (
            <>
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
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {trimmed.length}
                  {activityShow > ACTIVITY_PAGE_SIZE && (
                    <> of the most recent {activityShow}</>
                  )}
                </span>
                {hasMoreActivity && (
                  <Link
                    href={moreActivityHref}
                    className="rounded-md border border-border bg-card px-3 py-1 hover:border-primary/60 hover:text-foreground"
                  >
                    Show {nextActivityShow - activityShow} more
                  </Link>
                )}
                {!hasMoreActivity && activityShow >= ACTIVITY_MAX_SHOW && (
                  <span className="opacity-70">
                    Reached the {ACTIVITY_MAX_SHOW}-item view cap
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right rail — onboarding (while incomplete) + attention +
            plan */}
        <div className="space-y-6">
          {!onboarding.complete && (
            <OnboardingCard
              steps={onboarding.steps}
              doneCount={onboarding.doneCount}
              totalCount={onboarding.totalCount}
              nextStep={onboarding.nextStep}
            />
          )}
          {attentionClients.length > 0 && (
            <AttentionClientsCard
              clients={attentionClients}
              workspaceId={workspaceId}
            />
          )}
          {topAuditEntries.length > 0 && (
            <AuditRollupCard
              clients={topAuditEntries}
              totalCritical={totalCritical}
              totalWarning={totalWarning}
              workspaceId={workspaceId}
              trend={auditTrend}
              sparkline={auditSparkline}
              canRunAudit={isPrivileged}
            />
          )}
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

// --- This-week widget ------------------------------------------------

type AttentionItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

type AttentionTone = 'red' | 'amber' | 'primary' | 'purple';

const ATTENTION_STYLES: Record<
  AttentionTone,
  { icon: string; count: string; ring: string }
> = {
  red: {
    icon: 'text-red-400',
    count: 'text-red-400',
    ring: 'ring-red-400/30',
  },
  amber: {
    icon: 'text-amber-400',
    count: 'text-amber-400',
    ring: 'ring-amber-400/30',
  },
  primary: {
    icon: 'text-primary',
    count: 'text-primary',
    ring: 'ring-primary/30',
  },
  purple: {
    icon: 'text-purple-400',
    count: 'text-purple-400',
    ring: 'ring-purple-400/30',
  },
};

function AttentionCard({
  tone,
  icon: Icon,
  title,
  count,
  items,
  ctaHref,
  ctaLabel,
  emptyLabel,
}: {
  tone: AttentionTone;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  items: AttentionItem[];
  ctaHref: string;
  ctaLabel: string;
  emptyLabel: string;
}) {
  const styles = ATTENTION_STYLES[tone];
  const zero = count === 0;

  return (
    <Card
      className={`flex flex-col ${zero ? '' : `ring-1 ${styles.ring}`}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Icon className={`size-3.5 ${styles.icon}`} />
            {title}
          </CardTitle>
          <span className={`text-xl font-semibold ${zero ? 'text-muted-foreground' : styles.count}`}>
            {count}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {zero ? (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 3).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block text-xs leading-tight text-foreground/90 transition-colors hover:text-primary"
                >
                  <span className="line-clamp-1 font-medium">{item.title}</span>
                  {item.subtitle && (
                    <span className="line-clamp-1 text-muted-foreground">
                      {item.subtitle}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {!zero && (
        <div className="border-t border-border/60 px-6 py-2">
          <Link
            href={ctaHref}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {ctaLabel} →
          </Link>
        </div>
      )}
    </Card>
  );
}

function daysAgo(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

function daysUntil(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return 'overdue';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days}d`;
}

// --- Onboarding checklist card ---------------------------------------

/** Dashboard rollup of tracking-audit findings across all clients.
 *  Only renders when at least one active client has a critical or
 *  warning finding — info-only is too low-signal for the dashboard. */
function AuditRollupCard({
  clients,
  totalCritical,
  totalWarning,
  workspaceId,
  trend,
  sparkline,
  canRunAudit,
}: {
  clients: {
    id: string;
    name: string;
    criticalCount: number;
    warningCount: number;
  }[];
  totalCritical: number;
  totalWarning: number;
  workspaceId: string;
  /** Most recent persisted audit snapshot (from the weekly Inngest
   *  cron). When set, the card renders a delta vs that snapshot. */
  trend: {
    previousCritical: number;
    previousWarning: number;
    previousAt: Date | null;
  } | null;
  /** Oldest → newest critical/warning counts from up to 8 recent
   *  weekly snapshots. Renders an inline SVG sparkline when set
   *  + length >= 2. */
  sparkline: Array<{ critical: number; warning: number }> | null;
  /** Owner/admin only. Shows a small "Run now" button that fires
   *  the cron event for this workspace. */
  canRunAudit: boolean;
}) {
  const summary = [
    totalCritical > 0 &&
      `${totalCritical} critical`,
    totalWarning > 0 &&
      `${totalWarning} warning${totalWarning === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const trendLine = trend ? renderAuditTrend(trend, totalCritical, totalWarning) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <AlertTriangle
              className={`size-3.5 ${
                totalCritical > 0 ? 'text-red-400' : 'text-amber-400'
              }`}
              aria-hidden
            />
            Tracking audit
          </span>
          {canRunAudit && <RunAuditButton workspaceId={workspaceId} />}
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>
        {trendLine && (
          <p className="mt-1 text-[11px] text-muted-foreground">{trendLine}</p>
        )}
        {sparkline && sparkline.length >= 2 && (
          <div className="mt-2">
            <AuditSparkline series={sparkline} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <ul className="space-y-1.5">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/${workspaceId}/clients/${c.id}?tab=audit`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {c.name}
                </span>
                <span className="shrink-0 text-[10px]">
                  {c.criticalCount > 0 && (
                    <span className="text-red-400">
                      {c.criticalCount} critical
                    </span>
                  )}
                  {c.criticalCount > 0 && c.warningCount > 0 && (
                    <span className="mx-1 text-muted-foreground">·</span>
                  )}
                  {c.warningCount > 0 && (
                    <span className="text-amber-400">
                      {c.warningCount} warning
                      {c.warningCount === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="pt-1 text-xs">
          <Link
            href={`/${workspaceId}/clients`}
            className="text-muted-foreground hover:text-foreground"
          >
            Review each client →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionClientsCard({
  clients,
  workspaceId,
}: {
  clients: { id: string; name: string; health: HealthResult }[];
  workspaceId: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Clients needing attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <ul className="space-y-1.5">
          {clients.map(({ id, name, health }) => {
            const colors = HEALTH_COLORS[health.tier];
            const reasons = health.reasons.slice(0, 2).join(' · ');
            return (
              <li key={id}>
                <Link
                  href={`/${workspaceId}/clients/${id}`}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                  title={health.reasons.join(' · ')}
                >
                  <span
                    className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${colors.dot}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {name}
                      </span>
                      <span
                        className={`shrink-0 text-[10px] ${colors.badge.replace('border-', '').replace('/50', '')}`}
                      >
                        {health.score}
                      </span>
                    </div>
                    {reasons && (
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {reasons}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="pt-1 text-xs">
          <Link
            href={`/${workspaceId}/clients`}
            className="text-muted-foreground hover:text-foreground"
          >
            See all clients →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingCard({
  steps,
  doneCount,
  totalCount,
  nextStep,
}: {
  steps: OnboardingStep[];
  doneCount: number;
  totalCount: number;
  nextStep: OnboardingStep | null;
}) {
  const pct = Math.round((doneCount / totalCount) * 100);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Setup checklist</CardTitle>
          <span className="text-xs font-medium text-muted-foreground">
            {doneCount} / {totalCount}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <ul className="space-y-1">
          {steps.map((step) => {
            const isNext = nextStep?.id === step.id;
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50 ${
                    isNext ? 'bg-primary/5' : ''
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-[var(--color-health-working)]"
                      aria-hidden
                    />
                  ) : (
                    <Circle
                      className={`mt-0.5 size-4 shrink-0 ${
                        isNext ? 'text-primary' : 'text-muted-foreground'
                      }`}
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className={`flex items-center gap-2 ${
                        step.done
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                      }`}
                    >
                      <span>{step.title}</span>
                      {isNext && (
                        <ArrowRight className="size-3 text-primary" aria-hidden />
                      )}
                    </div>
                    {!step.done && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {step.description}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        {nextStep === null && (
          // Reached only in the transient "just completed last step" window
          // before the caller hides this card on next render. Stay friendly.
          <p className="pt-2 text-xs text-muted-foreground">
            You&apos;re set up. Nice work.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Build the "trend vs last week" sub-line for the audit rollup.
 * Returns null when nothing has changed AND the previous run had
 * no findings either — there's nothing useful to say.
 *
 * Wording rules:
 *   - Negative delta (fewer findings) → "↓ N critical from last run"
 *   - Positive delta → "↑ N critical from last run"
 *   - Same → "no change from last run"
 */
function renderAuditTrend(
  trend: {
    previousCritical: number;
    previousWarning: number;
    previousAt: Date | null;
  },
  currentCritical: number,
  currentWarning: number,
): string | null {
  const dCritical = currentCritical - trend.previousCritical;
  const dWarning = currentWarning - trend.previousWarning;
  if (dCritical === 0 && dWarning === 0 && currentCritical === 0 && currentWarning === 0) {
    return null;
  }
  const arrow = (delta: number) => (delta < 0 ? '↓' : delta > 0 ? '↑' : '·');
  const segments: string[] = [];
  if (dCritical !== 0) {
    segments.push(`${arrow(dCritical)} ${Math.abs(dCritical)} critical`);
  }
  if (dWarning !== 0) {
    segments.push(`${arrow(dWarning)} ${Math.abs(dWarning)} warning`);
  }
  if (segments.length === 0) {
    return 'No change from last run';
  }
  return `${segments.join(' · ')} from last run`;
}

