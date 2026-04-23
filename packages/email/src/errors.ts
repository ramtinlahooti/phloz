/**
 * Email errors. Thrown from send helpers and the inbound webhook parser.
 * API route handlers convert these into 4xx/5xx responses.
 */

export class EmailError extends Error {
  readonly code: EmailErrorCode;
  constructor(code: EmailErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'EmailError';
    this.code = code;
  }
}

export type EmailErrorCode =
  | 'resend_not_configured'
  | 'send_failed'
  | 'invalid_recipient'
  | 'invalid_webhook_signature'
  | 'invalid_payload'
  | 'unknown_inbound_address'
  | 'attachment_too_large';
