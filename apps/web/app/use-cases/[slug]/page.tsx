import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonVariants } from '@phloz/ui';

import { buildMetadata } from '@/lib/metadata';
import { SITE_CONFIG, USE_CASES, type UseCaseSlug } from '@/lib/site-config';

type RouteParams = { slug: UseCaseSlug };

const CONTENT: Record<UseCaseSlug, {
  title: string;
  description: string;
  hero: string;
  body: { heading: string; paragraph: string }[];
}> = {
  'client-onboarding-audit': {
    title: 'Client onboarding audit',
    description:
      'Run a repeatable, one-hour audit of every new client\'s existing tracking, accounts, and tooling — before you write a single line of strategy.',
    hero: 'Every agency loses weeks on week-one discovery. Phloz gives you a repeatable audit template that maps every existing pixel, property, audience, and account in 60 minutes flat.',
    body: [
      {
        heading: 'Why onboarding audits fall apart',
        paragraph:
          'New client, new set of 47 logins, 3 versions of the tracking setup document, and a GA4 property nobody can find the owner of. By week 3 you\'ve billed 20 hours of discovery and haven\'t started the work.',
      },
      {
        heading: 'What Phloz gives you',
        paragraph:
          'A templated tracking map per client: GA4 + GTM + each ad pixel + conversion events + audiences. Typed nodes so you know what fields to fill. A "verified / broken / missing" state per node. An audit checklist you can reuse across every client.',
      },
      {
        heading: 'The outcome',
        paragraph:
          'By end of week one you have a complete map of what exists, what\'s broken, what\'s missing, and what the strategy needs. Scoped and billable, not a burnt retainer.',
      },
    ],
  },
  'tracking-infrastructure-map': {
    title: 'Tracking infrastructure map',
    description:
      'A typed graph of every GA4 property, GTM container, pixel, conversion, and audience — per client. Find any tracking object in 30 seconds.',
    hero: 'The thing no other agency platform has: a typed, relational map of every pixel, tag, property, and audience you manage — across every client.',
    body: [
      {
        heading: 'The spreadsheet problem',
        paragraph:
          'Most agencies document tracking in a Google Sheet per client. Three problems: no relationships, no health state, no types. When something breaks, it lives in one person\'s head.',
      },
      {
        heading: 'The graph approach',
        paragraph:
          'Phloz models tracking as a graph: typed nodes (GA4, GTM, Meta, Google Ads, TikTok, Microsoft, audiences, UTMs, pages) and typed edges (fires-on, owned-by, depends-on). Click a node — see every pixel that depends on it, every ad account that owns it, every page it fires on.',
      },
      {
        heading: 'What you get',
        paragraph:
          'A single visual graph per client. Health states (working / broken / missing / unverified) you can filter by. Last-verified timestamps. "Who owns this?" answerable in one click. And a clean export to JSON so you can pipe it into whatever comes next.',
      },
    ],
  },
  'cross-client-reporting': {
    title: 'Cross-client reporting',
    description:
      'See every campaign, every open task, every pending approval across every client — in one view. No BI tool required.',
    hero: 'Stop building the weekly all-clients report in Looker Studio. Phloz gives you the cross-client operational view agencies actually need.',
    body: [
      {
        heading: 'What most tools give you',
        paragraph:
          'Either a single-client view (any PM tool) or a BI dashboard (Databox, Looker) that requires engineering to set up. Neither is right for the agency ops lead who just wants to know "what\'s on fire this week."',
      },
      {
        heading: 'What Phloz gives you',
        paragraph:
          'A cross-client operational surface: every task across every client, filterable by tier, department, status, owner. Every tracking-map node in a broken state, across every client. Every pending approval. One page, no engineering.',
      },
      {
        heading: 'The upgrade in V2',
        paragraph:
          'V2 adds pipe-to-BigQuery and Looker-compatible views for agencies that need the reporting layer on top. V1 gives you the operational layer that Looker can\'t.',
      },
    ],
  },
  'agency-pm': {
    title: 'Agency project management',
    description:
      'Tasks, boards, timelines, approvals — with role-based views per department. Built for how PPC, SEO, social, CRO, and web design actually work.',
    hero: 'Most PM tools are generic. Phloz ships with agency-shaped defaults — department views, tracking-connected tasks, client-scoped context.',
    body: [
      {
        heading: 'Generic PM tools vs agency PM',
        paragraph:
          'Asana is clean but generic. ClickUp is powerful but overwhelming. Neither knows the difference between a PPC task and an SEO task. You end up building custom fields, custom views, and custom statuses per client. Every agency builds the same thing 40 times.',
      },
      {
        heading: 'What Phloz ships with',
        paragraph:
          'Departments (PPC, SEO, social, CRO, web design) as a first-class field. Per-department views that show the tasks each role cares about. Task templates per common agency workflow (new campaign launch, monthly report, pixel audit). Approvals built in, not bolted on.',
      },
      {
        heading: 'Connected to the tracking map',
        paragraph:
          'When the PPC manager marks a pixel as broken in the tracking map, a task is auto-created for the right person. The work and the infrastructure it depends on are in the same tool.',
      },
    ],
  },
};

export function generateStaticParams(): RouteParams[] {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const content = CONTENT[slug];
  if (!content) return buildMetadata({ title: 'Use case not found' });
  return buildMetadata({
    title: content.title,
    description: content.description,
    path: `/use-cases/${slug}`,
  });
}

export default async function UseCasePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const content = CONTENT[slug];
  if (!content) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Use case
        </p>
        <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {content.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{content.hero}</p>
      </header>

      <div className="phloz-prose">
        {content.body.map((section) => (
          <div key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.paragraph}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Link
          href={`${SITE_CONFIG.appUrl}/signup`}
          className={buttonVariants({ size: 'lg' })}
        >
          Start your free trial
        </Link>
      </div>
    </div>
  );
}
