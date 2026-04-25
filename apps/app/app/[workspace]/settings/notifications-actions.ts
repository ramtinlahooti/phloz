'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
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
