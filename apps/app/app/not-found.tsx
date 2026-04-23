import Link from 'next/link';

import { buttonVariants } from '@phloz/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className={`${buttonVariants({ size: 'sm' })} mt-6`}
      >
        Go home
      </Link>
    </div>
  );
}
