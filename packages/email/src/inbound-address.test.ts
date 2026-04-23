import { describe, expect, it } from 'vitest';
import { extractInboundId, generateInboundAddress } from './inbound-address';

describe('generateInboundAddress', () => {
  it('produces the configured domain with a client- prefix', () => {
    const addr = generateInboundAddress();
    expect(addr.startsWith('client-')).toBe(true);
    expect(addr).toMatch(/@/);
  });

  it('produces a 12-char opaque id', () => {
    const id = extractInboundId(generateInboundAddress());
    expect(id).not.toBeNull();
    expect(id!.length).toBe(12);
  });

  it('produces unique addresses across many calls', () => {
    const addrs = new Set<string>();
    for (let i = 0; i < 500; i++) addrs.add(generateInboundAddress());
    expect(addrs.size).toBe(500);
  });
});

describe('extractInboundId', () => {
  it('extracts the id from a canonical address', () => {
    expect(extractInboundId('client-abc123xyz@inbound.phloz.com')).toBe(
      'abc123xyz',
    );
  });

  it('is case-insensitive', () => {
    expect(extractInboundId('Client-ABC123@inbound.PHLOZ.com')).toBe('abc123');
  });

  it('returns null for foreign addresses', () => {
    expect(extractInboundId('hello@phloz.com')).toBeNull();
    expect(extractInboundId('random@example.com')).toBeNull();
  });
});
