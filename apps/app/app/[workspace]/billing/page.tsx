import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { requireAdminOrOwner } from '@phloz/auth/roles';
import {
  getActiveClientCount,
  getTier,
  publicTiers,
} from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

import { BillingActions } from './billing-actions';

export const metadata = buildAppMetadata({ title: 'Billing' });

type RouteParams = { workspace: string };

export default async function BillingPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your plan and payment methods.
        </p>
      </header>

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
          />
        </CardContent>
      </Card>

      {otherTiers.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Other plans</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {otherTiers.map((t) => (
              <Card key={t.name}>
                <CardHeader>
                  <CardTitle>{t.displayName}</CardTitle>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
