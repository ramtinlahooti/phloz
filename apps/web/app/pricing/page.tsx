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
