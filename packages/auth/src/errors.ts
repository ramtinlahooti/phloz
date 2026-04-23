/**
 * Auth errors. Thrown from server-side auth helpers; the Next.js error
 * boundary at the app root converts these into friendly responses.
 */

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthError';
    this.code = code;
  }
}

export type AuthErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_workspace'
  | 'not_a_member'
  | 'role_denied'
  | 'portal_link_expired'
  | 'portal_link_invalid';
