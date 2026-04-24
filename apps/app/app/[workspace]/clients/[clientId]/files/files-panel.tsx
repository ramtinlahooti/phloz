'use client';

import {
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FileText,
  Film,
  ImageIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';

import type { AssetType } from '@phloz/db/schema';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  toast,
} from '@phloz/ui';

import {
  deleteAssetAction,
  getAssetSignedUrlAction,
  toggleAssetClientVisibleAction,
  uploadAssetAction,
} from './actions';

export type AssetRow = {
  id: string;
  name: string;
  assetType: AssetType;
  notes: string | null;
  clientVisible: boolean;
  createdAt: Date;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
      <Upload className="size-3.5" />
      {pending ? 'Uploading…' : 'Upload'}
    </Button>
  );
}

/**
 * Files tab content. Renders the upload form (drop / pick a file +
 * optional notes) and the list of existing assets. Download opens a
 * 5-minute signed URL in a new tab; delete is role-gated server-side.
 */
export function FilesPanel({
  workspaceId,
  clientId,
  assets,
}: {
  workspaceId: string;
  clientId: string;
  assets: AssetRow[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(uploadAssetAction, {
    error: null as string | null,
  });
  const [notes, setNotes] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingDelete, startDelete] = useTransition();

  async function handleDownload(id: string) {
    const res = await getAssetSignedUrlAction({ workspaceId, assetId: id });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.url, '_blank', 'noreferrer');
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this file?')) return;
    startDelete(async () => {
      const res = await deleteAssetAction({ workspaceId, assetId: id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Deleted');
      router.refresh();
    });
  }

  async function toggleVisibility(id: string, next: boolean) {
    const res = await toggleAssetClientVisibleAction({
      workspaceId,
      assetId: id,
      clientVisible: next,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      next
        ? 'Shared with client — visible in the portal'
        : 'Hidden from client',
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form
            action={(fd) => {
              // Nudge the form action toward success-case reset.
              formAction(fd);
              setNotes('');
              setFileName(null);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="clientId" value={clientId} />

            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border bg-background/60 px-4 py-3 text-sm hover:border-primary/60">
              <Upload className="size-4 text-muted-foreground" />
              <span className="flex-1 text-muted-foreground">
                {fileName ?? 'Click to pick a file (max 4 MB)'}
              </span>
              <input
                type="file"
                name="file"
                required
                className="hidden"
                onChange={(e) =>
                  setFileName(e.target.files?.[0]?.name ?? null)
                }
              />
            </label>

            <Input
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional) — e.g. Final creative, v3"
              maxLength={280}
            />

            {state?.error && (
              <p className="text-xs text-[var(--color-destructive)]">
                {state.error}
              </p>
            )}

            <div className="flex justify-end">
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>

      {assets.length === 0 ? (
        <EmptyState
          title="No files yet"
          description="Drop creative assets, briefs, or reference docs here. Signed download links keep them private to your workspace."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {assets.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <AssetIcon type={a.assetType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="truncate font-medium">{a.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {a.assetType}
                      </Badge>
                      {a.clientVisible && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 text-[10px] text-primary"
                        >
                          Shared with client
                        </Badge>
                      )}
                    </div>
                    {a.notes && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {a.notes}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Added {a.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleVisibility(a.id, !a.clientVisible)}
                    title={
                      a.clientVisible
                        ? 'Hide from client portal'
                        : 'Share with client portal'
                    }
                  >
                    {a.clientVisible ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(a.id)}
                    title="Download"
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(a.id)}
                    disabled={pendingDelete}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5 text-red-400" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
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
