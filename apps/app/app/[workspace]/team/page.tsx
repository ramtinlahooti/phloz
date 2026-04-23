import { desc, eq } from 'drizzle-orm';

import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
} from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

import { InviteMemberCard } from './invite-member-card';

export const metadata = buildAppMetadata({ title: 'Team' });

type RouteParams = { workspace: string };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export default async function TeamPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
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
    currentMembership?.role === 'owner' || currentMembership?.role === 'admin';

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {members.length} member{members.length === 1 ? '' : 's'}
          {invitations.length > 0 &&
            ` · ${invitations.length} pending invite${invitations.length === 1 ? '' : 's'}`}
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
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-4 px-6 py-4"
              >
                <Avatar>
                  <AvatarFallback>
                    {initials((member.userId ?? '').slice(0, 2))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-medium">
                      {member.userId === user.id
                        ? 'You'
                        : (member.userId ?? 'Unknown').slice(0, 8)}
                    </span>
                    {member.userId === user.id && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {member.role}
                </Badge>
              </li>
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
                  <li
                    key={inv.id}
                    className="flex items-center justify-between px-6 py-3 text-sm"
                  >
                    <span className="truncate">{inv.email}</span>
                    <Badge variant="outline" className="capitalize">
                      {inv.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
