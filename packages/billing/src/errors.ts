export type GateDenialReason =
  | 'client_limit_reached'
  | 'client_hard_cap_reached'
  | 'seat_limit_reached'
  | 'recurring_template_limit_reached'
  | 'unarchive_throttled'
  | 'downgrade_blocked_clients'
  | 'downgrade_blocked_seats'
  | 'feature_locked'
  | 'tier_not_found';

export type CanResult =
  | { allowed: true }
  | { allowed: false; reason: GateDenialReason; message: string; meta?: Record<string, unknown> };

export class BillingError extends Error {
  readonly code: GateDenialReason | 'stripe_error' | 'webhook_invalid';
  constructor(code: BillingError['code'], message?: string) {
    super(message ?? code);
    this.name = 'BillingError';
    this.code = code;
  }
}
