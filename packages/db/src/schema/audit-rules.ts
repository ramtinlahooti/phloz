import { boolean, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps } from './_helpers';
import { workspaces } from './workspaces';

/**
 * V2 scaffold (see ARCHITECTURE.md §5.4). Declarative health-audit rules
 * run by the V2 audit engine.
 * TODO(V2): rule DSL, scope, severity, suppression, triggering schedule.
 */
export const auditRules = pgTable('audit_rules', {
  id: pkUuid(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export type AuditRule = typeof auditRules.$inferSelect;
export type NewAuditRule = typeof auditRules.$inferInsert;
