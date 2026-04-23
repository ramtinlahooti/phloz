'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@phloz/ui';

type WorkspaceOption = {
  id: string;
  name: string;
  role: string;
};

export function WorkspaceSwitcher({
  currentId,
  workspaces,
}: {
  currentId: string;
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const current = workspaces.find((w) => w.id === currentId);

  async function switchTo(id: string) {
    setOpen(false);
    startTransition(async () => {
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? 'Could not switch workspace');
        return;
      }
      router.push(`/${id}`);
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]">
        <span className="inline-block size-5 shrink-0 rounded bg-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">
          {current?.name ?? 'Workspace'}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => switchTo(w.id)}
            className="flex items-center gap-2"
          >
            <span className="inline-block size-4 rounded bg-primary/80" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            {w.id === currentId && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="flex items-center gap-2">
            <Plus className="size-4" />
            Create a workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
