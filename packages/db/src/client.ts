import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { requireEnv } from '@phloz/config';

import * as schema from './schema';

let _client: ReturnType<typeof postgres> | null = null;

/**
 * Singleton postgres.js connection pool.
 *
 * Supabase's pgBouncer uses transaction pool mode, which disallows prepared
 * statements. The `prepare: false` option is required. See:
 * https://supabase.com/docs/guides/database/connecting-to-postgres
 */
export function getPgClient() {
  if (!_client) {
    _client = postgres(requireEnv('DATABASE_URL'), {
      prepare: false,
      max: 10,
    });
  }
  return _client;
}

/**
 * Drizzle ORM client. Use this everywhere instead of raw SQL.
 * The schema is fully typed and auto-completes in queries.
 */
export function getDb() {
  return drizzle(getPgClient(), { schema, casing: 'snake_case' });
}

export type Database = ReturnType<typeof getDb>;
export { schema };
