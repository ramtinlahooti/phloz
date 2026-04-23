import { and, count, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';

import { getActiveClientCount, getTier } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';
import { Badge, buttonVariants, Card, CardContent, CardHeader, CardTitle } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Overview' });

type RouteParams = { workspace: string };

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  const db = getDb();

  const [workspace, activeClientCount, openTaskCount, memberCount] = await Promise.all([
    db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .limit(1)
      .then((rows) => rows[0]),
    getActiveClientCount(workspaceId),
    db
      .select({ c: count() })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, workspaceId),
          inArray(schema.tasks.status, ['todo', 'in_progress', 'blocked']),
        ),
      )
      .then((rows) => rows[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.workspaceId, workspaceId))
      .then((rows) => rows[0]?.c ?? 0),
  ]);

  if (!workspace) return null;

  const tier = getTier(workspace.tier);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{tier.displayName}</Badge>
            <span>
              {activeClientCount} of{' '}
              {tier.clientLimit === 'unlimited' ? '∞' : tier.clientLimit} active
              clients
            </span>
          </div>
        </div>
        <Link
          href={`/${workspaceId}/clients/new`}
          className={buttonVariants({ size: 'sm' })}
        >
          Add client
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active clients
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {activeClientCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{openTaskCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team members
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{memberCount}</CardContent>
        </Card>
      </div>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden />
                <Link
                  className="hover:text-primary"
                  href={`/${workspaceId}/clients/new`}
                >
                  Add your first client
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden />
                <Link className="hover:text-primary" href={`/${workspaceId}/team`}>
                  Invite a teammate
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden />
                <Link
                  className="hover:text-primary"
                  href={`/${workspaceId}/settings`}
                >
                  Customize your workspace
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              You&apos;re on the <strong>{tier.displayName}</strong> tier.
              {tier.monthlyPriceUsd !== null && (
                <>
                  {' '}
                  ${tier.monthlyPriceUsd}/mo when billed monthly.
                </>
              )}
            </p>
            <Link
              href={`/${workspaceId}/billing`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Manage billing
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
