import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { pkUuid } from './_helpers';
import { workspaceMembers } from './workspace-members';
import { workspaces } from './workspaces';

/**
 * Per-(member, event_type) opt-out flag.
 *
 * Each row toggles one notification kind for one member. Absence of a
 * row means "use the default" (which is enabled). The cron consults
 * these rows when deciding whether to include a section in the daily
 * digest, when to fire one-off notifications (recurring task created,
 * assignment, etc.), and so on.
 *
 * Event-type domain is application-level (not a DB enum) so adding a
 * new kind doesn't require a migration. Convention: lower_snake.
 *
 *   - `daily_digest`            workspace digest email
 *   - `task_assignment`         a task is assigned to me
 *   - `task_mention`            I'm @mentioned in a comment
 *   - `inbound_message`         a client emails the workspace
 *   - `task_approval`           client approves/rejects/changes my work
 *   - `recurring_task_created`  the recurring-task cron created an
 *                               instance of one of my templates
 */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    workspaceMemberId: uuid('workspace_member_id')
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    memberEventKey: uniqueIndex(
      'notification_preferences_member_event_key',
    ).on(table.workspaceMemberId, table.eventType),
    workspaceIdx: index('notification_preferences_workspace_id_idx').on(
      table.workspaceId,
    ),
  }),
);

export type NotificationPreference =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference =
  typeof notificationPreferences.$inferInsert;
