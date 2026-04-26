import { and, eq, inArray, or } from 'drizzle-orm';

import { getDb, schema } from '@phloz/db/client';
import { sendMessageNotification } from '@phloz/email';

/**
 * Fan out an inbound-message notification email to every owner +
 * admin of the workspace, gated by each recipient's notification
 * preferences. Honors, in this order:
 *
 *  1. `workspace_members.paused_until` — vacation mode
 *  2. `notification_preferences` — per-event opt-out (`inbound_message`)
 *  3. `notification_subscriptions, entity_type='client'` — per-client mute
 *
 * Members with no email row are skipped silently (not yet
 * onboarded). Resend errors per-recipient are caught + logged so
 * one failed send doesn't block the rest of the fan-out — the
 * inbound webhook needs to return 200 quickly so Resend doesn't
 * retry.
 *
 * Returns `{sent, skipped, reasons}` for the caller to log.
 */
export async function fanOutInboundMessageNotification(input: {
  workspaceId: string;
  clientId: string;
  /** Email subject (or null when the client replied via the portal
   *  and didn't supply one). */
  subject: string | null;
  /** First ~200 chars of the body for the email preview. */
  bodyPreview: string;
}): Promise<{
  sent: number;
  skipped: number;
  reasons: Record<string, number>;
}> {
  const db = getDb();

  const [recipients, workspace, client] = await Promise.all([
    // Owners + admins only — members and viewers don't get the
    // inbound-message broadcast by default. They can still see
    // messages in the inbox; this is just about email noise.
    db
      .select({
        id: schema.workspaceMembers.id,
        email: schema.workspaceMembers.email,
        displayName: schema.workspaceMembers.displayName,
        pausedUntil: schema.workspaceMembers.pausedUntil,
      })
      .from(schema.workspaceMembers)
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, input.workspaceId),
          inArray(schema.workspaceMembers.role, ['owner', 'admin']),
        ),
      ),
    db
      .select({ name: schema.workspaces.name })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, input.workspaceId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ name: schema.clients.name })
      .from(schema.clients)
      .where(eq(schema.clients.id, input.clientId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!workspace || !client || recipients.length === 0) {
    return { sent: 0, skipped: 0, reasons: {} };
  }

  const recipientIds = recipients.map((r) => r.id);

  // Single round-trip for every gate input across every recipient,
  // bucketed in JS. Cheaper than N gate-fetches when the workspace
  // has 5+ owners/admins.
  const [prefRows, subRows] = await Promise.all([
    db
      .select({
        workspaceMemberId: schema.notificationPreferences.workspaceMemberId,
        enabled: schema.notificationPreferences.enabled,
      })
      .from(schema.notificationPreferences)
      .where(
        and(
          eq(schema.notificationPreferences.workspaceId, input.workspaceId),
          eq(
            schema.notificationPreferences.eventType,
            'inbound_message',
          ),
          inArray(
            schema.notificationPreferences.workspaceMemberId,
            recipientIds,
          ),
        ),
      ),
    db
      .select({
        workspaceMemberId:
          schema.notificationSubscriptions.workspaceMemberId,
      })
      .from(schema.notificationSubscriptions)
      .where(
        and(
          eq(
            schema.notificationSubscriptions.workspaceId,
            input.workspaceId,
          ),
          eq(schema.notificationSubscriptions.mode, 'mute'),
          eq(schema.notificationSubscriptions.entityType, 'client'),
          eq(schema.notificationSubscriptions.entityId, input.clientId),
          inArray(
            schema.notificationSubscriptions.workspaceMemberId,
            recipientIds,
          ),
        ),
      ),
  ]);

  const eventDisabled = new Set(
    prefRows.filter((p) => p.enabled === false).map((p) => p.workspaceMemberId),
  );
  const clientMuted = new Set(subRows.map((s) => s.workspaceMemberId));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com';
  const inboxUrl = `${appUrl}/${input.workspaceId}/clients/${input.clientId}`;
  const preferencesUrl = `${appUrl}/${input.workspaceId}/settings#notifications`;
  // Shrink the body preview to a sane size for the email card.
  const bodyPreview = input.bodyPreview.slice(0, 240).trim();

  const reasons: Record<string, number> = {};
  let sent = 0;
  let skipped = 0;
  const bump = (k: string) => {
    reasons[k] = (reasons[k] ?? 0) + 1;
    skipped += 1;
  };

  for (const r of recipients) {
    if (!r.email) {
      bump('no_email');
      continue;
    }
    if (r.pausedUntil && r.pausedUntil > new Date()) {
      bump('paused');
      continue;
    }
    if (eventDisabled.has(r.id)) {
      bump('event_type_muted');
      continue;
    }
    if (clientMuted.has(r.id)) {
      bump('client_muted');
      continue;
    }

    const recipientName =
      r.displayName?.trim() || r.email || 'there';
    try {
      await sendMessageNotification({
        to: r.email,
        recipientName,
        workspaceName: workspace.name,
        clientName: client.name,
        subject: input.subject,
        bodyPreview,
        inboxUrl,
        preferencesUrl,
      });
      sent += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[notify-message] send failed', {
        recipientMemberId: r.id,
        clientId: input.clientId,
        error: (err as Error).message,
      });
      bump(`send_error: ${(err as Error).message}`);
    }
  }

  return { sent, skipped, reasons };
}

// Reserve `or` for a future variant that also looks up per-task
// mutes (when an inbound message is linked to a specific task) —
// today we only mute by client.
void or;
