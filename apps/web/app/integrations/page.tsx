import Link from 'next/link';

import { buildMetadata } from '@/lib/metadata';
import { INTEGRATIONS } from '@/lib/site-config';

export const metadata = buildMetadata({
  title: 'Integrations',
  description:
    'Phloz integrates with the tools digital marketing agencies actually use: GA4, GTM, Google Ads, Meta, TikTok, Microsoft, Shopify, Klaviyo, HubSpot.',
  path: '/integrations',
});

export default function IntegrationsIndexPage() {
  const byCategory = INTEGRATIONS.reduce<
    Record<string, typeof INTEGRATIONS[number][]>
  >((acc, integ) => {
    acc[integ.category] = acc[integ.category] ?? [];
    acc[integ.category]!.push(integ);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-12 mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Integrations
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Phloz integrates with the ad platforms, analytics tools, and commerce
          stacks that make up the modern digital marketing agency toolkit.
        </p>
      </header>

      <div className="space-y-12">
        {Object.entries(byCategory).map(([category, items]) => (
          <section key={category}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">
              {category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <Link
                  key={i.slug}
                  href={`/integrations/${i.slug}`}
                  className="group rounded-xl border border-border/60 bg-card/30 p-6 transition-colors hover:border-primary/60 hover:bg-card/50"
                >
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">
                    {i.name}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {i.category}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
