import type { BillingPeriod, TierName } from '@phloz/config';

/**
 * Every tier knob lives here. When adding a new tier or changing limits:
 *  1. Edit this file.
 *  2. Create matching Stripe Products + Prices and paste the IDs below.
 *  3. `pnpm check` in packages/billing to ensure the tier tests still pass.
 *  4. Commit — no other code changes required (all gates read from TIERS).
 *
 * Prices mirror ARCHITECTURE.md §7.1. USD only at launch.
 */
export type TierConfig = {
  name: TierName;
  displayName: string;
  /** Maximum active clients. Number, or 'unlimited' for enterprise. */
  clientLimit: number | 'unlimited';
  /** Paid-seat roles (owner/admin/member) count against this. Viewers don't. */
  includedSeats: number | 'unlimited';
  /**
   * Maximum recurring task templates. Templates run as a workspace-wide
   * Inngest cron — capping prevents free workspaces from spawning
   * thousands of background tasks. 'unlimited' is enterprise-only.
   */
  recurringTemplateLimit: number | 'unlimited';
  /** Per-month price for an extra paid seat, or null if not purchasable. */
  extraSeatPriceUsd: number | null;
  /** Base plan price. null = free or custom. */
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  monthlyStripePriceId: string | null;
  annualStripePriceId: string | null;
  extraSeatStripePriceId: string | null;
  /** Show on the public /pricing page. */
  public: boolean;
};

export const TIERS: Record<TierName, TierConfig> = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    clientLimit: 1,
    includedSeats: 2,
    recurringTemplateLimit: 2,
    extraSeatPriceUsd: null,
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    monthlyStripePriceId: null,
    annualStripePriceId: null,
    extraSeatStripePriceId: null,
    public: true,
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    clientLimit: 10,
    includedSeats: 5,
    recurringTemplateLimit: 25,
    extraSeatPriceUsd: 9.99,
    monthlyPriceUsd: 29.99,
    annualPriceUsd: 299.99,
    // Stripe sandbox (acct_1RXbVlPomvpsIeGO) — product prod_UOFldR2CCkSDqS
    monthlyStripePriceId: 'price_1TPTGNPomvpsIeGOPCm3bWjE',
    annualStripePriceId: 'price_1TPTGQPomvpsIeGOS9CCvxgp',
    extraSeatStripePriceId: 'price_1TPTGTPomvpsIeGOLEQ7YUHz',
    public: true,
  },
  growth: {
    name: 'growth',
    displayName: 'Growth',
    clientLimit: 30,
    includedSeats: 8,
    recurringTemplateLimit: 75,
    extraSeatPriceUsd: 9.99,
    monthlyPriceUsd: 59.99,
    annualPriceUsd: 599.99,
    // Stripe sandbox — product prod_UOFlJvP0zTegxV
    monthlyStripePriceId: 'price_1TPTGWPomvpsIeGO51I6kbXN',
    annualStripePriceId: 'price_1TPTGZPomvpsIeGOnUDvByqs',
    extraSeatStripePriceId: 'price_1TPTGdPomvpsIeGObbDRlBd3',
    public: true,
  },
  business: {
    name: 'business',
    displayName: 'Business',
    clientLimit: 100,
    includedSeats: 15,
    recurringTemplateLimit: 250,
    extraSeatPriceUsd: 7.99,
    monthlyPriceUsd: 149.99,
    annualPriceUsd: 1499.99,
    // Stripe sandbox — product prod_UOFl7RRqfyEmce
    monthlyStripePriceId: 'price_1TPTGgPomvpsIeGO4c372DGA',
    annualStripePriceId: 'price_1TPTGjPomvpsIeGO2HDfoF6c',
    extraSeatStripePriceId: 'price_1TPTGmPomvpsIeGOWUjOl91X',
    public: true,
  },
  scale: {
    name: 'scale',
    displayName: 'Scale',
    clientLimit: 250,
    includedSeats: 30,
    recurringTemplateLimit: 750,
    extraSeatPriceUsd: 5.99,
    monthlyPriceUsd: 299.99,
    annualPriceUsd: 2999.99,
    // Stripe sandbox — product prod_UOFlG1UTSfSyGe
    monthlyStripePriceId: 'price_1TPTGpPomvpsIeGOHpKjuvM0',
    annualStripePriceId: 'price_1TPTGsPomvpsIeGOuOxL39d0',
    extraSeatStripePriceId: 'price_1TPTGvPomvpsIeGO4pp4ZDXI',
    public: true,
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    clientLimit: 'unlimited',
    includedSeats: 'unlimited',
    recurringTemplateLimit: 'unlimited',
    extraSeatPriceUsd: null,
    monthlyPriceUsd: null,
    annualPriceUsd: null,
    monthlyStripePriceId: null,
    annualStripePriceId: null,
    extraSeatStripePriceId: null,
    public: false,
  },
};

const ORDER: TierName[] = ['starter', 'pro', 'growth', 'business', 'scale', 'enterprise'];

export function getTier(name: TierName): TierConfig {
  const tier = TIERS[name];
  if (!tier) throw new Error(`Unknown tier: ${name}`);
  return tier;
}

/** Returns the next tier up from `current`, or null if already at top. */
export function nextTier(current: TierName): TierName | null {
  const idx = ORDER.indexOf(current);
  if (idx === -1 || idx >= ORDER.length - 1) return null;
  return ORDER[idx + 1] ?? null;
}

/** Returns the previous tier down from `current`, or null if already at bottom. */
export function previousTier(current: TierName): TierName | null {
  const idx = ORDER.indexOf(current);
  if (idx <= 0) return null;
  return ORDER[idx - 1] ?? null;
}

/** Tiers that should appear on the public pricing page, in display order. */
export function publicTiers(): TierConfig[] {
  return ORDER.map((name) => TIERS[name]).filter((t): t is TierConfig => Boolean(t?.public));
}

/** The Stripe price id for a given tier + billing period, or null. */
export function stripePriceIdFor(
  tier: TierName,
  period: BillingPeriod,
): string | null {
  const cfg = getTier(tier);
  return period === 'annual' ? cfg.annualStripePriceId : cfg.monthlyStripePriceId;
}

/** Monthly-equivalent price for an annual plan, for marketing display. */
export function annualMonthlyEquivalent(tier: TierName): number | null {
  const cfg = getTier(tier);
  if (cfg.annualPriceUsd == null) return null;
  return Math.round((cfg.annualPriceUsd / 12) * 100) / 100;
}
