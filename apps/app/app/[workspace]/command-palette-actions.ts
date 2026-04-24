'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { getDb, schema } from '@phloz/db/client';

/**
 * Command palette data fetcher. Called client-side when the user
 * opens ⌘K — we don't preload this in the layout because every
 * authenticated page would pay the cost on first render even when
 * the user never opens the palette.
 *
 * Limits are intentional: the UI is a keyboard-driven filter, not
 * a scrollable data view. 50 clients + 100 tasks covers the vast
 * majority of agencies we're targeting (≤100 active clients per
 * workspace per ARCHITECTURE.md §7.1).
 */

const schemaValidator = z.object({ workspaceId: z.string().uuid() });

export type PaletteClient = { id: string; name: string };
export type PaletteTask = {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
};

export async function listCommandPaletteItemsAction(
  input: z.infer<typeof schemaValidator>,
): Promise<
  | { ok: true; clients: PaletteClient[]; tasks: PaletteTask[] }
  | { ok: false; error: string }
> {
  const parsed = schemaValidator.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  try {
    await requireRole(parsed.data.workspaceId, [
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();

  const [clientRows, taskRows] = await Promise.all([
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.workspaceId, parsed.data.workspaceId),
          // Archived clients don't show up in the palette — one less
          // line of noise for a power user who's looking for active
          // work.
          isNull(schema.clients.archivedAt),
        ),
      )
      .orderBy(desc(schema.clients.updatedAt))
      .limit(100),
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        clientId: schema.tasks.clientId,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.workspaceId, parsed.data.workspaceId),
          // Same reasoning as the /tasks page: subtasks live inside
          // their parent and shouldn't be top-level search hits.
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(desc(schema.tasks.updatedAt))
      .limit(200),
  ]);

  const clientById = new Map(clientRows.map((c) => [c.id, c.name]));
  const tasks: PaletteTask[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    clientId: t.clientId,
    clientName: t.clientId ? clientById.get(t.clientId) ?? null : null,
  }));

  return { ok: true, clients: clientRows, tasks };
}
