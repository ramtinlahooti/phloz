'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';
import {
  getNodeTypeDescriptor,
  type TrackingNodeDto,
} from '@phloz/tracking-map';
import type { EdgeType, HealthStatus, NodeType } from '@phloz/config';
import { EDGE_TYPES, HEALTH_STATUSES, NODE_TYPES } from '@phloz/config';
import { revalidatePath } from 'next/cache';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

/**
 * Server actions for the tracking-map canvas. Each function returns
 * `{ ok: true, ...payload }` or `{ ok: false, error }` so the
 * canvas handler stays pure and the UI can render a toast on failure.
 *
 * Authorization: `requireRole(['owner','admin','member'])` on the
 * workspace — viewers can browse but not mutate. (Portal users never
 * reach these actions.)
 */

const uuid = z.string().uuid();

// --- create node -------------------------------------------------------
const createNodeInput = z.object({
  workspaceId: uuid,
  clientId: uuid,
  nodeType: z.enum(NODE_TYPES),
  label: z.string().trim().min(1).max(200),
  metadata: z.record(z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }),
});

export async function createNodeAction(
  input: z.infer<typeof createNodeInput>,
): Promise<{ ok: true; id: string; node: TrackingNodeDto } | { ok: false; error: string }> {
  const parsed = createNodeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const user = await requireUser();

  // NOTE: we deliberately don't validate metadata against
  // `descriptor.schema` here. Create-time metadata comes from
  // `descriptor.defaults()` (trusted code), and defaults frequently
  // contain empty placeholder fields so the user can fill them in via
  // the drawer. Strict per-field validation runs on save, in
  // `updateNodeAction` — see the descriptor lookup below that path.
  // Fields must still be a plain JSON object, which the top-level
  // `z.record(z.unknown())` on the input schema already enforces.

  const db = getDb();
  const [row] = await db
    .insert(schema.trackingNodes)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
      nodeType: parsed.data.nodeType,
      label: parsed.data.label,
      metadata: parsed.data.metadata,
      healthStatus: 'unverified',
      position: parsed.data.position,
      createdBy: user.id,
    })
    .returning();

  if (!row) return { ok: false, error: 'insert_failed' };

  fireTrack(
    'node_created',
    { node_type: parsed.data.nodeType },
    serverTrackContext(user.id, parsed.data.workspaceId),
  );

  return {
    ok: true,
    id: row.id,
    node: {
      id: row.id,
      clientId: row.clientId,
      workspaceId: row.workspaceId,
      nodeType: row.nodeType,
      label: row.label,
      metadata: row.metadata ?? {},
      healthStatus: row.healthStatus,
      lastVerifiedAt: row.lastVerifiedAt,
      position: row.position ?? null,
    },
  };
}

// --- update node -------------------------------------------------------
const updateNodeInput = z.object({
  workspaceId: uuid,
  id: uuid,
  label: z.string().trim().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
  healthStatus: z.enum(HEALTH_STATUSES).optional(),
  position: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
  markVerified: z.boolean().optional(),
});

export async function updateNodeAction(
  input: z.infer<typeof updateNodeInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateNodeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  let actor;
  try {
    actor = await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(schema.trackingNodes)
    .where(
      and(
        eq(schema.trackingNodes.id, parsed.data.id),
        eq(schema.trackingNodes.workspaceId, parsed.data.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!existing) return { ok: false, error: 'not_found' };

  if (parsed.data.metadata) {
    const descriptor = getNodeTypeDescriptor(existing.nodeType as NodeType);
    const v = descriptor.schema.safeParse(parsed.data.metadata);
    if (!v.success) return { ok: false, error: v.error.message };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.metadata !== undefined) updates.metadata = parsed.data.metadata;
  if (parsed.data.healthStatus !== undefined) updates.healthStatus = parsed.data.healthStatus as HealthStatus;
  if (parsed.data.position !== undefined) updates.position = parsed.data.position;
  if (parsed.data.markVerified) updates.lastVerifiedAt = new Date();

  await db
    .update(schema.trackingNodes)
    .set(updates)
    .where(eq(schema.trackingNodes.id, parsed.data.id));

  // Analytics. Position-only updates (auto-save on drag) are noisy and
  // not meaningful — skip them. Every other edit fires `node_updated`
  // with the primary field changed. `node_health_changed` fires on top
  // of that when the health status transitioned.
  const ctx = serverTrackContext(actor.user.id, parsed.data.workspaceId);
  const primaryField = pickPrimaryField(parsed.data);
  if (primaryField) {
    fireTrack(
      'node_updated',
      { node_type: existing.nodeType, field_changed: primaryField },
      ctx,
    );
  }
  if (
    parsed.data.healthStatus !== undefined &&
    existing.healthStatus !== parsed.data.healthStatus
  ) {
    fireTrack(
      'node_health_changed',
      {
        node_type: existing.nodeType,
        old_status: existing.healthStatus as HealthStatus,
        new_status: parsed.data.healthStatus as HealthStatus,
      },
      ctx,
    );
  }

  return { ok: true };
}

/** Pick the field to attribute a node_updated event to. Position-only
 *  updates (drag autosave) return null so we skip the event — otherwise
 *  dashboards would be flooded with mutation noise. */
function pickPrimaryField(update: {
  label?: string;
  metadata?: Record<string, unknown>;
  healthStatus?: string;
  position?: { x: number; y: number };
  markVerified?: boolean;
}): string | null {
  if (update.label !== undefined) return 'label';
  if (update.metadata !== undefined) return 'metadata';
  if (update.healthStatus !== undefined) return 'health_status';
  if (update.markVerified) return 'last_verified_at';
  // position-only → skip
  return null;
}

// --- delete node -------------------------------------------------------
export async function deleteNodeAction(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!uuid.safeParse(input.workspaceId).success || !uuid.safeParse(input.id).success) {
    return { ok: false, error: 'invalid_input' };
  }
  let actor;
  try {
    actor = await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();

  // Read nodeType before the delete so the analytics event can carry it.
  const existing = await db
    .select({ nodeType: schema.trackingNodes.nodeType })
    .from(schema.trackingNodes)
    .where(
      and(
        eq(schema.trackingNodes.id, input.id),
        eq(schema.trackingNodes.workspaceId, input.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  await db
    .delete(schema.trackingNodes)
    .where(
      and(
        eq(schema.trackingNodes.id, input.id),
        eq(schema.trackingNodes.workspaceId, input.workspaceId),
      ),
    );

  if (existing) {
    fireTrack(
      'node_deleted',
      { node_type: existing.nodeType },
      serverTrackContext(actor.user.id, input.workspaceId),
    );
  }
  return { ok: true };
}

// --- create edge -------------------------------------------------------
const createEdgeInput = z.object({
  workspaceId: uuid,
  clientId: uuid,
  sourceNodeId: uuid,
  targetNodeId: uuid,
  edgeType: z.enum(EDGE_TYPES),
  label: z.string().max(120).nullable().optional(),
});

export async function createEdgeAction(
  input: z.infer<typeof createEdgeInput>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = createEdgeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  if (parsed.data.sourceNodeId === parsed.data.targetNodeId) {
    return { ok: false, error: 'self_loop_not_allowed' };
  }

  const user = await requireUser();
  const db = getDb();

  // Both endpoints must belong to the same client within this workspace.
  // We also pull nodeType here so the edge_created analytics event can
  // carry source_type + target_type without an extra roundtrip.
  const endpoints = await db
    .select({
      id: schema.trackingNodes.id,
      clientId: schema.trackingNodes.clientId,
      nodeType: schema.trackingNodes.nodeType,
    })
    .from(schema.trackingNodes)
    .where(
      and(
        eq(schema.trackingNodes.workspaceId, parsed.data.workspaceId),
        eq(schema.trackingNodes.clientId, parsed.data.clientId),
      ),
    );
  const bySource = endpoints.find((n) => n.id === parsed.data.sourceNodeId);
  const byTarget = endpoints.find((n) => n.id === parsed.data.targetNodeId);
  if (!bySource || !byTarget) {
    return { ok: false, error: 'endpoint_not_in_client' };
  }

  const [row] = await db
    .insert(schema.trackingEdges)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
      sourceNodeId: parsed.data.sourceNodeId,
      targetNodeId: parsed.data.targetNodeId,
      edgeType: parsed.data.edgeType as EdgeType,
      label: parsed.data.label ?? null,
      createdBy: user.id,
    })
    .returning({ id: schema.trackingEdges.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  fireTrack(
    'edge_created',
    {
      edge_type: parsed.data.edgeType,
      source_type: bySource.nodeType,
      target_type: byTarget.nodeType,
    },
    serverTrackContext(user.id, parsed.data.workspaceId),
  );

  return { ok: true, id: row.id };
}

// --- update edge (type + label) ----------------------------------------
const updateEdgeInput = z.object({
  workspaceId: uuid,
  id: uuid,
  edgeType: z.enum(EDGE_TYPES).optional(),
  label: z.string().max(120).nullable().optional(),
});

export async function updateEdgeAction(
  input: z.infer<typeof updateEdgeInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateEdgeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.edgeType !== undefined)
    updates.edgeType = parsed.data.edgeType as EdgeType;
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;

  const db = getDb();
  await db
    .update(schema.trackingEdges)
    .set(updates)
    .where(
      and(
        eq(schema.trackingEdges.id, parsed.data.id),
        eq(schema.trackingEdges.workspaceId, parsed.data.workspaceId),
      ),
    );
  return { ok: true };
}

// --- delete edge -------------------------------------------------------
export async function deleteEdgeAction(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!uuid.safeParse(input.workspaceId).success || !uuid.safeParse(input.id).success) {
    return { ok: false, error: 'invalid_input' };
  }
  let actor;
  try {
    actor = await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  await db
    .delete(schema.trackingEdges)
    .where(
      and(
        eq(schema.trackingEdges.id, input.id),
        eq(schema.trackingEdges.workspaceId, input.workspaceId),
      ),
    );

  fireTrack(
    'edge_deleted',
    {},
    serverTrackContext(actor.user.id, input.workspaceId),
  );
  return { ok: true };
}

// --- bulk import (from JSON) -------------------------------------------
const importInput = z.object({
  workspaceId: uuid,
  clientId: uuid,
  nodes: z
    .array(
      z.object({
        id: z.string(),
        nodeType: z.enum(NODE_TYPES),
        label: z.string().trim().min(1).max(200),
        healthStatus: z.enum(HEALTH_STATUSES).default('unverified'),
        position: z
          .object({ x: z.number(), y: z.number() })
          .nullable()
          .optional(),
        metadata: z.record(z.unknown()).default({}),
      }),
    )
    .max(500),
  edges: z
    .array(
      z.object({
        sourceNodeId: z.string(),
        targetNodeId: z.string(),
        edgeType: z.enum(EDGE_TYPES).default('custom'),
        label: z.string().max(120).nullable().optional(),
      }),
    )
    .max(2000),
});

/**
 * Bulk-import a map snapshot (the shape `handleExportJson` produces).
 * New nodes get fresh UUIDs; the input `id` is treated as a local
 * reference used only to remap edges. Runs in a single transaction
 * so a partial import never leaves orphan rows.
 */
export async function importMapAction(
  input: z.infer<typeof importInput>,
): Promise<
  | { ok: true; nodesInserted: number; edgesInserted: number }
  | { ok: false; error: string }
> {
  const parsed = importInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const user = await requireUser();
  const db = getDb();

  type ImportResult =
    | { ok: true; nodesInserted: number; edgesInserted: number }
    | { ok: false; error: string };

  return db.transaction<ImportResult>(async (tx) => {
    const idMap = new Map<string, string>();

    for (const n of parsed.data.nodes) {
      const descriptor = getNodeTypeDescriptor(n.nodeType);
      const metaValidation = descriptor.schema.safeParse(n.metadata);
      if (!metaValidation.success) {
        // Abort the transaction — metadata validation is per-node, so
        // we reject the whole import rather than silently dropping nodes.
        throw new Error(
          `metadata invalid for node ${n.label}: ${metaValidation.error.message}`,
        );
      }
      const [row] = await tx
        .insert(schema.trackingNodes)
        .values({
          workspaceId: parsed.data.workspaceId,
          clientId: parsed.data.clientId,
          nodeType: n.nodeType,
          label: n.label,
          metadata: metaValidation.data as Record<string, unknown>,
          healthStatus: n.healthStatus,
          position: n.position ?? null,
          createdBy: user.id,
        })
        .returning({ id: schema.trackingNodes.id });
      if (!row) throw new Error('node insert failed');
      idMap.set(n.id, row.id);
    }

    let edgesInserted = 0;
    for (const e of parsed.data.edges) {
      const src = idMap.get(e.sourceNodeId);
      const tgt = idMap.get(e.targetNodeId);
      if (!src || !tgt) continue; // skip dangling edges silently
      await tx.insert(schema.trackingEdges).values({
        workspaceId: parsed.data.workspaceId,
        clientId: parsed.data.clientId,
        sourceNodeId: src,
        targetNodeId: tgt,
        edgeType: e.edgeType as EdgeType,
        label: e.label ?? null,
        createdBy: user.id,
      });
      edgesInserted++;
    }

    revalidatePath(
      `/${parsed.data.workspaceId}/clients/${parsed.data.clientId}/map`,
    );
    return {
      ok: true as const,
      nodesInserted: idMap.size,
      edgesInserted,
    };
  }).catch((err: Error): ImportResult => ({ ok: false, error: err.message }));
}
