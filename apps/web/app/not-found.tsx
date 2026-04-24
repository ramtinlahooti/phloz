import Link from 'next/link';

import { buttonVariants } from '@phloz/ui';

import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Page not found',
  noindex: true,
});

/**
 * Marketing-site 404. Kept text-only — most 404s on phloz.com will be
 * mistyped blog URLs or expired programmatic pages, so the goal is
 * "get them to the right place fast" not "pretty marketing moment".
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has
        moved. Try the homepage, pricing, or blog.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className={buttonVariants({ size: 'sm' })}>
          Home
        </Link>
        <Link
          href="/pricing"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Pricing
        </Link>
        <Link
          href="/blog"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Blog
        </Link>
      </div>
    </div>
  );
}
