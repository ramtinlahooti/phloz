import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { pkUuid } from './_helpers';
import { clients } from './clients';
import { workspaces } from './workspaces';

/**
 * Tracking-map audit suppressions. Users can snooze a rule for a
 * specific client when the finding represents a legitimate exception
 * (e.g. "this client is iOS-app-only, we don't need Meta CAPI").
 *
 * V1 scope:
 * - Per-client suppression only (no workspace-wide). If the same
 *   exception applies across many clients, the user re-suppresses
 *   per client — explicit, auditable.
 * - Permanent until manually un-snoozed. No "snooze for 30 days"
 *   semantic yet — add later via a `expires_at` column.
 * - One suppression per `(workspace_id, client_id, rule_id)` triple
 *   (uniqueness enforced); re-snoozing is a no-op via ON CONFLICT.
 *
 * Reading: every workspace member can see their workspace's
 * suppressions. Writing: handled by server actions, role-gated to
 * owner / admin / member.
 */
export const auditSuppressions = pgTable(
  'audit_suppressions',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    /**
     * Matches one of the IDs from the tracking-map audit engine —
     * `broken-node`, `meta-pixel-no-capi`, etc. Stored as text rather
     * than enum so adding a rule doesn't require a migration.
     */
    ruleId: text('rule_id').notNull(),
    /**
     * Optional free-text justification ("mobile-only", "client signed
     * a waiver", etc.). Visible in the suppression list so future
     * teammates can understand the call.
     */
    reason: text('reason'),
    /** Supabase auth user id of whoever snoozed the rule. */
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    /** Re-snoozing the same rule for the same client is a no-op,
     *  not a duplicate row. */
    uniquePerRule: uniqueIndex('audit_suppressions_unique_per_rule').on(
      table.workspaceId,
      table.clientId,
      table.ruleId,
    ),
    workspaceIdx: index('audit_suppressions_workspace_id_idx').on(
      table.workspaceId,
    ),
    clientIdx: index('audit_suppressions_client_id_idx').on(table.clientId),
  }),
);

export type AuditSuppression = typeof auditSuppressions.$inferSelect;
export type NewAuditSuppression = typeof auditSuppressions.$inferInsert;
