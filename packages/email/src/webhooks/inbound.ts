import { z } from 'zod';
import { EmailError } from '../errors';

/**
 * Zod schema for Resend's inbound email webhook payload.
 *
 * Resend parses the incoming MIME and POSTs a JSON body describing the
 * message. Fields not required for Phloz V1 (raw MIME, headers array,
 * full body structure) are captured via `passthrough()` so we don't
 * lose data but also don't fail on additions from Resend's side.
 */
export const resendInboundEnvelopeSchema = z
  .object({
    type: z.literal('email.inbound').or(z.string()),
    created_at: z.string().optional(),
    data: z
      .object({
        /** Resend message id. */
        email_id: z.string().optional(),
        /** Envelope + headers. */
        from: z.string().email().or(z.string()),
        to: z.array(z.string()).or(z.string()),
        cc: z.array(z.string()).optional(),
        subject: z.string().optional(),
        /** Parsed plaintext body. */
        text: z.string().optional(),
        /** Parsed HTML body. */
        html: z.string().optional(),
        /**
         * Attachments ship as metadata only; content is fetched via a
         * separate Resend API call. V1 drops attachments (ARCHITECTURE §10.3).
         */
        attachments: z
          .array(
            z
              .object({
                filename: z.string().optional(),
                content_type: z.string().optional(),
                size: z.number().optional(),
              })
              .passthrough(),
          )
          .optional(),
        /** In-Reply-To / References for threading. */
        in_reply_to: z.string().optional(),
        references: z.array(z.string()).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type ResendInboundEnvelope = z.infer<typeof resendInboundEnvelopeSchema>;

export interface ParsedInboundEmail {
  /** First plain-text `to:` address. Used to look up `inbound_email_addresses`. */
  toAddress: string;
  /** All `to:` addresses (helps when someone CCs multiple inboxes). */
  allToAddresses: string[];
  /** Sender email (lowercased for matching client_contacts.email). */
  fromAddress: string;
  subject: string;
  /** Plain-text body; falls back to stripped HTML if text is missing. */
  text: string;
  /** HTML body if present; raw (the app layer sanitizes before render). */
  html: string | null;
  /** Threading metadata to match against an existing `messages.thread_id`. */
  inReplyTo: string | null;
  references: string[];
  /** Names of attachments we're dropping in V1, for logging. */
  droppedAttachments: string[];
  /** The Resend message id, stored on the `messages` row for de-dup. */
  resendMessageId: string | null;
}

/** Max size Phloz accepts for an inbound message (ARCHITECTURE §10.3). */
export const INBOUND_MAX_BYTES = 5 * 1024 * 1024;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Parse + validate a Resend inbound webhook body. Throws
 * `EmailError('invalid_payload')` on shape errors and
 * `EmailError('attachment_too_large')` when a single attachment exceeds 5MB
 * (the MIME-level body itself is policed by Resend).
 *
 * This function is pure: no DB access, no Resend API calls. Caller layer
 * is responsible for looking up `inbound_email_addresses` by `toAddress`.
 */
export function parseResendInbound(body: unknown): ParsedInboundEmail {
  const result = resendInboundEnvelopeSchema.safeParse(body);
  if (!result.success) {
    throw new EmailError(
      'invalid_payload',
      result.error.issues.map((i) => i.message).join('; '),
    );
  }
  const data = result.data.data;

  const tos = normalizeToArray(data.to).map((s) => s.toLowerCase().trim());
  if (tos.length === 0) {
    throw new EmailError('invalid_payload', 'No `to` address in payload');
  }

  const attachments = data.attachments ?? [];
  for (const a of attachments) {
    if (typeof a.size === 'number' && a.size > INBOUND_MAX_BYTES) {
      throw new EmailError(
        'attachment_too_large',
        `Attachment ${a.filename ?? '(unnamed)'} exceeds 5MB`,
      );
    }
  }

  const text =
    data.text && data.text.length > 0
      ? data.text
      : data.html
        ? stripHtml(data.html)
        : '';

  return {
    toAddress: tos[0]!,
    allToAddresses: tos,
    fromAddress: (typeof data.from === 'string' ? data.from : '')
      .toLowerCase()
      .trim(),
    subject: data.subject ?? '(no subject)',
    text,
    html: data.html ?? null,
    inReplyTo: data.in_reply_to ?? null,
    references: data.references ?? [],
    droppedAttachments: attachments
      .map((a) => a.filename)
      .filter((n): n is string => typeof n === 'string'),
    resendMessageId: data.email_id ?? null,
  };
}
