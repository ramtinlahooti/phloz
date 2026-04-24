import Link from 'next/link';
import { notFound } from 'next/navigation';

import { validatePortalMagicLink } from '@phloz/auth/portal';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

type LayoutParams = { token: string };

/**
 * Portal layout. Validates the magic link on every request. Anything
 * invalid 404s — we never leak "the link is expired" vs "the link never
 * existed" to guessing clients.
 */
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<LayoutParams>;
}) {
  const { token } = await params;
  const link = await validatePortalMagicLink(token);
  if (!link) notFound();

  const db = getDb();
  const client = await db
    .select({ name: schema.clients.name, businessName: schema.clients.businessName })
    .from(schema.clients)
    .where(eq(schema.clients.id, link.clientId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!client) notFound();

  // Fire `portal_accessed` only on the first consumption of this magic
  // link. Subsequent portal pageloads within the 7-day window re-enter
  // the layout, but `firstUse` is false — so we don't double-count.
  // DistinctId: hashed client_contact_id. Portal users aren't in
  // auth.users, so we namespace separately; workspace_id tag is still
  // attached for segmentation.
  if (link.firstUse) {
    fireTrack(
      'portal_accessed',
      {},
      serverTrackContext(link.clientContactId, link.workspaceId),
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href={`/portal/${token}`} className="text-sm font-semibold">
            {client.name}
          </Link>
          <span className="text-xs text-muted-foreground">
            Client portal · Phloz
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
