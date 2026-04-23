import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Features',
  description:
    'Every Phloz module: CRM, work management, tracking infrastructure map, messaging, reporting, billing. All in one workspace.',
  path: '/features',
});

type FeatureSection = {
  title: string;
  summary: string;
  bullets: string[];
};

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: 'CRM',
    summary:
      'Clients, contacts, companies, deals. Not a generic CRM — one built for how agencies actually track relationships.',
    bullets: [
      'Client records with contacts, notes, files, tracking map, tasks, messages — all in one split-pane view.',
      'Contact roles (primary, billing, technical, decision maker) so the right person gets the right comms.',
      'Client tiers, status (active / paused / archived), and health — visible at a glance.',
      'Free client portal access via magic links — no passwords, no per-client seat costs.',
    ],
  },
  {
    title: 'Work management',
    summary:
      'Tasks, boards, timelines, approvals. Role-based views per department so the PPC lead sees PPC-shaped work.',
    bullets: [
      'Tasks with status, assignee, due date, department, priority, estimate.',
      'Board + list + timeline views. Your team picks how they see work.',
      'Task dependencies and subtasks without a Gantt-chart UI from 2008.',
      'Approvals on deliverables (creative review, copy review, tracking verification).',
    ],
  },
  {
    title: 'Tracking infrastructure map',
    summary:
      'The thing no other agency platform has. A typed graph of every GA4 property, pixel, conversion, and audience — per client.',
    bullets: [
      '9 node types at launch (GA4, GTM, Meta, Google Ads, TikTok, Microsoft, audiences, UTM conventions, generic pages).',
      'Every node has a typed Zod schema — so "GA4 property" and "Meta pixel" have the right fields, icons, and health states.',
      "Health status: working / broken / missing / unverified. Click \"verify\" and it's timestamped.",
      'Graph relationships (fires-on, owned-by, depends-on) so you can answer "what breaks if we migrate this?"',
    ],
  },
  {
    title: 'Messaging',
    summary:
      'Email forwarding to client threads + internal chat next to the work.',
    bullets: [
      'Every client gets an opaque inbound email address (client-xxxxx@inbound.phloz.com). Forward a client email and it auto-threads.',
      'Internal comments on every task, file, map node. Mention a teammate, get a notification.',
      'Deliverable-scoped threads — no more "which Slack channel was this in?"',
    ],
  },
  {
    title: 'Reporting',
    summary:
      'Cross-client views that don\'t require a BI tool for the basics.',
    bullets: [
      'See every active campaign, every open task, every pending approval across every client.',
      'Filter by tier, department, status, owner, health.',
      'CSV export and one-click BigQuery sync (V2).',
    ],
  },
  {
    title: 'Billing + tiers',
    summary:
      'Per-active-client pricing. Pay for your book of business, not your team size.',
    bullets: [
      'Six tiers from Starter (free, 1 client) to Scale (250) to Enterprise (unlimited).',
      'Active client = activity in last 60 days. Archived / dormant clients don\'t count.',
      'Included seats per tier (5/8/15/30). Extra seats are $5.99–$9.99/mo.',
      'Annual plans save ~17%.',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Every module your agency runs on.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Phloz is six tools in one workspace. Here&apos;s what each does.
        </p>
      </header>

      <div className="mt-20 space-y-16">
        {FEATURE_SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-border/60 bg-card/30 p-8 sm:p-12"
          >
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {section.title}
            </h2>
            <p className="mt-3 text-muted-foreground">{section.summary}</p>
            <ul className="mt-6 space-y-3">
              {section.bullets.map((b) => (
                <li
                  key={b}
                  className="flex gap-3 text-sm text-foreground/90"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
