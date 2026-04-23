'use client';

import { useState } from 'react';

import { Button, toast } from '@phloz/ui';

export function BillingActions({
  workspaceId,
  hasStripeCustomer,
}: {
  workspaceId: string;
  hasStripeCustomer: boolean;
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

  async function openCheckout(tier: string, period: 'monthly' | 'annual' = 'monthly') {
    setLoading('checkout');
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/billing/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier, period }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? 'Could not start checkout');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
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
        onClick={() => openCheckout('pro')}
        disabled={loading !== null}
      >
        {loading === 'checkout' ? 'Redirecting…' : 'Upgrade to Pro'}
      </Button>
    </div>
  );
}
