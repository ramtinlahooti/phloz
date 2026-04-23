import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { pkUuid } from './_helpers';
import { clients } from './clients';
import { workspaceMembers } from './workspace-members';

/**
 * Per-member client assignment. Only consulted when the workspace setting
 * `all_members_see_all_clients` is false (default). Owners and admins
 * always see every client regardless.
 */
export const workspaceMemberClientAccess = pgTable(
  'workspace_member_client_access',
  {
    id: pkUuid(),
    workspaceMemberId: uuid('workspace_member_id')
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueAssignment: uniqueIndex('workspace_member_client_access_member_client_key').on(
      table.workspaceMemberId,
      table.clientId,
    ),
    memberIdx: index('workspace_member_client_access_member_idx').on(table.workspaceMemberId),
    clientIdx: index('workspace_member_client_access_client_idx').on(table.clientId),
  }),
);

export type WorkspaceMemberClientAccess = typeof workspaceMemberClientAccess.$inferSelect;
export type NewWorkspaceMemberClientAccess = typeof workspaceMemberClientAccess.$inferInsert;
