'use client';

import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { NodeType } from '@phloz/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@phloz/ui';

import { getNodeTypeDescriptor } from '../node-types/registry';

import type { PhlozNode } from './custom-node';

export type SearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: PhlozNode[];
  onSelect: (nodeId: string) => void;
};

/**
 * Command-palette-style node search, invoked with `/` or `⌘K`. Renders
 * at most 50 results ordered by label match. Selecting focuses the
 * node and opens the drawer (caller wires the latter).
 */
export function NodeSearchDialog({
  open,
  onOpenChange,
  nodes,
  onSelect,
}: SearchProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes.slice(0, 50);
    return nodes
      .filter((n) => {
        const label = (n.data.label ?? '').toLowerCase();
        const typeLabel = getNodeTypeDescriptor(
          n.data.nodeType as NodeType,
        ).label.toLowerCase();
        return label.includes(q) || typeLabel.includes(q);
      })
      .slice(0, 50);
  }, [nodes, query]);

  function handlePick(id: string) {
    onSelect(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Search className="size-4" />
            Search nodes
          </DialogTitle>
          <DialogDescription className="sr-only">
            Find a node by label or type.
          </DialogDescription>
        </DialogHeader>
        <div className="p-3">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter…"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto px-2 pb-3">
          {results.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              No matching nodes.
            </li>
          ) : (
            results.map((n) => {
              const descriptor = getNodeTypeDescriptor(
                n.data.nodeType as NodeType,
              );
              const Icon = descriptor.icon;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(n.id)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Icon className={`size-4 shrink-0 ${descriptor.accent}`} />
                    <span className="min-w-0 flex-1 truncate">
                      {n.data.label || descriptor.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {descriptor.label}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
