import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'About',
  description:
    'Phloz exists because every digital marketing agency runs on a fragile stack of 6-8 tools duct-taped together. We\'re building the one workspace that replaces the duct tape.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          About Phloz
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Why this exists and where it&apos;s going.
        </p>
      </header>

      <div className="phloz-prose">
        <h2>The observation</h2>
        <p>
          Every digital marketing agency — from 5 people running 10 clients to
          50 people running 100 — runs on a stack of 6 to 8 tools. A CRM for
          deals. A project manager for work. A shared drive for files. A
          reporting tool for clients. A messaging tool for the team. Another
          for clients. A collection of spreadsheets documenting &quot;where
          things are&quot; (GA4 property IDs, GTM containers, pixels, ad
          accounts, UTM conventions).
        </p>
        <p>
          Nothing is <em>wrong</em>. Each tool is individually fine. But the
          agency pays the tax on every handoff, and the biggest tax isn&apos;t
          on the CRM side — it&apos;s on the tracking side. Nobody knows
          exactly which pixels are firing where, who owns them, or when they
          last worked.
        </p>

        <h2>What we&apos;re building</h2>
        <p>
          A CRM + work management + tracking infrastructure platform in one
          workspace, priced per active client instead of per seat. Opinionated
          defaults for how agencies actually work, free client portals, and a
          typed graph of every tracking object you manage.
        </p>

        <h2>Who&apos;s building it</h2>
        <p>
          Phloz is being built by{' '}
          <a
            href="https://twitter.com/ramtinlahooti"
            target="_blank"
            rel="noreferrer"
          >
            Ramtin Lahooti
          </a>{' '}
          out of Vancouver. Solo for now. Pre-launch, no paying customers yet,
          building the foundation before taking on design partners.
        </p>

        <h2>What&apos;s V2</h2>
        <p>
          We&apos;re shipping V1 with a clear roadmap for V2: the approvals
          engine, the ad-audit rule engine, agency-to-client billing, live
          tracking-integration APIs (GA4/GTM/Google Ads/Meta), advanced
          reporting, and more. See the{' '}
          <a href="/blog">blog</a> for progress updates.
        </p>

        <h2>Get in touch</h2>
        <p>
          If you run or work at an agency and you recognize the pain, <a href="/contact">say hello</a>. We&apos;d love to hear which part of the stack you&apos;d most want to delete.
        </p>
      </div>
    </div>
  );
}
