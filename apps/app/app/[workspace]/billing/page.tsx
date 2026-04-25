import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import {
  getActiveClientCount,
  getTier,
  publicTiers,
} from '@phloz/billing';
import { TIER_NAMES, type TierName } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import { BillingActions, UpgradeTierButton } from './billing-actions';

export const metadata = buildAppMetadata({ title: 'Billing' });

type RouteParams = { workspace: string };
type SearchParams = { upgrade?: string };

/**
 * Resolve a paid-tier slug from `?upgrade=<tier>`. Onboarding
 * redirects users with a `signup_tier_hint` here so the upgrade is
 * one click away. Invalid values, the free tier, and enterprise
 * (which doesn't self-serve checkout) all fall through to the
 * default-`pro` recommendation.
 */
function resolveUpgradeHint(raw: string | undefined, currentTier: TierName) {
  if (!raw) return null;
  const safe = (TIER_NAMES as readonly string[]).includes(raw)
    ? (raw as TierName)
    : null;
  if (!safe) return null;
  if (safe === 'starter' || safe === 'enterprise') return null;
  if (safe === currentTier) return null;
  return safe;
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { workspace: workspaceId } = await params;
  assertValidWorkspaceId(workspaceId);
  const sp = await searchParams;
  await requireAdminOrOwner(workspaceId);

  const db = getDb();
  const [workspace, activeCount] = await Promise.all([
    db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .limit(1)
      .then((rows) => rows[0]),
    getActiveClientCount(workspaceId),
  ]);

  if (!workspace) redirect('/onboarding');

  const tier = getTier(workspace.tier);
  const otherTiers = publicTiers().filter(
    (t) => t.name !== workspace.tier && t.name !== 'enterprise',
  );

  const upgradeHint = resolveUpgradeHint(sp.upgrade, workspace.tier);
  const recommended = upgradeHint
    ? getTier(upgradeHint)
    : otherTiers.find((t) => t.name === 'pro') ?? otherTiers[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your plan and payment methods.
        </p>
      </header>

      {upgradeHint && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="flex items-start justify-between gap-4 py-4 text-sm">
            <div>
              <p className="font-medium text-foreground">
                Picked {recommended?.displayName} during signup?
              </p>
              <p className="mt-1 text-muted-foreground">
                One click to start a Stripe checkout for the{' '}
                {recommended?.displayName} plan.
              </p>
            </div>
            {recommended && (
              <UpgradeTierButton
                workspaceId={workspaceId}
                tier={recommended.name}
                label={`Upgrade to ${recommended.displayName}`}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <span className="text-muted-foreground">Current plan</span>
            <Badge variant="outline" className="capitalize">
              {workspace.subscriptionStatus ?? 'active'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{tier.displayName}</span>
            {tier.monthlyPriceUsd !== null && (
              <span className="text-muted-foreground">
                · ${tier.monthlyPriceUsd}/mo
              </span>
            )}
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              {activeCount} of{' '}
              {tier.clientLimit === 'unlimited' ? '∞' : tier.clientLimit} active
              clients
            </li>
            <li>
              {tier.includedSeats === 'unlimited'
                ? 'Unlimited'
                : tier.includedSeats}{' '}
              included paid seats
            </li>
          </ul>
          <BillingActions
            workspaceId={workspaceId}
            hasStripeCustomer={!!workspace.stripeCustomerId}
            recommendedTier={recommended?.name ?? 'pro'}
            recommendedTierLabel={recommended?.displayName ?? 'Pro'}
          />
        </CardContent>
      </Card>

      {otherTiers.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Other plans</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {otherTiers.map((t) => {
              const isRecommended = upgradeHint === t.name;
              return (
                <Card
                  key={t.name}
                  className={
                    isRecommended ? 'border-primary ring-2 ring-primary/30' : ''
                  }
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{t.displayName}</span>
                      {isRecommended && (
                        <Badge variant="outline" className="text-[10px]">
                          You picked this
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-xl font-semibold">
                      {t.monthlyPriceUsd === null
                        ? 'Custom'
                        : `$${t.monthlyPriceUsd}/mo`}
                    </p>
                    <p className="text-muted-foreground">
                      {t.clientLimit === 'unlimited'
                        ? 'Unlimited'
                        : `${t.clientLimit} clients`}
                    </p>
                    <UpgradeTierButton
                      workspaceId={workspaceId}
                      tier={t.name}
                      label={`Upgrade to ${t.displayName}`}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
