import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { AuthorType, MessageChannel, MessageDirection } from '@phloz/config';

import { pkUuid } from './_helpers';
import { clients } from './clients';
import { workspaces } from './workspaces';

/**
 * `fromType` + `fromId` is polymorphic:
 *   - member: fromId = workspace_members.id
 *   - contact: fromId = client_contacts.id
 *   - system: fromId null
 * The app enforces consistency; no DB-level FK to keep the column generic.
 */
export const messages = pgTable(
  'messages',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id').notNull(),
    direction: text('direction').$type<MessageDirection>().notNull(),
    channel: text('channel').$type<MessageChannel>().notNull(),
    fromType: text('from_type').$type<AuthorType>().notNull(),
    fromId: uuid('from_id'),
    subject: text('subject'),
    body: text('body').notNull(),
    rawEmail: jsonb('raw_email').$type<Record<string, unknown>>(),
    /**
     * "Needs follow-up" flag — starred messages pin to the top of the
     * inbox so they aren't pushed off the first page by newer
     * traffic. Per-message rather than per-thread by design: the
     * inbox renders flat-by-message, so per-message granularity
     * matches the UI without a thread-aggregation step.
     */
    starred: boolean('starred').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index('messages_workspace_id_idx').on(table.workspaceId),
    clientIdx: index('messages_client_id_idx').on(table.clientId),
    threadIdx: index('messages_thread_id_idx').on(table.threadId),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
    starredCreatedAtIdx: index('messages_starred_created_at_idx').on(
      table.workspaceId,
      table.starred,
      table.createdAt,
    ),
  }),
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
