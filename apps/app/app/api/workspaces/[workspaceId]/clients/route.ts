import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { canAddClient } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';
import { inngest } from '@/inngest';

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

  let actor;
  try {
    actor = await requireRole(workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const gate = await canAddClient(workspaceId);
  if (!gate.allowed) {
    // Surface a gate_hit event so PostHog funnels can measure how
    // often users slam into a tier ceiling vs. successfully add. The
    // tier is exposed via `meta.tier` on the gate result (see
    // packages/billing/src/gates.ts canAddClientCheck).
    const tier = (gate.meta?.tier ?? 'starter') as
      | 'starter' | 'pro' | 'growth' | 'business' | 'scale' | 'enterprise';
    fireTrack(
      'gate_hit',
      { gate: 'client_limit', current_tier: tier },
      serverTrackContext(actor.user.id, workspaceId),
    );
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

  // Fan out so Inngest can provision the inbound email address, seed
  // defaults, etc. Swallow failures so client creation isn't blocked.
  try {
    await inngest.send({
      name: 'workspace/client-added',
      data: { workspaceId, clientId: client.id },
    });
  } catch (err) {
    console.error('[clients.POST] failed to send workspace/client-added', err);
  }

  fireTrack(
    'client_created',
    {},
    serverTrackContext(actor.user.id, workspaceId),
  );

  return NextResponse.json({ id: client.id }, { status: 201 });
}
