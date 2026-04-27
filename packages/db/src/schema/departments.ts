import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps, userIdRef } from './_helpers';
import { workspaces } from './workspaces';

/**
 * Agency-defined member groupings (e.g. "PPC", "SEO", "Social",
 * "Account Management"). Membership is M:N — a generalist or
 * supervisor may sit in several departments. See
 * `department_memberships` for the join table.
 *
 * Note: distinct from the `tasks.department` enum, which is a
 * loose tag on individual tasks. The two may eventually unify;
 * deferred until UI shapes the ergonomics.
 *
 * Mutation policy: owner/admin only (RLS).
 */
export const departments = pgTable(
  'departments',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /** Optional accent for chips/badges. Free-form hex; no validation. */
    color: text('color'),
    createdBy: userIdRef('created_by', { nullable: true }),
    ...timestamps,
  },
  (table) => ({
    workspaceIdx: index('departments_workspace_id_idx').on(table.workspaceId),
    uniqueName: uniqueIndex('departments_workspace_name_key').on(
      table.workspaceId,
      table.name,
    ),
  }),
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
