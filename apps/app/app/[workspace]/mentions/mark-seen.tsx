'use client';

import { useEffect } from 'react';

import { markMentionsSeenAction } from './actions';

/**
 * Tiny effect-only component. Stamps `workspace_members.mentions_seen_at`
 * to `now()` once on mount so the sidebar Mentions badge clears.
 * Renders nothing — the only purpose is the side effect.
 *
 * Why not do this server-side from the page?  The page is a server
 * component; calling a server action from there would block the
 * render path on a write. Doing it from a `'use client'` mount
 * hook keeps the page fast and the badge update arrives via the
 * action's `revalidatePath('/[workspace]', 'layout')`.
 */
export function MarkMentionsSeen({ workspaceId }: { workspaceId: string }) {
  useEffect(() => {
    void markMentionsSeenAction({ workspaceId });
  }, [workspaceId]);
  return null;
}
