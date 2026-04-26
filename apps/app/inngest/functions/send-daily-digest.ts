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

import { getDb, schema } from '@phloz/db/client';
import { sendDailyDigest } from '@phloz/email';
import {
  auditMap,
  type TrackingEdgeDto,
  type TrackingNodeDto,
} from '@phloz/tracking-map';

import { inngest } from '../client';

/**
 * Daily digest email. Cron fires every hour; for each workspace we
 * iterate every `workspace_members` row with `digest_enabled = true`
 * and send the digest to members whose preferred hour matches the
 * **workspace's local hour** for this run. Members with no
 * `digest_hour` set fall back to the workspace default (9 AM).
 *
 *   - **Owner / admin** receive the full workspace-wide picture: every
 *     overdue / due-today / pending-approval task, plus unreplied client
 *     messages and the audit-rollup card.
 *   - **Member / viewer** receive only their assigned task agenda
 *     (filtered to `tasks.assignee_id = member.id`). No workspace-wide
 *     unreplied or audit content — those are owner concerns.
 *
 * Empty digests are skipped so an inbox isn't filled with "all clear"
 * emails. The `digest/send-daily` manual event always runs regardless
 * of local hour — useful for previewing the email.
 */
const DIGEST_CRON = 'TZ=UTC 0 * * * *'; // hourly
const DIGEST_DEFAULT_HOUR = 9;

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

    // On-demand trigger can target one workspace + optionally one
    // member; cron hits every workspace + every digest_enabled member.
    const eventData = (event?.data ?? {}) as {
      workspaceId?: string;
      membershipId?: string;
    };
    const targeted =
      event?.name === 'digest/send-daily' ? eventData.workspaceId : undefined;
    const targetedMember =
      event?.name === 'digest/send-daily'
        ? eventData.membershipId ?? null
        : null;
    // Manual event = always send. Cron = only send when each
    // workspace's local hour matches the configured digest hour.
    const isManual = event?.name === 'digest/send-daily';

    const workspaces = await step.run('load-workspaces', async () => {
      const rows = targeted
        ? await db
            .select()
            .from(schema.workspaces)
            .where(eq(schema.workspaces.id, targeted))
        : await db.select().from(schema.workspaces);
      return rows;
    });

    const now = new Date();
    const allResults: MemberDigestResult[] = [];

    for (const ws of workspaces) {
      // Cron path: pass the current local hour so the workspace can
      // filter its members down to those whose `digest_hour` matches.
      // Manual path: filter is bypassed (membershipId targeting +
      // always-send wins).
      const localHour = isManual
        ? null
        : currentHourInTz(now, ws.timezone ?? 'UTC');

      const wsResults = await step.run(`digest-${ws.id}`, async () => {
        return runDigestForWorkspace(
          {
            id: ws.id,
            name: ws.name,
            ownerUserId: ws.ownerUserId,
          },
          { membershipId: targetedMember, isManual, localHour },
        );
      });
      allResults.push(...wsResults);
    }

    return {
      scanned: workspaces.length,
      sent: allResults.filter((r) => r.sent).length,
      skipped: allResults.filter((r) => !r.sent).length,
      results: allResults,
    };
  },
);

/**
 * Local hour [0–23] in the given timezone. Falls back to UTC when the
 * timezone string is invalid or empty — better to send at "the wrong"
 * hour than to crash the entire cron because one workspace has a
 * malformed timezone string.
 */
function currentHourInTz(date: Date, timezone: string): number {
  const tz = timezone?.trim() || 'UTC';
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: tz,
    }).format(date);
    const parsed = parseInt(formatted, 10);
    if (Number.isFinite(parsed)) return parsed;
  } catch {
    // RangeError from an unknown timezone → fall through.
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'UTC',
  })
    .format(date)
    .split(':')
    .map((s) => parseInt(s, 10))[0] ?? 0;
}

interface WorkspaceInput {
  id: string;
  name: string;
  ownerUserId: string | null;
}

interface MemberInput {
  id: string;
  userId: string | null;
  role: string;
  email: string | null;
  displayName: string | null;
  digestHour: number | null;
}

type MemberDigestResult = {
  workspaceId: string;
  membershipId: string | null;
  sent: boolean;
  reason?: string;
};

/**
 * Compose + send digests for every digest-enabled member of one
 * workspace. Workspace-wide aggregations (clients, messages, tracking
 * map) are computed once and shared across members; per-member task
 * queries are run individually to keep the assignee filter close to
 * the database.
 */
async function runDigestForWorkspace(
  ws: WorkspaceInput,
  opts: {
    membershipId: string | null;
    isManual: boolean;
    /** Current hour in the workspace's tz (cron path only). */
    localHour: number | null;
  } = { membershipId: null, isManual: false, localHour: null },
): Promise<MemberDigestResult[]> {
  const db = getDb();

  // Manual previews can target a single membership — used by the
  // Settings → Notifications "Preview today's digest" button so a
  // user can sanity-check their own digest without spamming
  // teammates. Cron path always passes `membershipId: null` and
  // hits every digest_enabled member.
  const memberFilter = opts.membershipId
    ? and(
        eq(schema.workspaceMembers.workspaceId, ws.id),
        eq(schema.workspaceMembers.id, opts.membershipId),
      )
    : and(
        eq(schema.workspaceMembers.workspaceId, ws.id),
        eq(schema.workspaceMembers.digestEnabled, true),
      );

  const allMembers = await db
    .select({
      id: schema.workspaceMembers.id,
      userId: schema.workspaceMembers.userId,
      role: schema.workspaceMembers.role,
      email: schema.workspaceMembers.email,
      displayName: schema.workspaceMembers.displayName,
      digestHour: schema.workspaceMembers.digestHour,
    })
    .from(schema.workspaceMembers)
    .where(memberFilter);

  // Cron path: filter to members whose preferred hour matches the
  // workspace's current local hour. Members with NULL digestHour fall
  // back to the workspace default. Manual path bypasses entirely so
  // the preview button always sends.
  const members = opts.isManual
    ? allMembers
    : allMembers.filter(
        (m) => (m.digestHour ?? DIGEST_DEFAULT_HOUR) === opts.localHour,
      );

  if (members.length === 0) {
    // No eligible members at this hour. Cron-path returns empty so
    // the run summary stays accurate (we don't claim "skipped" on
    // workspaces that simply have nobody scheduled this hour).
    return [];
  }

  const now = new Date();

  // Workspace-wide payload — fetched once, used for owner/admin and as
  // the client-name lookup for every member's personal task list.
  const [clientRows, inboundMessages, outboundMessages, trackingNodeRows, trackingEdgeRows] =
    await Promise.all([
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com';

  // Owner-eligible content: unreplied messages + audit rollup. Computed
  // once because the answer is workspace-wide; members don't see them.
  const unreplied = computeUnreplied({
    inboundMessages,
    outboundMessages,
    clientName,
    appUrl,
    workspaceId: ws.id,
  });
  const auditDigest = computeAuditDigest({
    clientRows,
    trackingNodeRows,
    trackingEdgeRows,
    appUrl,
    workspaceId: ws.id,
  });

  const results: MemberDigestResult[] = [];
  for (const m of members) {
    const result = await runDigestForMember(ws, m, {
      clientName,
      unreplied,
      auditDigest,
      appUrl,
      now,
    });
    results.push(result);
  }
  return results;
}

interface SharedDigestPayload {
  clientName: Map<string, string>;
  unreplied: ReturnType<typeof computeUnreplied>;
  auditDigest: ReturnType<typeof computeAuditDigest>;
  appUrl: string;
  now: Date;
}

async function runDigestForMember(
  ws: WorkspaceInput,
  member: MemberInput,
  shared: SharedDigestPayload,
): Promise<MemberDigestResult> {
  const db = getDb();
  if (!member.email) {
    return {
      workspaceId: ws.id,
      membershipId: member.id,
      sent: false,
      reason: 'member_email_missing',
    };
  }

  const isPrivileged = member.role === 'owner' || member.role === 'admin';
  const startOfToday = new Date(shared.now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(shared.now);
  endOfToday.setHours(23, 59, 59, 999);

  // Member-scoped task queries. Owner/admin: workspace-wide. Others:
  // tasks where assignee_id = membership id (one DB filter; viewer with
  // no assignments naturally sees an empty digest and gets skipped).
  const taskScope = isPrivileged
    ? eq(schema.tasks.workspaceId, ws.id)
    : and(
        eq(schema.tasks.workspaceId, ws.id),
        eq(schema.tasks.assigneeId, member.id),
      );

  const [overdueTasks, dueTodayTasks, pendingApprovalTasks] = await Promise.all([
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
          taskScope,
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
          taskScope,
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
          taskScope,
          eq(schema.tasks.approvalState, 'pending'),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(desc(schema.tasks.approvalUpdatedAt))
      .limit(10),
  ]);

  const memberUnreplied = isPrivileged ? shared.unreplied : [];
  const memberAudit = isPrivileged ? shared.auditDigest : [];

  const totalActionable =
    overdueTasks.length +
    dueTodayTasks.length +
    pendingApprovalTasks.length +
    memberUnreplied.length +
    memberAudit.length;

  if (totalActionable === 0) {
    return {
      workspaceId: ws.id,
      membershipId: member.id,
      sent: false,
      reason: 'all_clear',
    };
  }

  const nameFor = (id: string | null) =>
    id ? shared.clientName.get(id) ?? null : null;
  const taskHref = (clientId: string | null, taskId: string) =>
    clientId
      ? `${shared.appUrl}/${ws.id}/clients/${clientId}?task=${taskId}`
      : `${shared.appUrl}/${ws.id}/tasks?task=${taskId}`;

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
    return clientBit || undefined;
  };

  const dayName = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(shared.now);

  const recipientName =
    member.displayName?.trim() || member.email || 'there';

  try {
    const res = await sendDailyDigest({
      to: member.email,
      subject: `${dayName} at ${ws.name} — ${totalActionable} item${
        totalActionable === 1 ? '' : 's'
      } on your plate`,
      recipientName,
      workspaceName: ws.name,
      dayName,
      dashboardUrl: `${shared.appUrl}/${ws.id}`,
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
      unrepliedMessages: memberUnreplied,
      auditFindings: memberAudit.slice(0, 5),
    });
    return {
      workspaceId: ws.id,
      membershipId: member.id,
      sent: res.sent,
      reason: res.sent ? undefined : 'resend_not_configured',
    };
  } catch (err) {
    console.error('[daily-digest] send failed', ws.id, member.id, err);
    return {
      workspaceId: ws.id,
      membershipId: member.id,
      sent: false,
      reason: `send_error: ${(err as Error).message}`,
    };
  }
}

function computeUnreplied(input: {
  inboundMessages: Array<{
    id: string;
    clientId: string | null;
    createdAt: Date;
    subject: string | null;
    body: string;
  }>;
  outboundMessages: Array<{ clientId: string | null; createdAt: Date }>;
  clientName: Map<string, string>;
  appUrl: string;
  workspaceId: string;
}): Array<{ id: string; preview: string; subtitle: string; href: string }> {
  const lastOutboundByClient = new Map<string, Date>();
  for (const m of input.outboundMessages) {
    if (!m.clientId) continue;
    const existing = lastOutboundByClient.get(m.clientId);
    if (!existing || m.createdAt > existing) {
      lastOutboundByClient.set(m.clientId, m.createdAt);
    }
  }
  const seen = new Set<string>();
  const unreplied: Array<{
    id: string;
    preview: string;
    subtitle: string;
    href: string;
  }> = [];
  for (const m of input.inboundMessages) {
    if (!m.clientId || seen.has(m.clientId)) continue;
    const lastOut = lastOutboundByClient.get(m.clientId) ?? null;
    if (lastOut !== null && m.createdAt <= lastOut) continue;
    seen.add(m.clientId);
    const days = Math.max(
      0,
      Math.floor((Date.now() - m.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const name = input.clientName.get(m.clientId) ?? 'Unknown client';
    unreplied.push({
      id: m.id,
      preview: (m.subject ?? m.body).slice(0, 80),
      subtitle: `${name} · ${days}d waiting`,
      href: `${input.appUrl}/${input.workspaceId}/clients/${m.clientId}`,
    });
    if (unreplied.length >= 5) break;
  }
  return unreplied;
}

function computeAuditDigest(input: {
  clientRows: Array<{ id: string; name: string }>;
  trackingNodeRows: Array<typeof schema.trackingNodes.$inferSelect>;
  trackingEdgeRows: Array<typeof schema.trackingEdges.$inferSelect>;
  appUrl: string;
  workspaceId: string;
}): Array<{
  name: string;
  criticalCount: number;
  warningCount: number;
  href: string;
}> {
  const nodesByClient = new Map<string, TrackingNodeDto[]>();
  for (const n of input.trackingNodeRows) {
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
  for (const e of input.trackingEdgeRows) {
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
  const out: Array<{
    name: string;
    criticalCount: number;
    warningCount: number;
    href: string;
  }> = [];
  for (const c of input.clientRows) {
    const findings = auditMap({
      nodes: nodesByClient.get(c.id) ?? [],
      edges: edgesByClient.get(c.id) ?? [],
    });
    const crit = findings.filter((f) => f.severity === 'critical').length;
    const warn = findings.filter((f) => f.severity === 'warning').length;
    if (crit + warn === 0) continue;
    out.push({
      name: c.name,
      criticalCount: crit,
      warningCount: warn,
      href: `${input.appUrl}/${input.workspaceId}/clients/${c.id}?tab=audit`,
    });
  }
  out.sort((a, b) => {
    if (a.criticalCount !== b.criticalCount) {
      return b.criticalCount - a.criticalCount;
    }
    return b.warningCount - a.warningCount;
  });
  return out;
}
