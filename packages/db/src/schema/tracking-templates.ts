import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps } from './_helpers';
import { workspaces } from './workspaces';

/**
 * V2 scaffold (see ARCHITECTURE.md §5.4). Reusable templates for cloning a
 * tracking map across clients.
 * TODO(V2): template sharing scope (workspace vs global), node spec.
 */
export const trackingTemplates = pgTable('tracking_templates', {
  id: pkUuid(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  spec: jsonb('spec').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export type TrackingTemplate = typeof trackingTemplates.$inferSelect;
export type NewTrackingTemplate = typeof trackingTemplates.$inferInsert;
