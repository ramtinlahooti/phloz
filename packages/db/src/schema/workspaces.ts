import { index, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import type { SubscriptionStatus, TierName } from '@phloz/config';

import { pkUuid, timestamps, userIdRef } from './_helpers';

/**
 * Shape of `workspaces.settings` jsonb. Extend as new settings are added.
 * Toggle `all_members_see_all_clients` to relax the assignment-based filter
 * in RLS for `member`/`viewer` roles (ARCHITECTURE.md §6.4).
 */
export type WorkspaceSettings = {
  all_members_see_all_clients?: boolean;
  [key: string]: unknown;
};

export const workspaces = pgTable(
  'workspaces',
  {
    id: pkUuid(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    ownerUserId: userIdRef('owner_user_id'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    tier: text('tier').$type<TierName>().notNull().default('starter'),
    subscriptionStatus: text('subscription_status').$type<SubscriptionStatus | null>(),
    settings: jsonb('settings').$type<WorkspaceSettings>().notNull().default({}),
    /** Short public description — agency tagline / what they do. */
    description: text('description'),
    /** Primary agency website. Shown on the workspace settings page + future portal branding. */
    websiteUrl: text('website_url'),
    /** IANA tz (e.g. America/Vancouver). Formatting helpers default here when rendering dates. */
    timezone: text('timezone'),
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex('workspaces_slug_key').on(table.slug),
    ownerIdx: index('workspaces_owner_user_id_idx').on(table.ownerUserId),
  }),
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
