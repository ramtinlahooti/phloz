import { and, count, eq, inArray, isNotNull, isNull, lt, not } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';

import { AnalyticsIdentify } from '@/components/analytics-identify';
import { CommandPalette } from '@/components/command-palette';
import { DashboardShell } from '@/components/dashboard-shell';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';

type LayoutParams = { workspace: string };

/**
 * RFC-4122 UUID shape. Any segment that doesn't match is a stray
 * request (favicon.ico, apple-touch-icon, .well-known probes, etc.).
 * 404 those at the layout so they never reach the DB.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Workspace layout. Runs on every page under `/[workspace]/...`.
 *
 * Responsibilities:
 * - Require an authenticated user (middleware already refreshes the
 *   session; `requireUser` throws if there is no user at all).
 * - Verify the user is a member of this workspace. If not, redirect
 *   to their active workspace or onboarding.
 * - Load the workspace row + membership role and pass them to the
 *   dashboard shell for rendering.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<LayoutParams>;
}) {
  const { workspace: workspaceId } = await params;

  // Reject obviously-invalid segments (favicon.ico, robots.txt, etc.)
  // before we hit Supabase. The DB would throw a uuid-cast error
  // otherwise, which surfaces to Sentry as a noisy "Failed query".
  if (!UUID_RE.test(workspaceId)) notFound();

  const user = await requireUser();

  const db = getDb();
  const membership = await db
    .select()
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!membership) {
    if (user.activeWorkspaceId && user.activeWorkspaceId !== workspaceId) {
      redirect(`/${user.activeWorkspaceId}`);
    }
    redirect('/onboarding');
  }

  const workspace = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!workspace) redirect('/onboarding');

  // Every workspace the user belongs to — for the switcher.
  // Plus the two sidebar-badge counts (overdue tasks assigned to this
  // user, clients with unreplied inbound). Batched into one Promise.all
  // so the layout stays one roundtrip per page load.
  const now = new Date();
  const [
    allWorkspaces,
    overdueMineCountRow,
    inboundMessages,
    outboundMessages,
  ] = await Promise.all([
    db
      .select({
        id: schema.workspaces.id,
        name: schema.workspaces.name,
        role: schema.workspaceMembers.role,
      })
      .from(schema.workspaceMembers)
      .innerJoin(
        schema.workspaces,
        eq(schema.workspaceMembers.workspaceId, schema.workspaces.id),
      )
      .where(eq(schema.workspaceMembers.userId, user.id)),
    // Overdue tasks assigned to me, scoped to this workspace. Subtasks
    // excluded (they roll up into their parent's badge already).
    db
      .select({ c: count() })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          eq(schema.tasks.assigneeId, membership.id),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
          isNotNull(schema.tasks.dueDate),
          lt(schema.tasks.dueDate, now),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .then((r) => r[0]?.c ?? 0),
    // Last-60-day inbound messages per client (excluding internal
    // notes). Joined in JS against outbound timestamps to count
    // distinct "waiting on a reply" clients. Same heuristic the
    // dashboard + inbox use — one source of truth.
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
  ]);

  // Unreplied-clients rollup: for each client, does the latest inbound
  // post-date the latest outbound? Same logic as the dashboard
  // "Waiting on a reply" widget. At launch scale (~100s of messages
  // per workspace) this is cheap in JS; rewrite as a correlated
  // subquery when a workspace gets 10k+ messages.
  const lastOutboundByClient = new Map<string, Date>();
  for (const m of outboundMessages) {
    if (!m.clientId) continue;
    const existing = lastOutboundByClient.get(m.clientId);
    if (!existing || m.createdAt > existing) {
      lastOutboundByClient.set(m.clientId, m.createdAt);
    }
  }
  const seenClients = new Set<string>();
  for (const m of inboundMessages) {
    if (!m.clientId || seenClients.has(m.clientId)) continue;
    const lastOut = lastOutboundByClient.get(m.clientId) ?? null;
    if (lastOut === null || m.createdAt > lastOut) {
      seenClients.add(m.clientId);
    }
  }
  const unrepliedClientCount = seenClients.size;

  return (
    <>
      <AnalyticsIdentify
        userId={user.id}
        workspaceId={workspace.id}
        tier={workspace.tier}
        role={membership.role}
      />
      <CommandPalette workspaceId={workspace.id} />
      <KeyboardShortcutsDialog />
      <DashboardShell
        workspace={{
          id: workspace.id,
          name: workspace.name,
          tier: workspace.tier,
        }}
        role={membership.role}
        user={{
          id: user.id,
          email: user.email ?? '',
          name:
            (user.user_metadata?.full_name as string | undefined) ??
            user.email ??
            'You',
        }}
        allWorkspaces={allWorkspaces}
        navBadges={{
          tasks: overdueMineCountRow,
          messages: unrepliedClientCount,
        }}
      >
        {children}
      </DashboardShell>
    </>
  );
}
