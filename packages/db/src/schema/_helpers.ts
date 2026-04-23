import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Shared column helpers used across every schema file.
 * Keep this tiny — only things every table actually needs.
 */

export const pkUuid = () => uuid('id').defaultRandom().primaryKey();

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
};

/**
 * Convenience for Supabase auth.users references. `auth.users` is owned by
 * Supabase and not part of our schema; we treat user ids as opaque uuids.
 */
export const userIdRef = (name: string, opts: { nullable?: boolean } = {}) => {
  const col = uuid(name);
  return opts.nullable ? col : col.notNull();
};

/**
 * Sentinel for updated_at columns that must be kept in sync. The db trigger
 * that actually maintains it is emitted by the initial migration.
 */
export const touchTrigger = sql`
  CREATE OR REPLACE FUNCTION touch_updated_at()
  RETURNS trigger AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;
