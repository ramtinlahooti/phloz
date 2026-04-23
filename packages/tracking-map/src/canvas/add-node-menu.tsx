'use client';

import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { NodeType } from '@phloz/config';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@phloz/ui';

import { listNodeTypeDescriptors } from '../node-types/registry';

/**
 * Toolbar dropdown for adding a new node. Groups by descriptor
 * `category` so the menu stays scannable at 20+ types.
 */
export function AddNodeMenu({
  onPick,
}: {
  onPick: (type: NodeType) => void;
}) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const all = listNodeTypeDescriptors();
    const byCat = new Map<string, typeof all>();
    for (const d of all) {
      if (!byCat.has(d.category)) byCat.set(d.category, []);
      byCat.get(d.category)!.push(d);
    }
    return Array.from(byCat.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" />
          Add node
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-y-auto">
        {grouped.map(([cat, items], idx) => (
          <DropdownMenuGroup key={cat}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="capitalize">
              {cat.replace('-', ' ')}
            </DropdownMenuLabel>
            {items.map((d) => {
              const Icon = d.icon;
              return (
                <DropdownMenuItem
                  key={d.type}
                  onClick={() => {
                    setOpen(false);
                    onPick(d.type);
                  }}
                  className="items-start"
                >
                  <Icon className={`mt-0.5 size-4 shrink-0 ${d.accent}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{d.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.summary}
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
