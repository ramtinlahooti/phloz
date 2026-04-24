import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { pkUuid } from './_helpers';

/**
 * Marketing-site newsletter subscribers. Not tenant-scoped (no
 * `workspace_id`) — this is a cross-workspace audience on the
 * public marketing domain.
 *
 * Writes flow through `/api/newsletter/subscribe` which runs
 * service-role. RLS is enabled with no policies so anon/authenticated
 * roles can't read or write the table directly.
 *
 * Unsubscribe model (V0): set `unsubscribed_at` when a user requests
 * removal. We don't purge the row so we can avoid re-emailing if they
 * re-submit. A proper unsubscribe-token link is a follow-up; for now
 * unsubscribe happens via the service-role route only.
 */
export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    id: pkUuid(),
    email: text('email').notNull(),
    /**
     * Where the signup happened — `homepage_bottom`, `blog_footer`, etc.
     * Mirrors the `source` param on the `newsletter_signup` analytics
     * event so the table + the PostHog funnel line up.
     */
    source: text('source'),
    /** Unix ms when first subscribed. Defaults to now() on insert. */
    subscribedAt: timestamp('subscribed_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
    /** When set, the user asked to be removed. We keep the row so a
     *  re-submit doesn't silently re-opt-in without a confirmation. */
    unsubscribedAt: timestamp('unsubscribed_at', {
      withTimezone: true,
      mode: 'date',
    }),
    /** Room for UTM params, user-agent at signup, or ESP ids once we
     *  integrate Resend audiences. */
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    /** Case-insensitive email uniqueness via lowercased expression. We
     *  uppercase emails on read never — always store lowercase at insert. */
    emailKey: uniqueIndex('newsletter_subscribers_email_key').on(table.email),
    subscribedAtIdx: index('newsletter_subscribers_subscribed_at_idx').on(
      table.subscribedAt,
    ),
  }),
);

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber =
  typeof newsletterSubscribers.$inferInsert;
