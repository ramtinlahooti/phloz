'use client';

import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, toast } from '@phloz/ui';

import { seedStarterNodesAction } from './actions';

/**
 * One-click "seed a starter tracking setup" button. Shown on client
 * detail pages when the map is empty — turns a blank canvas into a
 * useful demo in < 1 second and kickstarts the audit engine on the
 * next page load.
 *
 * Refuses to seed on top of an existing map (server-enforced) so
 * double-clicks and stale-cache states don't duplicate nodes.
 */
export function SeedStarterNodesButton({
  workspaceId,
  clientId,
  variant = 'default',
}: {
  workspaceId: string;
  clientId: string;
  /** `default` — full-width primary button with the sparkle icon.
   *  `inline` — smaller outline button for constrained spots. */
  variant?: 'default' | 'inline';
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function seed() {
    setPending(true);
    try {
      const res = await seedStarterNodesAction({ workspaceId, clientId });
      if (!res.ok) {
        toast.error(
          res.error === 'map_not_empty'
            ? 'This map already has nodes. Remove them first.'
            : res.error,
        );
        return;
      }
      toast.success(
        `Added ${res.nodesInserted} starter nodes and ${res.edgesInserted} connections`,
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={seed}
      disabled={pending}
      variant={variant === 'inline' ? 'outline' : 'default'}
      size={variant === 'inline' ? 'sm' : 'md'}
      className="gap-2"
    >
      <Sparkles className="size-4" aria-hidden />
      {pending ? 'Adding…' : 'Seed starter setup'}
    </Button>
  );
}
