import { jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps } from './_helpers';
import { workspaces } from './workspaces';

/**
 * V2 scaffold (see ARCHITECTURE.md §5.4). Mirror of ad creatives.
 * TODO(V2): flesh out.
 */
export const adCreatives = pgTable('ad_creatives', {
  id: pkUuid(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export type AdCreative = typeof adCreatives.$inferSelect;
export type NewAdCreative = typeof adCreatives.$inferInsert;
