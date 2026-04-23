import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonVariants } from '@phloz/ui';

import { buildMetadata } from '@/lib/metadata';
import {
  INTEGRATIONS,
  SITE_CONFIG,
  type IntegrationSlug,
} from '@/lib/site-config';

type RouteParams = { slug: IntegrationSlug };

const BLURBS: Record<IntegrationSlug, { v1: string; v2: string }> = {
  ga4: {
    v1: 'GA4 properties appear as typed nodes in the tracking map with measurement IDs, owner, health status, and last-verified timestamp.',
    v2: 'Live sync via the GA4 Data API: read real conversion events, audience sizes, and property metadata directly into Phloz.',
  },
  gtm: {
    v1: 'GTM containers are first-class tracking-map nodes. Link tags, triggers, and variables manually or by container ID.',
    v2: 'Read-only GTM Admin API sync: container version, active tags, last publish timestamp.',
  },
  'google-ads': {
    v1: 'Google Ads accounts + conversion actions as typed nodes. Link pixels to GTM tags in the graph.',
    v2: 'Google Ads API sync: account health, conversion action states, enhanced-conversions setup.',
  },
  'meta-ads': {
    v1: 'Meta pixels + Conversions API endpoints as typed nodes. Link to audience nodes for retargeting graphs.',
    v2: 'Meta Marketing API sync: pixel events received, data quality score, CAPI match rate.',
  },
  'tiktok-ads': {
    v1: 'TikTok pixels + events tracked as nodes in the map.',
    v2: 'TikTok Marketing API sync: pixel health, event count, conversion lift.',
  },
  'microsoft-ads': {
    v1: 'Microsoft Advertising UET tags + conversion goals as typed nodes.',
    v2: 'Bing Ads API sync for UET tag health and conversion goal status.',
  },
  shopify: {
    v1: 'Shopify store + pixel + Shopify Analytics integration modelled as tracking-map nodes.',
    v2: 'Shopify Admin API sync: active apps, storefront pixel status, customer-event firing.',
  },
  klaviyo: {
    v1: 'Klaviyo lists, flows, and segments tracked as nodes. Link to the GA4 audiences and Meta pixel audiences they feed.',
    v2: 'Klaviyo API sync: flow performance, list health, list-to-segment dependencies.',
  },
  hubspot: {
    v1: 'HubSpot workspaces mapped as a tracking-map node so agencies managing client HubSpot instances can track what\'s configured where.',
    v2: 'HubSpot API sync: contact count, automation count, tracking-code install verification.',
  },
};

export function generateStaticParams(): RouteParams[] {
  return INTEGRATIONS.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const match = INTEGRATIONS.find((i) => i.slug === slug);
  if (!match) return buildMetadata({ title: 'Integration not found' });
  return buildMetadata({
    title: `${match.name} integration`,
    description: `How Phloz integrates with ${match.name}: tracking map nodes, health states, and (V2) live API sync.`,
    path: `/integrations/${slug}`,
  });
}

export default async function IntegrationPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const match = INTEGRATIONS.find((i) => i.slug === slug);
  if (!match) notFound();
  const blurb = BLURBS[slug];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <nav className="mb-8 text-sm">
        <Link
          href="/integrations"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All integrations
        </Link>
      </nav>

      <header className="mb-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          {match.category}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {match.name} integration
        </h1>
      </header>

      <section className="rounded-xl border border-border/60 bg-card/30 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-foreground">
          At launch (V1)
        </h2>
        <p className="mt-3 text-muted-foreground">{blurb.v1}</p>
      </section>

      <section className="mt-6 rounded-xl border border-border/60 bg-card/30 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-foreground">Coming (V2)</h2>
        <p className="mt-3 text-muted-foreground">{blurb.v2}</p>
      </section>

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
