/**
 * CI guard — assert that every tenant table in `TENANT_TABLES` has
 * `rowsecurity = true` in the target database. Run against a freshly
 * migrated Postgres instance (the CI workflow handles that).
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm --filter @phloz/db tsx scripts/check-rls-invariants.ts
 *
 * Exits non-zero when any table is missing RLS, so it can fail CI.
 */
import postgres from 'postgres';

import { TENANT_TABLES } from '../src/rls';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is required');
    process.exit(2);
  }

  const sql = postgres(databaseUrl, { prepare: false, max: 1 });

  try {
    const rows = await sql<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY(${sql.array(TENANT_TABLES as unknown as string[])})
    `;

    const byName = new Map(rows.map((r) => [r.tablename, r.rowsecurity]));
    const missing: string[] = [];
    const notEnabled: string[] = [];
    for (const t of TENANT_TABLES) {
      if (!byName.has(t)) missing.push(t);
      else if (!byName.get(t)) notEnabled.push(t);
    }

    if (missing.length || notEnabled.length) {
      console.error('❌ RLS invariant violated');
      if (missing.length) console.error('  Missing tables:', missing);
      if (notEnabled.length) console.error('  RLS disabled on:', notEnabled);
      process.exit(1);
    }

    console.log(
      `✅ All ${TENANT_TABLES.length} tenant tables have rowsecurity=true`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('check-rls-invariants crashed:', err);
  process.exit(2);
});
