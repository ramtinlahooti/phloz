import Link from 'next/link';

/**
 * Layout for unauthenticated routes (/login, /signup, /forgot-password,
 * /reset-password). Centers a card on a dark canvas with the Phloz
 * mark in the top-left.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <span className="inline-block size-5 rounded-md bg-primary" aria-hidden />
            Phloz
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
