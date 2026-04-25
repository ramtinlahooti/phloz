'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { hashAuthUidServer } from '@phloz/analytics/server';
import { createServerSupabase, createServiceRoleSupabase } from '@phloz/auth/server';
import { requireUser } from '@phloz/auth/session';
import { TIER_NAMES, type TierName } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import { fireTrack, serverTrackContext } from '@/lib/analytics';
import { inngest } from '@/inngest';

/**
 * Create the user's first workspace.
 *
 * Runs service-role writes so the initial rows exist before RLS kicks in
 * (the user has no membership yet at the moment of INSERT).
 *
 * Steps:
 * 1. Generate a unique slug from the workspace name.
 * 2. Insert the workspace row (owner = user.id, tier = starter).
 * 3. Insert the workspace_members row (role = owner).
 * 4. Update the user's user_metadata.active_workspace_id so the next
 *    JWT refresh includes it via the custom access token hook.
 *
 * Returns `{ ok: true, workspaceId }` on success; throws otherwise.
 */
const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export async function createWorkspaceAction(
  _prevState: { error: string | null } | undefined,
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = createSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid name' };
  }

  const user = await requireUser();
  const db = getDb();

  const baseSlug = slugify(parsed.data.name) || 'workspace';
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.query.workspaces.findFirst({
      where: (w, { eq }) => eq(w.slug, slug),
      columns: { id: true },
    });
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      name: parsed.data.name,
      slug,
      ownerUserId: user.id,
      tier: 'starter',
    })
    .returning({ id: schema.workspaces.id });

  if (!workspace) {
    return { error: 'Could not create workspace. Try again.' };
  }

  // Cache the user's identity on the membership row so the Team page +
  // task assignee picker can render names without a cross-schema join
  // against auth.users on every request. Kept in sync via
  // updateUserProfileAction when the user renames themselves.
  const fullName =
    typeof user.user_metadata?.full_name === 'string'
      ? (user.user_metadata.full_name as string)
      : null;

  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
    displayName: fullName,
    email: user.email ?? null,
    acceptedAt: new Date(),
  });

  // Persist the active workspace in user_metadata so the JWT hook reads it.
  const supabase = await createServerSupabase();
  await supabase.auth.updateUser({
    data: { active_workspace_id: workspace.id },
  });

  // Also sync via service role in case the user call's RLS policies
  // refuse — belt and braces for the onboarding path.
  const admin = await createServiceRoleSupabase();
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      active_workspace_id: workspace.id,
    },
  });

  // Fan out to Inngest for async post-creation work (seed defaults,
  // etc.). Swallow failures — Inngest retries on its side and the
  // onboarding flow shouldn't block on it.
  try {
    await inngest.send({
      name: 'workspace/created',
      data: { workspaceId: workspace.id, ownerUserId: user.id },
    });
  } catch (err) {
    console.error('[onboarding] failed to send workspace/created', err);
  }

  // Emit workspace_created. workspace_id_hash is also hashed (PostHog
  // is fine with raw workspace ids, but GA4 MP receives it server-side
  // and we keep all external-facing identifiers hashed for consistency).
  fireTrack(
    'workspace_created',
    { workspace_id_hash: hashAuthUidServer(workspace.id) },
    serverTrackContext(user.id, workspace.id),
  );

  // Honour a paid-tier hint captured during signup (the /pricing CTA
  // sets `signup_tier_hint` on the auth user's metadata). The
  // workspace stays on starter until payment clears — we just route
  // the user to billing so the upgrade is one click instead of
  // hunting through the sidebar. Invalid hints + the free 'starter'
  // hint fall through to the normal dashboard landing.
  const rawHint = user.user_metadata?.signup_tier_hint;
  const tierHint =
    typeof rawHint === 'string' && (TIER_NAMES as readonly string[]).includes(rawHint)
      ? (rawHint as TierName)
      : null;
  if (tierHint && tierHint !== 'starter' && tierHint !== 'enterprise') {
    redirect(`/${workspace.id}/billing?upgrade=${tierHint}`);
  }
  redirect(`/${workspace.id}`);
}
