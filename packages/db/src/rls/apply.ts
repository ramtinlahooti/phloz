import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireEnv } from '@phloz/config';
import postgres from 'postgres';

import { RLS_FILES } from './index';

/**
 * Apply every RLS SQL file against the configured database.
 *
 * Idempotent: each file uses CREATE OR REPLACE for functions and
 * `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is safe to rerun.
 *
 * CREATE POLICY is NOT idempotent — on re-run, existing policies must be
 * dropped first. The migration runner handles that by tracking applied
 * versions; see packages/db/README.md.
 */
async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sql = postgres(requireEnv('DATABASE_URL'), { prepare: false, max: 1 });

  try {
    for (const file of RLS_FILES) {
      const path = join(__dirname, file);
      const content = await readFile(path, 'utf8');
      // eslint-disable-next-line no-console
      console.warn(`[rls] applying ${file}`);
      await sql.unsafe(content);
    }
    // eslint-disable-next-line no-console
    console.warn('[rls] done');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
