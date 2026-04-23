import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { pkUuid } from './_helpers';
import { workspaces } from './workspaces';

/**
 * Append-only audit trail for sensitive actions (delete client, remove
 * member, change role, etc.). Writes come from server code only; clients
 * cannot mutate.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorType: text('actor_type').notNull(), // 'member' | 'system' | 'stripe' | etc.
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index('audit_log_workspace_id_idx').on(table.workspaceId),
    entityIdx: index('audit_log_entity_idx').on(table.entityType, table.entityId),
    createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
