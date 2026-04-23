import { z } from 'zod';

import type { EdgeType, HealthStatus, NodeType } from '@phloz/config';

/**
 * Serialized shape of a tracking node as it travels between the server
 * and the canvas. Matches `tracking_nodes` table columns we surface to
 * the client — `metadata` is a free-form `Record<string, unknown>` and
 * gets validated per-type on write.
 */
export const trackingNodeDtoSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  nodeType: z.string(),
  label: z.string(),
  metadata: z.record(z.unknown()).default({}),
  healthStatus: z.enum(['working', 'broken', 'missing', 'unverified']),
  lastVerifiedAt: z.coerce.date().nullable(),
  position: z
    .object({ x: z.number(), y: z.number() })
    .nullable()
    .optional(),
});
export type TrackingNodeDto = z.infer<typeof trackingNodeDtoSchema> & {
  nodeType: NodeType;
  healthStatus: HealthStatus;
};

export const trackingEdgeDtoSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  edgeType: z.string(),
  label: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
});
export type TrackingEdgeDto = z.infer<typeof trackingEdgeDtoSchema> & {
  edgeType: EdgeType;
};

/** Map data as the canvas receives it on first render. */
export type TrackingMapSnapshot = {
  nodes: TrackingNodeDto[];
  edges: TrackingEdgeDto[];
};
