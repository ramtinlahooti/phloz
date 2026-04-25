import { desc, eq } from 'drizzle-orm';

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

  const members = await db
    .select()
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId))
    .orderBy(desc(schema.workspaceMembers.createdAt));

  const invitations = await db
    .select()
    .from(schema.invitations)
    .where(eq(schema.invitations.workspaceId, workspaceId));

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
          <InviteMemberCard workspaceId={workspaceId} />
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
