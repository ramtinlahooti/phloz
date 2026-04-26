'use client';

import { Bell, BellOff } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button, toast } from '@phloz/ui';

import { setNotificationSubscriptionAction } from '../../settings/notifications-actions';

/**
 * Per-client mute toggle on the client detail header. Same
 * `notification_subscriptions` table the Settings → Notifications
 * panel writes to, surfaced here so the user can mute one specific
 * client without context-switching to settings.
 *
 * Optimistic flip with revert on server error. Toast copy makes the
 * scope clear ("you" vs the team) since muting is a personal
 * preference and other members are unaffected.
 */
export function MuteClientButton({
  workspaceId,
  clientId,
  initialMuted,
}: {
  workspaceId: string;
  clientId: string;
  initialMuted: boolean;
}) {
  const [muted, setMuted] = useState(initialMuted);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !muted;
    setMuted(next);
    startTransition(async () => {
      const res = await setNotificationSubscriptionAction({
        workspaceId,
        entityType: 'client',
        entityId: clientId,
        mode: next ? 'mute' : null,
      });
      if (!res.ok) {
        setMuted(!next);
        toast.error(
          `Couldn't ${next ? 'mute' : 'unmute'} this client: ${res.error}`,
        );
        return;
      }
      toast.success(
        next
          ? "You'll stop getting emails about this client"
          : "You'll get emails about this client again",
      );
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={toggle}
      disabled={pending}
      className={`gap-1.5 ${muted ? 'border-amber-400/50 text-amber-400' : ''}`}
      title={
        muted
          ? "You're not getting emails about this client. Click to unmute."
          : "Click to stop getting emails about this client. Doesn't affect teammates."
      }
      aria-pressed={muted}
    >
      {muted ? (
        <>
          <BellOff className="size-3.5" /> Muted
        </>
      ) : (
        <>
          <Bell className="size-3.5" /> Mute
        </>
      )}
    </Button>
  );
}
