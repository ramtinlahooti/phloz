import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
    createdBy: userIdRef('created_by', { nullable: true }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: index('client_assets_client_id_idx').on(table.clientId),
    workspaceIdx: index('client_assets_workspace_id_idx').on(table.workspaceId),
  }),
);

export type ClientAsset = typeof clientAssets.$inferSelect;
export type NewClientAsset = typeof clientAssets.$inferInsert;
