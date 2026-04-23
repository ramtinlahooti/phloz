import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('sendGa4ServerEvent', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no-ops (returns false) when measurement id / api secret are missing', async () => {
    delete process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
    const { sendGa4ServerEvent } = await import('./index');
    const sent = await sendGa4ServerEvent({
      clientId: 'abc',
      name: 'sign_up',
      params: { method: 'email' },
    });
    expect(sent).toBe(false);
  });

  it('strips undefined params before sending', async () => {
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = 'G-XXXXX';
    process.env.GA4_API_SECRET = 'secret';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));
    const { sendGa4ServerEvent } = await import('./index');

    await sendGa4ServerEvent({
      clientId: 'abc',
      name: 'sign_up',
      params: { method: 'email', extra: undefined },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1]!.body as string) ?? '{}',
    );
    expect(body.events[0].params).toEqual({ method: 'email' });
    expect(body.events[0].name).toBe('sign_up');
    expect(body.client_id).toBe('abc');
  });

  it('throws on non-2xx response', async () => {
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = 'G-XXXXX';
    process.env.GA4_API_SECRET = 'secret';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad', { status: 400 }),
    );
    const { sendGa4ServerEvent } = await import('./index');
    await expect(
      sendGa4ServerEvent({ clientId: 'x', name: 'e', params: {} }),
    ).rejects.toThrow(/400/);
  });
});
