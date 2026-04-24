import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import {
  createCheckoutSession,
  createCustomer,
  isStripeConfigured,
  stripePriceIdFor,
} from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';

import { getAppUrlFromRequest } from '@/lib/app-url';

const bodySchema = z.object({
  tier: z.enum(['pro', 'growth', 'business', 'scale']),
  period: z.enum(['monthly', 'annual']).default('monthly'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured for this environment.' },
      { status: 503 },
    );
  }

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

  const priceId = stripePriceIdFor(parsed.data.tier, parsed.data.period);
  if (!priceId) {
    return NextResponse.json(
      { error: 'No Stripe price configured for this tier / period.' },
      { status: 500 },
    );
  }

  const db = getDb();
  const workspace = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    return NextResponse.json({ error: 'workspace_not_found' }, { status: 404 });
  }

  // Ensure we have a Stripe customer id for this workspace.
  let customerId = workspace.stripeCustomerId;
  if (!customerId) {
    const customer = await createCustomer({
      workspaceId,
      email: actor.user.email ?? '',
      name: workspace.name,
    });
    customerId = customer.id;
    await db
      .update(schema.workspaces)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(schema.workspaces.id, workspaceId));
  }

  const session = await createCheckoutSession({
    customerId,
    priceId,
    workspaceId,
    successUrl: `${getAppUrlFromRequest(request)}/${workspaceId}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${getAppUrlFromRequest(request)}/${workspaceId}/billing?canceled=1`,
  });

  if (!session.url) {
    return NextResponse.json({ error: 'stripe_no_url' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
