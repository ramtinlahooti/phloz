import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, userIdRef } from './_helpers';
import { tasks } from './tasks';

export const taskWatchers = pgTable(
  'task_watchers',
  {
    id: pkUuid(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: userIdRef('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueWatch: uniqueIndex('task_watchers_task_user_key').on(table.taskId, table.userId),
    taskIdx: index('task_watchers_task_id_idx').on(table.taskId),
  }),
);

export type TaskWatcher = typeof taskWatchers.$inferSelect;
export type NewTaskWatcher = typeof taskWatchers.$inferInsert;
