import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import type { AuthorType, CommentParentType, TaskVisibility } from '@phloz/config';

import { pkUuid, timestamps } from './_helpers';
import { workspaces } from './workspaces';

/**
 * Polymorphic comments: attached to tasks, tracking_nodes, messages, or
 * clients via (parent_type, parent_id). Author is also polymorphic (member
 * vs. client_contact). Consistency is enforced by the app.
 */
export const comments = pgTable(
  'comments',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').notNull(),
    authorType: text('author_type').$type<AuthorType>().notNull(),
    parentType: text('parent_type').$type<CommentParentType>().notNull(),
    parentId: uuid('parent_id').notNull(),
    body: text('body').notNull(),
    mentions: uuid('mentions').array().notNull().default([]),
    visibility: text('visibility').$type<TaskVisibility>().notNull().default('internal'),
    ...timestamps,
  },
  (table) => ({
    workspaceIdx: index('comments_workspace_id_idx').on(table.workspaceId),
    parentIdx: index('comments_parent_idx').on(table.parentType, table.parentId),
  }),
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
