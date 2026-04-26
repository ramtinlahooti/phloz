'use client';

import { BellOff, Pause, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from '@phloz/config';
import { Button, toast } from '@phloz/ui';

import { DEFAULT_DIGEST_HOUR, formatHour } from '@/lib/format-hour';

import {
  previewDigestAction,
  setDigestEnabledAction,
  setDigestHourAction,
  setNotificationPreferenceAction,
  setNotificationSubscriptionAction,
  setPausedUntilAction,
} from './notifications-actions';

type Client = { id: string; name: string };

type Props = {
  workspaceId: string;
  /** Workspace's IANA tz, used in the dropdown's helper copy so the
   *  user knows whose clock the hour is referenced against. */
  workspaceTimezone: string;
  initial: {
    digestEnabled: boolean;
    /** null = use the workspace default (9 AM); otherwise 0–23. */
    digestHour: number | null;
    /** ISO timestamp; `null` means not paused. */
    pausedUntil: string | null;
    /** event_type → enabled. Absence = default (enabled). */
    eventPrefs: Record<string, boolean>;
    /** client IDs the member has muted. */
    mutedClientIds: string[];
  };
  /** Active clients in the workspace, name-sorted. Used by the
   *  mute panel; archived clients are deliberately excluded so the
   *  picker doesn't grow unbounded. */
  clients: Client[];
};

/**
 * Comprehensive per-member notifications panel. Five sections:
 *
 *   1. Vacation mode (`workspace_members.paused_until`)
 *   2. Daily digest (existing `digest_enabled` + `digest_hour`)
 *   3. Per-event-type opt-out (`notification_preferences`)
 *   4. Per-client mute (`notification_subscriptions`,
 *      entity_type='client', mode='mute')
 *   5. "Preview today's digest" — fires the cron's manual path
 *      scoped to the caller
 *
 * Per-task mute lives in the task detail dialog (separate UI; same
 * `notification_subscriptions` table with entity_type='task').
 *
 * All toggles save on change — no submit button — since each
 * control owns one row / column.
 */
export function NotificationsForm({
  workspaceId,
  workspaceTimezone,
  initial,
  clients,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Local mirror of the preference state so the optimistic UI
  // stays consistent across all five panels without a router
  // round-trip per change. Each setter calls the server action +
  // updates local state simultaneously.
  const [eventPrefs, setEventPrefs] = useState(initial.eventPrefs);
  const [mutedClients, setMutedClients] = useState<Set<string>>(
    () => new Set(initial.mutedClientIds),
  );
  const [pausedUntil, setPausedUntil] = useState(initial.pausedUntil);

  // Vacation mode preset: derive a date input value (YYYY-MM-DD)
  // from the ISO string so the <input type="date"> can mount
  // without timezone shenanigans.
  const pausedDateValue = useMemo(() => {
    if (!pausedUntil) return '';
    const d = new Date(pausedUntil);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [pausedUntil]);
  const isCurrentlyPaused =
    pausedUntil !== null && new Date(pausedUntil) > new Date();

  function handleDigestToggle(checked: boolean) {
    startTransition(async () => {
      const res = await setDigestEnabledAction({
        workspaceId,
        enabled: checked,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(checked ? 'Daily digest on' : 'Daily digest off');
      router.refresh();
    });
  }

  function handleHourChange(value: string) {
    const hour = value === 'default' ? null : Number.parseInt(value, 10);
    startTransition(async () => {
      const res = await setDigestHourAction({ workspaceId, hour });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        hour === null
          ? `Reset to workspace default (${formatHour(DEFAULT_DIGEST_HOUR)})`
          : `Digest will arrive at ${formatHour(hour)}`,
      );
      router.refresh();
    });
  }

  function handlePreview() {
    startTransition(async () => {
      const res = await previewDigestAction({ workspaceId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Preview queued', {
        description:
          'Check your inbox in a few seconds. Empty mornings still skip the send.',
      });
    });
  }

  function handleEventToggle(
    eventType: NotificationEventType,
    nextEnabled: boolean,
  ) {
    // Optimistic flip; revert on server error.
    setEventPrefs((prev) => ({ ...prev, [eventType]: nextEnabled }));
    startTransition(async () => {
      const res = await setNotificationPreferenceAction({
        workspaceId,
        eventType,
        enabled: nextEnabled,
      });
      if (!res.ok) {
        setEventPrefs((prev) => ({ ...prev, [eventType]: !nextEnabled }));
        toast.error(res.error);
        return;
      }
      toast.success(
        nextEnabled
          ? `Notifications on for ${NOTIFICATION_EVENT_LABELS[eventType].title.toLowerCase()}`
          : `Muted ${NOTIFICATION_EVENT_LABELS[eventType].title.toLowerCase()}`,
      );
    });
  }

  function handleClientMuteToggle(clientId: string, nextMuted: boolean) {
    setMutedClients((prev) => {
      const next = new Set(prev);
      if (nextMuted) next.add(clientId);
      else next.delete(clientId);
      return next;
    });
    startTransition(async () => {
      const res = await setNotificationSubscriptionAction({
        workspaceId,
        entityType: 'client',
        entityId: clientId,
        mode: nextMuted ? 'mute' : null,
      });
      if (!res.ok) {
        // Revert.
        setMutedClients((prev) => {
          const next = new Set(prev);
          if (nextMuted) next.delete(clientId);
          else next.add(clientId);
          return next;
        });
        toast.error(res.error);
        return;
      }
      const name = clients.find((c) => c.id === clientId)?.name ?? 'this client';
      toast.success(
        nextMuted ? `Muted ${name}` : `Unmuted ${name}`,
      );
    });
  }

  function handlePausedDateChange(value: string) {
    if (!value) {
      // User cleared the date input. Clear the pause too.
      setPausedUntil(null);
      startTransition(async () => {
        const res = await setPausedUntilAction({ workspaceId, until: null });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Vacation mode off');
      });
      return;
    }
    // <input type="date"> emits YYYY-MM-DD in the browser's local
    // calendar. We pin to end-of-day local so a user setting "until
    // April 28" stays paused all day on the 28th, not just to
    // midnight.
    const [y, m, d] = value.split('-').map((s) => Number.parseInt(s, 10));
    const target = new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
    const iso = target.toISOString();
    setPausedUntil(iso);
    startTransition(async () => {
      const res = await setPausedUntilAction({ workspaceId, until: iso });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Paused until ${target.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })}`,
      );
    });
  }

  function handleClearPause() {
    setPausedUntil(null);
    startTransition(async () => {
      const res = await setPausedUntilAction({ workspaceId, until: null });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Vacation mode off');
    });
  }

  const effectiveHour = initial.digestHour ?? DEFAULT_DIGEST_HOUR;

  return (
    <div className="space-y-6">
      {/* ---- Vacation mode --------------------------------------- */}
      <section
        className={`rounded-md border p-3 ${
          isCurrentlyPaused
            ? 'border-amber-400/40 bg-amber-400/5'
            : 'border-border bg-card/30'
        }`}
      >
        <div className="flex items-start gap-3">
          {isCurrentlyPaused ? (
            <Pause className="mt-0.5 size-4 shrink-0 text-amber-400" />
          ) : (
            <Play className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {isCurrentlyPaused ? 'Vacation mode is on' : 'Vacation mode'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pause every notification — daily digest, task assignments,
              client emails, all of it — until the date below. Teammates
              still see all the data; only your inbox stays quiet.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <input
                type="date"
                value={pausedDateValue}
                disabled={pending}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => handlePausedDateChange(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1 text-foreground disabled:opacity-50"
              />
              {pausedUntil && (
                <button
                  type="button"
                  onClick={handleClearPause}
                  disabled={pending}
                  className="rounded-md border border-border bg-card px-2 py-1 text-muted-foreground hover:border-primary/60 hover:text-foreground disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Daily digest ---------------------------------------- */}
      <section className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            defaultChecked={initial.digestEnabled}
            disabled={pending}
            onChange={(e) => handleDigestToggle(e.target.checked)}
            className="mt-0.5 size-4 rounded border-border accent-primary"
          />
          <span>
            <span className="font-medium text-foreground">
              Send me the daily digest
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              One email at {formatHour(effectiveHour)} in this workspace&apos;s
              timezone with your overdue tasks, work due today, and pending
              approvals. Owners and admins also get unreplied client messages
              and audit alerts. Empty mornings are skipped.
            </span>
          </span>
        </label>

        <div className="ml-7 space-y-1">
          <label
            htmlFor="digest-hour"
            className="block text-xs font-medium text-foreground/80"
          >
            Send at
          </label>
          <select
            id="digest-hour"
            disabled={pending || !initial.digestEnabled}
            value={initial.digestHour === null ? 'default' : String(initial.digestHour)}
            onChange={(e) => handleHourChange(e.target.value)}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground disabled:opacity-50"
          >
            <option value="default">
              Workspace default ({formatHour(DEFAULT_DIGEST_HOUR)})
            </option>
            {HOURS.map((h) => (
              <option key={h} value={String(h)}>
                {formatHour(h)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Times are in the workspace timezone ({workspaceTimezone}).
          </p>
        </div>
      </section>

      {/* ---- Per-event-type toggles ------------------------------ */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Email me when…
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each toggle controls one kind of one-off email. The daily digest
            above is its own switch.
          </p>
        </div>
        <ul className="space-y-2">
          {NOTIFICATION_EVENT_TYPES.map((eventType) => {
            const label = NOTIFICATION_EVENT_LABELS[eventType];
            // Defaults to true (enabled) when no row exists.
            const enabled = eventPrefs[eventType] ?? true;
            return (
              <li
                key={eventType}
                className="flex items-start gap-3 rounded-md border border-border/60 bg-card/30 p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={pending}
                  onChange={(e) =>
                    handleEventToggle(eventType, e.target.checked)
                  }
                  className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{label.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {label.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- Per-client mute ------------------------------------- */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Muted clients
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mute a client to drop their items from your daily digest and
            silence per-event emails about them. Other team members are
            unaffected.
          </p>
        </div>
        {clients.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card/30 p-3 text-center text-xs text-muted-foreground">
            No active clients yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-md border border-border/60">
            {clients.map((c) => {
              const muted = mutedClients.has(c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span
                    className={`truncate ${
                      muted ? 'text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {c.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleClientMuteToggle(c.id, !muted)}
                    disabled={pending}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                      muted
                        ? 'border-amber-400/50 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
                    }`}
                    aria-pressed={muted}
                  >
                    {muted ? (
                      <>
                        <BellOff className="size-3" />
                        Muted
                      </>
                    ) : (
                      'Mute'
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Preview ---------------------------------------------- */}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={pending}
        >
          {pending ? 'Sending…' : 'Preview today’s digest'}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends the digest to your email right now using today&apos;s
          actual data. Teammates aren&apos;t notified.
        </p>
      </div>
    </div>
  );
}

const HOURS: number[] = Array.from({ length: 24 }, (_, i) => i);
