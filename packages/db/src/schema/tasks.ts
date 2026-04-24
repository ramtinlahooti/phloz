import { index, pgTable, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import type {
  ApprovalState,
  Department,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@phloz/config';

import { pkUuid, timestamps, userIdRef } from './_helpers';
import { clients } from './clients';
import { trackingNodes } from './tracking-nodes';
import { workspaceMembers } from './workspace-members';
import { workspaces } from './workspaces';

/**
 * Parent-task nesting is enforced to one level at the application layer — the
 * DB does not self-enforce depth. See @phloz/types task schema.
 */
export const tasks = pgTable(
  'tasks',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<TaskStatus>().notNull().default('todo'),
    priority: text('priority').$type<TaskPriority>().notNull().default('medium'),
    department: text('department').$type<Department>().notNull().default('other'),
    visibility: text('visibility').$type<TaskVisibility>().notNull().default('internal'),
    assigneeId: uuid('assignee_id').references(() => workspaceMembers.id, {
      onDelete: 'set null',
    }),
    dueDate: timestamp('due_date', { withTimezone: true, mode: 'date' }),
    relatedNodeId: uuid('related_node_id').references(() => trackingNodes.id, {
      onDelete: 'set null',
    }),
    relatedMessageId: uuid('related_message_id'),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    approvalState: text('approval_state').$type<ApprovalState>().notNull().default('none'),
    approvalComment: text('approval_comment'),
    approvalUpdatedAt: timestamp('approval_updated_at', { withTimezone: true, mode: 'date' }),
    createdBy: userIdRef('created_by', { nullable: true }),
    ...timestamps,
  },
  (table) => ({
    workspaceIdx: index('tasks_workspace_id_idx').on(table.workspaceId),
    clientIdx: index('tasks_client_id_idx').on(table.clientId),
    assigneeIdx: index('tasks_assignee_id_idx').on(table.assigneeId),
    statusIdx: index('tasks_status_idx').on(table.status),
    dueDateIdx: index('tasks_due_date_idx').on(table.dueDate),
  }),
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
