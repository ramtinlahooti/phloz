import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { clientContacts } from './client-contacts';
import { clients } from './clients';
import { workspaces } from './workspaces';

export const portalMagicLinks = pgTable(
  'portal_magic_links',
  {
    token: text('token').primaryKey(),
    clientContactId: uuid('client_contact_id')
      .notNull()
      .references(() => clientContacts.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    contactIdx: index('portal_magic_links_contact_idx').on(table.clientContactId),
    clientIdx: index('portal_magic_links_client_idx').on(table.clientId),
    expiresIdx: index('portal_magic_links_expires_at_idx').on(table.expiresAt),
  }),
);

export type PortalMagicLink = typeof portalMagicLinks.$inferSelect;
export type NewPortalMagicLink = typeof portalMagicLinks.$inferInsert;
