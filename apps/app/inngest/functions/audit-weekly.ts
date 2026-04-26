import { and, eq, isNull } from 'drizzle-orm';

import { getDb, schema } from '@phloz/db/client';
import {
  auditMap,
  type TrackingEdgeDto,
  type TrackingNodeDto,
} from '@phloz/tracking-map';

import { inngest } from '../client';

/**
 * Weekly audit run. Iterates every active client across every
 * workspace, runs the in-process `auditMap()` over each one's
 * tracking nodes + edges, applies that client's suppressions, and
 * emits a single `audit_log` row per client with the finding-count
 * breakdown. The dashboard's audit rollup card already runs the
 * same engine on every page render — this cron exists for
 * historical-trend tracking, not realtime correctness.
 *
 * Output rows per client (action = 'audit_run.client_summary'):
 *   {
 *     critical: number,
 *     warning: number,
 *     info: number,
 *     suppressed: number,
 *     total_nodes: number,
 *     total_edges: number,
 *   }
 *
 * Plus one workspace-level summary row at the end of each
 * workspace's pass (action = 'audit_run.workspace_summary') that
 * aggregates across clients — handy for the "trend over time"
 * graph that the dashboard will eventually pick up.
 *
 * Cron fires Monday 08:00 UTC. Manual trigger:
 * `audit/run-weekly` event with optional `{ workspaceId }`.
 */
const AUDIT_CRON = 'TZ=UTC 0 8 * * 1';

export const auditWeeklyFunction = inngest.createFunction(
  {
    id: 'audit-weekly',
    name: 'Weekly tracking-map audit',
    concurrency: { limit: 4 },
    retries: 2,
    triggers: [{ cron: AUDIT_CRON }, { event: 'audit/run-weekly' }],
  },
  async ({ event, step }) => {
    const db = getDb();

    const eventData = (event?.data ?? {}) as { workspaceId?: string };
    const targeted =
      event?.name === 'audit/run-weekly' ? eventData.workspaceId : undefined;

    const workspaces = await step.run('load-workspaces', async () => {
      const rows = targeted
        ? await db
            .select({ id: schema.workspaces.id })
            .from(schema.workspaces)
            .where(eq(schema.workspaces.id, targeted))
        : await db.select({ id: schema.workspaces.id }).from(schema.workspaces);
      return rows;
    });

    let totalClientsAudited = 0;
    let totalCritical = 0;
    let totalWarning = 0;
    const perWorkspace: Array<{
      workspaceId: string;
      clientsAudited: number;
      critical: number;
      warning: number;
    }> = [];

    for (const ws of workspaces) {
      const summary = await step.run(`audit-${ws.id}`, async () => {
        return runWorkspaceAudit(ws.id);
      });
      totalClientsAudited += summary.clientsAudited;
      totalCritical += summary.critical;
      totalWarning += summary.warning;
      perWorkspace.push({ workspaceId: ws.id, ...summary });
    }

    return {
      scanned: workspaces.length,
      clientsAudited: totalClientsAudited,
      criticalFindings: totalCritical,
      warningFindings: totalWarning,
      perWorkspace,
    };
  },
);

interface WorkspaceAuditSummary {
  clientsAudited: number;
  critical: number;
  warning: number;
}

async function runWorkspaceAudit(
  workspaceId: string,
): Promise<WorkspaceAuditSummary> {
  const db = getDb();

  // Workspace-wide fetch of every input the audit needs, grouped
  // client-side so we don't hit the DB once per client.
  const [clientRows, trackingNodeRows, trackingEdgeRows, suppressionRows] =
    await Promise.all([
      db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(
          and(
            eq(schema.clients.workspaceId, workspaceId),
            isNull(schema.clients.archivedAt),
          ),
        ),
      db
        .select()
        .from(schema.trackingNodes)
        .where(eq(schema.trackingNodes.workspaceId, workspaceId)),
      db
        .select()
        .from(schema.trackingEdges)
        .where(eq(schema.trackingEdges.workspaceId, workspaceId)),
      db
        .select({
          clientId: schema.auditSuppressions.clientId,
          ruleId: schema.auditSuppressions.ruleId,
        })
        .from(schema.auditSuppressions)
        .where(eq(schema.auditSuppressions.workspaceId, workspaceId)),
    ]);

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

  const suppressedByClient = new Map<string, Set<string>>();
  for (const s of suppressionRows) {
    if (!s.clientId) continue;
    const set = suppressedByClient.get(s.clientId) ?? new Set<string>();
    set.add(s.ruleId);
    suppressedByClient.set(s.clientId, set);
  }

  const summaryRows: Array<typeof schema.auditLog.$inferInsert> = [];
  let totalCritical = 0;
  let totalWarning = 0;

  for (const c of clientRows) {
    const nodes = nodesByClient.get(c.id) ?? [];
    const edges = edgesByClient.get(c.id) ?? [];
    const allFindings = auditMap({ nodes, edges });
    const suppressed = suppressedByClient.get(c.id) ?? new Set<string>();
    const visible = allFindings.filter((f) => !suppressed.has(f.ruleId));

    const counts = {
      critical: visible.filter((f) => f.severity === 'critical').length,
      warning: visible.filter((f) => f.severity === 'warning').length,
      info: visible.filter((f) => f.severity === 'info').length,
      suppressed: allFindings.length - visible.length,
      total_nodes: nodes.length,
      total_edges: edges.length,
    };
    totalCritical += counts.critical;
    totalWarning += counts.warning;

    summaryRows.push({
      workspaceId,
      actorType: 'system',
      actorId: null,
      action: 'audit_run.client_summary',
      entityType: 'client',
      entityId: c.id,
      metadata: counts,
    });
  }

  // Workspace-level summary closes the run with the rollup the
  // dashboard already shows live — preserved here for trend graphs.
  summaryRows.push({
    workspaceId,
    actorType: 'system',
    actorId: null,
    action: 'audit_run.workspace_summary',
    entityType: 'tracking_map',
    entityId: null,
    metadata: {
      clients_audited: clientRows.length,
      critical: totalCritical,
      warning: totalWarning,
      ran_at: new Date().toISOString(),
    },
  });

  if (summaryRows.length > 0) {
    await db.insert(schema.auditLog).values(summaryRows);
  }

  return {
    clientsAudited: clientRows.length,
    critical: totalCritical,
    warning: totalWarning,
  };
}
