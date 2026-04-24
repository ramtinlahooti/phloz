import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  not,
} from 'drizzle-orm';

import { createServiceRoleSupabase } from '@phloz/auth/server';
import { getDb, schema } from '@phloz/db/client';
import { sendDailyDigest } from '@phloz/email';
import {
  auditMap,
  type TrackingEdgeDto,
  type TrackingNodeDto,
} from '@phloz/tracking-map';

import { inngest } from '../client';

/**
 * Daily digest email. Runs once a day at 09:00 UTC and also fires
 * on-demand via the `digest/send-daily` event (useful for testing).
 *
 * V1 audience: only the workspace owner. Per-member digests +
 * per-user opt-out land in V2 — requires a new settings column and
 * timezone plumbing. For now the email itself tells the recipient
 * they can reply to opt out, which gives us a manual safety valve.
 *
 * Skips sending when there's nothing actionable in the workspace.
 * No point filling an inbox with "all clear" messages every morning.
 */
const DIGEST_CRON = 'TZ=UTC 0 9 * * *';

export const sendDailyDigestFunction = inngest.createFunction(
  {
    id: 'send-daily-digest',
    name: 'Send daily digest',
    concurrency: { limit: 4 },
    retries: 2,
    triggers: [
      { cron: DIGEST_CRON },
      { event: 'digest/send-daily' },
    ],
  },
  async ({ event, step }) => {
    const db = getDb();

    // On-demand trigger can target one workspace; cron hits all.
    const eventData = (event?.data ?? {}) as { workspaceId?: string };
    const targeted =
      event?.name === 'digest/send-daily' ? eventData.workspaceId : undefined;

    const workspaces = await step.run('load-workspaces', async () => {
      const rows = targeted
        ? await db
            .select()
            .from(schema.workspaces)
            .where(eq(schema.workspaces.id, targeted))
        : await db.select().from(schema.workspaces);
      return rows;
    });

    const results: Array<{
      workspaceId: string;
      ownerUserId: string | null;
      sent: boolean;
      reason?: string;
    }> = [];

    for (const ws of workspaces) {
      const result = await step.run(`digest-${ws.id}`, async () => {
        return runDigestForWorkspace(ws);
      });
      results.push(result);
    }

    return {
      scanned: workspaces.length,
      sent: results.filter((r) => r.sent).length,
      skipped: results.filter((r) => !r.sent).length,
      results,
    };
  },
);

/**
 * Compose + send the digest for one workspace. Called once per
 * workspace per run.
 *
 * The data shape here mirrors the dashboard's "This week" widget +
 * audit rollup card so users see the same numbers in the email as
 * they see when they click through.
 *
 * Takes `WorkspaceInput` (not the full schema row) because Inngest's
 * `step.run` serialises its arguments through JSON — Date fields
 * arrive as strings. We only need three columns here, so narrow
 * explicitly.
 */
interface WorkspaceInput {
  id: string;
  name: string;
  ownerUserId: string | null;
}

async function runDigestForWorkspace(
  ws: WorkspaceInput,
): Promise<{
  workspaceId: string;
  ownerUserId: string | null;
  sent: boolean;
  reason?: string;
}> {
  const db = getDb();

  if (!ws.ownerUserId) {
    return {
      workspaceId: ws.id,
      ownerUserId: null,
      sent: false,
      reason: 'no_owner',
    };
  }

  // Resolve the owner's email via Supabase admin — auth.users isn't
  // mirrored into our schema, so service-role is the cleanest path.
  const admin = await createServiceRoleSupabase();
  const ownerLookup = await admin.auth.admin.getUserById(ws.ownerUserId);
  const ownerEmail = ownerLookup.data.user?.email;
  const ownerName =
    (ownerLookup.data.user?.user_metadata?.full_name as string | undefined) ??
    ownerLookup.data.user?.email ??
    'there';
  if (!ownerEmail) {
    return {
      workspaceId: ws.id,
      ownerUserId: ws.ownerUserId,
      sent: false,
      reason: 'owner_email_missing',
    };
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [
    overdueTasks,
    dueTodayTasks,
    pendingApprovalTasks,
    clientRows,
    inboundMessages,
    outboundMessages,
    trackingNodeRows,
    trackingEdgeRows,
  ] = await Promise.all([
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
          eq(schema.tasks.workspaceId, ws.id),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
          isNotNull(schema.tasks.dueDate),
          lt(schema.tasks.dueDate, startOfToday),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(schema.tasks.dueDate)
      .limit(10),
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
          eq(schema.tasks.workspaceId, ws.id),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
          gte(schema.tasks.dueDate, startOfToday),
          lte(schema.tasks.dueDate, endOfToday),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(schema.tasks.dueDate)
      .limit(10),
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        clientId: schema.tasks.clientId,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, ws.id),
          eq(schema.tasks.approvalState, 'pending'),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(desc(schema.tasks.approvalUpdatedAt))
      .limit(10),
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.workspaceId, ws.id),
          isNull(schema.clients.archivedAt),
        ),
      ),
    db
      .select({
        id: schema.messages.id,
        clientId: schema.messages.clientId,
        createdAt: schema.messages.createdAt,
        subject: schema.messages.subject,
        body: schema.messages.body,
      })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.workspaceId, ws.id),
          eq(schema.messages.direction, 'inbound'),
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
          eq(schema.messages.workspaceId, ws.id),
          eq(schema.messages.direction, 'outbound'),
          not(eq(schema.messages.channel, 'internal_note')),
        ),
      ),
    db
      .select()
      .from(schema.trackingNodes)
      .where(eq(schema.trackingNodes.workspaceId, ws.id)),
    db
      .select()
      .from(schema.trackingEdges)
      .where(eq(schema.trackingEdges.workspaceId, ws.id)),
  ]);

  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const nameFor = (id: string | null) =>
    id ? clientName.get(id) ?? null : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com';

  const taskHref = (clientId: string | null, taskId: string) =>
    clientId
      ? `${appUrl}/${ws.id}/clients/${clientId}?task=${taskId}`
      : `${appUrl}/${ws.id}/tasks?task=${taskId}`;

  const formatDueSubtitle = (
    dueDate: Date | null,
    clientId: string | null,
    mode: 'overdue' | 'due-today',
  ) => {
    const clientBit = clientId ? nameFor(clientId) ?? '' : '';
    if (mode === 'overdue' && dueDate) {
      const days = Math.max(
        0,
        Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      return [clientBit, `${days}d overdue`].filter(Boolean).join(' · ');
    }
    if (mode === 'due-today') {
      return clientBit || undefined;
    }
    return clientBit || undefined;
  };

  // Unreplied inbound: per-client, count messages newer than the
  // last outbound. Same logic the inbox + dashboard use.
  const lastOutboundByClient = new Map<string, Date>();
  for (const m of outboundMessages) {
    if (!m.clientId) continue;
    const existing = lastOutboundByClient.get(m.clientId);
    if (!existing || m.createdAt > existing) {
      lastOutboundByClient.set(m.clientId, m.createdAt);
    }
  }
  const unrepliedSeen = new Set<string>();
  const unreplied: Array<{
    id: string;
    preview: string;
    subtitle: string;
    href: string;
  }> = [];
  for (const m of inboundMessages) {
    if (!m.clientId || unrepliedSeen.has(m.clientId)) continue;
    const lastOut = lastOutboundByClient.get(m.clientId) ?? null;
    if (lastOut !== null && m.createdAt <= lastOut) continue;
    unrepliedSeen.add(m.clientId);
    const days = Math.max(
      0,
      Math.floor((Date.now() - m.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const name = nameFor(m.clientId) ?? 'Unknown client';
    unreplied.push({
      id: m.id,
      preview: (m.subject ?? m.body).slice(0, 80),
      subtitle: `${name} · ${days}d waiting`,
      href: `${appUrl}/${ws.id}/clients/${m.clientId}`,
    });
    if (unreplied.length >= 5) break;
  }

  // Audit rollup: reuse the same per-client aggregation the
  // dashboard card uses. Keep only clients with critical/warning
  // findings (info-only is too quiet for a digest).
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
  const auditDigest: Array<{
    name: string;
    criticalCount: number;
    warningCount: number;
    href: string;
  }> = [];
  for (const c of clientRows) {
    const findings = auditMap({
      nodes: nodesByClient.get(c.id) ?? [],
      edges: edgesByClient.get(c.id) ?? [],
    });
    const crit = findings.filter((f) => f.severity === 'critical').length;
    const warn = findings.filter((f) => f.severity === 'warning').length;
    if (crit + warn === 0) continue;
    auditDigest.push({
      name: c.name,
      criticalCount: crit,
      warningCount: warn,
      href: `${appUrl}/${ws.id}/clients/${c.id}?tab=audit`,
    });
  }
  auditDigest.sort((a, b) => {
    if (a.criticalCount !== b.criticalCount) {
      return b.criticalCount - a.criticalCount;
    }
    return b.warningCount - a.warningCount;
  });

  // If nothing actionable anywhere, skip the email. Empty-inbox
  // mornings shouldn't generate notifications.
  const totalActionable =
    overdueTasks.length +
    dueTodayTasks.length +
    pendingApprovalTasks.length +
    unreplied.length +
    auditDigest.length;
  if (totalActionable === 0) {
    return {
      workspaceId: ws.id,
      ownerUserId: ws.ownerUserId,
      sent: false,
      reason: 'all_clear',
    };
  }

  const dayName = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(now);

  try {
    const res = await sendDailyDigest({
      to: ownerEmail,
      subject: `${dayName} at ${ws.name} — ${totalActionable} item${
        totalActionable === 1 ? '' : 's'
      } on your plate`,
      recipientName: ownerName,
      workspaceName: ws.name,
      dayName,
      dashboardUrl: `${appUrl}/${ws.id}`,
      overdue: overdueTasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: formatDueSubtitle(t.dueDate, t.clientId, 'overdue'),
        href: taskHref(t.clientId, t.id),
      })),
      dueToday: dueTodayTasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: formatDueSubtitle(t.dueDate, t.clientId, 'due-today'),
        href: taskHref(t.clientId, t.id),
      })),
      pendingApproval: pendingApprovalTasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: t.clientId ? nameFor(t.clientId) ?? undefined : undefined,
        href: taskHref(t.clientId, t.id),
      })),
      unrepliedMessages: unreplied,
      auditFindings: auditDigest.slice(0, 5),
    });
    return {
      workspaceId: ws.id,
      ownerUserId: ws.ownerUserId,
      sent: res.sent,
      reason: res.sent ? undefined : 'resend_not_configured',
    };
  } catch (err) {
    // Swallow + log — one workspace's send failure shouldn't block
    // the cron from processing the rest. Inngest will surface the
    // step error in its UI.
    console.error('[daily-digest] send failed', ws.id, err);
    return {
      workspaceId: ws.id,
      ownerUserId: ws.ownerUserId,
      sent: false,
      reason: `send_error: ${(err as Error).message}`,
    };
  }
}
