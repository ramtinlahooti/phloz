'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import {
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { inngest } from '@/inngest';

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  enabled: z.boolean(),
});

/**
 * Toggle the current user's daily-digest opt-in for one workspace.
 * Each membership row owns its own preference, so a user in two
 * workspaces can opt in for one and out of the other.
 *
 * Self-targeting only — the action looks up the caller's membership
 * via `requireUser`. There's no admin override path because the
 * preference is personal.
 */
export async function setDigestEnabledAction(
  input: z.infer<typeof inputSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }

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

  const user = await requireUser();
  const db = getDb();
  const result = await db
    .update(schema.workspaceMembers)
    .set({ digestEnabled: parsed.data.enabled })
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .returning({ id: schema.workspaceMembers.id });

  if (result.length === 0) {
    return { ok: false, error: 'membership_not_found' };
  }

  revalidatePath(`/${parsed.data.workspaceId}/settings`);
  return { ok: true };
}

const digestHourSchema = z.object({
  workspaceId: z.string().uuid(),
  /** 0–23, or null to fall back to the workspace default (9 AM). */
  hour: z.number().int().min(0).max(23).nullable(),
});

/**
 * Set the calling user's preferred digest hour-of-day for one
 * workspace. Stored on `workspace_members.digest_hour`; null means
 * "use the workspace default" (the hourly cron treats null as 9 AM).
 *
 * Self-targeting only — same shape as `setDigestEnabledAction`.
 */
export async function setDigestHourAction(
  input: z.infer<typeof digestHourSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = digestHourSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }

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

  const user = await requireUser();
  const db = getDb();
  const result = await db
    .update(schema.workspaceMembers)
    .set({ digestHour: parsed.data.hour })
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .returning({ id: schema.workspaceMembers.id });

  if (result.length === 0) {
    return { ok: false, error: 'membership_not_found' };
  }

  revalidatePath(`/${parsed.data.workspaceId}/settings`);
  return { ok: true };
}

const previewSchema = z.object({
  workspaceId: z.string().uuid(),
});

/**
 * Trigger a one-off digest send for the calling user only.
 *
 * Looks up the caller's `workspace_members.id` and fires the
 * `digest/send-daily` Inngest event with both `workspaceId` and
 * `membershipId` so the cron's manual path runs `runDigestForWorkspace`
 * with a single-member filter — only the caller gets the email,
 * teammates don't.
 *
 * Useful for sanity-checking the per-member digest content + opt-out
 * toggle without waiting until 9 AM tomorrow. Inngest itself returns
 * 200 even when the API key is missing (no-op path), so this action's
 * `ok: true` doesn't guarantee an email actually arrived — that
 * depends on Resend + Inngest both being configured.
 */
export async function previewDigestAction(
  input: z.infer<typeof previewSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = previewSchema.safeParse(input);
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

  const user = await requireUser();
  const db = getDb();
  const [membership] = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return { ok: false, error: 'membership_not_found' };
  }

  try {
    await inngest.send({
      name: 'digest/send-daily',
      data: {
        workspaceId: parsed.data.workspaceId,
        membershipId: membership.id,
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `inngest_send_failed: ${(err as Error).message}`,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Per-event-type opt-out (notification_preferences)
// ---------------------------------------------------------------------------

const notificationEventTypeSchema = z.enum(NOTIFICATION_EVENT_TYPES);

const setEventPrefSchema = z.object({
  workspaceId: z.string().uuid(),
  eventType: notificationEventTypeSchema,
  enabled: z.boolean(),
});

/**
 * Set the calling user's preference for one event type. Idempotent
 * upsert via ON CONFLICT — re-toggling overwrites the existing row's
 * `enabled` rather than creating duplicates. Same self-targeting
 * shape as the other notification actions.
 */
export async function setNotificationPreferenceAction(
  input: z.infer<typeof setEventPrefSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = setEventPrefSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }

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

  const user = await requireUser();
  const db = getDb();
  const [membership] = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return { ok: false, error: 'membership_not_found' };
  }

  await db
    .insert(schema.notificationPreferences)
    .values({
      workspaceId: parsed.data.workspaceId,
      workspaceMemberId: membership.id,
      eventType: parsed.data.eventType,
      enabled: parsed.data.enabled,
    })
    .onConflictDoUpdate({
      target: [
        schema.notificationPreferences.workspaceMemberId,
        schema.notificationPreferences.eventType,
      ],
      set: {
        enabled: parsed.data.enabled,
        updatedAt: new Date(),
      },
    });

  revalidatePath(`/${parsed.data.workspaceId}/settings`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Per-entity mute / watch (notification_subscriptions)
// ---------------------------------------------------------------------------

const setSubscriptionSchema = z.object({
  workspaceId: z.string().uuid(),
  entityType: z.enum(['client', 'task']),
  entityId: z.string().uuid(),
  /** `null` = clear any existing row. */
  mode: z.enum(['mute', 'watch']).nullable(),
});

/**
 * Mute, watch, or clear the calling user's preference for one
 * client or task. Mute beats default behaviour (the cron skips this
 * entity's items in their digest + suppresses real-time notifications).
 * Watch is opt-in surveillance — no UI ships today; the column is
 * future-proofing for "subscribe to this thread".
 *
 * Passing `mode: null` deletes any existing row, restoring default
 * behaviour. Same self-targeting shape as the other notification
 * actions.
 */
export async function setNotificationSubscriptionAction(
  input: z.infer<typeof setSubscriptionSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = setSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }

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

  const user = await requireUser();
  const db = getDb();
  const [membership] = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return { ok: false, error: 'membership_not_found' };
  }

  if (parsed.data.mode === null) {
    await db
      .delete(schema.notificationSubscriptions)
      .where(
        and(
          eq(schema.notificationSubscriptions.workspaceMemberId, membership.id),
          eq(schema.notificationSubscriptions.entityType, parsed.data.entityType),
          eq(schema.notificationSubscriptions.entityId, parsed.data.entityId),
        ),
      );
  } else {
    // Drop any existing row first so we can switch mute ↔ watch via
    // the same call. The unique index on
    // (member, entity_type, entity_id) means we can never have
    // duplicates; this is just simpler than an ON CONFLICT update.
    await db
      .delete(schema.notificationSubscriptions)
      .where(
        and(
          eq(schema.notificationSubscriptions.workspaceMemberId, membership.id),
          eq(schema.notificationSubscriptions.entityType, parsed.data.entityType),
          eq(schema.notificationSubscriptions.entityId, parsed.data.entityId),
        ),
      );
    await db.insert(schema.notificationSubscriptions).values({
      workspaceId: parsed.data.workspaceId,
      workspaceMemberId: membership.id,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      mode: parsed.data.mode,
    });
  }

  revalidatePath(`/${parsed.data.workspaceId}/settings`);
  // Refresh the entity's own surfaces so any "Muted" badges flip.
  if (parsed.data.entityType === 'client') {
    revalidatePath(
      `/${parsed.data.workspaceId}/clients/${parsed.data.entityId}`,
    );
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vacation mode (workspace_members.paused_until)
// ---------------------------------------------------------------------------

const setPausedUntilSchema = z.object({
  workspaceId: z.string().uuid(),
  /** ISO timestamp, or null to clear. */
  until: z.string().datetime().nullable(),
});

/**
 * Set the calling user's vacation-mode timestamp. While
 * `paused_until > now`, the digest cron skips this member entirely
 * and per-event helpers suppress real-time emails. `null` clears
 * the pause.
 */
export async function setPausedUntilAction(
  input: z.infer<typeof setPausedUntilSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = setPausedUntilSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'invalid_input',
    };
  }

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

  const user = await requireUser();
  const db = getDb();
  const result = await db
    .update(schema.workspaceMembers)
    .set({
      pausedUntil: parsed.data.until ? new Date(parsed.data.until) : null,
    })
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .returning({ id: schema.workspaceMembers.id });

  if (result.length === 0) {
    return { ok: false, error: 'membership_not_found' };
  }

  revalidatePath(`/${parsed.data.workspaceId}/settings`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Read-only helper for the task detail dialog
// ---------------------------------------------------------------------------

const getTaskMuteSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

/**
 * Lazy fetcher for "is this task muted by the calling user?". Returns
 * `{ muted: false }` on any failure (auth, missing membership, etc.)
 * since the dialog can render the un-muted state cleanly without
 * surfacing an error toast for a read.
 */
export async function getTaskMuteStateAction(
  input: z.infer<typeof getTaskMuteSchema>,
): Promise<{ muted: boolean }> {
  const parsed = getTaskMuteSchema.safeParse(input);
  if (!parsed.success) return { muted: false };

  try {
    await requireRole(parsed.data.workspaceId, [
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  } catch {
    return { muted: false };
  }

  const user = await requireUser();
  const db = getDb();
  const [membership] = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (!membership) return { muted: false };

  const [row] = await db
    .select({ id: schema.notificationSubscriptions.id })
    .from(schema.notificationSubscriptions)
    .where(
      and(
        eq(schema.notificationSubscriptions.workspaceMemberId, membership.id),
        eq(schema.notificationSubscriptions.entityType, 'task'),
        eq(schema.notificationSubscriptions.entityId, parsed.data.taskId),
        eq(schema.notificationSubscriptions.mode, 'mute'),
      ),
    )
    .limit(1);

  return { muted: !!row };
}

// Re-export so importers can stay narrow.
export type { NotificationEventType };
