import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import { sendInvitation } from '@phloz/email';
import { canInviteMember } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';
import { getAppUrlFromRequest } from '@/lib/app-url';

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
  /** Optional pre-selected clients. Only honored for member + viewer
   *  roles; admins always see every client so a pre-assignment is
   *  meaningless for them. */
  pendingClientIds: z
    .array(z.string().uuid())
    .max(500)
    .optional()
    .default([]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  let actor;
  try {
    actor = await requireAdminOrOwner(workspaceId);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const gate = await canInviteMember(workspaceId, parsed.data.role);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.message, code: gate.reason },
      { status: 402 },
    );
  }

  const db = getDb();

  // Pre-assignment is only meaningful for member + viewer roles.
  // Admin invites are silently stripped of any pre-selected client
  // ids (they'd never be enforced by RLS for an admin anyway).
  const pendingClientIds =
    parsed.data.role === 'admin' ? [] : parsed.data.pendingClientIds;

  // Validate the pre-selected client ids belong to this workspace —
  // otherwise an admin could pre-grant access to clients they
  // shouldn't even know exist by passing arbitrary UUIDs.
  if (pendingClientIds.length > 0) {
    const validClients = await db.query.clients.findMany({
      where: (c, { and: a, eq: e, inArray: i }) =>
        a(e(c.workspaceId, workspaceId), i(c.id, pendingClientIds)),
      columns: { id: true },
    });
    if (validClients.length !== pendingClientIds.length) {
      return NextResponse.json(
        { error: 'invalid_client_ids' },
        { status: 400 },
      );
    }
  }

  // Generate a URL-safe token + 7-day expiry.
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(schema.invitations).values({
    workspaceId,
    email: parsed.data.email,
    role: parsed.data.role,
    invitedBy: actor.user.id,
    token,
    expiresAt,
    pendingClientIds,
  });

  // Pull workspace name for the email.
  const workspace = await db.query.workspaces.findFirst({
    where: (w, { eq }) => eq(w.id, workspaceId),
    columns: { name: true },
  });

  const inviterName =
    (actor.user.user_metadata?.full_name as string | undefined) ??
    actor.user.email ??
    'A teammate';

  await sendInvitation({
    to: parsed.data.email,
    inviterName,
    role: parsed.data.role,
    workspaceName: workspace?.name ?? 'your new workspace',
    acceptUrl: `${getAppUrlFromRequest(request)}/accept-invite?token=${token}`,
  });

  fireTrack(
    'member_invited',
    { role: parsed.data.role },
    serverTrackContext(actor.user.id, workspaceId),
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
