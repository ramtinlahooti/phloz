import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { canAddClient } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  businessName: z.string().trim().max(120).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  industry: z.string().trim().max(60).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  try {
    await requireRole(workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const gate = await canAddClient(workspaceId);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.message, code: gate.reason },
      { status: 402 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid_body' },
      { status: 400 },
    );
  }

  const db = getDb();
  const [client] = await db
    .insert(schema.clients)
    .values({
      workspaceId,
      name: parsed.data.name,
      businessName: parsed.data.businessName ?? null,
      websiteUrl: parsed.data.websiteUrl ?? null,
      industry: parsed.data.industry ?? null,
    })
    .returning({ id: schema.clients.id });

  if (!client) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ id: client.id }, { status: 201 });
}
