import { annualMonthlyEquivalent, publicTiers, type TierConfig } from '@phloz/billing';
import { Badge, buttonVariants } from '@phloz/ui';

import { TrackedCtaLink } from '@/components/analytics/tracked-cta-link';
import { NewsletterForm } from '@/components/newsletter-form';
import { buildMetadata, softwareApplicationJsonLd } from '@/lib/metadata';
import { SITE_CONFIG } from '@/lib/site-config';

function formatUsd(value: number | null): string {
  if (value === null) return 'Custom';
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function clientLimitLabel(tier: TierConfig): string {
  return tier.clientLimit === 'unlimited'
    ? 'Unlimited active clients'
    : `${tier.clientLimit} active client${tier.clientLimit === 1 ? '' : 's'}`;
}

function seatsLabel(tier: TierConfig): string {
  return tier.includedSeats === 'unlimited'
    ? 'Unlimited included seats'
    : `${tier.includedSeats} included seats`;
}

export const metadata = buildMetadata({
  title: 'CRM + work management for digital marketing agencies',
  description: SITE_CONFIG.description,
  path: '/',
});

const FEATURES = [
  {
    title: 'One place for every client',
    body: 'Clients, contacts, projects, tasks, messages, files — all under a single workspace. No more switching tabs between Asana, HubSpot, and a shared Drive folder.',
  },
  {
    title: 'The tracking infrastructure map',
    body: 'A typed graph of every GA4 property, GTM container, pixel, conversion, and audience — per client. When a pixel breaks, you know where it lives and who owns it.',
  },
  {
    title: 'Work management that fits agency workflows',
    body: 'Tasks, boards, timelines, approvals. Role-based views for PPC, SEO, social, CRO, web design. Client portals with magic-link access, no passwords.',
  },
  {
    title: 'Built-in email + chat',
    body: 'Forward client emails to your inbound address and they auto-thread against the right client. Internal chat threads live next to the work, not in Slack.',
  },
  {
    title: 'Cross-client reporting, finally',
    body: 'See every client\'s performance in one view. Filter by department, status, tier. Export to CSV or pipe into BigQuery.',
  },
  {
    title: 'Fair pricing for how agencies actually grow',
    body: 'Pay per active client, not per seat. Your 10-person team doesn\'t pay for 10 licences to run 3 clients.',
  },
];

const SOCIAL_PROOF_POINTS = [
  '30-day money back — no questions',
  'SOC 2 roadmap',
  'GDPR-compliant',
  'Data exports in one click',
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd()),
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6">
              New: tracking infrastructure map
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              The CRM + work management platform purpose-built for digital
              marketing agencies.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              Clients, projects, tasks, approvals, and a typed map of every
              pixel, tag, and audience you manage — in one workspace. Pay for
              active clients, not per seat.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <TrackedCtaLink
                href={`${SITE_CONFIG.appUrl}/signup`}
                className={buttonVariants({ size: 'lg' })}
                ctaLocation="homepage_hero"
                ctaLabel="start_free_no_cc"
              >
                Start free — no credit card
              </TrackedCtaLink>
              <TrackedCtaLink
                href="/features"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
                ctaLocation="homepage_hero"
                ctaLabel="see_every_feature"
              >
                See every feature
              </TrackedCtaLink>
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {SOCIAL_PROOF_POINTS.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything your agency runs on, in one workspace.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Most agency stacks are 6–8 tools duct-taped together. Phloz
              replaces the ones that matter and integrates the rest.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="rounded-lg border border-border/60 bg-card/30 p-6"
              >
                <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing summary */}
      <PricingSummary />

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to see every client, every task, and every pixel in one place?
          </h2>
          <p className="mt-4 text-muted-foreground">
            14 days free on any paid plan. Bring your team, your clients, and
            your existing tools — we integrate with the ones that matter.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <TrackedCtaLink
              href={`${SITE_CONFIG.appUrl}/signup`}
              className={buttonVariants({ size: 'lg' })}
              ctaLocation="homepage_bottom"
              ctaLabel="start_free_trial"
            >
              Start your free trial
            </TrackedCtaLink>
            <TrackedCtaLink
              href="/pricing"
              className={buttonVariants({ variant: 'ghost', size: 'lg' })}
              ctaLocation="homepage_bottom"
              ctaLabel="view_pricing"
            >
              View pricing →
            </TrackedCtaLink>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Agency operations, twice a month.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Short, practical essays on tracking infrastructure, client
            operations, and what's changing in paid media. No spam.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <NewsletterForm
              source="homepage_bottom"
              submitLabel="Subscribe"
            />
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Compact pricing strip for the homepage. Mirrors the full pricing
 * page's tier set + Growth-as-most-popular highlight, but trims each
 * card to price + main caps + a CTA so the homepage stays browsable.
 * Full plan comparison + FAQ live at /pricing.
 */
function PricingSummary() {
  const tiers = publicTiers();
  return (
    <section
      id="pricing"
      className="border-b border-border/60 bg-card/20"
    >
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Pay per active client, not per seat.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Six plans from free to unlimited. Client portals are free on
            every tier — only your team counts against the seat cap.
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {tiers.map((tier) => {
            const isFeatured = tier.name === 'growth';
            const annualMonthly = annualMonthlyEquivalent(tier.name);
            return (
              <article
                key={tier.name}
                className={`relative flex flex-col rounded-xl border p-5 ${
                  isFeatured
                    ? 'border-primary bg-card/60 ring-1 ring-primary'
                    : 'border-border/60 bg-card/30'
                }`}
              >
                {isFeatured && (
                  <Badge className="absolute -top-3 left-5 text-[10px]">
                    Most popular
                  </Badge>
                )}
                <h3 className="text-base font-semibold text-foreground">
                  {tier.displayName}
                </h3>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">
                    {formatUsd(tier.monthlyPriceUsd)}
                  </span>
                  {tier.monthlyPriceUsd !== null && (
                    <span className="text-xs text-muted-foreground">/mo</span>
                  )}
                </p>
                {annualMonthly !== null && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatUsd(annualMonthly)}/mo billed annually
                  </p>
                )}
                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <li>{clientLimitLabel(tier)}</li>
                  <li>{seatsLabel(tier)}</li>
                  <li>Unlimited client portal users</li>
                </ul>
                <TrackedCtaLink
                  href={
                    tier.name === 'enterprise'
                      ? '/contact'
                      : `${SITE_CONFIG.appUrl}/signup?tier=${tier.name}`
                  }
                  className={`${buttonVariants({
                    variant: isFeatured ? 'default' : 'outline',
                    size: 'sm',
                  })} mt-6 w-full`}
                  ctaLocation="homepage_pricing"
                  ctaLabel={`tier_${tier.name}`}
                >
                  {tier.name === 'starter'
                    ? 'Start free'
                    : tier.name === 'enterprise'
                      ? 'Contact sales'
                      : 'Start trial'}
                </TrackedCtaLink>
              </article>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <TrackedCtaLink
            href="/pricing"
            className={buttonVariants({ variant: 'ghost', size: 'md' })}
            ctaLocation="homepage_pricing"
            ctaLabel="compare_all_plans"
          >
            Compare all plans + FAQ →
          </TrackedCtaLink>
        </div>
      </div>
    </section>
  );
}
