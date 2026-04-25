/**
 * Ordered list of RLS policy SQL files.
 *
 * `_functions.sql` must run first so later files can reference the helper
 * functions. Each tenant table has its own file so diffs stay targeted.
 *
 * The CI check + migration runner reads this list via fs and concatenates the
 * files into one `0001_rls.sql` migration on top of Drizzle's initial schema
 * migration.
 */
export const RLS_FILES = [
  '_functions.sql',
  'workspaces.sql',
  'workspace-members.sql',
  'workspace-member-client-access.sql',
  'clients.sql',
  'client-contacts.sql',
  'client-assets.sql',
  'tracking-nodes.sql',
  'tracking-edges.sql',
  'tasks.sql',
  'task-watchers.sql',
  'recurring-task-templates.sql',
  'saved-views.sql',
  'comments.sql',
  'messages.sql',
  'inbound-email-addresses.sql',
  'portal-magic-links.sql',
  'invitations.sql',
  'audit-log.sql',
  'audit-suppressions.sql',
  'billing-events.sql',
  '_v2-tables.sql',
] as const;

/**
 * Tables that the RLS CI check should verify have row-level security
 * enabled. Update this list when a new tenant table is added.
 */
export const TENANT_TABLES = [
  'workspaces',
  'workspace_members',
  'workspace_member_client_access',
  'clients',
  'client_contacts',
  'client_assets',
  'tracking_nodes',
  'tracking_edges',
  'tasks',
  'task_watchers',
  'recurring_task_templates',
  'saved_views',
  'comments',
  'messages',
  'inbound_email_addresses',
  'portal_magic_links',
  'invitations',
  'audit_log',
  'audit_suppressions',
  'billing_events',
  'ad_platform_accounts',
  'ad_campaigns',
  'ad_groups',
  'ad_keywords',
  'ad_creatives',
  'tracking_node_versions',
  'tracking_templates',
  'audit_rules',
] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];
