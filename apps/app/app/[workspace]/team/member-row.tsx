'use client';

import {
  BellOff,
  Clock,
  Crown,
  Mail,
  MoreHorizontal,
  Trash2,
  UserCheck,
  UserCog,
  X,
} from 'lucide-react';
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

import { DEFAULT_DIGEST_HOUR, formatHour } from '@/lib/format-hour';

import {
  changeMemberRoleAction,
  nudgeMemberDigestAction,
  removeMemberAction,
  revokeInvitationAction,
} from './actions';
import { ClientAccessDialog } from './client-access-dialog';
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
  /**
   * Whether this member receives the daily digest. Muted members get
   * a small badge so owners can see at-a-glance who's opted out.
   * Toggling another member's preference is intentionally not
   * exposed — preference is personal.
   */
  digestEnabled: boolean;
  /**
   * Per-member preferred digest hour-of-day in workspace tz. NULL =
   * workspace default (9 AM). The badge only renders when this differs
   * from the default — owners spot-check non-standard preferences
   * without scanning every row.
   */
  digestHour: number | null;
  /** Client IDs the member has explicit access to via
   *  `workspace_member_client_access`. Owners + admins always see
   *  everything regardless of this list. */
  assignedClientIds: string[];
};

export function MemberRow({
  workspaceId,
  member,
  clients,
  allMembersSeeAllClients,
}: {
  workspaceId: string;
  member: MemberRowView;
  /** Active workspace clients; passed for the access-management
   *  dialog. */
  clients: Array<{ id: string; name: string }>;
  /** Workspace policy. When true, per-member assignments save but
   *  don't take effect — the dialog tells the user. */
  allMembersSeeAllClients: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [transferOpen, setTransferOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

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

  async function nudgeDigest() {
    startTransition(async () => {
      const res = await nudgeMemberDigestAction({
        workspaceId,
        memberId: member.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Digest queued', {
        description:
          "They'll get one ad-hoc email even if they've muted the daily digest.",
      });
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
        {/* Per-member assigned-clients count. Only meaningful for
            member + viewer + when the workspace policy enforces
            assignments. Owners + admins always see everything so a
            count badge would be misleading there. */}
        {allMembersSeeAllClients === false &&
          (member.role === 'member' || member.role === 'viewer') && (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] text-muted-foreground"
              title={
                member.assignedClientIds.length === 0
                  ? 'No clients assigned — this member can only see workspace-level surfaces.'
                  : `Assigned to ${member.assignedClientIds.length} client${member.assignedClientIds.length === 1 ? '' : 's'}.`
              }
            >
              <UserCheck className="size-3" />
              {member.assignedClientIds.length}{' '}
              client{member.assignedClientIds.length === 1 ? '' : 's'}
            </Badge>
          )}
        {!member.digestEnabled && (
          <Badge
            variant="outline"
            className="gap-1 text-[10px] text-muted-foreground"
            title="This member has muted the daily digest in Settings → Notifications."
          >
            <BellOff className="size-3" />
            Digest off
          </Badge>
        )}
        {member.digestEnabled &&
          member.digestHour !== null &&
          member.digestHour !== DEFAULT_DIGEST_HOUR && (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] text-muted-foreground"
              title={`This member receives the daily digest at ${formatHour(member.digestHour)} (workspace timezone). Members set this in their own Settings → Notifications.`}
            >
              <Clock className="size-3" />
              {formatHour(member.digestHour)}
            </Badge>
          )}
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
              <DropdownMenuItem onClick={() => setAccessOpen(true)}>
                <UserCheck className="size-3.5" /> Manage client access…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={nudgeDigest}>
                <Mail className="size-3.5" /> Send digest now
              </DropdownMenuItem>
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

      {canManage && canActOnThisRole && (
        <ClientAccessDialog
          workspaceId={workspaceId}
          memberId={member.id}
          memberLabel={member.label}
          clients={clients}
          initialClientIds={member.assignedClientIds}
          policyEnforced={!allMembersSeeAllClients}
          open={accessOpen}
          onOpenChange={setAccessOpen}
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
