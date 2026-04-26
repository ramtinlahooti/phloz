'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { toast } from '@phloz/ui';

import { setAllMembersSeeAllClientsAction } from '../team/actions';

/**
 * Owner/admin toggle for the workspace's client-access policy.
 * Two modes:
 *
 *  - **All members see all clients** (default for new workspaces).
 *    The simplest model — no per-member assignments needed. Best
 *    for small agencies where everyone touches everything.
 *
 *  - **Restricted** — members and viewers only see clients they've
 *    been explicitly assigned to. Owner/admin still see everything.
 *    Per-member assignments are managed on the Team page.
 *
 * The setting lives in `workspaces.settings.all_members_see_all_clients`.
 * RLS enforces the gate via `phloz_is_assigned_to(client_id)`, so
 * flipping this toggle takes effect on the next request — no
 * cache invalidation gymnastics needed.
 */
export function ClientAccessForm({
  workspaceId,
  allMembersSeeAllClients,
}: {
  workspaceId: string;
  allMembersSeeAllClients: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setEnabled(next: boolean) {
    startTransition(async () => {
      const res = await setAllMembersSeeAllClientsAction({
        workspaceId,
        enabled: next,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        next
          ? 'Every member can now see every client'
          : 'Members and viewers now see only their assigned clients',
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          Who can see which clients?
        </legend>
        <p className="text-xs text-muted-foreground">
          Owners and admins always see every client. Members and viewers
          inherit one of these two policies.
        </p>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card/30 p-3 text-sm">
            <input
              type="radio"
              name="all-see-all"
              checked={allMembersSeeAllClients}
              disabled={pending}
              onChange={() => setEnabled(true)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-medium text-foreground">
                Everyone sees everything
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Simplest model. Best for small agencies where every
                teammate touches every client. No per-member set-up.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card/30 p-3 text-sm">
            <input
              type="radio"
              name="all-see-all"
              checked={!allMembersSeeAllClients}
              disabled={pending}
              onChange={() => setEnabled(false)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-medium text-foreground">
                Restricted by assignment
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Members and viewers only see clients they&apos;ve been
                explicitly assigned to. Manage assignments per teammate
                on the{' '}
                <Link
                  href={`/${workspaceId}/team`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Team page
                </Link>
                .
              </span>
            </span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}
