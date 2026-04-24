'use client';

import { Crown, MoreHorizontal, Trash2, UserCog, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { Role } from '@phloz/config';
import {
  Avatar,
  AvatarFallback,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@phloz/ui';

import {
  changeMemberRoleAction,
  removeMemberAction,
  revokeInvitationAction,
} from './actions';
import { TransferOwnershipDialog } from './transfer-ownership-dialog';

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export type MemberRowView = {
  id: string;
  userId: string | null;
  /** Primary label — display_name, falling back to email then UUID prefix. */
  label: string;
  /**
   * Cached email. Rendered as a secondary line below the label when it
   * differs from the label (i.e. when the label is a real name, not the
   * email fallback).
   */
  email: string | null;
  role: Role;
  isSelf: boolean;
  /** Only owners can act on other owners. */
  viewerIsOwner: boolean;
};

export function MemberRow({
  workspaceId,
  member,
}: {
  workspaceId: string;
  member: MemberRowView;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [transferOpen, setTransferOpen] = useState(false);

  const canManage = !member.isSelf;
  // Only an owner can modify another owner.
  const canActOnThisRole =
    member.role !== 'owner' || member.viewerIsOwner;
  // Ownership transfer: owner-only, never to self or to existing owner.
  const canTransferOwnership =
    member.viewerIsOwner && !member.isSelf && member.role !== 'owner';

  async function changeRole(role: Role) {
    if (role === member.role) return;
    startTransition(async () => {
      const res = await changeMemberRoleAction({
        workspaceId,
        memberId: member.id,
        role,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Role set to ${role}`);
      router.refresh();
    });
  }

  async function remove() {
    if (!confirm(`Remove this member from the workspace?`)) return;
    startTransition(async () => {
      const res = await removeMemberAction({
        workspaceId,
        memberId: member.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Member removed');
      router.refresh();
    });
  }

  return (
    <>
      <li className="flex items-center gap-4 px-6 py-4">
        <Avatar>
          <AvatarFallback>{initials(member.label)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate font-medium">{member.label}</span>
            {member.isSelf && (
              <Badge variant="outline" className="text-xs">
                You
              </Badge>
            )}
          </div>
          {member.email && member.email !== member.label && (
            <div className="truncate text-xs text-muted-foreground">
              {member.email}
            </div>
          )}
        </div>
        <Badge variant="secondary" className="capitalize">
          {member.role}
        </Badge>
        {canManage && canActOnThisRole && (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex items-center gap-2">
                <UserCog className="size-3.5" /> Role
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={member.role}>
                <DropdownMenuItem
                  onClick={() => changeRole('admin')}
                  className="capitalize"
                >
                  Admin {member.role === 'admin' && '·'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => changeRole('member')}
                  className="capitalize"
                >
                  Member {member.role === 'member' && '·'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => changeRole('viewer')}
                  className="capitalize"
                >
                  Viewer {member.role === 'viewer' && '·'}
                </DropdownMenuItem>
              </DropdownMenuRadioGroup>
              {canTransferOwnership && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                    <Crown className="size-3.5" /> Transfer ownership…
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={remove}
                className="text-red-400"
              >
                <Trash2 className="size-3.5" /> Remove from workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </li>

      {canTransferOwnership && (
        <TransferOwnershipDialog
          workspaceId={workspaceId}
          memberId={member.id}
          memberLabel={member.label}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      )}
    </>
  );
}

// --- pending invitation row ------------------------------------------
export function InvitationRow({
  workspaceId,
  invitation,
}: {
  workspaceId: string;
  invitation: { id: string; email: string; role: Role };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function revoke() {
    if (!confirm(`Revoke invitation to ${invitation.email}?`)) return;
    startTransition(async () => {
      const res = await revokeInvitationAction({
        workspaceId,
        invitationId: invitation.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Invitation revoked');
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 px-6 py-3 text-sm">
      <span className="min-w-0 flex-1 truncate">{invitation.email}</span>
      <Badge variant="outline" className="capitalize">
        {invitation.role}
      </Badge>
      <button
        type="button"
        onClick={revoke}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-red-400"
        title="Revoke invitation"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
