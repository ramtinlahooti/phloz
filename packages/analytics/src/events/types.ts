/**
 * Typed event catalog. Source of truth: ARCHITECTURE.md §11.2.
 *
 * Adding an event:
 *   1. Append to `EventMap` with fully-typed params
 *   2. Update ARCHITECTURE.md §11.2
 *   3. If the event should hit GA4 server-side (signup, purchase),
 *      also list it in `SERVER_GA4_EVENTS` below.
 *
 * Params never contain PII. User ids are hashed; workspace ids are OK.
 */

export type TierSlug =
  | 'starter'
  | 'pro'
  | 'growth'
  | 'business'
  | 'scale'
  | 'enterprise';

export type BillingPeriod = 'monthly' | 'annual';

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export type AuthMethod = 'email' | 'google' | 'magic_link';

export type TaskDepartment =
  | 'ppc'
  | 'seo'
  | 'social'
  | 'cro'
  | 'web_design'
  | 'other';

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'archived';

export type HealthStatus = 'working' | 'broken' | 'missing' | 'unverified';

export type MessageChannel = 'email' | 'portal' | 'internal_note';

export type MessageDirection = 'inbound' | 'outbound';

export type GateName = 'client_limit' | 'seat_limit' | 'feature_locked';

/**
 * The event catalog. Keys are event names (snake_case verb_noun);
 * values are the exact param shape for that event.
 */
export interface EventMap {
  // -----------------------------------------------------------------------
  // Marketing site
  // -----------------------------------------------------------------------
  page_view: { page_path: string; page_title?: string };
  cta_click: {
    cta_location: string;
    cta_label: string;
    destination: string;
  };
  pricing_page_view_tier: { tier: TierSlug };
  blog_post_view: { post_slug: string; post_category: string };
  newsletter_signup: { source: string };
  compare_page_view: { competitor: string };

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------
  sign_up: { method: AuthMethod };
  login: { method: AuthMethod };
  logout: Record<string, never>;
  password_reset_requested: Record<string, never>;

  // -----------------------------------------------------------------------
  // Workspace lifecycle
  // -----------------------------------------------------------------------
  workspace_created: { workspace_id_hash: string };
  workspace_switched: Record<string, never>;
  workspace_settings_updated: { setting_key: string };

  // -----------------------------------------------------------------------
  // Team
  // -----------------------------------------------------------------------
  member_invited: { role: MemberRole };
  member_accepted_invite: { role: MemberRole };
  member_role_changed: { from_role: MemberRole; to_role: MemberRole };
  member_removed: Record<string, never>;

  // -----------------------------------------------------------------------
  // Clients
  // -----------------------------------------------------------------------
  client_created: Record<string, never>;
  client_updated: { field_changed: string };
  client_archived: Record<string, never>;
  client_unarchived: Record<string, never>;
  client_assigned: { assignee_role: MemberRole };

  // -----------------------------------------------------------------------
  // Tracking map
  // -----------------------------------------------------------------------
  node_created: { node_type: string };
  node_updated: { node_type: string; field_changed: string };
  node_deleted: { node_type: string };
  node_health_changed: {
    node_type: string;
    old_status: HealthStatus;
    new_status: HealthStatus;
  };
  edge_created: {
    edge_type: string;
    source_type: string;
    target_type: string;
  };
  edge_deleted: Record<string, never>;
  map_layout_arranged: Record<string, never>;

  // -----------------------------------------------------------------------
  // Tasks
  // -----------------------------------------------------------------------
  task_created: {
    department: TaskDepartment;
    has_due_date: boolean;
    has_assignee: boolean;
  };
  task_status_changed: {
    from_status: TaskStatus;
    to_status: TaskStatus;
    department: TaskDepartment;
  };
  task_assigned: { department: TaskDepartment };
  task_completed: {
    department: TaskDepartment;
    time_to_complete_hours: number;
  };
  task_comment_added: { has_mentions: boolean };

  // -----------------------------------------------------------------------
  // Messages
  // -----------------------------------------------------------------------
  message_sent: {
    channel: MessageChannel;
    direction: MessageDirection;
  };
  message_received: { channel: MessageChannel };
  portal_link_sent: Record<string, never>;
  portal_accessed: Record<string, never>;

  // -----------------------------------------------------------------------
  // Billing
  // -----------------------------------------------------------------------
  pricing_tier_viewed: { tier: TierSlug };
  begin_checkout: { tier: TierSlug; billing_period: BillingPeriod };
  upgrade_tier: {
    from_tier: TierSlug;
    to_tier: TierSlug;
    billing_period: BillingPeriod;
    /** Revenue in USD cents. */
    value: number;
  };
  downgrade_tier: { from_tier: TierSlug; to_tier: TierSlug };
  subscription_canceled: { from_tier: TierSlug; reason: string };
  payment_failed: { tier: TierSlug };
  seat_added: { tier: TierSlug };

  // -----------------------------------------------------------------------
  // Feature gates
  // -----------------------------------------------------------------------
  gate_hit: { gate: GateName; current_tier: TierSlug };
}

export type EventName = keyof EventMap;

/**
 * Events that must reach GA4 server-side via Measurement Protocol.
 * These fire from server code (webhooks, server actions) where the
 * browser-side GTM snippet isn't running.
 */
export const SERVER_GA4_EVENTS = ['sign_up', 'upgrade_tier'] as const satisfies readonly EventName[];

export type ServerGa4Event = (typeof SERVER_GA4_EVENTS)[number];
