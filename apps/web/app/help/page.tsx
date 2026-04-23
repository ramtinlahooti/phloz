import Link from 'next/link';

import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Help center',
  description:
    'Getting started guides, FAQ, and how-to articles for using Phloz.',
  path: '/help',
});

const SECTIONS = [
  {
    title: 'Getting started',
    items: [
      { label: 'Create your first workspace', href: '/help#workspace' },
      { label: 'Invite teammates', href: '/help#invite' },
      { label: 'Add your first client', href: '/help#client' },
    ],
  },
  {
    title: 'Tracking infrastructure map',
    items: [
      { label: 'What is the tracking map?', href: '/blog/tracking-infrastructure-map' },
      { label: 'Add a GA4 property', href: '/help#ga4' },
      { label: 'Mark a pixel as broken', href: '/help#broken' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'How active clients are counted', href: '/pricing' },
      { label: 'Change your plan', href: '/help#upgrade' },
      { label: 'Annual vs monthly billing', href: '/pricing' },
    ],
  },
  {
    title: 'Client portals',
    items: [
      { label: 'Send a portal magic link', href: '/help#portal' },
      { label: 'Revoke portal access', href: '/help#revoke' },
      { label: 'Portal permissions', href: '/help#portal-perms' },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Help center
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Can&apos;t find what you need?{' '}
          <Link
            href="/contact"
            className="text-primary underline-offset-4 hover:underline"
          >
            Contact support
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-border/60 bg-card/30 p-6"
          >
            <h2 className="text-lg font-semibold text-foreground">
              {section.title}
            </h2>
            <ul className="mt-4 space-y-2">
              {section.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-16 text-sm text-muted-foreground">
        Full docs at <span className="font-mono">docs.phloz.com</span> coming
        with V1 launch. In the meantime, most answers are in the{' '}
        <Link
          href="/blog"
          className="text-primary underline-offset-4 hover:underline"
        >
          blog
        </Link>
        .
      </p>
    </div>
  );
}
