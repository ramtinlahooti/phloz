import Link from 'next/link';

import { canAddClient } from '@phloz/billing';
import { buttonVariants, Card, CardContent } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

import { NewClientForm } from './new-client-form';

export const metadata = buildAppMetadata({ title: 'Add client' });

type RouteParams = { workspace: string };

export default async function NewClientPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  const gate = await canAddClient(workspaceId);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-6 text-sm">
        <Link
          href={`/${workspaceId}/clients`}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Clients
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Add a client</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You can add more details (contacts, tracking map, tasks) after.
        </p>
      </header>

      {!gate.allowed ? (
        <Card className="border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10">
          <CardContent className="space-y-3 p-6 text-sm">
            <p className="font-medium">
              You&apos;ve reached your active-client limit.
            </p>
            <p className="text-muted-foreground">{gate.message}</p>
            <Link
              href={`/${workspaceId}/billing`}
              className={buttonVariants({ size: 'sm' })}
            >
              Upgrade plan
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <NewClientForm workspaceId={workspaceId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
