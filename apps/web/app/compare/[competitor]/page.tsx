import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonVariants } from '@phloz/ui';

import { buildMetadata } from '@/lib/metadata';
import { COMPETITORS, SITE_CONFIG, type CompetitorSlug } from '@/lib/site-config';

type RouteParams = { competitor: CompetitorSlug };

const BLURBS: Record<CompetitorSlug, { tagline: string; missing: string[] }> = {
  hubspot: {
    tagline:
      'HubSpot is a CRM built for sales teams selling a product. Phloz is built for agencies selling a service.',
    missing: [
      'Per-active-client pricing (HubSpot charges per seat and per contact record)',
      'Tracking infrastructure map',
      'Role-based agency views (PPC / SEO / social)',
      'Free unlimited client portal access',
    ],
  },
  monday: {
    tagline:
      'Monday is a flexible work OS. Phloz is opinionated for agency ops, with CRM + tracking built in.',
    missing: [
      'Native CRM (Monday has add-ons, not a CRM)',
      'Tracking infrastructure map',
      'Client portals with magic-link auth',
      'Per-active-client pricing model',
    ],
  },
  clickup: {
    tagline:
      'ClickUp is a general-purpose PM tool. Phloz is agency-specific and ships with CRM + tracking in the core.',
    missing: [
      'Integrated CRM (ClickUp has "ClickUp CRM" views, not a full CRM)',
      'Tracking infrastructure map',
      'Per-active-client pricing',
      'Native inbound email threading per client',
    ],
  },
  asana: {
    tagline:
      'Asana is a clean PM tool. Phloz combines Asana-grade work management with an agency-shaped CRM.',
    missing: [
      'CRM for clients/deals/contacts',
      'Tracking infrastructure map',
      'Client portals',
      'Agency-specific departmental views',
    ],
  },
  notion: {
    tagline:
      'Notion is a blank canvas. Phloz is pre-assembled for agencies, with real CRM schemas and a tracking graph you don\'t have to build.',
    missing: [
      'Real relational data model (Notion\'s databases flatten relationships)',
      'Tracking infrastructure map with typed nodes',
      'Billing tier enforcement',
      'Client portals with magic-link auth',
    ],
  },
  teamwork: {
    tagline:
      'Teamwork is agency-focused PM. Phloz adds the tracking infrastructure map Teamwork doesn\'t have.',
    missing: [
      'Tracking infrastructure map',
      'Typed tracking-node schemas (GA4, GTM, Meta, Google Ads)',
      'Per-active-client pricing (Teamwork is per-seat)',
    ],
  },
  productive: {
    tagline:
      'Productive is built for agencies. Phloz covers the same ground and adds the tracking map + deeper per-client pricing.',
    missing: [
      'Tracking infrastructure map',
      'Typed tracking-node schemas',
      'Free unlimited client portal access',
    ],
  },
  rocketlane: {
    tagline:
      'Rocketlane is client-onboarding focused. Phloz is the platform you run the whole agency on, not just onboarding.',
    missing: [
      'Full CRM (contacts, deals, long-term relationships)',
      'Tracking infrastructure map',
      'Per-active-client pricing',
    ],
  },
  functionpoint: {
    tagline:
      'Function Point covers agency ops and accounting. Phloz covers agency ops and tracking, with modern UX.',
    missing: [
      'Tracking infrastructure map',
      'Modern, fast UI',
      'Per-active-client pricing transparency',
    ],
  },
  accelo: {
    tagline:
      'Accelo is professional services automation. Phloz is agency-specific with the tracking map baked in.',
    missing: [
      'Tracking infrastructure map',
      'Agency-shaped department views',
      'Modern pricing model',
    ],
  },
};

export function generateStaticParams(): RouteParams[] {
  return COMPETITORS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { competitor } = await params;
  const match = COMPETITORS.find((c) => c.slug === competitor);
  if (!match) return buildMetadata({ title: 'Comparison not found' });
  return buildMetadata({
    title: `Phloz vs ${match.name}`,
    description: `How Phloz compares to ${match.name} for digital marketing agencies. Per-active-client pricing, tracking infrastructure map, and agency-specific workflows.`,
    path: `/compare/${competitor}`,
  });
}

export default async function ComparePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { competitor } = await params;
  const match = COMPETITORS.find((c) => c.slug === competitor);
  if (!match) notFound();
  const blurb = BLURBS[match.slug];

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Compare
        </p>
        <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Phloz vs {match.name}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{blurb.tagline}</p>
      </header>

      <section className="rounded-xl border border-border/60 bg-card/30 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-foreground">
          What Phloz has that {match.name} doesn&apos;t
        </h2>
        <ul className="mt-4 space-y-3">
          {blurb.missing.map((b) => (
            <li key={b} className="flex gap-3 text-sm text-foreground/90">
              <span
                className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-xl border border-border/60 bg-card/30 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-foreground">
          When {match.name} is the right choice
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          If you&apos;re not running a digital marketing agency, {match.name}{' '}
          is likely a fine fit. {match.name} is a mature, capable product —
          it just isn&apos;t shaped for our specific use case. Phloz exists
          because we couldn&apos;t find a platform that treated agency ops
          and tracking infrastructure as first-class.
        </p>
      </section>

      <div className="mt-16 text-center">
        <Link
          href={`${SITE_CONFIG.appUrl}/signup`}
          className={buttonVariants({ size: 'lg' })}
        >
          Try Phloz free
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">
          14 days free · No credit card · Starter tier free forever
        </p>
      </div>
    </div>
  );
}
