import {
  HARD_CLIENT_CAP_MULTIPLIER,
  PAID_SEAT_ROLES,
  UNARCHIVE_THROTTLE_DAYS,
  type Role,
  type TierName,
} from '@phloz/config';
import { and, eq, getDb, schema } from '@phloz/db';

import {
  getActiveClientCount,
  getPaidSeatCount,
  getTotalClientCount,
} from './active-clients';
import type { CanResult } from './errors';
import { getTier, nextTier } from './tiers';

// ---------------------------------------------------------------------------
// Pure check functions (no DB). These are what the unit tests exercise.
// ---------------------------------------------------------------------------

export function canAddClientCheck(input: {
  tier: TierName;
  activeCount: number;
  totalCount: number;
}): CanResult {
  const cfg = getTier(input.tier);
  if (cfg.clientLimit !== 'unlimited') {
    const hardCap = cfg.clientLimit * HARD_CLIENT_CAP_MULTIPLIER;
    if (input.totalCount >= hardCap) {
      return {
        allowed: false,
        reason: 'client_hard_cap_reached',
        message: `Hard cap of ${hardCap} total clients reached (including archived).`,
        meta: { hardCap, totalCount: input.totalCount },
      };
    }
    if (input.activeCount >= cfg.clientLimit) {
      return {
        allowed: false,
        reason: 'client_limit_reached',
        message: `Your ${cfg.displayName} plan is at its ${cfg.clientLimit}-client limit.`,
        meta: {
          tier: input.tier,
          limit: cfg.clientLimit,
          activeCount: input.activeCount,
          upgradeTo: nextTier(input.tier),
        },
      };
    }
  }
  return { allowed: true };
}

export function canInviteMemberCheck(input: {
  tier: TierName;
  role: Role;
  paidSeatCount: number;
}): CanResult {
  // Viewers don't consume seats — always allowed tier-wise.
  if (!PAID_SEAT_ROLES.includes(input.role)) return { allowed: true };

  const cfg = getTier(input.tier);
  if (cfg.includedSeats === 'unlimited') return { allowed: true };

  if (input.paidSeatCount >= cfg.includedSeats) {
    return {
      allowed: false,
      reason: 'seat_limit_reached',
      message: `Your ${cfg.displayName} plan includes ${cfg.includedSeats} seats. Add an extra seat or upgrade.`,
      meta: {
        tier: input.tier,
        includedSeats: cfg.includedSeats,
        paidSeatCount: input.paidSeatCount,
        extraSeatPriceUsd: cfg.extraSeatPriceUsd,
        upgradeTo: nextTier(input.tier),
      },
    };
  }
  return { allowed: true };
}

export function canUnarchiveClientCheck(input: {
  tier: TierName;
  activeCount: number;
  totalCount: number;
  lastUnarchivedAt: Date | null;
  now?: Date;
}): CanResult {
  const now = input.now ?? new Date();
  if (input.lastUnarchivedAt) {
    const elapsedDays = (now.getTime() - input.lastUnarchivedAt.getTime()) / 86_400_000;
    if (elapsedDays < UNARCHIVE_THROTTLE_DAYS) {
      const daysLeft = Math.ceil(UNARCHIVE_THROTTLE_DAYS - elapsedDays);
      return {
        allowed: false,
        reason: 'unarchive_throttled',
        message: `This client was recently unarchived. Wait ${daysLeft} more day${daysLeft === 1 ? '' : 's'}.`,
        meta: { daysLeft },
      };
    }
  }
  return canAddClientCheck({
    tier: input.tier,
    activeCount: input.activeCount,
    totalCount: input.totalCount,
  });
}

export function canDowngradeCheck(input: {
  fromTier: TierName;
  toTier: TierName;
  activeCount: number;
  paidSeatCount: number;
}): CanResult {
  const target = getTier(input.toTier);
  if (target.clientLimit !== 'unlimited' && input.activeCount > target.clientLimit) {
    return {
      allowed: false,
      reason: 'downgrade_blocked_clients',
      message: `You have ${input.activeCount} active clients. The ${target.displayName} plan supports up to ${target.clientLimit}. Archive ${input.activeCount - target.clientLimit} before downgrading.`,
      meta: {
        excess: input.activeCount - target.clientLimit,
        targetLimit: target.clientLimit,
      },
    };
  }
  if (target.includedSeats !== 'unlimited' && input.paidSeatCount > target.includedSeats) {
    return {
      allowed: false,
      reason: 'downgrade_blocked_seats',
      message: `You have ${input.paidSeatCount} paid seats. The ${target.displayName} plan includes ${target.includedSeats}. Remove ${input.paidSeatCount - target.includedSeats} before downgrading.`,
      meta: {
        excess: input.paidSeatCount - target.includedSeats,
        targetSeats: target.includedSeats,
      },
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Server wrappers: read state from DB then delegate to the pure check.
// ---------------------------------------------------------------------------

async function readWorkspaceTier(workspaceId: string): Promise<TierName> {
  const db = getDb();
  const rows = await db
    .select({ tier: schema.workspaces.tier })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1);
  const tier = rows[0]?.tier;
  if (!tier) throw new Error(`Workspace ${workspaceId} not found`);
  return tier;
}

export async function canAddClient(workspaceId: string): Promise<CanResult> {
  const [tier, activeCount, totalCount] = await Promise.all([
    readWorkspaceTier(workspaceId),
    getActiveClientCount(workspaceId),
    getTotalClientCount(workspaceId),
  ]);
  return canAddClientCheck({ tier, activeCount, totalCount });
}

export async function canInviteMember(workspaceId: string, role: Role): Promise<CanResult> {
  const [tier, paidSeatCount] = await Promise.all([
    readWorkspaceTier(workspaceId),
    getPaidSeatCount(workspaceId),
  ]);
  return canInviteMemberCheck({ tier, role, paidSeatCount });
}

export async function canUnarchiveClient(
  workspaceId: string,
  clientId: string,
): Promise<CanResult> {
  const db = getDb();
  const [tier, activeCount, totalCount, clientRows] = await Promise.all([
    readWorkspaceTier(workspaceId),
    getActiveClientCount(workspaceId),
    getTotalClientCount(workspaceId),
    db
      .select({
        archivedAt: schema.clients.archivedAt,
        updatedAt: schema.clients.updatedAt,
      })
      .from(schema.clients)
      .where(and(eq(schema.clients.id, clientId), eq(schema.clients.workspaceId, workspaceId)))
      .limit(1),
  ]);

  const client = clientRows[0];
  if (!client) throw new Error(`Client ${clientId} not found in workspace ${workspaceId}`);

  // We approximate "last unarchived at" with updated_at when archived_at is
  // null and the row was previously archived. The audit_log is the source of
  // truth once it's wired.
  const lastUnarchivedAt = client.archivedAt ? null : client.updatedAt;
  return canUnarchiveClientCheck({ tier, activeCount, totalCount, lastUnarchivedAt });
}

export async function canDowngrade(
  workspaceId: string,
  toTier: TierName,
): Promise<CanResult> {
  const [fromTier, activeCount, paidSeatCount] = await Promise.all([
    readWorkspaceTier(workspaceId),
    getActiveClientCount(workspaceId),
    getPaidSeatCount(workspaceId),
  ]);
  return canDowngradeCheck({ fromTier, toTier, activeCount, paidSeatCount });
}
