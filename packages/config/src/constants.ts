/**
 * Shared constants used across the monorepo.
 * Source of truth for anything that would otherwise drift into magic numbers.
 * See ARCHITECTURE.md for the rationale behind each.
 */

// --- Tier / billing ---
export const TIER_NAMES = [
  'starter',
  'pro',
  'growth',
  'business',
  'scale',
  'enterprise',
] as const;
export type TierName = (typeof TIER_NAMES)[number];

export const BILLING_PERIODS = ['monthly', 'annual'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

// --- Roles (ARCHITECTURE.md §6.4) ---
export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PAID_SEAT_ROLES: readonly Role[] = ['owner', 'admin', 'member'];

// --- Subscription status (mirrors Stripe) ---
export const SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'canceled',
  'trialing',
  'incomplete',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// --- Active-client window (ARCHITECTURE.md §7.2) ---
export const ACTIVE_CLIENT_WINDOW_DAYS = 60;
export const UNARCHIVE_THROTTLE_DAYS = 30;
export const HARD_CLIENT_CAP_MULTIPLIER = 3;

// --- Tokens / magic links ---
export const PORTAL_MAGIC_LINK_TTL_DAYS = 7;
export const INVITATION_TTL_DAYS = 14;

// --- Tracking map ---
export const MAX_NODES_PER_CLIENT = 200;

// --- Inbound email ---
export const INBOUND_EMAIL_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const INBOUND_NANOID_LENGTH = 12;

// --- Departments ---
export const DEPARTMENTS = ['ppc', 'seo', 'social', 'cro', 'web_design', 'other'] as const;
export type Department = (typeof DEPARTMENTS)[number];

// --- Task statuses / priorities ---
export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done', 'archived'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_VISIBILITIES = ['internal', 'client_visible'] as const;
export type TaskVisibility = (typeof TASK_VISIBILITIES)[number];

/**
 * Approval workflow states for client-visible tasks.
 * - `none`: default — agency hasn't asked for approval.
 * - `pending`: agency requested approval; portal shows action buttons.
 * - `approved` / `rejected` / `needs_changes`: terminal or
 *   rework-needed states set by the client via the portal.
 */
export const APPROVAL_STATES = [
  'none',
  'pending',
  'approved',
  'rejected',
  'needs_changes',
] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

// --- Tracking node + edge types (ARCHITECTURE.md §5.2, §5.3) ---
export const NODE_TYPES = [
  'website',
  'landing_page',
  'gtm_container',
  'gtm_server_container',
  'ga4_property',
  'ga4_data_stream',
  'google_ads_account',
  'google_ads_conversion_action',
  'meta_ads_account',
  'meta_pixel',
  'meta_capi',
  'tiktok_ads_account',
  'tiktok_pixel',
  'microsoft_ads_account',
  'linkedin_ads_account',
  'crm_system',
  'email_platform',
  'ecommerce_platform',
  'server_endpoint',
  'conversion_api_endpoint',
  'custom',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_TYPES = [
  'sends_events_to',
  'fires_pixel',
  'reports_conversions_to',
  'sends_server_events_to',
  'uses_data_layer',
  'pushes_audiences_to',
  'syncs_leads_to',
  'custom',
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export const HEALTH_STATUSES = ['working', 'broken', 'missing', 'unverified'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

// --- Messages ---
export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_CHANNELS = ['email', 'portal', 'internal_note'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const AUTHOR_TYPES = ['member', 'contact', 'system'] as const;
export type AuthorType = (typeof AUTHOR_TYPES)[number];

// --- Comments ---
export const COMMENT_PARENT_TYPES = ['task', 'tracking_node', 'message', 'client'] as const;
export type CommentParentType = (typeof COMMENT_PARENT_TYPES)[number];

// --- Notification preferences ---
//
// One row in `notification_preferences` per (member, eventType) at
// most. Absence of a row means "use the default" (which is enabled).
// Adding a new event kind means adding a new entry here AND wiring
// the cron / per-event helper to consult the flag — no migration
// needed (the column is plain text).
//
// Order is the order the Settings UI renders them, top → bottom.
// `daily_digest` is intentionally NOT in this list — the existing
// `workspace_members.digest_enabled` column owns that toggle, and
// having two switches for the same thing confuses users. The cron
// consults the column directly.
export const NOTIFICATION_EVENT_TYPES = [
  'task_assignment',
  'task_mention',
  'inbound_message',
  'task_approval',
  'recurring_task_created',
] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

/** Human-readable copy for each event type. Source of truth for the
 *  Settings UI labels + the per-event "you turned off X" toasts. */
export const NOTIFICATION_EVENT_LABELS: Record<
  NotificationEventType,
  { title: string; description: string }
> = {
  task_assignment: {
    title: 'Task assigned to you',
    description:
      'Email when a teammate (or a recurring template) assigns you a task.',
  },
  task_mention: {
    title: 'You’re @mentioned',
    description:
      'Email when someone @mentions you in a task, message, or tracking-node comment.',
  },
  inbound_message: {
    title: 'Client emails',
    description:
      'Email when a client replies via the inbound address. Owners and admins only.',
  },
  task_approval: {
    title: 'Client approval changes',
    description:
      'Email when a client approves, rejects, or requests changes on one of your tasks.',
  },
  recurring_task_created: {
    title: 'Recurring task created',
    description:
      'Email when one of your recurring templates spawns a new task instance.',
  },
};
