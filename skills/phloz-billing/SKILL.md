---
name: phloz-billing
description: Use this skill whenever working with pricing tiers, subscription limits, Stripe integration, feature gating, or anything tier-related in Phloz. Apply when adding a feature that should be tier-gated, modifying tier limits or prices, handling Stripe webhooks, or computing whether an action is allowed based on current tier. Critical for any change affecting paid users.
---

# Phloz Billing Skill

Phloz billing is **config-driven**. All tier logic lives in `packages/billing/tiers.ts`. Feature gating goes through `packages/billing/gates.ts`. No code outside `packages/billing` reads tier configuration directly.

## When to apply this skill

Use whenever you:
- Add a feature that has tier-based limits (client count, seats, specific features)
- Change tier pricing, limits, or names
- Handle a Stripe webhook
- Need to check "is this action allowed for this workspace"
- Add a new gate or upgrade prompt in the UI

## The source of truth: `packages/billing/tiers.ts`

```typescript
export const TIERS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    clientLimit: 1,
    seatsIncluded: 2,
    extraSeatPrice: null,
    prices: { monthly: 0, annual: 0 },
    stripePriceIds: { monthly: null, annual: null },
    features: {
      clientPortal: true,
      emailToApp: true,
      phlozBranding: true, // watermark shown to clients
      customDomain: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    clientLimit: 10,
    seatsIncluded: 5,
    extraSeatPrice: 9.99,
    prices: { monthly: 29.99, annual: 299.99 },
    stripePriceIds: { monthly: 'price_...', annual: 'price_...' },
    features: { clientPortal: true, emailToApp: true, phlozBranding: false, customDomain: false },
  },
  // growth, business, scale, enterprise...
} as const;

export type TierId = keyof typeof TIERS;
```

## Adding a new feature gate

Every feature that could be tier-limited needs a gate function.

```typescript
// packages/billing/gates.ts

export type CanResult =
  | { allowed: true }
  | { allowed: false; reason: string; suggestedTier?: TierId };

export async function canAddClient(workspaceId: string): Promise<CanResult> {
  const workspace = await getWorkspace(workspaceId);
  const tier = TIERS[workspace.tier];
  const activeCount = await countActiveClients(workspaceId);

  if (activeCount >= tier.clientLimit) {
    return {
      allowed: false,
      reason: 'client_limit_reached',
      suggestedTier: nextTier(workspace.tier),
    };
  }
  return { allowed: true };
}

export async function canInviteMember(workspaceId: string, role: Role): Promise<CanResult> {
  if (role === 'viewer') return { allowed: true }; // viewers don't count toward seats
  // ... seat limit logic
}
```

## Using a gate in a server action

Always check before mutating. Never trust the UI to have checked.

```typescript
// In a server action
export async function addClient(input: AddClientInput) {
  'use server';
  const ctx = await getAuthContext();

  // Role check first
  if (!['owner', 'admin'].includes(ctx.role)) {
    return err('forbidden');
  }

  // Tier gate
  const gate = await canAddClient(ctx.activeWorkspaceId);
  if (!gate.allowed) {
    await track('gate_hit', {
      gate: gate.reason,
      current_tier: ctx.tier,
    });
    return err({ kind: 'tier_limit', reason: gate.reason, suggestedTier: gate.suggestedTier });
  }

  // Proceed with insert
  // ...
}
```

## Active client calculation

A client counts toward the tier limit if:
1. `archived_at IS NULL`, AND
2. Has had activity (node/task/message created or updated) within the last 60 days, OR was created within the last 60 days

```typescript
// packages/billing/active-clients.ts

export async function countActiveClients(workspaceId: string): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT c.id) AS count
    FROM clients c
    WHERE c.workspace_id = ${workspaceId}
      AND c.archived_at IS NULL
      AND (
        c.created_at > ${cutoff}
        OR EXISTS (SELECT 1 FROM tracking_nodes n WHERE n.client_id = c.id AND n.updated_at > ${cutoff})
        OR EXISTS (SELECT 1 FROM tasks t WHERE t.client_id = c.id AND t.updated_at > ${cutoff})
        OR EXISTS (SELECT 1 FROM messages m WHERE m.client_id = c.id AND m.created_at > ${cutoff})
      )
  `);

  return Number(result[0].count);
}
```

This is recomputed via an Inngest nightly job and cached on `workspaces.active_clients_count` for fast reads. Live writes recalculate on demand for gate checks.

## Stripe webhook handling

All Stripe events hit `/api/webhooks/stripe/route.ts`, which:

1. Verifies the signature
2. Logs the event to `billing_events` table (idempotent on `stripe_event_id`)
3. Enqueues an Inngest job to handle the event
4. Returns 200 immediately (no long-running logic in the webhook handler)

Events we handle:

- `customer.subscription.created` → update `workspace.tier`, `subscription_status`
- `customer.subscription.updated` → update tier on change
- `customer.subscription.deleted` → set tier to `starter`, status to `canceled`
- `invoice.payment_failed` → set status to `past_due`, trigger email
- `invoice.payment_succeeded` → if was `past_due`, set to `active`
- `customer.subscription.trial_will_end` → trigger email
- `checkout.session.completed` → attach subscription to workspace

## Downgrade flow

Downgrades are **blocked in the UI** if current usage exceeds new tier limits. No overages, no soft-locks, no grace periods.

```typescript
export async function canDowngrade(workspaceId: string, toTier: TierId): Promise<CanResult> {
  const workspace = await getWorkspace(workspaceId);
  const newTier = TIERS[toTier];
  const activeClients = await countActiveClients(workspaceId);
  const paidSeats = await countPaidSeats(workspaceId);

  if (activeClients > newTier.clientLimit) {
    return {
      allowed: false,
      reason: `Active clients (${activeClients}) exceeds ${newTier.name} limit (${newTier.clientLimit}). Archive clients first.`,
    };
  }
  if (paidSeats > newTier.seatsIncluded) {
    return {
      allowed: false,
      reason: `Paid seats (${paidSeats}) exceeds ${newTier.name} limit (${newTier.seatsIncluded}). Remove members first.`,
    };
  }
  return { allowed: true };
}
```

## Abuse prevention

- **Unarchive throttling**: max 1 unarchive per client per 30 days (enforced in `canUnarchiveClient` gate)
- **Hard workspace cap**: `archived + active` cannot exceed 3× tier's `clientLimit` (prevents "archive everything then unarchive" abuse)
- **Active definition**: purely activity-based — idle clients don't count, prevents gaming

## When changing pricing

1. Update `TIERS` config
2. Create new Stripe Prices in the Stripe dashboard
3. Update `stripePriceIds` in config
4. Do NOT delete old Stripe Prices — existing subscribers stay on them
5. Write a decision note in `docs/DECISIONS.md`
6. Update marketing site pricing page (reads from same config)
7. Run `packages/billing` tests — all gates must still pass

## Common mistakes

- ❌ Hardcoding tier name in a condition (`if (tier === 'pro')`) — use feature flags from `tier.features`
- ❌ Comparing prices in code — use the config
- ❌ Calling Stripe SDK from `apps/*` — must go through `packages/billing`
- ❌ Charging overages — we don't; the product is clean-tier only
- ❌ Granting tier upgrades from code without a real Stripe subscription
- ❌ Forgetting to test the downgrade-blocking UI
