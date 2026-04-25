'use client';

import dynamic from 'next/dynamic';

import type { TrackingMapSnapshot } from '@phloz/tracking-map';

/**
 * Client-side wrapper around `MapClient` that defers the React Flow
 * + dagre + audit bundle until first render. Used inside the client
 * detail page's Tracking map tab (Radix unmounts inactive tabs by
 * default, so the chunk only downloads when the user actually opens
 * that tab). Same component renders on the dedicated /map route
 * directly — that route is already its own bundle, no extra splitting
 * needed there.
 *
 * `ssr: false` because the canvas is interactive-only — there's
 * nothing useful to render server-side, and React Flow has hard
 * dependencies on `window` that crash during SSR.
 */
const MapClient = dynamic(() => import('./map-client').then((m) => m.MapClient), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading the canvas…
    </div>
  ),
});

export function LazyMapClient(props: {
  workspaceId: string;
  clientId: string;
  initial: TrackingMapSnapshot;
  focusNodeId?: string | null;
}) {
  return <MapClient {...props} />;
}
