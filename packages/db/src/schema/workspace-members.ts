import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Role } from '@phloz/config';

import { pkUuid, userIdRef } from './_helpers';
import { workspaces } from './workspaces';

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: userIdRef('user_id'),
    role: text('role').$type<Role>().notNull(),
    invitedAt: timestamp('invited_at', { withTimezone: true, mode: 'date' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueMembership: uniqueIndex('workspace_members_workspace_user_key').on(
      table.workspaceId,
      table.userId,
    ),
    workspaceIdx: index('workspace_members_workspace_id_idx').on(table.workspaceId),
    userIdx: index('workspace_members_user_id_idx').on(table.userId),
  }),
);

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
