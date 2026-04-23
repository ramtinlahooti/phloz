import { requireEnv } from '@phloz/config';
import { eq, getDb, schema } from '@phloz/db';
import type Stripe from 'stripe';

import { BillingError } from './errors';
import { getStripe } from './stripe';

/**
 * Verify + parse a Stripe webhook body. Throws BillingError('webhook_invalid')
 * on a bad signature — return 400 to Stripe in that case.
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  try {
    return getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET'),
    );
  } catch (err) {
    throw new BillingError('webhook_invalid', (err as Error).message);
  }
}

/**
 * Idempotent ingestion: records the Stripe event in billing_events and
 * returns `true` if this was a fresh write, `false` if the event was
 * already processed.
 */
export async function recordBillingEvent(
  event: Stripe.Event,
  workspaceId: string | null,
): Promise<boolean> {
  const db = getDb();
  const existing = await db
    .select({ id: schema.billingEvents.id })
    .from(schema.billingEvents)
    .where(eq(schema.billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existing[0]) return false;

  await db.insert(schema.billingEvents).values({
    workspaceId,
    stripeEventId: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });
  return true;
}

/**
 * Mark a previously-recorded event as processed.
 */
export async function markBillingEventProcessed(stripeEventId: string) {
  const db = getDb();
  await db
    .update(schema.billingEvents)
    .set({ processedAt: new Date() })
    .where(eq(schema.billingEvents.stripeEventId, stripeEventId));
}

/**
 * Thin dispatcher for the handful of event types V1 cares about. The actual
 * reconciliation (update workspace.tier, notify owner, queue Inngest job)
 * lives in apps/app — this package only gives the typed entry point.
 */
export type HandledStripeEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed';

export const HANDLED_EVENT_TYPES: readonly HandledStripeEventType[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
];

export function isHandledEvent(type: string): type is HandledStripeEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}
