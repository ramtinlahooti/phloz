import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import { getDb, schema } from '@phloz/db/client';

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().max(1000).nullable().optional(),
  websiteUrl: z
    .string()
    .url()
    .max(500)
    .or(z.literal(''))
    .nullable()
    .optional(),
  timezone: z
    .string()
    .max(64)
    .or(z.literal(''))
    .nullable()
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  try {
    await requireAdminOrOwner(workspaceId);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid_body' },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description || null;
  }
  if (parsed.data.websiteUrl !== undefined) {
    updates.websiteUrl = parsed.data.websiteUrl || null;
  }
  if (parsed.data.timezone !== undefined) {
    updates.timezone = parsed.data.timezone || null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  await db
    .update(schema.workspaces)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(schema.workspaces.id, workspaceId));

  return NextResponse.json({ ok: true });
}
