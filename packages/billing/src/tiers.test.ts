import { describe, expect, it } from 'vitest';

import {
  annualMonthlyEquivalent,
  getTier,
  nextTier,
  previousTier,
  publicTiers,
  TIERS,
} from './tiers';

describe('tier config', () => {
  it('ships every tier name from @phloz/config', () => {
    expect(Object.keys(TIERS)).toEqual([
      'starter',
      'pro',
      'growth',
      'business',
      'scale',
      'enterprise',
    ]);
  });

  it('matches ARCHITECTURE.md §7.1 client limits', () => {
    expect(getTier('starter').clientLimit).toBe(1);
    expect(getTier('pro').clientLimit).toBe(10);
    expect(getTier('growth').clientLimit).toBe(30);
    expect(getTier('business').clientLimit).toBe(100);
    expect(getTier('scale').clientLimit).toBe(250);
    expect(getTier('enterprise').clientLimit).toBe('unlimited');
  });

  it('matches ARCHITECTURE.md §7.1 seat limits', () => {
    expect(getTier('starter').includedSeats).toBe(2);
    expect(getTier('pro').includedSeats).toBe(5);
    expect(getTier('growth').includedSeats).toBe(8);
    expect(getTier('business').includedSeats).toBe(15);
    expect(getTier('scale').includedSeats).toBe(30);
  });
});

describe('nextTier / previousTier', () => {
  it('walks up the ladder', () => {
    expect(nextTier('starter')).toBe('pro');
    expect(nextTier('pro')).toBe('growth');
    expect(nextTier('growth')).toBe('business');
    expect(nextTier('scale')).toBe('enterprise');
    expect(nextTier('enterprise')).toBeNull();
  });

  it('walks down the ladder', () => {
    expect(previousTier('enterprise')).toBe('scale');
    expect(previousTier('pro')).toBe('starter');
    expect(previousTier('starter')).toBeNull();
  });
});

describe('publicTiers', () => {
  it('omits enterprise from the pricing page', () => {
    expect(publicTiers().map((t) => t.name)).toEqual([
      'starter',
      'pro',
      'growth',
      'business',
      'scale',
    ]);
  });
});

describe('annualMonthlyEquivalent', () => {
  it('returns the per-month equivalent of the annual price', () => {
    expect(annualMonthlyEquivalent('pro')).toBeCloseTo(25, 0); // 299.99/12
    expect(annualMonthlyEquivalent('business')).toBeCloseTo(125, 0);
  });

  it('returns null for free or custom tiers', () => {
    expect(annualMonthlyEquivalent('enterprise')).toBeNull();
  });
});
