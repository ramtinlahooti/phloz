import { describe, expect, it } from 'vitest';

import {
  canAddClientCheck,
  canDowngradeCheck,
  canInviteMemberCheck,
  canUnarchiveClientCheck,
} from './gates';

describe('canAddClientCheck', () => {
  it('allows when under limit', () => {
    const r = canAddClientCheck({ tier: 'pro', activeCount: 5, totalCount: 5 });
    expect(r.allowed).toBe(true);
  });

  it('denies when at limit', () => {
    const r = canAddClientCheck({ tier: 'pro', activeCount: 10, totalCount: 10 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('client_limit_reached');
  });

  it('denies when hard cap reached (3x limit including archived)', () => {
    const r = canAddClientCheck({ tier: 'pro', activeCount: 5, totalCount: 30 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('client_hard_cap_reached');
  });

  it('always allows for enterprise', () => {
    const r = canAddClientCheck({
      tier: 'enterprise',
      activeCount: 9_999,
      totalCount: 99_999,
    });
    expect(r.allowed).toBe(true);
  });

  it('suggests upgrade tier in meta', () => {
    const r = canAddClientCheck({ tier: 'pro', activeCount: 10, totalCount: 10 });
    if (!r.allowed) expect(r.meta?.upgradeTo).toBe('growth');
  });
});

describe('canInviteMemberCheck', () => {
  it('viewers do not consume seats', () => {
    const r = canInviteMemberCheck({ tier: 'pro', role: 'viewer', paidSeatCount: 99 });
    expect(r.allowed).toBe(true);
  });

  it('allows when under seat limit', () => {
    const r = canInviteMemberCheck({ tier: 'pro', role: 'member', paidSeatCount: 4 });
    expect(r.allowed).toBe(true);
  });

  it('denies when at seat limit', () => {
    const r = canInviteMemberCheck({ tier: 'pro', role: 'member', paidSeatCount: 5 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('seat_limit_reached');
  });

  it('always allows for enterprise', () => {
    const r = canInviteMemberCheck({
      tier: 'enterprise',
      role: 'admin',
      paidSeatCount: 9_999,
    });
    expect(r.allowed).toBe(true);
  });
});

describe('canUnarchiveClientCheck', () => {
  it('denies within 30 days of last unarchive', () => {
    const now = new Date('2026-04-23T12:00:00Z');
    const recent = new Date('2026-04-10T12:00:00Z'); // 13 days ago
    const r = canUnarchiveClientCheck({
      tier: 'pro',
      activeCount: 0,
      totalCount: 1,
      lastUnarchivedAt: recent,
      now,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('unarchive_throttled');
  });

  it('allows after 30 days', () => {
    const now = new Date('2026-04-23T12:00:00Z');
    const old = new Date('2026-03-01T12:00:00Z');
    const r = canUnarchiveClientCheck({
      tier: 'pro',
      activeCount: 1,
      totalCount: 1,
      lastUnarchivedAt: old,
      now,
    });
    expect(r.allowed).toBe(true);
  });

  it('allows when never unarchived', () => {
    const r = canUnarchiveClientCheck({
      tier: 'pro',
      activeCount: 0,
      totalCount: 1,
      lastUnarchivedAt: null,
    });
    expect(r.allowed).toBe(true);
  });

  it('denies if unarchive would exceed active-client limit', () => {
    const r = canUnarchiveClientCheck({
      tier: 'pro',
      activeCount: 10,
      totalCount: 11,
      lastUnarchivedAt: null,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('client_limit_reached');
  });
});

describe('canDowngradeCheck', () => {
  it('allows downgrade when within new limits', () => {
    const r = canDowngradeCheck({
      fromTier: 'growth',
      toTier: 'pro',
      activeCount: 8,
      paidSeatCount: 4,
    });
    expect(r.allowed).toBe(true);
  });

  it('blocks downgrade when active clients exceed target', () => {
    const r = canDowngradeCheck({
      fromTier: 'growth',
      toTier: 'pro',
      activeCount: 15,
      paidSeatCount: 4,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('downgrade_blocked_clients');
  });

  it('blocks downgrade when seats exceed target', () => {
    const r = canDowngradeCheck({
      fromTier: 'growth',
      toTier: 'pro',
      activeCount: 8,
      paidSeatCount: 7,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('downgrade_blocked_seats');
  });
});
