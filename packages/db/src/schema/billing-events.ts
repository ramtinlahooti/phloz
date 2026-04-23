import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { pkUuid } from './_helpers';
import { workspaces } from './workspaces';

/**
 * Stripe webhook audit trail. stripe_event_id is unique so webhook replay
 * cannot double-process. `processedAt` null = queued, set = handled.
 */
export const billingEvents = pgTable(
  'billing_events',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    stripeEventId: text('stripe_event_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    stripeEventUnique: uniqueIndex('billing_events_stripe_event_id_key').on(table.stripeEventId),
    workspaceIdx: index('billing_events_workspace_id_idx').on(table.workspaceId),
    typeIdx: index('billing_events_type_idx').on(table.type),
    processedIdx: index('billing_events_processed_at_idx').on(table.processedAt),
  }),
);

export type BillingEvent = typeof billingEvents.$inferSelect;
export type NewBillingEvent = typeof billingEvents.$inferInsert;
