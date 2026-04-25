import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { canAddRecurringTemplate, getTier } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';
import { EmptyState } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';
import { assertValidWorkspaceId } from '@/lib/workspace-param';

import {
  describeCadence,
  describeNextFire,
  type RecurringCadence,
} from './cadence';
import { NewRecurringDialog } from './new-recurring-dialog';
import { RecurringRow } from './recurring-row';

export const metadata = buildAppMetadata({ title: 'Recurring tasks' });

type RouteParams = { workspace: string };

export default async function RecurringTasksPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { workspace: workspaceId } = await params;
  assertValidWorkspaceId(workspaceId);

  const actor = await requireRole(workspaceId, [
    'owner',
    'admin',
    'member',
    'viewer',
  ]);
  const user = await requireUser();
  const canDelete = actor.role === 'owner' || actor.role === 'admin';
  const db = getDb();

  const [templates, clientRows, memberRows, gate, workspaceRow] =
    await Promise.all([
      db
        .select()
        .from(schema.recurringTaskTemplates)
        .where(eq(schema.recurringTaskTemplates.workspaceId, workspaceId))
        .orderBy(asc(schema.recurringTaskTemplates.title)),
      db
        .select({ id: schema.clients.id, name: schema.clients.name })
        .from(schema.clients)
        .where(eq(schema.clients.workspaceId, workspaceId))
        .orderBy(asc(schema.clients.name)),
      db
        .select({
          id: schema.workspaceMembers.id,
          userId: schema.workspaceMembers.userId,
          role: schema.workspaceMembers.role,
          displayName: schema.workspaceMembers.displayName,
          email: schema.workspaceMembers.email,
        })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, workspaceId)),
      canAddRecurringTemplate(workspaceId),
      db
        .select({
          tier: schema.workspaces.tier,
          timezone: schema.workspaces.timezone,
        })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.id, workspaceId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

  const now = new Date();
  const workspaceTimezone = workspaceRow?.timezone ?? 'UTC';

  // Pre-flight gate result. Server still authoritative on submit; this
  // disables the New button + surfaces the limit message before the
  // user wastes a form-fill cycle.
  const atLimit = !gate.allowed;
  const limitMessage = !gate.allowed ? gate.message : undefined;
  const tierConfig = workspaceRow ? getTier(workspaceRow.tier) : null;
  const templateLimit =
    tierConfig && tierConfig.recurringTemplateLimit !== 'unlimited'
      ? tierConfig.recurringTemplateLimit
      : null;

  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const memberOptions = memberRows
    .map((m) => {
      const isSelf = m.userId === user.id;
      const primary = isSelf
        ? 'You'
        : (m.displayName?.trim() ||
            m.email?.trim() ||
            `${(m.userId ?? 'unknown').slice(0, 8)}…`);
      return {
        id: m.id,
        label: `${primary} · ${m.role}`,
        sortKey: isSelf ? '' : primary.toLowerCase(),
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ id, label }) => ({ id, label }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            <Link
              href={`/${workspaceId}/tasks`}
              className="hover:text-foreground"
            >
              Tasks
            </Link>{' '}
            / Recurring
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Recurring tasks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Templates fire at 6 AM workspace local time. New tasks land on
            the regular task list.
            {templateLimit !== null && (
              <>
                {' · '}
                <span className={atLimit ? 'text-destructive' : ''}>
                  {templates.length} of {templateLimit} used
                </span>
              </>
            )}
          </p>
        </div>
        <NewRecurringDialog
          workspaceId={workspaceId}
          clients={clientRows}
          members={memberOptions}
          disabled={atLimit}
          disabledMessage={limitMessage}
        />
      </header>

      {templates.length === 0 ? (
        <EmptyState
          title="No recurring tasks yet"
          description="Set up a template for the work that repeats — weekly client reviews, monthly billing reminders, daily standups."
          action={
            <NewRecurringDialog
              workspaceId={workspaceId}
              clients={clientRows}
              members={memberOptions}
              disabled={atLimit}
              disabledMessage={limitMessage}
            />
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <RecurringRow
              key={t.id}
              workspaceId={workspaceId}
              template={{
                id: t.id,
                title: t.title,
                cadenceSummary: describeCadence({
                  cadence: t.cadence as RecurringCadence,
                  weekday: t.weekday,
                  dayOfMonth: t.dayOfMonth,
                }),
                nextFireSummary: describeNextFire({
                  cadence: t.cadence as RecurringCadence,
                  weekday: t.weekday,
                  dayOfMonth: t.dayOfMonth,
                  lastRunAt: t.lastRunAt,
                  now,
                  timezone: workspaceTimezone,
                }),
                clientName: t.clientId ? clientName.get(t.clientId) ?? null : null,
                department: t.department,
                enabled: t.enabled,
                lastRunAt: t.lastRunAt,
                canDelete,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
