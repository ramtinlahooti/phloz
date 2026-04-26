import { and, eq, inArray, or } from 'drizzle-orm';

import type { NotificationEventType } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';
import {
  sendTaskNotification,
  type TaskNotificationVariant,
} from '@phloz/email';

/**
 * Preference-aware sender for per-task notification emails. Honors,
 * in this order, ALL of:
 *
 *  1. `workspace_members.paused_until` — vacation mode
 *  2. `notification_preferences` — per-event-type opt-out
 *  3. `notification_subscriptions` — per-client mute
 *  4. `notification_subscriptions` — per-task mute
 *
 * If any check denies, the helper no-ops (logs at info level so the
 * caller can correlate). Otherwise it composes the email with the
 * recipient's display name + the workspace + client context and
 * fires it via `sendTaskNotification`. Errors during the actual
 * Resend call are caught + logged — a transient mail failure must
 * not break the calling action.
 *
 * The variant constraint matches the schema's NotificationEventType
 * subset; `inbound_message` (also in the catalog) lives in its own
 * helper because the payload + template differ.
 */
type NotifyVariant = Extract<
  NotificationEventType,
  'task_assignment' | 'task_mention' | 'task_approval' | 'recurring_task_created'
>;

export async function sendTaskNotificationToMember(input: {
  workspaceId: string;
  workspaceName: string;
  recipientMemberId: string;
  eventType: NotifyVariant;
  task: {
    id: string;
    title: string;
    clientId: string | null;
    dueDate: Date | null;
  };
  /** Display name of the user (or system) that triggered the event.
   *  Pass `null` for system events (recurring spawn, portal-driven
   *  approval changes when we don't have a member to attribute). */
  actorName: string | null;
  /** Optional one-line context — comment excerpt, approval comment,
   *  cadence summary. Renders below the task card in the email. */
  contextLine?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const db = getDb();

  // Single round-trip for every input the gate needs. Each query is
  // tiny (one or two rows max); Drizzle batches the round-trip via
  // Promise.all on the same connection.
  const [memberRows, prefRows, subRows] = await Promise.all([
    db
      .select({
        email: schema.workspaceMembers.email,
        displayName: schema.workspaceMembers.displayName,
        pausedUntil: schema.workspaceMembers.pausedUntil,
      })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.id, input.recipientMemberId))
      .limit(1),
    db
      .select({
        enabled: schema.notificationPreferences.enabled,
      })
      .from(schema.notificationPreferences)
      .where(
        and(
          eq(
            schema.notificationPreferences.workspaceMemberId,
            input.recipientMemberId,
          ),
          eq(
            schema.notificationPreferences.eventType,
            input.eventType,
          ),
        ),
      )
      .limit(1),
    // Look up both client + task mutes in one query so we don't pay
    // for two round-trips when a single mute would already shut us
    // down. The `or` filters to entries that match either dimension.
    db
      .select({
        entityType: schema.notificationSubscriptions.entityType,
        entityId: schema.notificationSubscriptions.entityId,
      })
      .from(schema.notificationSubscriptions)
      .where(
        and(
          eq(
            schema.notificationSubscriptions.workspaceMemberId,
            input.recipientMemberId,
          ),
          eq(schema.notificationSubscriptions.mode, 'mute'),
          or(
            and(
              eq(schema.notificationSubscriptions.entityType, 'task'),
              eq(schema.notificationSubscriptions.entityId, input.task.id),
            ),
            input.task.clientId
              ? and(
                  eq(
                    schema.notificationSubscriptions.entityType,
                    'client',
                  ),
                  eq(
                    schema.notificationSubscriptions.entityId,
                    input.task.clientId,
                  ),
                )
              : undefined,
          ),
        ),
      ),
  ]);

  const member = memberRows[0];
  if (!member?.email) {
    return { sent: false, reason: 'member_email_missing' };
  }
  if (member.pausedUntil && member.pausedUntil > new Date()) {
    return { sent: false, reason: 'paused' };
  }
  // Default for the per-event pref is "enabled" — only an explicit
  // false row blocks. Fast-path the common case.
  if (prefRows[0] && prefRows[0].enabled === false) {
    return { sent: false, reason: 'event_type_muted' };
  }
  if (subRows.length > 0) {
    // Either entity_type='task' or 'client' triggered a hit. Both
    // mean "don't send".
    return {
      sent: false,
      reason: subRows.some((r) => r.entityType === 'task')
        ? 'task_muted'
        : 'client_muted',
    };
  }

  // Optional client-name lookup. Skipped when the task isn't scoped
  // to a client (workspace-level tasks).
  let clientName: string | null = null;
  if (input.task.clientId) {
    const [client] = await db
      .select({ name: schema.clients.name })
      .from(schema.clients)
      .where(eq(schema.clients.id, input.task.clientId))
      .limit(1);
    clientName = client?.name ?? null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com';
  const taskUrl = input.task.clientId
    ? `${appUrl}/${input.workspaceId}/clients/${input.task.clientId}?task=${input.task.id}`
    : `${appUrl}/${input.workspaceId}/tasks?task=${input.task.id}`;

  const dueLabel = input.task.dueDate
    ? input.task.dueDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const recipientName =
    member.displayName?.trim() || member.email || 'there';

  try {
    await sendTaskNotification({
      to: member.email,
      // Cast safe: the Extract above is a strict subset of
      // TaskNotificationVariant.
      variant: input.eventType as TaskNotificationVariant,
      recipientName,
      workspaceName: input.workspaceName,
      actorName: input.actorName,
      taskTitle: input.task.title,
      clientName,
      dueLabel,
      taskUrl,
      contextLine: input.contextLine ?? null,
    });
    return { sent: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify-task] send failed', {
      eventType: input.eventType,
      taskId: input.task.id,
      recipientMemberId: input.recipientMemberId,
      error: (err as Error).message,
    });
    return { sent: false, reason: `send_error: ${(err as Error).message}` };
  }
}

// Suppress the `inArray` import — unused locally but reserved for a
// batch variant of this helper that takes a list of recipient
// member ids in a single round-trip. Will land alongside the
// mention notification (which fans out to multiple recipients per
// comment).
void inArray;
