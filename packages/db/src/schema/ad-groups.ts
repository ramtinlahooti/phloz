import { jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps } from './_helpers';
import { workspaces } from './workspaces';

/**
 * V2 scaffold (see ARCHITECTURE.md §5.4). Mirror of ad groups.
 * TODO(V2): flesh out.
 */
export const adGroups = pgTable('ad_groups', {
  id: pkUuid(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export type AdGroup = typeof adGroups.$inferSelect;
export type NewAdGroup = typeof adGroups.$inferInsert;
