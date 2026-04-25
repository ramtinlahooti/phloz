'use client';

import { useState } from 'react';

import { track, type EventMap } from '@phloz/analytics';
import { Button, toast } from '@phloz/ui';

type TierSlug = EventMap['begin_checkout']['tier'];

async function startCheckout(
  workspaceId: string,
  tier: TierSlug,
  period: 'monthly' | 'annual' = 'monthly',
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  // Fire begin_checkout *before* the redirect. GA4 recognises this
  // event name for ecommerce funnels; PostHog just records it.
  void track('begin_checkout', { tier, billing_period: period });
  const res = await fetch(
    `/api/workspaces/${workspaceId}/billing/checkout`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, period }),
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? 'Could not start checkout' };
  }
  const { url } = (await res.json()) as { url: string };
  return { ok: true, url };
}

export function BillingActions({
  workspaceId,
  hasStripeCustomer,
  recommendedTier = 'pro',
  recommendedTierLabel = 'Pro',
}: {
  workspaceId: string;
  hasStripeCustomer: boolean;
  /** Tier slug to upgrade to. Sourced from `?upgrade=<tier>` (set by
   *  the onboarding redirect for users who picked a paid plan during
   *  signup) or defaulted to 'pro'. */
  recommendedTier?: TierSlug;
  /** Pre-resolved display name to keep this client component free of
   *  `getTier` (and the billing package's whole bundle). */
  recommendedTierLabel?: string;
}) {
  const [loading, setLoading] = useState<'portal' | 'checkout' | null>(null);

  async function openPortal() {
    setLoading('portal');
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/billing/portal`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? 'Could not open billing portal');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } finally {
      setLoading(null);
    }
  }

  async function openCheckout() {
    setLoading('checkout');
    try {
      const res = await startCheckout(workspaceId, recommendedTier);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {hasStripeCustomer && (
        <Button
          variant="outline"
          size="sm"
          onClick={openPortal}
          disabled={loading !== null}
        >
          {loading === 'portal' ? 'Opening…' : 'Manage billing'}
        </Button>
      )}
      <Button
        size="sm"
        onClick={openCheckout}
        disabled={loading !== null}
      >
        {loading === 'checkout' ? 'Redirecting…' : `Upgrade to ${recommendedTierLabel}`}
      </Button>
    </div>
  );
}

/**
 * Per-card upgrade button used in the "Other plans" grid. Identical
 * checkout flow as `BillingActions`, but renders as a single inline
 * button so each plan card can drive its own upgrade.
 */
export function UpgradeTierButton({
  workspaceId,
  tier,
  label,
}: {
  workspaceId: string;
  tier: TierSlug;
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await startCheckout(workspaceId, tier);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Redirecting…' : label}
    </Button>
  );
}
