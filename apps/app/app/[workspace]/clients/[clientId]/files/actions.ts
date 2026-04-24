'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { createServerSupabase } from '@phloz/auth/server';
import { requireUser } from '@phloz/auth/session';
import { getDb, schema } from '@phloz/db/client';
import type { AssetType } from '@phloz/db/schema';

const uuid = z.string().uuid();

/**
 * Max upload size we accept from the app layer. The Supabase bucket
 * also enforces this (see the `client_assets_storage_bucket` migration).
 * Vercel's server-action body limit is 4.5MB by default; users uploading
 * larger files will hit that first — when we need larger, switch to a
 * signed-upload-URL flow.
 */
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB — under Vercel's cap
const BUCKET = 'client-assets';

const ALLOWED_MIMES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

function inferAssetType(mime: string): AssetType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (
    mime === 'application/pdf' ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime === 'text/plain' ||
    mime === 'text/csv'
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * Upload a file to Supabase Storage and record it in `client_assets`.
 * Called from a <form action={uploadAssetAction}> in the Files tab.
 *
 * The uploaded path is `{workspaceId}/{clientId}/{timestamp}-{filename}`
 * so the RLS policies on `storage.objects` can extract the workspaceId
 * as the first folder segment (see the migration).
 */
export async function uploadAssetAction(
  _prev: { error: string | null } | undefined,
  formData: FormData,
): Promise<{ error: string | null }> {
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const clientId = String(formData.get('clientId') ?? '');
  const file = formData.get('file');
  const notes = (formData.get('notes') as string | null)?.trim() || null;

  if (!uuid.safeParse(workspaceId).success || !uuid.safeParse(clientId).success) {
    return { error: 'Invalid workspace / client id' };
  }
  if (!(file instanceof File)) {
    return { error: 'No file selected' };
  }
  if (file.size === 0) {
    return { error: 'File is empty' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: `File exceeds ${MAX_FILE_BYTES / 1024 / 1024}MB limit` };
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return {
      error: `File type ${file.type || 'unknown'} isn't allowed. Allowed: images, PDFs, docs, videos.`,
    };
  }

  try {
    await requireRole(workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { error: 'forbidden' };
  }
  const user = await requireUser();

  const supabase = await createServerSupabase();

  // Path: {workspaceId}/{clientId}/{unix-ms}-{safeName}
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const path = `${workspaceId}/${clientId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const db = getDb();
  await db.insert(schema.clientAssets).values({
    workspaceId,
    clientId,
    name: file.name,
    url: path, // store the object path; generate signed URLs on read
    assetType: inferAssetType(file.type),
    notes,
    createdBy: user.id,
  });

  revalidatePath(`/${workspaceId}/clients/${clientId}`);
  return { error: null };
}

/**
 * Return a short-lived signed URL for downloading / previewing an asset.
 * Called from a client-side button that opens the URL in a new tab.
 */
export async function getAssetSignedUrlAction(input: {
  workspaceId: string;
  assetId: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.assetId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    await requireRole(input.workspaceId, [
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const asset = await db
    .select()
    .from(schema.clientAssets)
    .where(
      and(
        eq(schema.clientAssets.id, input.assetId),
        eq(schema.clientAssets.workspaceId, input.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!asset) return { ok: false, error: 'not_found' };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(asset.url, 300); // 5 minutes
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'signed_url_failed' };
  }

  return { ok: true, url: data.signedUrl };
}

/**
 * Delete an asset — both the Storage object and the DB row. Role-gated
 * at owner/admin/member (viewers can only read).
 */
export async function deleteAssetAction(input: {
  workspaceId: string;
  assetId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.assetId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const asset = await db
    .select()
    .from(schema.clientAssets)
    .where(
      and(
        eq(schema.clientAssets.id, input.assetId),
        eq(schema.clientAssets.workspaceId, input.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!asset) return { ok: false, error: 'not_found' };

  const supabase = await createServerSupabase();
  const { error: rmError } = await supabase.storage
    .from(BUCKET)
    .remove([asset.url]);
  if (rmError) {
    // Log but don't hard fail — orphan object is less bad than a
    // stale DB row with no way to remove.
    console.warn('[files] storage.remove failed', rmError);
  }

  await db
    .delete(schema.clientAssets)
    .where(eq(schema.clientAssets.id, input.assetId));

  revalidatePath(`/${input.workspaceId}/clients/${asset.clientId}`);
  return { ok: true };
}
