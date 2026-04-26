import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireRole } from '@phloz/auth/roles';
import { canAddRecurringTemplate, nextTier } from '@phloz/billing';
import type {
  ApprovalState,
  Department,
  MessageChannel,
  MessageDirection,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  Breadcrumbs,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@phloz/ui';

import {
  auditMap,
  type Finding,
  type TrackingEdgeDto,
  type TrackingNodeDto,
} from '@phloz/tracking-map';

import { AuditSparkline } from '@/components/audit-sparkline';
import {
  HEALTH_COLORS,
  computeClientHealth,
} from '@/lib/client-health';
import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import { RunAuditButton } from '../../run-audit-button';

import { ArchiveButton } from './archive-button';
import { ClientOverviewForm } from './client-overview-form';
import { LazyMapClient } from './map/lazy-map-client';
import { ClientNotesEditor } from './notes-editor';
import { PlatformIdsCard } from './platform-ids-card';
import { collectPlatformIds } from './platform-ids';
import {
  ContactsPanel,
  type ContactRow,
} from './contacts/contacts-panel';
import {
  AuditSnoozeButton,
  AuditUnsnoozeButton,
} from './audit-snooze-button';
import { FilesPanel, type AssetRow } from './files/files-panel';
import { SeedStarterNodesButton } from './map/seed-starter-button';
import { ApplyTemplateButton } from '../../tasks/apply-template-button';
import {
  MessageThread,
  type MessageItem,
} from '../../messages/message-thread';
import { NewTaskDialog } from '../../tasks/new-task-dialog';
import {
  describeCadence,
  describeNextFire,
  type RecurringCadence,
} from '../../tasks/recurring/cadence';
import { NewRecurringDialog } from '../../tasks/recurring/new-recurring-dialog';
import { RecurringRow } from '../../tasks/recurring/recurring-row';
import { TaskListWithSelection } from '../../tasks/task-list-with-selection';
import { type TaskRowModel } from '../../tasks/task-row';

export const metadata = buildAppMetadata({ title: 'Client' });

type RouteParams = { workspace: string; clientId: string };

const VALID_TABS = [
  'overview',
  'contacts',
  'tasks',
  'messages',
  'map',
  'audit',
  'files',
] as const;
type ClientDetailTab = (typeof VALID_TABS)[number];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<{ tab?: string; task?: string }>;
}) {
  const { workspace: workspaceId, clientId } = await params;
  assertValidWorkspaceId(workspaceId);
  assertValidWorkspaceId(clientId);
  const sp = await searchParams;
  // `?tab=audit` deep-links to a specific tab on load. Used by the
  // dashboard audit-rollup card + any other feature that wants to
  // jump to a specific client surface. Invalid values fall through
  // to the default.
  const initialTab: ClientDetailTab = (
    VALID_TABS as readonly string[]
  ).includes(sp.tab ?? '')
    ? (sp.tab as ClientDetailTab)
    : 'overview';
  const db = getDb();
  const actor = await requireRole(workspaceId, [
    'owner',
    'admin',
    'member',
    'viewer',
  ]);
  const user = actor.user;
  const isPrivileged = actor.role === 'owner' || actor.role === 'admin';
  const canDeleteRecurring = isPrivileged;
  const canRunAudit = isPrivileged;

  const [
    client,
    clientTasks,
    clientMessages,
    inboundAddressRow,
    clientAssets,
    clientContactRows,
    memberRows,
    subtaskRollupRows,
    trackingNodeRows,
    trackingEdgeRows,
    auditSuppressionRows,
    auditHistoryRows,
    recurringTemplateRows,
    workspaceRow,
  ] = await Promise.all([
      db
        .select()
        .from(schema.clients)
        .where(
          and(
            eq(schema.clients.id, clientId),
            eq(schema.clients.workspaceId, workspaceId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.workspaceId, workspaceId),
            eq(schema.tasks.clientId, clientId),
            // Subtasks only appear inside their parent's detail dialog.
            isNull(schema.tasks.parentTaskId),
          ),
        )
        .orderBy(desc(schema.tasks.priority), asc(schema.tasks.dueDate)),
      db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.workspaceId, workspaceId),
            eq(schema.messages.clientId, clientId),
          ),
        )
        .orderBy(desc(schema.messages.createdAt))
        .limit(200),
      db
        .select({ address: schema.inboundEmailAddresses.address })
        .from(schema.inboundEmailAddresses)
        .where(
          and(
            eq(schema.inboundEmailAddresses.clientId, clientId),
            eq(schema.inboundEmailAddresses.active, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select()
        .from(schema.clientAssets)
        .where(
          and(
            eq(schema.clientAssets.workspaceId, workspaceId),
            eq(schema.clientAssets.clientId, clientId),
          ),
        )
        .orderBy(desc(schema.clientAssets.createdAt))
        .limit(200),
      db
        .select({
          id: schema.clientContacts.id,
          name: schema.clientContacts.name,
          email: schema.clientContacts.email,
          phone: schema.clientContacts.phone,
          role: schema.clientContacts.role,
          portalAccess: schema.clientContacts.portalAccess,
        })
        .from(schema.clientContacts)
        .where(
          and(
            eq(schema.clientContacts.workspaceId, workspaceId),
            eq(schema.clientContacts.clientId, clientId),
          ),
        )
        .orderBy(asc(schema.clientContacts.name)),
      // Members for the task assignee picker (NewTaskDialog + detail
      // dialog edit mode). Kept in the same Promise.all so the page
      // stays one roundtrip.
      db
        .select({
          id: schema.workspaceMembers.id,
          userId: schema.workspaceMembers.userId,
          role: schema.workspaceMembers.role,
          displayName: schema.workspaceMembers.displayName,
          email: schema.workspaceMembers.email,
        })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, workspaceId)),
      // Subtasks under this client's tasks — aggregated in JS to a
      // per-parent progress pill on each row.
      db
        .select({
          parentTaskId: schema.tasks.parentTaskId,
          status: schema.tasks.status,
        })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.workspaceId, workspaceId),
            eq(schema.tasks.clientId, clientId),
            isNotNull(schema.tasks.parentTaskId),
          ),
        ),
      // Tracking nodes for this client — feeds the header health
      // chip, the right-rail details, AND the Audit tab. We fetch
      // full rows so the audit engine has enough signal (metadata,
      // lastVerifiedAt) to run its rules.
      db
        .select()
        .from(schema.trackingNodes)
        .where(
          and(
            eq(schema.trackingNodes.workspaceId, workspaceId),
            eq(schema.trackingNodes.clientId, clientId),
          ),
        ),
      // Edges for this client — used by the audit engine's
      // orphan-gtm + graph-shape rules.
      db
        .select()
        .from(schema.trackingEdges)
        .where(
          and(
            eq(schema.trackingEdges.workspaceId, workspaceId),
            eq(schema.trackingEdges.clientId, clientId),
          ),
        ),
      // Audit suppressions for this client — filtered out before
      // rendering, and listed at the bottom of the Audit tab so
      // users can un-snooze.
      db
        .select()
        .from(schema.auditSuppressions)
        .where(
          and(
            eq(schema.auditSuppressions.workspaceId, workspaceId),
            eq(schema.auditSuppressions.clientId, clientId),
          ),
        ),
      // Per-client audit history. The weekly Inngest audit cron
      // writes one `audit_run.client_summary` row per client per pass
      // with `{critical, warning, info, suppressed, total_nodes,
      // total_edges}`. Eight rows ≈ two months of weekly history —
      // matches the dashboard sparkline window and renders as a small
      // timeline under the live findings.
      db
        .select({
          metadata: schema.auditLog.metadata,
          createdAt: schema.auditLog.createdAt,
        })
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.workspaceId, workspaceId),
            eq(schema.auditLog.action, 'audit_run.client_summary'),
            eq(schema.auditLog.entityId, clientId),
          ),
        )
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(8),
      // Recurring task templates scoped to this client — surfaced in
      // a section above the regular tasks list so agency owners
      // discover them without leaving the client view.
      db
        .select()
        .from(schema.recurringTaskTemplates)
        .where(
          and(
            eq(schema.recurringTaskTemplates.workspaceId, workspaceId),
            eq(schema.recurringTaskTemplates.clientId, clientId),
          ),
        )
        .orderBy(asc(schema.recurringTaskTemplates.title)),
      // Workspace timezone — used by the recurring-template
      // "next fire" hint. Cheap single-row lookup; if the layout's
      // `workspaces` query were lifted to a Context we could reuse
      // it, but that's a refactor for another day.
      db
        .select({
          timezone: schema.workspaces.timezone,
          tier: schema.workspaces.tier,
        })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.id, workspaceId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

  const workspaceTimezone = workspaceRow?.timezone ?? 'UTC';
  const recurringNow = new Date();

  // Tier-gate UX for the per-client recurring section. Mirrors the
  // workspace `/tasks/recurring` page: when the gate denies, the
  // dialog's New button disables with the gate message + an inline
  // "Upgrade →" link points at the matching billing-page CTA.
  const recurringGate = await canAddRecurringTemplate(workspaceId);
  const recurringAtLimit = !recurringGate.allowed;
  const recurringLimitMessage = recurringAtLimit
    ? recurringGate.message
    : undefined;
  const recurringUpgradeTier = workspaceRow
    ? nextTier(workspaceRow.tier)
    : null;
  const recurringUpgradeHref = recurringAtLimit
    ? recurringUpgradeTier && recurringUpgradeTier !== 'enterprise'
      ? `/${workspaceId}/billing?upgrade=${recurringUpgradeTier}`
      : `/${workspaceId}/billing`
    : undefined;

  if (!client) notFound();

  // Assignee lookup: membership id → display label. Mirrors the
  // Tasks-page builder so task rows look identical on either page.
  const assigneeDetails = new Map<
    string,
    { label: string; isSelf: boolean }
  >();
  for (const m of memberRows) {
    const isSelf = m.userId === user.id;
    assigneeDetails.set(m.id, {
      label: isSelf
        ? 'You'
        : (m.displayName?.trim() ||
           m.email?.trim() ||
           `${(m.userId ?? 'unknown').slice(0, 8)}…`),
      isSelf,
    });
  }

  const subtaskStats = new Map<string, { total: number; done: number }>();
  for (const row of subtaskRollupRows) {
    if (!row.parentTaskId) continue;
    const stats = subtaskStats.get(row.parentTaskId) ?? { total: 0, done: 0 };
    stats.total += 1;
    if (row.status === 'done') stats.done += 1;
    subtaskStats.set(row.parentTaskId, stats);
  }

  const tasksAsRows: TaskRowModel[] = clientTasks.map((t) => {
    const assignee = t.assigneeId ? assigneeDetails.get(t.assigneeId) : null;
    return {
      id: t.id,
      title: t.title,
      status: t.status as TaskStatus,
      priority: t.priority as TaskPriority,
      department: t.department as Department,
      visibility: t.visibility as TaskVisibility,
      dueDate: t.dueDate,
      clientId: t.clientId,
      clientName: client.name,
      approvalState: t.approvalState as ApprovalState,
      assigneeMembershipId: t.assigneeId,
      assigneeLabel: assignee?.label ?? null,
      assigneeIsSelf: assignee?.isSelf ?? false,
      subtaskStats: subtaskStats.get(t.id),
    };
  });

  // Build assignee options with the same label precedence as the
  // workspace-wide Tasks page. See `/tasks/page.tsx` for the ordering
  // logic.
  const memberOptions = memberRows
    .map((m) => {
      const isSelf = m.userId === user.id;
      const primary = isSelf
        ? 'You'
        : (m.displayName?.trim() ||
           m.email?.trim() ||
           `${(m.userId ?? 'unknown').slice(0, 8)}…`);
      return {
        id: m.id,
        label: `${primary} · ${m.role}`,
        sortKey: isSelf ? '' : primary.toLowerCase(),
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ id, label }) => ({ id, label }));
  const openTasks = tasksAsRows.filter(
    (t) => t.status !== 'done' && t.status !== 'archived',
  );

  // Group rows by status for the selection-aware list. Mirrors the
  // workspace `/tasks` page so the per-client tab feels identical
  // and bulk actions work the same way.
  const TASK_GROUP_ORDER: TaskStatus[] = [
    'todo',
    'in_progress',
    'blocked',
    'done',
  ];
  const tasksByStatus = TASK_GROUP_ORDER.flatMap((status) => {
    const rows = tasksAsRows.filter((t) => t.status === status);
    if (rows.length === 0) return [];
    return [{ status, tasks: rows }];
  });

  const messages: MessageItem[] = clientMessages.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    direction: m.direction as MessageDirection,
    channel: m.channel as MessageChannel,
    subject: m.subject,
    body: m.body,
    fromLabel:
      m.fromType === 'member'
        ? 'Team'
        : m.fromType === 'contact'
          ? client.name
          : 'System',
    createdAt: m.createdAt,
  }));

  const assetRows: AssetRow[] = clientAssets.map((a) => ({
    id: a.id,
    name: a.name,
    assetType: a.assetType,
    notes: a.notes,
    clientVisible: a.clientVisible,
    createdAt: a.createdAt,
  }));

  const contactRows: ContactRow[] = clientContactRows.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: c.role,
    portalAccess: c.portalAccess,
  }));

  // --- Header stats ---------------------------------------------------
  //
  // Compute the same signals the /clients list uses, scoped to this
  // client. Keeps the health badge identical on the list + detail
  // page so numbers don't mysteriously disagree.
  const now = Date.now();
  const overdueCount = clientTasks.filter(
    (t) =>
      t.parentTaskId === null &&
      ['todo', 'in_progress', 'blocked'].includes(t.status) &&
      t.dueDate !== null &&
      t.dueDate.getTime() < now,
  ).length;

  // Unreplied inbound: count of inbound messages newer than the last
  // outbound, excluding internal notes. Same definition as /clients +
  // /messages.
  let lastOutboundAt: Date | null = null;
  for (const m of clientMessages) {
    if (m.direction === 'outbound' && m.channel !== 'internal_note') {
      if (!lastOutboundAt || m.createdAt > lastOutboundAt) {
        lastOutboundAt = m.createdAt;
      }
    }
  }
  const unrepliedCount = clientMessages.filter(
    (m) =>
      m.direction === 'inbound' &&
      m.channel !== 'internal_note' &&
      (lastOutboundAt === null || m.createdAt > lastOutboundAt),
  ).length;

  const brokenNodeCount = trackingNodeRows.filter(
    (n) => n.healthStatus === 'broken',
  ).length;
  const missingNodeCount = trackingNodeRows.filter(
    (n) => n.healthStatus === 'missing',
  ).length;

  const health = computeClientHealth({
    archived: client.archivedAt !== null,
    lastActivityAt: client.lastActivityAt,
    overdueTaskCount: overdueCount,
    unrepliedInboundCount: unrepliedCount,
    brokenNodeCount,
    missingNodeCount,
  });
  const healthColors = HEALTH_COLORS[health.tier];

  const portalContactsCount = contactRows.filter((c) => c.portalAccess).length;

  // Run the audit engine against this client's map. Cheap — pure
  // function over already-fetched rows, runs every page render.
  const auditNodeDtos: TrackingNodeDto[] = trackingNodeRows.map((n) => ({
    id: n.id,
    clientId: n.clientId,
    workspaceId: n.workspaceId,
    nodeType: n.nodeType,
    label: n.label,
    metadata: (n.metadata as Record<string, unknown>) ?? {},
    healthStatus: n.healthStatus,
    lastVerifiedAt: n.lastVerifiedAt,
    position: n.position ?? null,
  }));
  const auditEdgeDtos: TrackingEdgeDto[] = trackingEdgeRows.map((e) => ({
    id: e.id,
    clientId: e.clientId,
    workspaceId: e.workspaceId,
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    edgeType: e.edgeType,
    label: e.label,
    metadata: (e.metadata as Record<string, unknown>) ?? {},
  }));
  // Run the audit, then drop any finding whose ruleId has been
  // suppressed for this client. Suppressed-rules section below the
  // findings lets the user un-snooze.
  const suppressedRuleIds = new Set(
    auditSuppressionRows.map((s) => s.ruleId),
  );
  const allFindings: Finding[] = auditMap({
    nodes: auditNodeDtos,
    edges: auditEdgeDtos,
  });
  const auditFindings: Finding[] = allFindings.filter(
    (f) => !suppressedRuleIds.has(f.ruleId),
  );
  const criticalCount = auditFindings.filter(
    (f) => f.severity === 'critical',
  ).length;
  const warningCount = auditFindings.filter(
    (f) => f.severity === 'warning',
  ).length;

  // Project the raw audit_log rows into typed snapshots for the
  // History timeline. Drops malformed rows defensively (the metadata
  // column is `jsonb` so anything could land there in principle).
  const auditHistory: AuditHistorySnapshot[] = auditHistoryRows
    .map((row) => {
      const meta = (row.metadata ?? {}) as {
        critical?: number;
        warning?: number;
        info?: number;
      };
      return {
        at: row.createdAt,
        critical: typeof meta.critical === 'number' ? meta.critical : 0,
        warning: typeof meta.warning === 'number' ? meta.warning : 0,
        info: typeof meta.info === 'number' ? meta.info : 0,
      };
    });

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border/60 bg-card/30 px-6 py-5">
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: 'Clients', href: `/${workspaceId}/clients` },
            { label: client.name },
          ]}
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {client.name}
            </h1>
            {client.businessName && (
              <p className="mt-1 text-sm text-muted-foreground">
                {client.businessName}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {client.archivedAt && (
              <Badge variant="outline">Archived</Badge>
            )}
            <ArchiveButton
              workspaceId={workspaceId}
              clientId={clientId}
              archived={client.archivedAt !== null}
            />
          </div>
        </div>

        {/* At-a-glance stats. Only rendered for non-archived clients
            since health scoring short-circuits to 0 on archived, which
            would misleadingly show a red badge. */}
        {!client.archivedAt && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${healthColors.badge}`}
              title={health.reasons.join(' · ') || 'All signals good'}
            >
              <span
                className={`inline-block size-1.5 rounded-full ${healthColors.dot}`}
                aria-hidden
              />
              {healthColors.label} · {health.score}
            </span>
            <StatChip
              label={
                openTasks.length === 1
                  ? '1 open task'
                  : `${openTasks.length} open tasks`
              }
              sub={
                overdueCount > 0
                  ? `${overdueCount} overdue`
                  : undefined
              }
              tone={overdueCount > 0 ? 'red' : 'default'}
            />
            {unrepliedCount > 0 && (
              <StatChip
                label={
                  unrepliedCount === 1
                    ? '1 unreplied message'
                    : `${unrepliedCount} unreplied messages`
                }
                tone="amber"
              />
            )}
            <StatChip
              label={
                trackingNodeRows.length === 1
                  ? '1 tracking node'
                  : `${trackingNodeRows.length} tracking nodes`
              }
              sub={
                brokenNodeCount + missingNodeCount > 0
                  ? `${brokenNodeCount + missingNodeCount} need attention`
                  : undefined
              }
              tone={
                brokenNodeCount > 0
                  ? 'red'
                  : missingNodeCount > 0
                    ? 'amber'
                    : 'default'
              }
            />
            {contactRows.length > 0 && (
              <StatChip
                label={
                  contactRows.length === 1
                    ? '1 contact'
                    : `${contactRows.length} contacts`
                }
                sub={
                  portalContactsCount > 0
                    ? `${portalContactsCount} with portal access`
                    : undefined
                }
              />
            )}
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Main pane */}
        <div className="flex-1 min-w-0 overflow-auto">
          <Tabs defaultValue={initialTab} className="p-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="map">Tracking map</TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5">
                Audit
                {criticalCount + warningCount > 0 && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      criticalCount > 0
                        ? 'border-red-400/50 text-red-400'
                        : 'border-amber-400/50 text-amber-400'
                    }`}
                  >
                    {criticalCount + warningCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <ClientOverviewForm
                workspaceId={workspaceId}
                clientId={clientId}
                initial={{
                  name: client.name,
                  businessName: client.businessName,
                  businessEmail: client.businessEmail,
                  businessPhone: client.businessPhone,
                  websiteUrl: client.websiteUrl,
                  industry: client.industry,
                }}
              />
              <PlatformIdsCard
                workspaceId={workspaceId}
                clientId={clientId}
                rows={collectPlatformIds(
                  trackingNodeRows.map((n) => ({
                    id: n.id,
                    nodeType: n.nodeType,
                    label: n.label,
                    metadata: (n.metadata as Record<string, unknown>) ?? null,
                  })),
                )}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <ClientNotesEditor
                    workspaceId={workspaceId}
                    clientId={clientId}
                    initialNotes={client.notes ?? null}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="mt-6">
              <ContactsPanel
                workspaceId={workspaceId}
                clientId={clientId}
                contacts={contactRows}
              />
            </TabsContent>

            <TabsContent value="tasks" className="mt-6 space-y-6">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Recurring
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Templates that auto-create tasks for this client on a
                      cadence.
                    </p>
                  </div>
                  <NewRecurringDialog
                    workspaceId={workspaceId}
                    clientId={clientId}
                    members={memberOptions}
                    disabled={recurringAtLimit}
                    disabledMessage={recurringLimitMessage}
                    upgradeHref={recurringUpgradeHref}
                  />
                </div>
                {recurringTemplateRows.length === 0 ? (
                  <Card>
                    <CardContent className="px-6 py-4 text-xs text-muted-foreground">
                      No recurring templates yet. Set one up for the work
                      that repeats — weekly check-ins, monthly reports.
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {recurringTemplateRows.map((t) => (
                      <RecurringRow
                        key={t.id}
                        workspaceId={workspaceId}
                        template={{
                          id: t.id,
                          title: t.title,
                          cadenceSummary: describeCadence({
                            cadence: t.cadence as RecurringCadence,
                            weekday: t.weekday,
                            dayOfMonth: t.dayOfMonth,
                          }),
                          nextFireSummary: describeNextFire({
                            cadence: t.cadence as RecurringCadence,
                            weekday: t.weekday,
                            dayOfMonth: t.dayOfMonth,
                            lastRunAt: t.lastRunAt,
                            now: recurringNow,
                            timezone: workspaceTimezone,
                          }),
                          clientName: null,
                          department: t.department,
                          enabled: t.enabled,
                          lastRunAt: t.lastRunAt,
                          canDelete: canDeleteRecurring,
                        }}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {tasksAsRows.length} total · {openTasks.length} open
                  </p>
                  <div className="flex items-center gap-2">
                    <ApplyTemplateButton
                      workspaceId={workspaceId}
                      clientId={clientId}
                    />
                    <NewTaskDialog
                      workspaceId={workspaceId}
                      clientId={clientId}
                      members={memberOptions}
                    />
                  </div>
                </div>
                {tasksAsRows.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-sm text-muted-foreground">
                      No tasks yet. Add one to start tracking work for this
                      client.
                    </CardContent>
                  </Card>
                ) : (
                  <TaskListWithSelection
                    workspaceId={workspaceId}
                    members={memberOptions}
                    groups={tasksByStatus}
                  />
                )}
              </section>
            </TabsContent>

            <TabsContent value="messages" className="mt-6">
              <MessageThread
                workspaceId={workspaceId}
                clientId={clientId}
                clientEmail={client.businessEmail ?? null}
                inboundAddress={inboundAddressRow?.address ?? null}
                messages={messages}
              />
            </TabsContent>

            <TabsContent value="map" className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Drag to position · click to edit · handle drag = connect ·
                  press <kbd className="rounded border border-border bg-card px-1 text-[10px]">n</kbd> to add
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {trackingNodeRows.length === 0 && (
                    <SeedStarterNodesButton
                      workspaceId={workspaceId}
                      clientId={clientId}
                      variant="inline"
                    />
                  )}
                  <Link
                    href={`/${workspaceId}/clients/${clientId}/map`}
                    className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  >
                    Open full screen ↗
                  </Link>
                </div>
              </div>
              {/* Inline canvas. Keeps the canvas mounted inside the
                  tab so the user lands on the live map, not a
                  click-through. The dedicated /map route stays for
                  full-screen work. Height is constrained so the rest
                  of the page (header strip + breadcrumbs) stays in
                  view. */}
              <div className="h-[70vh] min-h-[480px] overflow-hidden rounded-lg border border-border/60">
                <LazyMapClient
                  workspaceId={workspaceId}
                  clientId={clientId}
                  initial={{
                    nodes: trackingNodeRows.map((n) => ({
                      id: n.id,
                      clientId: n.clientId,
                      workspaceId: n.workspaceId,
                      nodeType: n.nodeType,
                      label: n.label,
                      metadata: (n.metadata as Record<string, unknown>) ?? {},
                      healthStatus: n.healthStatus,
                      lastVerifiedAt: n.lastVerifiedAt,
                      position: n.position ?? null,
                    })),
                    edges: trackingEdgeRows.map((e) => ({
                      id: e.id,
                      clientId: e.clientId,
                      workspaceId: e.workspaceId,
                      sourceNodeId: e.sourceNodeId,
                      targetNodeId: e.targetNodeId,
                      edgeType: e.edgeType,
                      label: e.label,
                      metadata: (e.metadata as Record<string, unknown>) ?? {},
                    })),
                  }}
                  focusNodeId={null}
                />
              </div>
            </TabsContent>

            <TabsContent value="audit" className="mt-6">
              <AuditPanel
                findings={auditFindings}
                suppressions={auditSuppressionRows.map((s) => ({
                  id: s.id,
                  ruleId: s.ruleId,
                  reason: s.reason,
                  createdAt: s.createdAt,
                }))}
                history={auditHistory}
                workspaceId={workspaceId}
                clientId={clientId}
                canRunAudit={canRunAudit}
              />
            </TabsContent>

            <TabsContent value="files" className="mt-6">
              <FilesPanel
                workspaceId={workspaceId}
                clientId={clientId}
                assets={assetRows}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <aside className="hidden w-80 shrink-0 border-l border-border/60 bg-card/20 p-6 lg:block">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Details
              </h3>
              <dl className="space-y-2 text-sm">
                {client.websiteUrl && (
                  <div>
                    <dt className="text-muted-foreground">Website</dt>
                    <dd>
                      <a
                        href={client.websiteUrl}
                        className="text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {client.websiteUrl}
                      </a>
                    </dd>
                  </div>
                )}
                {client.industry && (
                  <div>
                    <dt className="text-muted-foreground">Industry</dt>
                    <dd>{client.industry}</dd>
                  </div>
                )}
                {client.businessEmail && (
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{client.businessEmail}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Added</dt>
                  <dd>{new Date(client.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

type SuppressionView = {
  id: string;
  ruleId: string;
  reason: string | null;
  createdAt: Date;
};

type AuditHistorySnapshot = {
  at: Date;
  critical: number;
  warning: number;
  info: number;
};

/** Renders the audit-engine findings as a triaged list. Critical
 *  first, then warning, then info. Empty state congratulates the
 *  user rather than showing a blank card. Suppressed rules appear
 *  in a separate footer section so users can un-snooze. The History
 *  section at the bottom lists the most recent weekly cron snapshots
 *  so users can see when each finding count first appeared. Owners
 *  and admins get a "Run now" button to trigger a fresh snapshot. */
function AuditPanel({
  findings,
  suppressions,
  history,
  workspaceId,
  clientId,
  canRunAudit,
}: {
  findings: Finding[];
  suppressions: SuppressionView[];
  history: AuditHistorySnapshot[];
  workspaceId: string;
  clientId: string;
  canRunAudit: boolean;
}) {
  const criticals = findings.filter((f) => f.severity === 'critical');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const infos = findings.filter((f) => f.severity === 'info');

  if (
    findings.length === 0 &&
    suppressions.length === 0 &&
    history.length === 0
  ) {
    return (
      <div className="space-y-3">
        {canRunAudit && (
          <div className="flex justify-end">
            <RunAuditButton
              workspaceId={workspaceId}
              clientId={clientId}
            />
          </div>
        )}
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <p className="text-sm font-medium text-[var(--color-health-working)]">
              All clear.
            </p>
            <p className="text-sm text-muted-foreground">
              The audit engine didn&apos;t find anything wrong with this
              client&apos;s tracking setup. Re-run anytime — it&apos;s live
              against the current map.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = [
    criticals.length > 0 && `${criticals.length} critical`,
    warnings.length > 0 && `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`,
    infos.length > 0 && `${infos.length} info`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        {findings.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {findings.length} active finding{findings.length === 1 ? '' : 's'} ·{' '}
            {summary}
            {suppressions.length > 0 && (
              <> · {suppressions.length} suppressed</>
            )}
          </p>
        ) : (
          <span className="text-xs text-muted-foreground" />
        )}
        {canRunAudit && (
          <RunAuditButton workspaceId={workspaceId} clientId={clientId} />
        )}
      </div>
      {findings.length === 0 && (
        <Card>
          <CardContent className="space-y-2 p-6 text-center">
            <p className="text-sm font-medium text-[var(--color-health-working)]">
              All clear.
            </p>
            {suppressions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {suppressions.length} suppressed rule
                {suppressions.length === 1 ? '' : 's'} below — un-snooze any
                to bring it back.
              </p>
            )}
            {suppressions.length === 0 && history.length > 0 && (
              <p className="text-xs text-muted-foreground">
                History below shows the trend across recent weekly runs.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {criticals.length > 0 && (
        <FindingGroup
          title="Critical"
          findings={criticals}
          workspaceId={workspaceId}
          clientId={clientId}
        />
      )}
      {warnings.length > 0 && (
        <FindingGroup
          title="Warnings"
          findings={warnings}
          workspaceId={workspaceId}
          clientId={clientId}
        />
      )}
      {infos.length > 0 && (
        <FindingGroup
          title="Info"
          findings={infos}
          workspaceId={workspaceId}
          clientId={clientId}
        />
      )}
      {suppressions.length > 0 && (
        <SuppressedRulesSection
          suppressions={suppressions}
          workspaceId={workspaceId}
        />
      )}
      {history.length > 0 && <AuditHistorySection history={history} />}
    </div>
  );
}

/** Per-client audit history. The weekly Inngest cron writes one
 *  `audit_run.client_summary` row per client per pass; we list the
 *  most recent snapshots newest-first with a delta vs the prior
 *  (older) row so users can see when each finding count moved. A
 *  sparkline above the list visualises the trend at a glance —
 *  same renderer the dashboard rollup card uses. */
function AuditHistorySection({ history }: { history: AuditHistorySnapshot[] }) {
  // Series for the sparkline: oldest → newest, only the dimensions
  // the renderer plots. Skipped at the call site when fewer than 2.
  const sparkSeries = history
    .slice()
    .reverse()
    .map((s) => ({ critical: s.critical, warning: s.warning }));

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        History
      </h3>
      <p className="mb-2 text-[11px] text-muted-foreground">
        {history.length === 1
          ? 'One weekly audit snapshot recorded so far.'
          : `Last ${history.length} weekly audit snapshots.`}{' '}
        Counts reflect the cron run, not the live findings above.
      </p>
      {sparkSeries.length >= 2 && (
        <div className="mb-3">
          <AuditSparkline series={sparkSeries} />
        </div>
      )}
      <ul className="space-y-1.5">
        {history.map((snapshot, idx) => {
          const prev = history[idx + 1] ?? null;
          const delta = prev ? formatAuditDelta(snapshot, prev) : null;
          return (
            <li
              key={snapshot.at.toISOString()}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 items-center gap-3">
                <time
                  className="shrink-0 font-mono text-muted-foreground"
                  dateTime={snapshot.at.toISOString()}
                >
                  {snapshot.at.toLocaleDateString(undefined, {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  })}
                </time>
                <span className="truncate text-foreground/80">
                  {formatAuditCounts(snapshot)}
                </span>
              </div>
              {delta && (
                <span
                  className={`shrink-0 ${
                    delta.tone === 'up'
                      ? 'text-red-400'
                      : delta.tone === 'down'
                        ? 'text-emerald-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {delta.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatAuditCounts(s: AuditHistorySnapshot): string {
  const parts: string[] = [];
  if (s.critical > 0) {
    parts.push(`${s.critical} critical`);
  }
  if (s.warning > 0) {
    parts.push(`${s.warning} warning${s.warning === 1 ? '' : 's'}`);
  }
  if (s.info > 0) parts.push(`${s.info} info`);
  return parts.length > 0 ? parts.join(' · ') : 'all clear';
}

/** Compares two snapshots and returns a short delta label + tone.
 *  Tone is `up` when things got worse (more findings), `down` when
 *  better, `flat` when both critical and warning stayed put. Info
 *  is ignored — too noisy and the dashboard trend ignores it too. */
function formatAuditDelta(
  curr: AuditHistorySnapshot,
  prev: AuditHistorySnapshot,
): { label: string; tone: 'up' | 'down' | 'flat' } {
  const dCrit = curr.critical - prev.critical;
  const dWarn = curr.warning - prev.warning;
  if (dCrit === 0 && dWarn === 0) {
    return { label: 'no change', tone: 'flat' };
  }
  const parts: string[] = [];
  if (dCrit !== 0) {
    parts.push(
      `${dCrit > 0 ? '↑' : '↓'}${Math.abs(dCrit)} critical`,
    );
  }
  if (dWarn !== 0) {
    parts.push(
      `${dWarn > 0 ? '↑' : '↓'}${Math.abs(dWarn)} warning${
        Math.abs(dWarn) === 1 ? '' : 's'
      }`,
    );
  }
  // Tone is dominated by criticals; warnings only set tone if no crit
  // delta. Up = worse (red), down = better (green).
  const sign = dCrit !== 0 ? dCrit : dWarn;
  return { label: parts.join(', '), tone: sign > 0 ? 'up' : 'down' };
}

function SuppressedRulesSection({
  suppressions,
  workspaceId,
}: {
  suppressions: SuppressionView[];
  workspaceId: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Suppressed rules
      </h3>
      <ul className="space-y-2">
        {suppressions.map((s) => (
          <li
            key={s.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-card/30 p-3 text-xs"
          >
            <div className="min-w-0">
              <p className="font-mono font-medium text-foreground/80">
                {s.ruleId}
              </p>
              {s.reason && (
                <p className="mt-1 text-muted-foreground">{s.reason}</p>
              )}
              <p className="mt-1 text-muted-foreground">
                Snoozed {new Date(s.createdAt).toLocaleDateString()}
              </p>
            </div>
            <AuditUnsnoozeButton
              workspaceId={workspaceId}
              suppressionId={s.id}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FindingGroup({
  title,
  findings,
  workspaceId,
  clientId,
}: {
  title: string;
  findings: Finding[];
  workspaceId: string;
  clientId: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-2">
        {findings.map((f) => {
          // Inline tone shading. Subtle left border so critical
          // findings are scannable without overwhelming.
          const border =
            f.severity === 'critical'
              ? 'border-l-4 border-l-red-400 border border-red-400/20'
              : f.severity === 'warning'
                ? 'border-l-4 border-l-amber-400 border border-amber-400/20'
                : 'border-l-4 border-l-muted-foreground/40 border border-border';
          return (
            <li
              key={`${f.ruleId}-${f.nodeId ?? 'map'}`}
              className={`rounded-md bg-card/30 p-3 ${border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {f.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.description}
                  </p>
                  {f.suggestion && (
                    <p className="mt-2 text-xs">
                      <span className="font-medium text-foreground/80">
                        Suggested fix:
                      </span>{' '}
                      <span className="text-muted-foreground">
                        {f.suggestion}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {f.nodeId && (
                    <Link
                      href={`/${workspaceId}/clients/${clientId}/map?node=${f.nodeId}`}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      View node →
                    </Link>
                  )}
                  <AuditSnoozeButton
                    workspaceId={workspaceId}
                    clientId={clientId}
                    ruleId={f.ruleId}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Small pill used in the client-header stats strip. `sub` appears
 *  as a dimmer tail inside the same chip. Tones shade the border +
 *  text to indicate urgency without shouting. */
function StatChip({
  label,
  sub,
  tone = 'default',
}: {
  label: string;
  sub?: string;
  tone?: 'default' | 'red' | 'amber';
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-400/50 text-red-400'
      : tone === 'amber'
        ? 'border-amber-400/50 text-amber-400'
        : 'border-border text-muted-foreground';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${toneClass}`}
    >
      <span className="text-foreground/90">{label}</span>
      {sub && <span className="opacity-70">· {sub}</span>}
    </span>
  );
}
