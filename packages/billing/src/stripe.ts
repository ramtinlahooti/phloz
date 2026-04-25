import { hasEnv, requireEnv } from '@phloz/config';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Lazy Stripe client. Throws if STRIPE_SECRET_KEY isn't set.
 * Callers should check `isStripeConfigured()` for graceful no-op paths in
 * local dev without a Stripe account.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-04-22.dahlia',
      appInfo: { name: 'phloz', version: '0.0.0' },
    });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return hasEnv('STRIPE_SECRET_KEY');
}

/**
 * Get-or-create a Stripe customer for a workspace. Idempotent via the
 * `workspace.stripeCustomerId` field managed on the calling side.
 */
export async function createCustomer(input: {
  workspaceId: string;
  email: string;
  name?: string;
}): Promise<Stripe.Customer> {
  return getStripe().customers.create({
    email: input.email,
    name: input.name,
    metadata: { workspace_id: input.workspaceId },
  });
}

/**
 * Open a Stripe Checkout session for a tier upgrade. `successUrl` and
 * `cancelUrl` should be absolute — caller owns URL construction.
 */
export async function createCheckoutSession(input: {
  customerId: string;
  priceId: string;
  workspaceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: input.customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.workspaceId,
    metadata: { workspace_id: input.workspaceId },
    allow_promotion_codes: true,
  });
}

/** Portal link for the customer to manage their subscription + invoices. */
export async function createBillingPortalLink(input: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}
