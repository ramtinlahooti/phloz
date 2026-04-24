'use client';

import {
  Download,
  FileArchive,
  FileText,
  Film,
  ImageIcon,
} from 'lucide-react';
import { useState } from 'react';

import type { AssetType } from '@phloz/db/schema';
import { Badge, Button, Card, CardContent, EmptyState, toast } from '@phloz/ui';

import { getPortalAssetSignedUrlAction } from './actions';

export type PortalAsset = {
  id: string;
  name: string;
  assetType: AssetType;
  notes: string | null;
  createdAt: Date;
};

/**
 * Read-only file list on the portal. Shows only assets the agency
 * marked `clientVisible`. Download buttons request a 5-minute signed
 * URL from `getPortalAssetSignedUrlAction` and open it in a new tab.
 */
export function PortalFiles({
  token,
  assets,
}: {
  token: string;
  assets: PortalAsset[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function download(id: string) {
    setBusyId(id);
    try {
      const res = await getPortalAssetSignedUrlAction({
        token,
        assetId: id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.open(res.url, '_blank', 'noreferrer');
    } finally {
      setBusyId(null);
    }
  }

  if (assets.length === 0) {
    return (
      <EmptyState
        title="No shared files yet"
        description="Your agency will drop creatives, briefs, and reports here as they share them."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/60">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <AssetIcon type={a.assetType} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate font-medium">{a.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] capitalize"
                  >
                    {a.assetType}
                  </Badge>
                </div>
                {a.notes && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.notes}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Shared {a.createdAt.toLocaleDateString()}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => download(a.id)}
                disabled={busyId === a.id}
                className="gap-1.5"
              >
                <Download className="size-3.5" />
                {busyId === a.id ? 'Opening…' : 'Download'}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AssetIcon({ type }: { type: AssetType }) {
  const cls = 'size-4 shrink-0 text-muted-foreground';
  if (type === 'image')
    return <ImageIcon className={cls} aria-label="image" />;
  if (type === 'video') return <Film className={cls} aria-label="video" />;
  if (type === 'document')
    return <FileText className={cls} aria-label="document" />;
  return <FileArchive className={cls} aria-label="other" />;
}
