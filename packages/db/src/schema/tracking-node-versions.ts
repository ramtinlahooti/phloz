import { jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps } from './_helpers';
import { trackingNodes } from './tracking-nodes';
import { workspaces } from './workspaces';

/**
 * V2 scaffold (see ARCHITECTURE.md §5.4). Versioned history of tracking nodes.
 * TODO(V2): snapshot metadata on every change, add author + diff columns.
 */
export const trackingNodeVersions = pgTable('tracking_node_versions', {
  id: pkUuid(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  nodeId: uuid('node_id')
    .notNull()
    .references(() => trackingNodes.id, { onDelete: 'cascade' }),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  ...timestamps,
});

export type TrackingNodeVersion = typeof trackingNodeVersions.$inferSelect;
export type NewTrackingNodeVersion = typeof trackingNodeVersions.$inferInsert;
