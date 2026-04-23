# @phloz/billing

Tier config, gate checks, Stripe client, webhook ingestion.

All tier/pricing knobs live in `src/tiers.ts`. All tier-gated actions go
through a `can*()` function in `src/gates.ts` — no tier logic scattered
elsewhere in the codebase (see CLAUDE.md §2 rule 5).

## Layout

```
src/
  tiers.ts          TIERS config, getTier, nextTier, publicTiers, stripePriceIdFor
  active-clients.ts getActiveClientCount (60-day window), seats, totals
  gates.ts          canAddClient, canInviteMember, canUnarchiveClient, canDowngrade
                    (+ pure *Check functions without DB for unit tests)
  stripe.ts         getStripe(), createCustomer, createCheckoutSession, portal link
  webhooks.ts       constructWebhookEvent, recordBillingEvent, HANDLED_EVENT_TYPES
  errors.ts         BillingError, CanResult
  gates.test.ts     unit tests for every pure gate
  tiers.test.ts     asserts config matches ARCHITECTURE.md §7.1
```

## Adding a new tier

1. Add a row to `TIERS` in `src/tiers.ts` (name, limits, prices).
2. Add the name to `TIER_NAMES` in `@phloz/config`.
3. Create Stripe Products + Prices and paste the IDs into the TIERS row.
4. Update the pricing page copy in `apps/web/app/pricing`.
5. `pnpm check` — the tier tests catch drift.

## Adding a new gate

1. Write the pure check function in `src/gates.ts` (`canDoXCheck`).
2. Write unit tests in `src/gates.test.ts`.
3. Write the server wrapper `canDoX(workspaceId, ...)` that reads state and
   delegates.
4. Call `canDoX` in the server action / route handler. On denial, return
   the `CanResult.message` to the UI and fire the `gate_hit` analytics event.

## Gates available

| Gate | Purpose |
|---|---|
| `canAddClient` | Before creating a client — enforces tier client limit + 3× hard cap. |
| `canInviteMember` | Before inviting a team member — viewer always allowed. |
| `canUnarchiveClient` | Before unarchiving — 30-day throttle + tier limit. |
| `canDowngrade` | Before changing to a lower tier — blocks if over new limits. |

Each returns `CanResult`:

```ts
type CanResult =
  | { allowed: true }
  | { allowed: false; reason: GateDenialReason; message: string; meta?: {} };
```

## Active clients (ARCHITECTURE.md §7.2)

A client is active when `archived_at IS NULL` and it was created within 60
days OR has had a tracking node / task / message touched in the last 60
days. `getActiveClientCount(workspaceId)` runs in a single Postgres query.

An Inngest job (see `apps/app/inngest/recompute-active-client-count.ts`)
recomputes this nightly per workspace for the dashboard + usage UI.

## Stripe

`getStripe()` returns a lazy client keyed by `STRIPE_SECRET_KEY`. In local
dev without Stripe set, `isStripeConfigured()` returns false — UI code can
gate behind that so you don't need Stripe to run the app.

Webhook endpoint lives in `apps/app/app/api/webhooks/stripe/route.ts`:

```ts
const event = constructWebhookEvent(body, signature); // throws on bad sig
const fresh = await recordBillingEvent(event, workspaceId);
if (!fresh) return new Response(null, { status: 200 }); // idempotent replay
if (isHandledEvent(event.type)) {
  // reconcile workspace.tier, notify owner, etc.
}
await markBillingEventProcessed(event.id);
```
