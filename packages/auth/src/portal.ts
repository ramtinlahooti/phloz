import { PORTAL_MAGIC_LINK_TTL_DAYS } from '@phloz/config';
import { eq, getDb, schema } from '@phloz/db';
import { nanoid } from 'nanoid';

import { AuthError } from './errors';

const PORTAL_TOKEN_LENGTH = 40;

export type PortalSession = {
  token: string;
  url: string;
  clientId: string;
  workspaceId: string;
  clientContactId: string;
  expiresAt: Date;
};

/**
 * Issue a fresh portal magic link for a client_contact. Throws if the
 * contact has portal_access disabled. Caller is responsible for emailing
 * the URL to the contact (see @phloz/email).
 */
export async function generatePortalMagicLink(clientContactId: string): Promise<PortalSession> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.clientContacts)
    .where(eq(schema.clientContacts.id, clientContactId))
    .limit(1);
  const contact = rows[0];
  if (!contact) throw new AuthError('portal_link_invalid', 'contact not found');
  if (!contact.portalAccess) throw new AuthError('forbidden', 'portal access disabled');

  const token = nanoid(PORTAL_TOKEN_LENGTH);
  const expiresAt = new Date(Date.now() + PORTAL_MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(schema.portalMagicLinks).values({
    token,
    clientContactId: contact.id,
    clientId: contact.clientId,
    workspaceId: contact.workspaceId,
    expiresAt,
  });

  return {
    token,
    url: `/portal/${token}`,
    clientId: contact.clientId,
    workspaceId: contact.workspaceId,
    clientContactId: contact.id,
    expiresAt,
  };
}

/**
 * Look up a magic link by token. Returns the row if valid and unexpired,
 * null otherwise. Touches last_used_at so we can expire idle sessions.
 */
export async function validatePortalMagicLink(token: string) {
  if (!token || token.length !== PORTAL_TOKEN_LENGTH) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.portalMagicLinks)
    .where(eq(schema.portalMagicLinks.token, token))
    .limit(1);
  const link = rows[0];
  if (!link) return null;
  if (link.expiresAt.getTime() < Date.now()) return null;

  await db
    .update(schema.portalMagicLinks)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.portalMagicLinks.token, token));

  return link;
}

/** Revoke a magic link (e.g. on explicit sign-out). */
export async function revokePortalMagicLink(token: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.portalMagicLinks).where(eq(schema.portalMagicLinks.token, token));
}
