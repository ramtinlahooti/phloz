import { check, index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { pkUuid, userIdRef } from './_helpers';
import { clientGroups } from './client-groups';
import { clients } from './clients';
import { departments } from './departments';
import { workspaceMembers } from './workspace-members';
import { workspaces } from './workspaces';

/**
 * Single source of truth for "who can see which clients" beyond
 * the role-based escape hatches (owner/admin always see all,
 * `all_members_see_all_clients` setting opts everyone in).
 *
 * Subject side (who is being granted access) is exactly one of:
 *   - `granted_to_member_id` — direct grant to a single member
 *   - `granted_to_department_id` — grant to all members of a
 *     department; resolves dynamically as the department's
 *     membership changes
 *
 * Object side (what they get access to) is exactly one of:
 *   - `client_id` — single client
 *   - `client_group_id` — every client whose `client_group_id`
 *     matches; resolves dynamically as clients move between
 *     groups
 *
 * Both sides are CHECK-constrained at the SQL level so an
 * inconsistent row (zero or two FKs on either side) cannot be
 * inserted.
 *
 * RLS reads this table inside `phloz_is_assigned_to(client_id)`.
 *
 * Mutation policy: owner/admin only (RLS).
 */
export const accessGrants = pgTable(
  'access_grants',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    grantedToMemberId: uuid('granted_to_member_id').references(
      () => workspaceMembers.id,
      { onDelete: 'cascade' },
    ),
    grantedToDepartmentId: uuid('granted_to_department_id').references(
      () => departments.id,
      { onDelete: 'cascade' },
    ),
    clientId: uuid('client_id').references(() => clients.id, {
      onDelete: 'cascade',
    }),
    clientGroupId: uuid('client_group_id').references(
      () => clientGroups.id,
      { onDelete: 'cascade' },
    ),
    createdBy: userIdRef('created_by', { nullable: true }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    /** Subject side: exactly one FK populated. */
    subjectExclusive: check(
      'access_grants_subject_exclusive',
      sql`(${table.grantedToMemberId} IS NOT NULL) <> (${table.grantedToDepartmentId} IS NOT NULL)`,
    ),
    /** Object side: exactly one FK populated. */
    objectExclusive: check(
      'access_grants_object_exclusive',
      sql`(${table.clientId} IS NOT NULL) <> (${table.clientGroupId} IS NOT NULL)`,
    ),
    /**
     * Prevent duplicate identical grants. NULLs are distinct in
     * Postgres unique indexes by default, so we COALESCE to a
     * sentinel uuid so the (member|dept, client|group) tuple is
     * compared as a single key.
     */
    uniqueGrant: uniqueIndex('access_grants_unique_edge_key').on(
      table.workspaceId,
      sql`coalesce(${table.grantedToMemberId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.grantedToDepartmentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.clientId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.clientGroupId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    workspaceIdx: index('access_grants_workspace_id_idx').on(table.workspaceId),
    memberIdx: index('access_grants_granted_to_member_idx').on(
      table.grantedToMemberId,
    ),
    departmentIdx: index('access_grants_granted_to_department_idx').on(
      table.grantedToDepartmentId,
    ),
    clientIdx: index('access_grants_client_idx').on(table.clientId),
    clientGroupIdx: index('access_grants_client_group_idx').on(
      table.clientGroupId,
    ),
  }),
);

export type AccessGrant = typeof accessGrants.$inferSelect;
export type NewAccessGrant = typeof accessGrants.$inferInsert;
