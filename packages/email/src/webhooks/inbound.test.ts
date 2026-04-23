import { describe, expect, it } from 'vitest';
import { EmailError } from '../errors';
import { parseResendInbound } from './inbound';

describe('parseResendInbound', () => {
  const baseEnvelope = {
    type: 'email.inbound',
    created_at: '2026-04-23T12:00:00Z',
    data: {
      email_id: 'rs_123',
      from: 'Jamie <jamie@acme.com>',
      to: ['client-abc123@inbound.phloz.com'],
      subject: 'Re: October report',
      text: 'Looks good, thanks.',
      html: '<p>Looks good, thanks.</p>',
    },
  };

  it('parses a well-formed inbound envelope', () => {
    const result = parseResendInbound(baseEnvelope);
    expect(result.toAddress).toBe('client-abc123@inbound.phloz.com');
    expect(result.fromAddress).toBe('jamie <jamie@acme.com>');
    expect(result.subject).toBe('Re: October report');
    expect(result.text).toBe('Looks good, thanks.');
    expect(result.html).toBe('<p>Looks good, thanks.</p>');
    expect(result.resendMessageId).toBe('rs_123');
  });

  it('accepts a singular `to` string', () => {
    const result = parseResendInbound({
      ...baseEnvelope,
      data: { ...baseEnvelope.data, to: 'client-abc123@inbound.phloz.com' },
    });
    expect(result.allToAddresses).toEqual(['client-abc123@inbound.phloz.com']);
  });

  it('falls back to HTML when plain text is absent', () => {
    const result = parseResendInbound({
      ...baseEnvelope,
      data: {
        ...baseEnvelope.data,
        text: undefined,
        html: '<p>Hello <strong>world</strong></p>',
      },
    });
    expect(result.text).toBe('Hello world');
  });

  it('rejects payloads with no `to` address', () => {
    expect(() =>
      parseResendInbound({
        ...baseEnvelope,
        data: { ...baseEnvelope.data, to: [] },
      }),
    ).toThrow(EmailError);
  });

  it('rejects attachments exceeding 5MB', () => {
    expect(() =>
      parseResendInbound({
        ...baseEnvelope,
        data: {
          ...baseEnvelope.data,
          attachments: [
            { filename: 'giant.zip', size: 10 * 1024 * 1024 },
          ],
        },
      }),
    ).toThrowError(/exceeds 5MB/);
  });

  it('records attachment filenames as dropped', () => {
    const result = parseResendInbound({
      ...baseEnvelope,
      data: {
        ...baseEnvelope.data,
        attachments: [
          { filename: 'report.pdf', size: 1024 },
          { filename: 'image.png', size: 2048 },
        ],
      },
    });
    expect(result.droppedAttachments).toEqual(['report.pdf', 'image.png']);
  });

  it('rejects completely malformed input', () => {
    expect(() => parseResendInbound({ foo: 'bar' })).toThrow(EmailError);
  });
});
