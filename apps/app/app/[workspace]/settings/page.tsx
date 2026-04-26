import { and, asc, eq, isNull } from 'drizzle-orm';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';
import { Card, CardContent, CardHeader, CardTitle } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import { NotificationsForm } from './notifications-form';
import { ProfileForm } from './profile-form';
import { WorkspaceSettingsForm } from './workspace-settings-form';

export const metadata = buildAppMetadata({ title: 'Settings' });

type RouteParams = { workspace: string };

export default async function SettingsPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  assertValidWorkspaceId(workspaceId);
  // Personal preferences (profile name, daily-digest opt-in) belong to
  // every member; only the agency card is owner/admin-gated.
  const actor = await requireRole(workspaceId, [
    'owner',
    'admin',
    'member',
    'viewer',
  ]);
  const isPrivileged = actor.role === 'owner' || actor.role === 'admin';

  const db = getDb();
  const [workspace, user, membership] = await Promise.all([
    db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .limit(1)
      .then((rows) => rows[0]),
    requireUser(),
    db
      .select({
        id: schema.workspaceMembers.id,
        digestEnabled: schema.workspaceMembers.digestEnabled,
        digestHour: schema.workspaceMembers.digestHour,
        pausedUntil: schema.workspaceMembers.pausedUntil,
      })
      .from(schema.workspaceMembers)
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, workspaceId),
          eq(schema.workspaceMembers.userId, actor.user.id),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!workspace) return null;

  // Per-event-type prefs + per-client mutes for the comprehensive
  // notifications panel. Both are scoped to the calling member;
  // owners/admins do NOT see other members' rows (RLS enforces).
  // Active clients are listed for the mute UI; archived clients are
  // excluded so the picker doesn't grow unbounded.
  const [eventPrefs, clientMutes, activeClients] = membership
    ? await Promise.all([
        db
          .select({
            eventType: schema.notificationPreferences.eventType,
            enabled: schema.notificationPreferences.enabled,
          })
          .from(schema.notificationPreferences)
          .where(
            eq(
              schema.notificationPreferences.workspaceMemberId,
              membership.id,
            ),
          ),
        db
          .select({
            entityId: schema.notificationSubscriptions.entityId,
          })
          .from(schema.notificationSubscriptions)
          .where(
            and(
              eq(
                schema.notificationSubscriptions.workspaceMemberId,
                membership.id,
              ),
              eq(schema.notificationSubscriptions.entityType, 'client'),
              eq(schema.notificationSubscriptions.mode, 'mute'),
            ),
          ),
        db
          .select({
            id: schema.clients.id,
            name: schema.clients.name,
          })
          .from(schema.clients)
          .where(
            and(
              eq(schema.clients.workspaceId, workspaceId),
              isNull(schema.clients.archivedAt),
            ),
          )
          .orderBy(asc(schema.clients.name)),
      ])
    : [[], [], []];

  const eventPrefMap = new Map<string, boolean>();
  for (const p of eventPrefs) {
    eventPrefMap.set(p.eventType, p.enabled);
  }
  const mutedClientIdSet = new Set(clientMutes.map((m) => m.entityId));

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? '';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <header className="mb-2">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your profile, your workspace, and how things show up for clients.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              fullName,
              email: user.email ?? '',
            }}
          />
        </CardContent>
      </Card>

      <Card id="notifications" className="scroll-mt-6">
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationsForm
            workspaceId={workspaceId}
            workspaceTimezone={workspace.timezone ?? 'UTC'}
            initial={{
              digestEnabled: membership?.digestEnabled ?? true,
              digestHour: membership?.digestHour ?? null,
              pausedUntil: membership?.pausedUntil
                ? membership.pausedUntil.toISOString()
                : null,
              eventPrefs: Object.fromEntries(eventPrefMap),
              mutedClientIds: Array.from(mutedClientIdSet),
            }}
            clients={activeClients}
          />
        </CardContent>
      </Card>

      {isPrivileged && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agency / Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkspaceSettingsForm
              workspace={{
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                description: workspace.description ?? '',
                websiteUrl: workspace.websiteUrl ?? '',
                timezone: workspace.timezone ?? 'UTC',
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
