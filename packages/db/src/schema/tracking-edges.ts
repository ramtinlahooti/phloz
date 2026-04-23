import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import type { EdgeType } from '@phloz/config';

import { pkUuid, timestamps, userIdRef } from './_helpers';
import { clients } from './clients';
import { trackingNodes } from './tracking-nodes';
import { workspaces } from './workspaces';

export const trackingEdges = pgTable(
  'tracking_edges',
  {
    id: pkUuid(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceNodeId: uuid('source_node_id')
      .notNull()
      .references(() => trackingNodes.id, { onDelete: 'cascade' }),
    targetNodeId: uuid('target_node_id')
      .notNull()
      .references(() => trackingNodes.id, { onDelete: 'cascade' }),
    edgeType: text('edge_type').$type<EdgeType>().notNull(),
    label: text('label'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdBy: userIdRef('created_by', { nullable: true }),
    ...timestamps,
  },
  (table) => ({
    clientIdx: index('tracking_edges_client_id_idx').on(table.clientId),
    workspaceIdx: index('tracking_edges_workspace_id_idx').on(table.workspaceId),
    sourceIdx: index('tracking_edges_source_node_idx').on(table.sourceNodeId),
    targetIdx: index('tracking_edges_target_node_idx').on(table.targetNodeId),
  }),
);

export type TrackingEdge = typeof trackingEdges.$inferSelect;
export type NewTrackingEdge = typeof trackingEdges.$inferInsert;
