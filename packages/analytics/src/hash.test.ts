import { describe, expect, it } from 'vitest';
import { hashAuthUidClient, hashAuthUidServer } from './hash';

describe('hashAuthUid', () => {
  it('server and client produce the same hex for the same input', async () => {
    const server = hashAuthUidServer('user_abc123');
    const client = await hashAuthUidClient('user_abc123');
    expect(server).toBe(client);
  });

  it('different inputs hash to different outputs', () => {
    expect(hashAuthUidServer('a')).not.toBe(hashAuthUidServer('b'));
  });

  it('produces a 64-char hex string (SHA-256)', () => {
    const h = hashAuthUidServer('anything');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
