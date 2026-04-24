'use client';

import { Upload } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@phloz/ui';

export type ImportPayload = {
  nodes: Array<{
    id: string;
    nodeType: string;
    label: string;
    healthStatus?: string;
    position?: { x: number; y: number } | null;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    edgeType?: string;
    label?: string | null;
  }>;
};

/**
 * Paired with the toolbar Export button — accepts a JSON file dropped
 * in (or pasted into the textarea) and hands the parsed payload to the
 * caller. The caller is responsible for server-side validation + insert.
 */
export function ImportMapDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    payload: ImportPayload,
  ) => Promise<{ ok: true; nodesInserted: number; edgesInserted: number } | { ok: false; error: string }>;
}) {
  const [raw, setRaw] = useState('');
  const [importing, setImporting] = useState(false);

  async function onFile(file: File) {
    const text = await file.text();
    setRaw(text);
  }

  async function handleImport() {
    if (!raw.trim()) {
      toast.error('Paste JSON or drop a file first.');
      return;
    }
    let parsed: ImportPayload;
    try {
      const obj = JSON.parse(raw) as ImportPayload;
      if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
        throw new Error('missing nodes / edges arrays');
      }
      parsed = obj;
    } catch (err) {
      toast.error(`Invalid JSON: ${(err as Error).message}`);
      return;
    }

    setImporting(true);
    try {
      const res = await onImport(parsed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Imported ${res.nodesInserted} node${res.nodesInserted === 1 ? '' : 's'} and ${res.edgesInserted} edge${res.edgesInserted === 1 ? '' : 's'}`,
      );
      onOpenChange(false);
      setRaw('');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import map</DialogTitle>
          <DialogDescription>
            Paste a JSON snapshot (from Export) or drop a file below. Nodes
            get fresh IDs; edges are re-linked by label. This is additive
            — your existing map stays intact.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card/30 px-4 py-6 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground">
          <Upload className="size-4" />
          <span>Drop or click to choose a .json file</span>
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder='{"nodes": [...], "edges": [...]}'
          className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
        />

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
