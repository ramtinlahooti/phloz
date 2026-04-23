import { jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps } from './_helpers';
import { workspaces } from './workspaces';

/**
 * V2 scaffold (see ARCHITECTURE.md §5.4). Mirror of keywords.
 * TODO(V2): flesh out.
 */
export const adKeywords = pgTable('ad_keywords', {
  id: pkUuid(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export type AdKeyword = typeof adKeywords.$inferSelect;
export type NewAdKeyword = typeof adKeywords.$inferInsert;
