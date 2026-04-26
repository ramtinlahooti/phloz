import {
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
 * Per-(member, entity) explicit notification preference.
 *
 * One row per (member, entity_type, entity_id) at most (unique
 * index). Absence of a row means "default behaviour" — the member
 * gets notifications according to their general preferences. Mute
 * suppresses notifications about that entity entirely. Watch is
 * opt-in surveillance (no UI ships today; reserved for the
 * "subscribe to a thread I don't own" pattern).
 *
 * `entity_type` is constrained to `'client' | 'task'` at the DB.
 *
 *   - `client` mute → digest skips this client's items + any
 *     real-time email (inbound message, approval) is suppressed
 *   - `task` mute → no per-task notifications even if the member
 *     is the assignee or a watcher
 *
 * The cron + per-event helpers in
 * `apps/app/inngest/functions/send-daily-digest.ts` (and friends)
 * are what give these rows meaning; the schema is inert without
 * them.
 */
export const notificationSubscriptions = pgTable(
  'notification_subscriptions',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    workspaceMemberId: uuid('workspace_member_id')
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: 'cascade' }),
    /** `'client' | 'task'` (DB-side CHECK constraint enforces). */
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    /** `'mute' | 'watch'` (DB-side CHECK constraint enforces). */
    mode: text('mode').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    memberEntityKey: uniqueIndex(
      'notification_subscriptions_member_entity_key',
    ).on(table.workspaceMemberId, table.entityType, table.entityId),
    workspaceIdx: index('notification_subscriptions_workspace_id_idx').on(
      table.workspaceId,
    ),
    entityIdx: index('notification_subscriptions_entity_idx').on(
      table.entityType,
      table.entityId,
    ),
  }),
);

export type NotificationSubscription =
  typeof notificationSubscriptions.$inferSelect;
export type NewNotificationSubscription =
  typeof notificationSubscriptions.$inferInsert;

/** App-level enums that mirror the DB CHECK constraints. */
export const NOTIFICATION_ENTITY_TYPES = ['client', 'task'] as const;
export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];

export const NOTIFICATION_SUBSCRIPTION_MODES = ['mute', 'watch'] as const;
export type NotificationSubscriptionMode =
  (typeof NOTIFICATION_SUBSCRIPTION_MODES)[number];
