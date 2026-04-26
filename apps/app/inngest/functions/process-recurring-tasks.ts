import { and, eq } from 'drizzle-orm';

import { getDb, schema } from '@phloz/db/client';

import { sendTaskNotificationToMember } from '../../lib/notify-task';
import {
  RECURRING_LOCAL_HOUR,
  cadenceMatches,
  localDateParts,
  sameLocalDate,
  type RecurringCadence,
} from '../../app/[workspace]/tasks/recurring/cadence';
import { inngest } from '../client';

/**
 * Hourly cron that fires recurring task templates. For each
 * workspace, when the local hour equals `RECURRING_LOCAL_HOUR` (6 AM
 * local), iterate enabled templates and instantiate a fresh `tasks`
 * row whenever the cadence predicate matches today's local date and
 * the template hasn't already fired today.
 *
 * The `recurring/process` event mirrors the digest pattern: useful
 * for manual replay against a single workspace from the Inngest
 * dashboard. Always fires regardless of local hour when triggered
 * manually.
 */
const RECURRING_CRON = 'TZ=UTC 0 * * * *';

export const processRecurringTasksFunction = inngest.createFunction(
  {
    id: 'process-recurring-tasks',
    name: 'Process recurring task templates (hourly)',
    concurrency: { limit: 4 },
    retries: 2,
    triggers: [{ cron: RECURRING_CRON }, { event: 'recurring/process' }],
  },
  async ({ event, step }) => {
    const db = getDb();

    const eventData = (event?.data ?? {}) as { workspaceId?: string };
    const targeted =
      event?.name === 'recurring/process' ? eventData.workspaceId : undefined;
    const isManual = event?.name === 'recurring/process';

    const workspaces = await step.run('load-workspaces', async () => {
      const rows = targeted
        ? await db
            .select({
              id: schema.workspaces.id,
              timezone: schema.workspaces.timezone,
            })
            .from(schema.workspaces)
            .where(eq(schema.workspaces.id, targeted))
        : await db
            .select({
              id: schema.workspaces.id,
              timezone: schema.workspaces.timezone,
            })
            .from(schema.workspaces);
      return rows;
    });

    const now = new Date();
    let totalFired = 0;
    let totalSkipped = 0;

    for (const ws of workspaces) {
      const tz = ws.timezone ?? 'UTC';
      const local = localDateParts(now, tz);

      // Cron path: only act on the local-6am tick. Manual path: always run
      // — useful for replays + previewing creation behaviour.
      if (!isManual && local.hour !== RECURRING_LOCAL_HOUR) {
        continue;
      }

      const fired = await step.run(`recurring-${ws.id}`, async () => {
        const templates = await db
          .select()
          .from(schema.recurringTaskTemplates)
          .where(
            and(
              eq(schema.recurringTaskTemplates.workspaceId, ws.id),
              eq(schema.recurringTaskTemplates.enabled, true),
            ),
          );

        let firedHere = 0;
        let skippedHere = 0;
        for (const t of templates) {
          const matches = cadenceMatches({
            cadence: t.cadence as RecurringCadence,
            weekday: t.weekday,
            dayOfMonth: t.dayOfMonth,
            local,
          });
          if (!matches) {
            skippedHere += 1;
            continue;
          }
          if (sameLocalDate(t.lastRunAt, now, tz)) {
            // Already ran today (cron retry / re-fire of the same hour).
            skippedHere += 1;
            continue;
          }

          const dueDate =
            t.dueOffsetDays > 0
              ? new Date(now.getTime() + t.dueOffsetDays * 24 * 60 * 60 * 1000)
              : null;

          const [insertedTask] = await db
            .insert(schema.tasks)
            .values({
              workspaceId: t.workspaceId,
              clientId: t.clientId,
              title: t.title,
              description: t.description,
              status: 'todo',
              priority: t.priority,
              department: t.department,
              visibility: t.visibility,
              assigneeId: t.assigneeId,
              dueDate,
              createdBy: t.createdBy,
            })
            .returning({ id: schema.tasks.id });

          await db
            .update(schema.recurringTaskTemplates)
            .set({ lastRunAt: now, updatedAt: now })
            .where(eq(schema.recurringTaskTemplates.id, t.id));

          // Notify the assignee (if any). preference-aware helper
          // honors paused_until + per-event opt-out + per-client +
          // per-task mute. Fire-and-forget — a Resend hiccup must
          // not block the rest of this workspace's templates.
          if (insertedTask && t.assigneeId) {
            const [workspaceRow] = await db
              .select({ name: schema.workspaces.name })
              .from(schema.workspaces)
              .where(eq(schema.workspaces.id, t.workspaceId))
              .limit(1);
            if (workspaceRow) {
              void sendTaskNotificationToMember({
                workspaceId: t.workspaceId,
                workspaceName: workspaceRow.name,
                recipientMemberId: t.assigneeId,
                eventType: 'recurring_task_created',
                task: {
                  id: insertedTask.id,
                  title: t.title,
                  clientId: t.clientId,
                  dueDate,
                },
                actorName: null, // system-spawned — no human actor
              });
            }
          }

          firedHere += 1;
        }
        return { firedHere, skippedHere };
      });

      totalFired += fired.firedHere;
      totalSkipped += fired.skippedHere;
    }

    return {
      scanned: workspaces.length,
      fired: totalFired,
      skipped: totalSkipped,
    };
  },
);
