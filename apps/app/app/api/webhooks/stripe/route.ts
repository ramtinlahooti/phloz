import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import {
  constructWebhookEvent,
  markBillingEventProcessed,
  recordBillingEvent,
  HANDLED_EVENT_TYPES,
  type HandledStripeEventType,
} from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';
import type { TierName } from '@phloz/config';
import type Stripe from 'stripe';

import { inngest } from '@/inngest';

// Must use the raw body for signature verification — disable Next's parsing.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRICE_TO_TIER: Record<string, TierName> = {
  // Monthly
  price_1TPTGNPomvpsIeGOPCm3bWjE: 'pro',
  price_1TPTGWPomvpsIeGO51I6kbXN: 'growth',
  price_1TPTGgPomvpsIeGO4c372DGA: 'business',
  price_1TPTGpPomvpsIeGOHpKjuvM0: 'scale',
  // Annual
  price_1TPTGQPomvpsIeGOS9CCvxgp: 'pro',
  price_1TPTGZPomvpsIeGOnUDvByqs: 'growth',
  price_1TPTGjPomvpsIeGO2HDfoF6c: 'business',
  price_1TPTGsPomvpsIeGOuOxL39d0: 'scale',
};

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    return NextResponse.json(
      { error: `webhook_invalid: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const workspaceId = extractWorkspaceId(event);
  const isFresh = await recordBillingEvent(event, workspaceId);
  if (!isFresh) {
    // Already processed — return 200 so Stripe doesn't retry.
    return NextResponse.json({ ok: true, deduped: true });
  }

  if (HANDLED_EVENT_TYPES.includes(event.type as HandledStripeEventType)) {
    await reconcile(event, workspaceId);
  }

  await markBillingEventProcessed(event.id);
  return NextResponse.json({ ok: true });
}

function extractWorkspaceId(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;
  const meta = (obj.metadata as Record<string, string> | undefined) ?? null;
  if (meta?.workspace_id) return meta.workspace_id;
  const clientRef = (obj.client_reference_id as string | undefined) ?? null;
  return clientRef ?? null;
}

type OurSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'
  | 'incomplete';

function normalizeStatus(s: Stripe.Subscription.Status): OurSubscriptionStatus {
  switch (s) {
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'trialing':
    case 'incomplete':
      return s;
    case 'incomplete_expired':
    case 'unpaid':
      return 'canceled';
    case 'paused':
      return 'past_due';
    default:
      return 'incomplete';
  }
}

async function reconcile(event: Stripe.Event, workspaceId: string | null) {
  if (!workspaceId) return;
  const db = getDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.customer && typeof session.customer === 'string') {
        await db
          .update(schema.workspaces)
          .set({
            stripeCustomerId: session.customer,
            stripeSubscriptionId:
              typeof session.subscription === 'string'
                ? session.subscription
                : null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workspaces.id, workspaceId));
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const tier = priceId ? PRICE_TO_TIER[priceId] : undefined;
      await db
        .update(schema.workspaces)
        .set({
          tier: tier ?? undefined,
          subscriptionStatus: normalizeStatus(sub.status),
          stripeSubscriptionId: sub.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.workspaces.id, workspaceId));
      try {
        await inngest.send({
          name: 'stripe/subscription-updated',
          data: {
            workspaceId,
            subscriptionId: sub.id,
            status: sub.status,
          },
        });
      } catch (err) {
        console.error('[stripe.webhook] inngest fanout failed', err);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      await db
        .update(schema.workspaces)
        .set({
          tier: 'starter',
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.workspaces.id, workspaceId));
      break;
    }
    // invoice.paid / invoice.payment_failed: emit analytics events in V2.
    default:
      break;
  }
}
