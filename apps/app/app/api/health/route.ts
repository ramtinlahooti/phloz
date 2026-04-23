import { NextResponse } from 'next/server';

import { getDb } from '@phloz/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness + basic DB readiness. Returns 200 when the app can round-trip
 * to Postgres. Used by uptime monitors and Vercel health checks.
 */
export async function GET() {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({
      ok: true,
      db: 'ok',
      at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: 'error',
        error: (err as Error).message,
        at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
