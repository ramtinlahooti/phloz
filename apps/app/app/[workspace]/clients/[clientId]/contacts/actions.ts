'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { generatePortalMagicLink } from '@phloz/auth/portal';
import { getDb, schema } from '@phloz/db/client';
import { sendPortalMagicLink } from '@phloz/email';

import { getAppUrl } from '@/lib/app-url';

const uuid = z.string().uuid();

// --- create contact ----------------------------------------------------
const createContactSchema = z.object({
  workspaceId: uuid,
  clientId: uuid,
  name: z.string().trim().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(60).optional(),
  role: z.string().max(100).optional(),
  portalAccess: z.boolean().default(false),
});

export async function createContactAction(
  input: z.infer<typeof createContactSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = createContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const [row] = await db
    .insert(schema.clientContacts)
    .values({
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      role: parsed.data.role || null,
      portalAccess: parsed.data.portalAccess,
    })
    .returning({ id: schema.clientContacts.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  revalidatePath(
    `/${parsed.data.workspaceId}/clients/${parsed.data.clientId}`,
  );
  return { ok: true, id: row.id };
}

// --- toggle portal access ---------------------------------------------
export async function togglePortalAccessAction(input: {
  workspaceId: string;
  contactId: string;
  portalAccess: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.contactId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const contact = await db
    .select({ clientId: schema.clientContacts.clientId })
    .from(schema.clientContacts)
    .where(
      and(
        eq(schema.clientContacts.id, input.contactId),
        eq(schema.clientContacts.workspaceId, input.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!contact) return { ok: false, error: 'not_found' };

  await db
    .update(schema.clientContacts)
    .set({ portalAccess: input.portalAccess })
    .where(eq(schema.clientContacts.id, input.contactId));

  revalidatePath(`/${input.workspaceId}/clients/${contact.clientId}`);
  return { ok: true };
}

// --- delete contact ---------------------------------------------------
export async function deleteContactAction(input: {
  workspaceId: string;
  contactId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.contactId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const contact = await db
    .select({ clientId: schema.clientContacts.clientId })
    .from(schema.clientContacts)
    .where(
      and(
        eq(schema.clientContacts.id, input.contactId),
        eq(schema.clientContacts.workspaceId, input.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!contact) return { ok: false, error: 'not_found' };

  await db
    .delete(schema.clientContacts)
    .where(eq(schema.clientContacts.id, input.contactId));

  revalidatePath(`/${input.workspaceId}/clients/${contact.clientId}`);
  return { ok: true };
}

// --- generate portal magic link ---------------------------------------
export async function generatePortalLinkAction(input: {
  workspaceId: string;
  contactId: string;
  /** When true, also emails the link via Resend. When false, returns
   * the URL so the caller can copy it to clipboard. Dev-friendly
   * default is false since most local setups don't have Resend keys. */
  sendEmail?: boolean;
}): Promise<
  | { ok: true; url: string; emailed: boolean }
  | { ok: false; error: string }
> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.contactId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  try {
    const session = await generatePortalMagicLink(input.contactId);
    const appUrl = await getAppUrl();
    const fullUrl = `${appUrl}/portal/${session.token}`;

    let emailed = false;
    if (input.sendEmail !== false) {
      const db = getDb();
      const contact = await db
        .select({
          email: schema.clientContacts.email,
          name: schema.clientContacts.name,
        })
        .from(schema.clientContacts)
        .where(eq(schema.clientContacts.id, input.contactId))
        .limit(1)
        .then((r) => r[0]);

      if (contact?.email) {
        const workspace = await db
          .select({ name: schema.workspaces.name })
          .from(schema.workspaces)
          .where(eq(schema.workspaces.id, input.workspaceId))
          .limit(1)
          .then((r) => r[0]);
        try {
          await sendPortalMagicLink({
            to: contact.email,
            contactName: contact.name,
            workspaceName: workspace?.name ?? 'Your agency',
            magicLinkUrl: fullUrl,
          });
          emailed = true;
        } catch {
          // Email-send failures don't fail the action — we still return
          // the URL so the agency can copy + paste manually.
          emailed = false;
        }
      }
    }

    revalidatePath(`/${input.workspaceId}/clients`);
    return { ok: true, url: fullUrl, emailed };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
