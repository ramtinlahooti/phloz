import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { pkUuid, timestamps, userIdRef } from './_helpers';
import { workspaces } from './workspaces';

export type BusinessAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
};

export type GeoTargeting = {
  countries?: string[];
  regions?: string[];
  cities?: string[];
};

export const clients = pgTable(
  'clients',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    businessName: text('business_name'),
    businessPhone: text('business_phone'),
    businessEmail: text('business_email'),
    businessAddress: jsonb('business_address').$type<BusinessAddress>(),
    companySize: text('company_size'),
    companyBudget: numeric('company_budget', { precision: 14, scale: 2 }),
    targetCpa: numeric('target_cpa', { precision: 14, scale: 2 }),
    geoTargeting: jsonb('geo_targeting').$type<GeoTargeting>(),
    industry: text('industry'),
    websiteUrl: text('website_url'),
    notes: text('notes'),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
    archivedReason: text('archived_reason'),
    /**
     * Cached max(createdAt) across tasks / messages / tracking_nodes /
     * tracking_edges / client_assets. Populated by the Inngest
     * `recomputeActiveClientCount` cron. Used for at-risk / inactive
     * surfacing — NOT authoritative for billing (billing computes
     * activity live in `getActiveClientCount`).
     */
    lastActivityAt: timestamp('last_activity_at', {
      withTimezone: true,
      mode: 'date',
    }),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
    createdBy: userIdRef('created_by', { nullable: true }),
    ...timestamps,
  },
  (table) => ({
    workspaceIdx: index('clients_workspace_id_idx').on(table.workspaceId),
    archivedIdx: index('clients_archived_at_idx').on(table.archivedAt),
    lastActivityIdx: index('clients_last_activity_at_idx').on(
      table.lastActivityAt,
    ),
  }),
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
