'use client';

import { useEffect, useRef } from 'react';

import { track, type EventMap, type EventName } from '@phloz/analytics';

/**
 * Fire a single `track()` call when this component mounts in the
 * browser. Used for "page view" style events on server-rendered pages
 * (blog_post_view, compare_page_view, pricing_page_view_tier) — the
 * page stays a server component and mounts one of these to fire the
 * event client-side where GTM/PostHog/GA4 can actually receive it.
 *
 * Guards against double-fire in React Strict Mode (which intentionally
 * mounts → unmounts → mounts in dev) via a ref sentinel.
 */
export function TrackOnMount<E extends EventName>({
  event,
  params,
}: {
  event: E;
  params: EventMap[E];
}) {
  const fired = useRef(false);

  // We intentionally run on mount only (no deps). Serializing `params`
  // into the dep list would thrash if a parent passes a fresh object
  // each render; the event is a page-view semantic so mount = one
  // event. Double-fire in Strict Mode is guarded via the `fired` ref.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void track(event, params);
  }, []);

  return null;
}
