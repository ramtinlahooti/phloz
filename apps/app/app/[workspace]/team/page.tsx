import { asc, desc, eq, isNull } from 'drizzle-orm';

import { requireUser } from '@phloz/auth/session';
import type { Role } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import { Card, CardContent } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import { InviteMemberCard } from './invite-member-card';
import {
  InvitationRow,
  MemberRow,
  type MemberRowView,
} from './member-row';

export const metadata = buildAppMetadata({ title: 'Team' });

type RouteParams = { workspace: string };

export default async function TeamPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  assertValidWorkspaceId(workspaceId);
  const db = getDb();
  const user = await requireUser();

  const [members, invitations, allClients, accessRows, workspaceRow] =
    await Promise.all([
      db
        .select()
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, workspaceId))
        .orderBy(desc(schema.workspaceMembers.createdAt)),
      db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.workspaceId, workspaceId)),
      // Active clients only — archived clients clutter the picker
      // and don't generate work that needs gated visibility.
      db
        .select({ id: schema.clients.id, name: schema.clients.name })
        .from(schema.clients)
        .where(
          eq(schema.clients.workspaceId, workspaceId),
        )
        .orderBy(asc(schema.clients.name)),
      // Per-member access rows. Bucketed by membership in JS for the
      // dialog's initial-state prop.
      db
        .select({
          workspaceMemberId:
            schema.workspaceMemberClientAccess.workspaceMemberId,
          clientId: schema.workspaceMemberClientAccess.clientId,
        })
        .from(schema.workspaceMemberClientAccess)
        .innerJoin(
          schema.workspaceMembers,
          eq(
            schema.workspaceMembers.id,
            schema.workspaceMemberClientAccess.workspaceMemberId,
          ),
        )
        .where(eq(schema.workspaceMembers.workspaceId, workspaceId)),
      // Workspace settings for the policy banner. Reading via the
      // existing workspaces row instead of a layout-context lookup
      // keeps the page self-contained.
      db
        .select({ settings: schema.workspaces.settings })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.id, workspaceId))
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

  // Suppress unused — kept for future "include archived" toggle.
  void isNull;

  const accessByMember = new Map<string, string[]>();
  for (const row of accessRows) {
    const list = accessByMember.get(row.workspaceMemberId) ?? [];
    list.push(row.clientId);
    accessByMember.set(row.workspaceMemberId, list);
  }
  const allMembersSeeAllClients =
    ((workspaceRow?.settings as Record<string, unknown> | null)?.[
      'all_members_see_all_clients'
    ] as boolean | undefined) ?? true;

  const currentMembership = members.find((m) => m.userId === user.id);
  const canInvite =
    currentMembership?.role === 'owner' ||
    currentMembership?.role === 'admin';
  const viewerIsOwner = currentMembership?.role === 'owner';

  // Label precedence: cached display_name → cached email → UUID prefix.
  // The cache is populated at invite-accept / onboarding time and synced
  // on profile edits (see profile-actions.ts). Pre-cache rows backfilled
  // by the 0001 migration.
  const memberViews: MemberRowView[] = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    label: memberLabel(m, user.id),
    email: m.userId === user.id ? user.email ?? m.email : m.email,
    role: m.role as Role,
    isSelf: m.userId === user.id,
    viewerIsOwner,
    digestEnabled: m.digestEnabled,
    digestHour: m.digestHour,
    assignedClientIds: accessByMember.get(m.id) ?? [],
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {members.length} member{members.length === 1 ? '' : 's'}
          {invitations.length > 0 &&
            ` · ${invitations.length} pending invite${
              invitations.length === 1 ? '' : 's'
            }`}
        </p>
      </header>

      {canInvite && (
        <div className="mb-8">
          <InviteMemberCard
            workspaceId={workspaceId}
            clients={allClients}
            allMembersSeeAllClients={allMembersSeeAllClients}
          />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {memberViews.map((member) => (
              <MemberRow
                key={member.id}
                workspaceId={workspaceId}
                member={member}
                clients={allClients}
                allMembersSeeAllClients={allMembersSeeAllClients}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending invites
          </h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                {invitations.map((inv) => (
                  <InvitationRow
                    key={inv.id}
                    workspaceId={workspaceId}
                    invitation={{
                      id: inv.id,
                      email: inv.email,
                      role: inv.role as Role,
                    }}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

/**
 * Pick the best human label for a member row:
 * - Current user → always "You" (matches the `You` badge semantics).
 * - Cached display_name if present.
 * - Cached email as a fallback (meaningful for freshly-accepted invites
 *   that haven't set a full_name yet).
 * - Truncated UUID as last resort (only happens pre-backfill).
 */
function memberLabel(
  m: { userId: string | null; displayName: string | null; email: string | null },
  currentUserId: string,
): string {
  if (m.userId === currentUserId) return 'You';
  if (m.displayName && m.displayName.trim()) return m.displayName;
  if (m.email && m.email.trim()) return m.email;
  return `${(m.userId ?? 'unknown').slice(0, 8)}…`;
}
