import { boolean, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps } from './_helpers';
import { clients } from './clients';
import { workspaces } from './workspaces';

export const clientContacts = pgTable(
  'client_contacts',
  {
    id: pkUuid(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    role: text('role'),
    portalAccess: boolean('portal_access').notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    clientIdx: index('client_contacts_client_id_idx').on(table.clientId),
    workspaceIdx: index('client_contacts_workspace_id_idx').on(table.workspaceId),
    emailIdx: index('client_contacts_email_idx').on(table.email),
  }),
);

export type ClientContact = typeof clientContacts.$inferSelect;
export type NewClientContact = typeof clientContacts.$inferInsert;
