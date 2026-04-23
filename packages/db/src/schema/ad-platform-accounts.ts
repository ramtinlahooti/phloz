import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps } from './_helpers';
import { workspaces } from './workspaces';

/**
 * V2 scaffold (see ARCHITECTURE.md §5.4).
 * Connected ad-platform accounts (Google Ads MCC, Meta Business, etc.).
 * TODO(V2): platform-specific fields, OAuth token storage, sync state.
 */
export const adPlatformAccounts = pgTable('ad_platform_accounts', {
  id: pkUuid(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export type AdPlatformAccount = typeof adPlatformAccounts.$inferSelect;
export type NewAdPlatformAccount = typeof adPlatformAccounts.$inferInsert;
