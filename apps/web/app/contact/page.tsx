import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Contact',
  description:
    'Get in touch with Phloz: sales, support, partnerships, or general questions.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Contact us
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The fastest way to reach us during pre-launch is email or Twitter.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <article className="rounded-xl border border-border/60 bg-card/30 p-6">
          <h2 className="text-lg font-semibold text-foreground">
            General questions
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Product feedback, feature requests, or &quot;does Phloz do X?&quot;
          </p>
          <a
            href="mailto:hello@phloz.com"
            className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            hello@phloz.com
          </a>
        </article>

        <article className="rounded-xl border border-border/60 bg-card/30 p-6">
          <h2 className="text-lg font-semibold text-foreground">Sales</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enterprise plans, procurement, custom SLA, SSO.
          </p>
          <a
            href="mailto:sales@phloz.com"
            className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            sales@phloz.com
          </a>
        </article>

        <article className="rounded-xl border border-border/60 bg-card/30 p-6">
          <h2 className="text-lg font-semibold text-foreground">Support</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Something broken? Need help setting up?
          </p>
          <a
            href="mailto:support@phloz.com"
            className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            support@phloz.com
          </a>
        </article>

        <article className="rounded-xl border border-border/60 bg-card/30 p-6">
          <h2 className="text-lg font-semibold text-foreground">Twitter</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Shipping updates, build-in-public notes, product launches.
          </p>
          <a
            href="https://twitter.com/phlozhq"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            @phlozhq
          </a>
        </article>
      </div>
    </div>
  );
}
