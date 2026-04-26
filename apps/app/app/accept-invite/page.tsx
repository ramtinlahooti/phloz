import { and, eq, gt } from 'drizzle-orm';
import Link from 'next/link';

import { getCurrentUser } from '@phloz/auth/session';
import { createServerSupabase } from '@phloz/auth/server';
import type { Role } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import { buttonVariants, Card, CardContent } from '@phloz/ui';

import { fireTrack, serverTrackContext } from '@/lib/analytics';
import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Accept invitation' });

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <InviteFailed
        title="Missing token"
        description="This invitation URL is missing its token. Ask for a fresh link."
      />
    );
  }

  const db = getDb();
  const now = new Date();
  const invitation = await db
    .select()
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.token, token),
        gt(schema.invitations.expiresAt, now),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!invitation || invitation.acceptedAt !== null) {
    return (
      <InviteFailed
        title="Invitation expired or already used"
        description="Ask your agency admin for a fresh invitation link."
      />
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    const redirectTo = `/accept-invite?token=${encodeURIComponent(token)}`;
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardContent className="space-y-4 p-6 text-center">
          <h1 className="text-xl font-semibold">
            You&apos;re invited to join as {invitation.role}
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in or create an account with the invited email to accept.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/signup?redirect_to=${encodeURIComponent(redirectTo)}`}
              className={buttonVariants({ size: 'md' })}
            >
              Create account
            </Link>
            <Link
              href={`/login?redirect_to=${encodeURIComponent(redirectTo)}`}
              className={buttonVariants({ variant: 'outline', size: 'md' })}
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <InviteFailed
        title="Wrong account"
        description={`This invitation is for ${invitation.email}. You're signed in as ${user.email}.`}
      />
    );
  }

  // Accept: create membership + mark invitation accepted + set active workspace.
  const existingMembership = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, invitation.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!existingMembership) {
    // Cache identity on insert — see packages/db/src/schema/workspace-members.ts
    // for the rationale. Falls back to null when the invitee hasn't set a
    // full_name yet; the Team page then shows the email as the primary label.
    const fullName =
      typeof user.user_metadata?.full_name === 'string'
        ? (user.user_metadata.full_name as string)
        : null;

    const [insertedMember] = await db
      .insert(schema.workspaceMembers)
      .values({
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role,
        displayName: fullName,
        email: user.email ?? null,
        invitedAt: invitation.createdAt,
        acceptedAt: new Date(),
      })
      .returning({ id: schema.workspaceMembers.id });

    // Apply pre-selected client assignments (set when the inviter
    // pre-selected clients on the invite). ON CONFLICT DO NOTHING
    // covers the rare case where the same client was somehow
    // pre-assigned twice (shouldn't happen per the API validation,
    // but defense-in-depth). Insert silently skips any clients that
    // were deleted between invite + accept.
    if (
      insertedMember &&
      invitation.pendingClientIds &&
      invitation.pendingClientIds.length > 0
    ) {
      await db
        .insert(schema.workspaceMemberClientAccess)
        .values(
          invitation.pendingClientIds.map((clientId) => ({
            workspaceMemberId: insertedMember.id,
            clientId,
          })),
        )
        .onConflictDoNothing();
    }

    // Fire the accept event only on the first acceptance. An existing
    // membership means the user clicked the link a second time, which
    // we don't want double-counted as a new conversion.
    fireTrack(
      'member_accepted_invite',
      { role: invitation.role as Role },
      serverTrackContext(user.id, invitation.workspaceId),
    );
  }

  await db
    .update(schema.invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.invitations.id, invitation.id));

  const supabase = await createServerSupabase();
  await supabase.auth.updateUser({
    data: { active_workspace_id: invitation.workspaceId },
  });

  return (
    <Card className="mx-auto mt-16 max-w-md">
      <CardContent className="space-y-4 p-6 text-center">
        <h1 className="text-xl font-semibold">You&apos;re in</h1>
        <p className="text-sm text-muted-foreground">
          Your invitation has been accepted.
        </p>
        <Link
          href={`/${invitation.workspaceId}`}
          className={buttonVariants({ size: 'md' })}
        >
          Open workspace
        </Link>
      </CardContent>
    </Card>
  );
}

function InviteFailed({ title, description }: { title: string; description: string }) {
  return (
    <Card className="mx-auto mt-16 max-w-md">
      <CardContent className="space-y-3 p-6 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
