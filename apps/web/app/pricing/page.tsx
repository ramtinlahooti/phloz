import { annualMonthlyEquivalent, publicTiers, type TierConfig } from '@phloz/billing';
import { Badge, buttonVariants } from '@phloz/ui';

import { buildMetadata } from '@/lib/metadata';
import { SITE_CONFIG } from '@/lib/site-config';

import { PricingTierCta } from './tier-cta';

export const metadata = buildMetadata({
  title: 'Pricing',
  description:
    'Per-active-client pricing. Six tiers from free to unlimited. Pay for your book of business, not your team size.',
  path: '/pricing',
});

function formatUsd(value: number | null): string {
  if (value === null) return 'Custom';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function clientLimitLabel(tier: TierConfig): string {
  return tier.clientLimit === 'unlimited'
    ? 'Unlimited active clients'
    : `Up to ${tier.clientLimit} active clients`;
}

function seatsLabel(tier: TierConfig): string {
  return tier.includedSeats === 'unlimited'
    ? 'Unlimited included seats'
    : `${tier.includedSeats} included paid seats`;
}

function extraSeatLabel(tier: TierConfig): string | null {
  if (tier.extraSeatPriceUsd === null) return null;
  return `Extra seats ${formatUsd(tier.extraSeatPriceUsd)}/mo`;
}

export default function PricingPage() {
  const tiers = publicTiers();
  const faqs = [
    {
      q: 'What counts as an "active" client?',
      a: 'A client is active if it has had any activity (task, message, file, comment, tracking-map edit) in the last 60 days. Archived or dormant clients don\'t count against your cap.',
    },
    {
      q: 'What if I exceed my client cap?',
      a: 'You get a soft warning at 80% and a hard block at 100%. Unarchive an old client only if you have room. Upgrade anytime — proration is automatic.',
    },
    {
      q: 'Do client portal users count as seats?',
      a: 'No. Client portal access is free and unlimited on every paid tier. Only internal team members (owner, admin, member) count against your seat cap.',
    },
    {
      q: 'Can I switch tiers?',
      a: 'Yes, anytime. Downgrades are allowed as long as your active-client count fits the lower tier. Upgrades are instant with prorated billing.',
    },
    {
      q: 'Is there a free trial?',
      a: 'Yes — 14 days on any paid plan, no credit card required. The Starter tier is free forever for one client.',
    },
    {
      q: 'Do you offer annual discounts?',
      a: 'Annual plans save roughly 17% (two months free). Billed once per year.',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Simple, predictable pricing for agencies.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Pay per active client. Extra seats are cheap. Client portals are free.
          No surprises.
        </p>
      </header>

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiers.map((tier) => {
          const isFeatured = tier.name === 'growth';
          const annualMonthly = annualMonthlyEquivalent(tier.name);
          return (
            <article
              key={tier.name}
              className={`relative flex flex-col rounded-xl border p-6 ${
                isFeatured
                  ? 'border-primary bg-card/50 ring-1 ring-primary'
                  : 'border-border/60 bg-card/30'
              }`}
            >
              {isFeatured && (
                <Badge className="absolute -top-3 left-6">Most popular</Badge>
              )}
              <h2 className="text-lg font-semibold text-foreground">
                {tier.displayName}
              </h2>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">
                  {formatUsd(tier.monthlyPriceUsd)}
                </span>
                {tier.monthlyPriceUsd !== null && (
                  <span className="text-sm text-muted-foreground">/mo</span>
                )}
              </p>
              {annualMonthly !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  or {formatUsd(annualMonthly)}/mo billed annually
                </p>
              )}

              <ul className="mt-6 space-y-2 text-sm text-foreground/90">
                <li>{clientLimitLabel(tier)}</li>
                <li>{seatsLabel(tier)}</li>
                {extraSeatLabel(tier) && <li>{extraSeatLabel(tier)}</li>}
                <li>Unlimited client portal users</li>
                <li>Tracking infrastructure map</li>
                {tier.name !== 'starter' && <li>Email + inbound threading</li>}
                {(tier.name === 'business' ||
                  tier.name === 'scale' ||
                  tier.name === 'enterprise') && <li>Priority support</li>}
                {tier.name === 'enterprise' && <li>Custom SSO + SLA</li>}
              </ul>

              <PricingTierCta
                tier={tier.name}
                href={
                  tier.name === 'enterprise'
                    ? '/contact'
                    : `${SITE_CONFIG.appUrl}/signup?tier=${tier.name}`
                }
                className={`${buttonVariants({
                  variant: isFeatured ? 'default' : 'outline',
                  size: 'md',
                })} mt-8 w-full`}
                label={
                  tier.name === 'starter'
                    ? 'Start free'
                    : tier.name === 'enterprise'
                      ? 'Contact sales'
                      : 'Start free trial'
                }
              />
            </article>
          );
        })}
      </div>

      <ComparisonTable tiers={tiers} />

      <section className="mt-24">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <dl className="mx-auto mt-8 max-w-3xl divide-y divide-border/60">
          {faqs.map((faq) => (
            <div key={faq.q} className="py-6">
              <dt className="text-base font-semibold text-foreground">{faq.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/** Side-by-side tier matrix. Pulls every numeric cap from the same
 *  `publicTiers()` source as the cards above, so adding a tier or
 *  changing a limit in `packages/billing/tiers.ts` updates this table
 *  with no edits here. Yes/no rows hardcode the platform features
 *  that are universal vs gated. Horizontal scroll on narrow screens
 *  keeps the matrix scannable without truncation. */
function ComparisonTable({ tiers }: { tiers: TierConfig[] }) {
  const formatLimit = (limit: number | 'unlimited'): string =>
    limit === 'unlimited' ? 'Unlimited' : limit.toLocaleString('en-US');

  return (
    <section className="mt-24">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
        Compare plans
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
        Every plan includes the core platform — tracking infrastructure
        map, agency CRM, unlimited client portal users. Higher tiers
        raise the caps on clients, seats, and recurring work.
      </p>
      <div className="mt-8 overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-card/40">
            <tr className="border-b border-border/60">
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-foreground/80"
              >
                Feature
              </th>
              {tiers.map((tier) => {
                const isFeatured = tier.name === 'growth';
                return (
                  <th
                    key={tier.name}
                    scope="col"
                    className={`px-4 py-3 text-center font-semibold ${
                      isFeatured ? 'text-foreground' : 'text-foreground/80'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{tier.displayName}</span>
                      {isFeatured && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                          Most popular
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-border/60">
            <ComparisonRow
              label="Active clients"
              tiers={tiers}
              cell={(t) => formatLimit(t.clientLimit)}
            />
            <ComparisonRow
              label="Included paid seats"
              tiers={tiers}
              cell={(t) => formatLimit(t.includedSeats)}
            />
            <ComparisonRow
              label="Extra seat price"
              tiers={tiers}
              cell={(t) =>
                t.extraSeatPriceUsd === null
                  ? '—'
                  : `${formatUsd(t.extraSeatPriceUsd)}/mo`
              }
            />
            <ComparisonRow
              label="Recurring task templates"
              tiers={tiers}
              cell={(t) => formatLimit(t.recurringTemplateLimit)}
            />
            <ComparisonRow
              label="Tracking infrastructure map"
              tiers={tiers}
              cell={() => <CheckCell />}
            />
            <ComparisonRow
              label="Client portal users"
              tiers={tiers}
              cell={() => 'Unlimited'}
            />
            <ComparisonRow
              label="Email + inbound threading"
              tiers={tiers}
              cell={(t) => (t.name === 'starter' ? '—' : <CheckCell />)}
            />
            <ComparisonRow
              label="Priority support"
              tiers={tiers}
              cell={(t) =>
                t.name === 'business' || t.name === 'scale' ? (
                  <CheckCell />
                ) : (
                  '—'
                )
              }
            />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Need more than {formatLimit(tiers[tiers.length - 1]?.clientLimit ?? 'unlimited')}{' '}
        clients?{' '}
        <a className="underline hover:text-foreground" href="/contact">
          Talk to us about Enterprise
        </a>
        .
      </p>
    </section>
  );
}

function ComparisonRow({
  label,
  tiers,
  cell,
}: {
  label: string;
  tiers: TierConfig[];
  cell: (tier: TierConfig) => React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="px-4 py-3 text-left font-medium text-foreground/80"
      >
        {label}
      </th>
      {tiers.map((tier) => (
        <td
          key={tier.name}
          className={`px-4 py-3 text-center ${
            tier.name === 'growth'
              ? 'bg-primary/[0.04] text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          {cell(tier)}
        </td>
      ))}
    </tr>
  );
}

function CheckCell() {
  return (
    <span
      className="inline-flex items-center justify-center text-primary"
      aria-label="Included"
      title="Included"
    >
      <svg
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 10.5l4 4 8-9" />
      </svg>
    </span>
  );
}
