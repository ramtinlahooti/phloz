import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import { sendInvitation } from '@phloz/email';
import { canInviteMember } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com';

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
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
    acceptUrl: `${APP_URL}/accept-invite?token=${token}`,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
