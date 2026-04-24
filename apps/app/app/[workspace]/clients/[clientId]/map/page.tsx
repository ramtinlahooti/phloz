import { and, asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { getDb, schema } from '@phloz/db/client';
import type { TrackingMapSnapshot } from '@phloz/tracking-map';
import { Breadcrumbs } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

import { MapClient } from './map-client';

export const metadata = buildAppMetadata({ title: 'Tracking map' });

type RouteParams = { workspace: string; clientId: string };

export default async function ClientMapPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId, clientId } = await params;

  const db = getDb();

  const client = await db
    .select({ id: schema.clients.id, name: schema.clients.name })
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.id, clientId),
        eq(schema.clients.workspaceId, workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!client) notFound();

  const [nodes, edges] = await Promise.all([
    db
      .select()
      .from(schema.trackingNodes)
      .where(
        and(
          eq(schema.trackingNodes.workspaceId, workspaceId),
          eq(schema.trackingNodes.clientId, clientId),
        ),
      )
      .orderBy(asc(schema.trackingNodes.createdAt)),
    db
      .select()
      .from(schema.trackingEdges)
      .where(
        and(
          eq(schema.trackingEdges.workspaceId, workspaceId),
          eq(schema.trackingEdges.clientId, clientId),
        ),
      )
      .orderBy(asc(schema.trackingEdges.createdAt)),
  ]);

  const snapshot: TrackingMapSnapshot = {
    nodes: nodes.map((n) => ({
      id: n.id,
      clientId: n.clientId,
      workspaceId: n.workspaceId,
      nodeType: n.nodeType,
      label: n.label,
      metadata: n.metadata ?? {},
      healthStatus: n.healthStatus,
      lastVerifiedAt: n.lastVerifiedAt,
      position: n.position ?? null,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      clientId: e.clientId,
      workspaceId: e.workspaceId,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      edgeType: e.edgeType,
      label: e.label,
      metadata: e.metadata ?? {},
    })),
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <header className="flex items-center justify-between border-b border-border/60 bg-card/30 px-6 py-3">
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: 'Clients', href: `/${workspaceId}/clients` },
              {
                label: client.name,
                href: `/${workspaceId}/clients/${clientId}`,
              },
              { label: 'Tracking map' },
            ]}
          />
          <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight">
            Tracking map
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Drag to position · click to edit · handle drag = connect</span>
          <span className="hidden md:inline" aria-hidden>
            ·
          </span>
          <span className="hidden md:inline">
            <kbd className="rounded border border-border bg-card px-1 text-[10px]">
              n
            </kbd>{' '}
            add ·{' '}
            <kbd className="rounded border border-border bg-card px-1 text-[10px]">
              /
            </kbd>{' '}
            search ·{' '}
            <kbd className="rounded border border-border bg-card px-1 text-[10px]">
              del
            </kbd>{' '}
            remove
          </span>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <MapClient
          workspaceId={workspaceId}
          clientId={clientId}
          initial={snapshot}
        />
      </div>
    </div>
  );
}
