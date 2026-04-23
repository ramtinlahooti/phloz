import Link from 'next/link';

import { Badge, buttonVariants } from '@phloz/ui';

import { buildMetadata, softwareApplicationJsonLd } from '@/lib/metadata';
import { SITE_CONFIG } from '@/lib/site-config';

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
              <Link
                href={`${SITE_CONFIG.appUrl}/signup`}
                className={buttonVariants({ size: 'lg' })}
              >
                Start free — no credit card
              </Link>
              <Link
                href="/features"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                See every feature
              </Link>
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
            <Link
              href={`${SITE_CONFIG.appUrl}/signup`}
              className={buttonVariants({ size: 'lg' })}
            >
              Start your free trial
            </Link>
            <Link
              href="/pricing"
              className={buttonVariants({ variant: 'ghost', size: 'lg' })}
            >
              View pricing →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
