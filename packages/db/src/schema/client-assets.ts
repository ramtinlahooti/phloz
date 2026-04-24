import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { pkUuid, userIdRef } from './_helpers';
import { clients } from './clients';
import { workspaces } from './workspaces';

export type AssetType = 'image' | 'video' | 'document' | 'other';

export const clientAssets = pgTable(
  'client_assets',
  {
    id: pkUuid(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    assetType: text('asset_type').$type<AssetType>().notNull().default('other'),
    notes: text('notes'),
    /**
     * When `true`, portal users (magic-link session on
     * `/portal/[token]`) can see + download the asset. Internal by
     * default; agency explicitly opts each asset in via the Files tab.
     */
    clientVisible: boolean('client_visible').notNull().default(false),
    createdBy: userIdRef('created_by', { nullable: true }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: index('client_assets_client_id_idx').on(table.clientId),
    workspaceIdx: index('client_assets_workspace_id_idx').on(table.workspaceId),
    clientVisibleIdx: index('client_assets_client_visible_idx').on(
      table.clientVisible,
    ),
  }),
);

export type ClientAsset = typeof clientAssets.$inferSelect;
export type NewClientAsset = typeof clientAssets.$inferInsert;
