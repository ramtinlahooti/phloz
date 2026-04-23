import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { HealthStatus, NodeType } from '@phloz/config';

import { pkUuid, timestamps, userIdRef } from './_helpers';
import { clients } from './clients';
import { workspaces } from './workspaces';

export type NodePosition = { x: number; y: number };

/**
 * Per-node `metadata` is validated by a Zod schema keyed on `node_type`
 * (see packages/tracking-map/node-types/[type].ts). The DB stores it
 * opaquely as jsonb; the app enforces the shape on write.
 */
export const trackingNodes = pgTable(
  'tracking_nodes',
  {
    id: pkUuid(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    nodeType: text('node_type').$type<NodeType>().notNull(),
    label: text('label').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    healthStatus: text('health_status').$type<HealthStatus>().notNull().default('unverified'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true, mode: 'date' }),
    position: jsonb('position').$type<NodePosition>(),
    createdBy: userIdRef('created_by', { nullable: true }),
    ...timestamps,
  },
  (table) => ({
    clientIdx: index('tracking_nodes_client_id_idx').on(table.clientId),
    workspaceIdx: index('tracking_nodes_workspace_id_idx').on(table.workspaceId),
    nodeTypeIdx: index('tracking_nodes_node_type_idx').on(table.nodeType),
    healthIdx: index('tracking_nodes_health_status_idx').on(table.healthStatus),
  }),
);

export type TrackingNode = typeof trackingNodes.$inferSelect;
export type NewTrackingNode = typeof trackingNodes.$inferInsert;
