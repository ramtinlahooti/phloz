import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Role } from '@phloz/config';

import { pkUuid, userIdRef } from './_helpers';
import { workspaces } from './workspaces';

export const invitations = pgTable(
  'invitations',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').$type<Role>().notNull(),
    invitedBy: userIdRef('invited_by'),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    /**
     * Client IDs the inviter pre-selected. On accept, the flow inserts
     * one `workspace_member_client_access` row per id. Empty array
     * (the default) means no pre-assignment — the existing behaviour.
     * Only meaningful for member + viewer invitations when the
     * workspace policy is "Restricted by assignment".
     */
    pendingClientIds: uuid('pending_client_ids')
      .array()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('invitations_token_key').on(table.token),
    workspaceIdx: index('invitations_workspace_id_idx').on(table.workspaceId),
    emailIdx: index('invitations_email_idx').on(table.email),
  }),
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
