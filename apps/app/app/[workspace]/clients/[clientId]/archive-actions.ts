'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { canUnarchiveClient } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

const uuid = z.string().uuid();

/**
 * Archive a client — flips archivedAt to now and records an optional
 * reason. Archived clients don't count against the tier's active-client
 * cap (`getActiveClientCount` only counts rows with archivedAt IS NULL).
 * Role-gated at owner/admin/member.
 */
export async function archiveClientAction(input: {
  workspaceId: string;
  clientId: string;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.clientId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  let actor;
  try {
    actor = await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  await db
    .update(schema.clients)
    .set({
      archivedAt: new Date(),
      archivedReason: input.reason?.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.clients.id, input.clientId),
        eq(schema.clients.workspaceId, input.workspaceId),
      ),
    );

  fireTrack(
    'client_archived',
    {},
    serverTrackContext(actor.user.id, input.workspaceId),
  );

  revalidatePath(`/${input.workspaceId}/clients`);
  revalidatePath(`/${input.workspaceId}/clients/${input.clientId}`);
  revalidatePath(`/${input.workspaceId}`);
  return { ok: true };
}

/**
 * Unarchive a client. Goes through `canUnarchiveClient` which checks:
 *   - Tier's active-client cap has room (can't unarchive into a full
 *     workspace — agency must upgrade first).
 *   - The unarchive throttle (prevents rapid archive/unarchive to game
 *     the cap).
 */
export async function unarchiveClientAction(input: {
  workspaceId: string;
  clientId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.clientId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  let actor;
  try {
    actor = await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const gate = await canUnarchiveClient(input.workspaceId, input.clientId);
  if (!gate.allowed) {
    return { ok: false, error: gate.message };
  }

  const db = getDb();
  await db
    .update(schema.clients)
    .set({
      archivedAt: null,
      archivedReason: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.clients.id, input.clientId),
        eq(schema.clients.workspaceId, input.workspaceId),
      ),
    );

  fireTrack(
    'client_unarchived',
    {},
    serverTrackContext(actor.user.id, input.workspaceId),
  );

  revalidatePath(`/${input.workspaceId}/clients`);
  revalidatePath(`/${input.workspaceId}/clients/${input.clientId}`);
  revalidatePath(`/${input.workspaceId}`);
  return { ok: true };
}
