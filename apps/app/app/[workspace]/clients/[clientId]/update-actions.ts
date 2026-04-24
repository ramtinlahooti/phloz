'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';

const uuid = z.string().uuid();

/**
 * Patch a single client's editable fields. Keeping this generic so the
 * inline Notes editor + a future full Edit-client form can both target
 * it — every field is optional; only what's passed gets updated.
 */
const patchSchema = z.object({
  workspaceId: uuid,
  clientId: uuid,
  name: z.string().trim().min(1).max(200).optional(),
  businessName: z.string().trim().max(200).nullable().optional(),
  businessEmail: z.string().email().max(200).nullable().optional(),
  businessPhone: z.string().max(60).nullable().optional(),
  websiteUrl: z.string().url().max(500).nullable().optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
});

/** camelCase column name → snake_case analytics field_changed tag. */
const FIELD_TO_ANALYTICS_KEY: Record<string, string> = {
  name: 'name',
  businessName: 'business_name',
  businessEmail: 'business_email',
  businessPhone: 'business_phone',
  websiteUrl: 'website_url',
  industry: 'industry',
  notes: 'notes',
};

export async function updateClientAction(
  input: z.infer<typeof patchSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  let actor;
  try {
    actor = await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const { workspaceId: _ws, clientId: _id, ...fields } = parsed.data;
  void _ws;
  void _id;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) updates[key] = value;
  }

  if (Object.keys(updates).length === 1) {
    // Only `updatedAt` — nothing to patch.
    return { ok: true };
  }

  const db = getDb();
  await db
    .update(schema.clients)
    .set(updates)
    .where(
      and(
        eq(schema.clients.id, parsed.data.clientId),
        eq(schema.clients.workspaceId, parsed.data.workspaceId),
      ),
    );

  // One `client_updated` event per changed field. This gives PostHog
  // the granularity to see which field people edit most (notes vs
  // website_url vs etc.) at the cost of one extra event per save.
  // Fire-and-forget — server-side PostHog/GA4 latency stays off the
  // critical path for the user's save.
  const ctx = serverTrackContext(actor.user.id, parsed.data.workspaceId);
  for (const key of Object.keys(updates)) {
    if (key === 'updatedAt') continue;
    const analyticsKey = FIELD_TO_ANALYTICS_KEY[key] ?? key;
    fireTrack('client_updated', { field_changed: analyticsKey }, ctx);
  }

  revalidatePath(`/${parsed.data.workspaceId}/clients`);
  revalidatePath(
    `/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`,
  );
  return { ok: true };
}
