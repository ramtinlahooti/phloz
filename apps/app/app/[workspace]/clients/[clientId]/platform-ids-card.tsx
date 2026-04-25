'use client';

import { Check, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@phloz/ui';

import type { PlatformIdRow } from './platform-ids';

type Props = {
  workspaceId: string;
  clientId: string;
  rows: PlatformIdRow[];
};

/**
 * Read-only at-a-glance panel for every platform ID this client
 * uses — GA4 measurement IDs, GTM container IDs, Meta Pixel, etc.
 * Pulled from the tracking_nodes metadata (the source of truth).
 *
 * Each row has a copy-to-clipboard button; the value itself is a
 * `<code>` so it visibly looks like a copyable token. Clicking the
 * label (when the row carries a `nodeId`) deep-links into the
 * tracking map with the node centred + drawer open.
 *
 * Empty state nudges the user to set up the tracking map — the IDs
 * surface only after at least one node with an ID has been added.
 */
export function PlatformIdsCard({ workspaceId, clientId, rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform IDs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-6 py-4 text-sm text-muted-foreground">
            No tracking IDs yet. Add a GA4 / GTM / pixel node on the
            tracking map and the IDs land here automatically.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((row, idx) => (
              <PlatformIdRowItem
                key={`${row.label}-${row.value}-${idx}`}
                workspaceId={workspaceId}
                clientId={clientId}
                row={row}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PlatformIdRowItem({
  workspaceId,
  clientId,
  row,
}: {
  workspaceId: string;
  clientId: string;
  row: PlatformIdRow;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Permissions / unfocused-tab failure — silently swallow.
      // Worst case the user sees no checkmark and tries again.
    }
  }

  return (
    <li className="flex items-center gap-3 px-6 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{row.label}</span>
          {row.nodeId && (
            <Link
              href={`/${workspaceId}/clients/${clientId}/map?node=${row.nodeId}`}
              className="inline-flex items-center gap-0.5 text-muted-foreground/70 hover:text-foreground"
              title="Open in tracking map"
            >
              <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={copy}
          className="group mt-0.5 flex w-full items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-left transition-colors hover:bg-muted"
          title="Copy to clipboard"
        >
          <code className="flex-1 truncate font-mono text-sm text-foreground">
            {row.value}
          </code>
          <span
            className={`shrink-0 transition-opacity ${
              copied
                ? 'text-primary opacity-100'
                : 'text-muted-foreground opacity-0 group-hover:opacity-100'
            }`}
            aria-hidden
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </span>
          <span className="sr-only">
            {copied ? 'Copied' : `Copy ${row.label}`}
          </span>
        </button>
      </div>
    </li>
  );
}
