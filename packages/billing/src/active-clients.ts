import { ACTIVE_CLIENT_WINDOW_DAYS } from '@phloz/config';
import { and, eq, getDb, isNull, or, schema, sql } from '@phloz/db';

/**
 * Active-client count per ARCHITECTURE.md §7.2.
 *
 * A client counts against the tier limit if:
 *   - archived_at IS NULL, AND
 *   - (created within 60 days, OR any activity within 60 days)
 *
 * Activity = a tracking_node, task, or message touched (created or updated)
 * in the last 60 days.
 */
export async function getActiveClientCount(workspaceId: string): Promise<number> {
  const db = getDb();
  const windowDays = ACTIVE_CLIENT_WINDOW_DAYS;

  // One CTE-style query keeps this to a single round-trip.
  const [row] = await db.execute<{ count: string }>(sql`
    SELECT COUNT(DISTINCT c.id)::text as count
    FROM ${schema.clients} c
    WHERE c.workspace_id = ${workspaceId}
      AND c.archived_at IS NULL
      AND (
        c.created_at >= now() - (${windowDays}::int * interval '1 day')
        OR EXISTS (
          SELECT 1 FROM ${schema.trackingNodes} n
          WHERE n.client_id = c.id
            AND (
              n.created_at >= now() - (${windowDays}::int * interval '1 day')
              OR n.updated_at >= now() - (${windowDays}::int * interval '1 day')
            )
        )
        OR EXISTS (
          SELECT 1 FROM ${schema.tasks} t
          WHERE t.client_id = c.id
            AND (
              t.created_at >= now() - (${windowDays}::int * interval '1 day')
              OR t.updated_at >= now() - (${windowDays}::int * interval '1 day')
            )
        )
        OR EXISTS (
          SELECT 1 FROM ${schema.messages} m
          WHERE m.client_id = c.id
            AND m.created_at >= now() - (${windowDays}::int * interval '1 day')
        )
      )
  `);

  return Number(row?.count ?? 0);
}

/** Count of non-archived clients regardless of activity. */
export async function getUnarchivedClientCount(workspaceId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(schema.clients)
    .where(and(eq(schema.clients.workspaceId, workspaceId), isNull(schema.clients.archivedAt)));
  return Number(rows[0]?.count ?? 0);
}

/** Total clients including archived — for the 3x hard cap. */
export async function getTotalClientCount(workspaceId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(schema.clients)
    .where(eq(schema.clients.workspaceId, workspaceId));
  return Number(rows[0]?.count ?? 0);
}

/** Count of paid-seat members (owner + admin + member). Viewers don't count. */
export async function getPaidSeatCount(workspaceId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        or(
          eq(schema.workspaceMembers.role, 'owner'),
          eq(schema.workspaceMembers.role, 'admin'),
          eq(schema.workspaceMembers.role, 'member'),
        ),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Count of recurring task templates regardless of `enabled` state — a
 * disabled template still occupies a row and a future re-enable
 * shouldn't be blocked by the limit. Disable + create cycles would
 * otherwise let users skirt the cap.
 */
export async function getRecurringTemplateCount(workspaceId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(schema.recurringTaskTemplates)
    .where(eq(schema.recurringTaskTemplates.workspaceId, workspaceId));
  return Number(rows[0]?.count ?? 0);
}
