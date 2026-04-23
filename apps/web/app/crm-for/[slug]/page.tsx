import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonVariants } from '@phloz/ui';

import { buildMetadata } from '@/lib/metadata';
import { DEPARTMENTS, SITE_CONFIG, type DepartmentSlug } from '@/lib/site-config';

type RouteParams = { slug: DepartmentSlug };

const CONTENT: Record<DepartmentSlug, {
  tagline: string;
  whyYouCare: string;
  phlozGives: string[];
}> = {
  ppc: {
    tagline:
      'A CRM + work management + tracking platform built for PPC agencies. See every active campaign, every ad account, every pixel across every client in one view.',
    whyYouCare:
      'PPC work lives and dies by tracking. If conversions aren\'t firing, budgets burn with nothing to optimize against. Phloz treats tracking infrastructure as a first-class citizen, not an afterthought.',
    phlozGives: [
      'Per-client tracking map — every Google Ads conversion action, Meta pixel, GA4 property, audience list.',
      'Health states per pixel (working / broken / missing / unverified).',
      'Budget pacing and campaign-status views across every client.',
      'Role-based PPC view so campaign managers see campaign-shaped work, not SEO tickets.',
    ],
  },
  seo: {
    tagline:
      'CRM + work management + tracking for SEO agencies. Audit, track, and manage every client\'s technical SEO and content ops from one workspace.',
    whyYouCare:
      'SEO teams juggle technical audits, content ops, link tracking, GSC data, ranking reports — across 20+ clients. Most tools make you either generalize or specialize. Phloz lets you do both.',
    phlozGives: [
      'Content ops views — briefs, drafts, review, publish, update.',
      'Technical audit templates as reusable task bundles.',
      'Per-client tracking map including GA4 + GSC + schema markup status.',
      'Client portals for stakeholders who want to see progress without a login.',
    ],
  },
  'social-media': {
    tagline:
      'CRM + work management for social media agencies. Content calendars, approvals, and client-scoped asset storage, integrated with your tracking setup.',
    whyYouCare:
      'Social ops is approval-heavy. Every post needs a brand review, a client sign-off, a schedule, a cross-post plan. Phloz bakes approvals in, so nothing ships without the right eyes on it.',
    phlozGives: [
      'Content calendar per client with approval gates.',
      'Approval workflows (creative → brand → client).',
      'Per-client tracking map including Meta pixel, TikTok pixel, and pixel audiences.',
      'Client portals for asset sign-off without email chains.',
    ],
  },
  cro: {
    tagline:
      'CRM + work management for CRO agencies. Document every test hypothesis, every variant, every tracking requirement — tied to the client\'s tracking map.',
    whyYouCare:
      'CRO work depends on correct tracking. If your event isn\'t firing, your test isn\'t a test. Phloz ties every experiment directly to the tracking nodes it relies on.',
    phlozGives: [
      'Experiment documentation templates (hypothesis, variants, metrics, duration).',
      'Tracking-dependency links — a test points at the GA4 event(s) it depends on.',
      'Client-scoped results archive so last year\'s tests are still discoverable.',
      'Role-based CRO views.',
    ],
  },
  'web-design': {
    tagline:
      'Project management for web design agencies. Design phases, client approvals, dev handoff, and post-launch tracking setup — one workspace, one client view.',
    whyYouCare:
      'Web design projects end the day the site launches — and then the tracking setup starts. Most agencies treat these as separate projects. Phloz keeps them connected.',
    phlozGives: [
      'Design-phase boards (discovery → wireframe → design → build → QA).',
      'Client approvals at each phase gate.',
      'Launch-day tracking-map template: GA4 property, GTM container, conversions, pixels, confirmed on the new URL.',
      'Post-launch retainer hand-off with zero context loss.',
    ],
  },
  'performance-marketing': {
    tagline:
      'CRM + work management for performance marketing agencies. Track every client\'s funnel, every ad account, every tracking event across every channel.',
    whyYouCare:
      'Performance marketing touches every channel — paid, SEO, CRO, email, social. Phloz is the only platform that gives you a single cross-channel operational view per client.',
    phlozGives: [
      'Cross-channel tracking map (GA4 + every ad platform + Klaviyo + whatever else).',
      'Funnel-level reporting across every client.',
      'Per-channel department views for specialists.',
      'Client portals with opinionated reporting templates.',
    ],
  },
  ecommerce: {
    tagline:
      'CRM + work management for ecommerce agencies. Shopify, Klaviyo, GA4, Meta, Google Ads — all tracked, all mapped, all in one workspace.',
    whyYouCare:
      'Ecommerce tracking is the hardest. Catalog, server-side events, consent mode, Enhanced Conversions, Klaviyo flows. Phloz maps the whole stack per client.',
    phlozGives: [
      'Commerce-specific tracking nodes (Shopify pixel, Klaviyo list, product feed, enhanced conversions).',
      'Per-client funnel map.',
      'Promotion and campaign boards.',
      'Approval flows for creative and merchandising.',
    ],
  },
  b2b: {
    tagline:
      'CRM + work management for B2B marketing agencies. ABM, long sales cycles, multi-touch attribution — tracked and managed in one workspace.',
    whyYouCare:
      'B2B marketing lives on attribution. HubSpot, Salesforce, LinkedIn, GA4, webinar platforms — Phloz lets you map and manage the whole stack per client.',
    phlozGives: [
      'Account-based campaign boards.',
      'Tracking map with CRM + ad platform + webinar integrations.',
      'Long-cycle reporting templates (quarterly, annually).',
      'Role-based views for strategy / content / paid / ops.',
    ],
  },
};

export function generateStaticParams(): RouteParams[] {
  return DEPARTMENTS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const match = DEPARTMENTS.find((d) => d.slug === slug);
  if (!match) return buildMetadata({ title: 'Department not found' });
  return buildMetadata({
    title: `CRM for ${match.name} agencies`,
    description: CONTENT[slug].tagline,
    path: `/crm-for/${slug}`,
  });
}

export default async function CrmForPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const match = DEPARTMENTS.find((d) => d.slug === slug);
  if (!match) notFound();
  const content = CONTENT[slug];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          CRM for {match.name} agencies
        </p>
        <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          The workspace {match.name} agencies actually want.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{content.tagline}</p>
      </header>

      <section className="rounded-xl border border-border/60 bg-card/30 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-foreground">
          Why {match.name} teams care
        </h2>
        <p className="mt-3 text-muted-foreground">{content.whyYouCare}</p>
      </section>

      <section className="mt-8 rounded-xl border border-border/60 bg-card/30 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-foreground">
          What Phloz gives you
        </h2>
        <ul className="mt-4 space-y-3">
          {content.phlozGives.map((b) => (
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

      <div className="mt-16 text-center">
        <Link
          href={`${SITE_CONFIG.appUrl}/signup`}
          className={buttonVariants({ size: 'lg' })}
        >
          Start free
        </Link>
      </div>
    </div>
  );
}
