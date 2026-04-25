import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Department, TaskPriority, TaskVisibility } from '@phloz/config';

import { pkUuid, timestamps, userIdRef } from './_helpers';
import { clients } from './clients';
import { workspaceMembers } from './workspace-members';
import { workspaces } from './workspaces';

/**
 * Recurring task templates. The Inngest hourly cron checks each
 * enabled template against the workspace's local clock; when the
 * cadence matches and `last_run_at` isn't already on today's local
 * date, it inserts a fresh `tasks` row from the template fields.
 *
 * Cadence:
 *   - daily: matches every day at the configured local hour
 *   - weekly: matches when local weekday == `weekday` (0=Sunday)
 *   - monthly: matches when local day-of-month == `day_of_month`
 *     (clamped to month length, so 31 fires on the 28th in Feb)
 */
export const recurringTaskTemplates = pgTable(
  'recurring_task_templates',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority').$type<TaskPriority>().notNull().default('medium'),
    department: text('department').$type<Department>().notNull().default('other'),
    visibility: text('visibility').$type<TaskVisibility>().notNull().default('internal'),
    assigneeId: uuid('assignee_id').references(() => workspaceMembers.id, {
      onDelete: 'set null',
    }),
    /** When instantiated, due_date = now + due_offset_days. 0 = no due date. */
    dueOffsetDays: integer('due_offset_days').notNull().default(0),
    cadence: text('cadence').notNull(),
    /** Sunday=0 ... Saturday=6, used when cadence='weekly'. */
    weekday: smallint('weekday'),
    /** 1-31, used when cadence='monthly'. */
    dayOfMonth: smallint('day_of_month'),
    enabled: boolean('enabled').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true, mode: 'date' }),
    createdBy: userIdRef('created_by', { nullable: true }),
    ...timestamps,
  },
  (table) => ({
    workspaceIdx: index('recurring_task_templates_workspace_id_idx').on(
      table.workspaceId,
    ),
    clientIdx: index('recurring_task_templates_client_id_idx').on(table.clientId),
    enabledIdx: index('recurring_task_templates_enabled_idx').on(table.enabled),
  }),
);

export type RecurringTaskTemplate = typeof recurringTaskTemplates.$inferSelect;
export type NewRecurringTaskTemplate = typeof recurringTaskTemplates.$inferInsert;
