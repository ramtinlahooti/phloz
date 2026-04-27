import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps, userIdRef } from './_helpers';
import { workspaces } from './workspaces';

/**
 * Agency-defined client groupings (e.g. "Acquisition", "Retention",
 * "Enterprise"). Each client lives in at most one group — see
 * `clients.client_group_id`. Used as either side of an `access_grant`
 * so an agency can assign whole portfolios at once.
 *
 * Mutation policy: owner/admin only (RLS).
 */
export const clientGroups = pgTable(
  'client_groups',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /** Optional accent for chips/badges. Free-form hex; no validation. */
    color: text('color'),
    createdBy: userIdRef('created_by', { nullable: true }),
    ...timestamps,
  },
  (table) => ({
    workspaceIdx: index('client_groups_workspace_id_idx').on(table.workspaceId),
    uniqueName: uniqueIndex('client_groups_workspace_name_key').on(
      table.workspaceId,
      table.name,
    ),
  }),
);

export type ClientGroup = typeof clientGroups.$inferSelect;
export type NewClientGroup = typeof clientGroups.$inferInsert;
