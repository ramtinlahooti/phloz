import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { pkUuid } from './_helpers';
import { departments } from './departments';
import { workspaceMembers } from './workspace-members';
import { workspaces } from './workspaces';

/**
 * M:N join between a workspace member and a department. A member
 * may sit in many departments (supervisor pattern), and a
 * department may contain many members.
 *
 * `workspace_id` is denormalised so RLS / queries don't have to
 * join through the parent department or member to scope by
 * workspace. Defense-in-depth + cheaper indexes.
 *
 * Mutation policy: owner/admin only (RLS).
 */
export const departmentMemberships = pgTable(
  'department_memberships',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    workspaceMemberId: uuid('workspace_member_id')
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueMembership: uniqueIndex('department_memberships_dept_member_key').on(
      table.departmentId,
      table.workspaceMemberId,
    ),
    departmentIdx: index('department_memberships_department_idx').on(
      table.departmentId,
    ),
    memberIdx: index('department_memberships_member_idx').on(
      table.workspaceMemberId,
    ),
  }),
);

export type DepartmentMembership = typeof departmentMemberships.$inferSelect;
export type NewDepartmentMembership =
  typeof departmentMemberships.$inferInsert;
