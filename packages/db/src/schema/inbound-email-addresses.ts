import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { pkUuid } from './_helpers';
import { clients } from './clients';
import { workspaces } from './workspaces';

/**
 * Each client gets `client-<nanoid(12)>@inbound.phloz.com`. Address shape is
 * opaque on purpose (ARCHITECTURE.md §10.1) — don't expose slugs.
 */
export const inboundEmailAddresses = pgTable(
  'inbound_email_addresses',
  {
    id: pkUuid(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    addressUnique: uniqueIndex('inbound_email_addresses_address_key').on(table.address),
    clientIdx: index('inbound_email_addresses_client_idx').on(table.clientId),
  }),
);

export type InboundEmailAddress = typeof inboundEmailAddresses.$inferSelect;
export type NewInboundEmailAddress = typeof inboundEmailAddresses.$inferInsert;
