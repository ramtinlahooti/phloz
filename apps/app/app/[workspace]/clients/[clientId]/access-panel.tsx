'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import type { Role } from '@phloz/config';
import { Badge, toast } from '@phloz/ui';

import { setMemberClientAccessPairAction } from '../../team/actions';

type MemberRow = {
  id: string;
  label: string;
  email: string | null;
  role: Role;
  /** True when the member already has explicit access for this client.
   *  Toggling flips the `workspace_member_client_access` row via
   *  setMemberClientAccessPairAction. */
  hasAccess: boolean;
};

/**
 * Per-client Access section. Mirror image of the Team page's
 * Manage-client-access dialog: when an owner/admin opens this
 * client, they see every workspace member with a toggle for THIS
 * client's access. Single-pair writes via the sister action; no
 * full-list replace needed.
 *
 * Owner/admin rows render the toggle disabled with a "(always
 * sees everything)" caption, since `phloz_is_assigned_to`
 * unconditionally returns true for those roles. Showing the
 * toggle would be misleading.
 *
 * Banner explains the policy state — same convention as the
 * dialog on the Team page.
 */
export function ClientAccessPanel({
  workspaceId,
  clientId,
  members,
  policyEnforced,
}: {
  workspaceId: string;
  clientId: string;
  members: MemberRow[];
  /** True when `all_members_see_all_clients = false`. */
  policyEnforced: boolean;
}) {
  // Local mirror so optimistic flips don't wait for revalidation
  // of the parent server component on each toggle.
  const [accessByMember, setAccessByMember] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(members.map((m) => [m.id, m.hasAccess])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(member: MemberRow) {
    if (member.role === 'owner' || member.role === 'admin') return;
    const currently = accessByMember[member.id] ?? false;
    const next = !currently;
    setAccessByMember((prev) => ({ ...prev, [member.id]: next }));
    setPendingId(member.id);
    startTransition(async () => {
      const res = await setMemberClientAccessPairAction({
        workspaceId,
        memberId: member.id,
        clientId,
        granted: next,
      });
      setPendingId(null);
      if (!res.ok) {
        setAccessByMember((prev) => ({ ...prev, [member.id]: currently }));
        toast.error(res.error);
        return;
      }
      toast.success(
        next
          ? `${member.label} can now see this client`
          : `${member.label} no longer sees this client`,
      );
    });
  }

  const memberAndViewerCount = members.filter(
    (m) => m.role === 'member' || m.role === 'viewer',
  ).length;
  const grantedCount = members.filter(
    (m) =>
      (m.role === 'member' || m.role === 'viewer') &&
      (accessByMember[m.id] ?? false),
  ).length;

  return (
    <section className="space-y-4">
      {!policyEnforced && (
        <div className="rounded-md border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-xs text-amber-400">
          Workspace policy is currently <strong>Everyone sees everything</strong>.
          These assignments save, but won&apos;t take effect until you
          switch to <strong>Restricted by assignment</strong> in{' '}
          <Link
            href={`/${workspaceId}/settings#access`}
            className="underline-offset-2 hover:underline"
          >
            Settings → Client access
          </Link>
          .
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-foreground">
          Who can see this client?
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Owners and admins always see every client. Toggle access for
          each member or viewer below.{' '}
          {memberAndViewerCount > 0 && (
            <span>
              {grantedCount} of {memberAndViewerCount} member
              {memberAndViewerCount === 1 ? '' : 's'} currently
              {grantedCount === 1 ? ' has' : ' have'} access.
            </span>
          )}
        </p>
      </div>

      {members.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/30 p-4 text-center text-xs text-muted-foreground">
          No team members yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {members.map((m) => {
            const isPrivileged = m.role === 'owner' || m.role === 'admin';
            const granted = accessByMember[m.id] ?? false;
            const isPending = pendingId === m.id;
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">
                      {m.label}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] capitalize"
                    >
                      {m.role}
                    </Badge>
                  </div>
                  {m.email && m.email !== m.label && (
                    <div className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </div>
                  )}
                </div>
                {isPrivileged ? (
                  <span className="text-xs text-muted-foreground">
                    Always has access
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    disabled={isPending}
                    aria-pressed={granted}
                    className={`shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                      granted
                        ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
                    }`}
                  >
                    {isPending
                      ? 'Saving…'
                      : granted
                        ? 'Has access'
                        : 'Grant access'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
