import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import { createBillingPortalLink, isStripeConfigured } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured for this environment.' },
      { status: 503 },
    );
  }

  try {
    await requireAdminOrOwner(workspaceId);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const db = getDb();
  const workspace = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No Stripe customer for this workspace yet — upgrade first.' },
      { status: 400 },
    );
  }

  const portal = await createBillingPortalLink({
    customerId: workspace.stripeCustomerId,
    returnUrl: `${APP_URL}/${workspaceId}/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
