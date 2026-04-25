// Barrel export for every table in the schema.
// Drizzle-kit reads this file to generate migrations.
// Keep imports alphabetical so diffs stay clean.

// --- V1 tables ---
export * from './workspaces';
export * from './workspace-members';
export * from './workspace-member-client-access';
export * from './clients';
export * from './client-contacts';
export * from './client-assets';
export * from './tracking-nodes';
export * from './tracking-edges';
export * from './tasks';
export * from './task-watchers';
export * from './recurring-task-templates';
export * from './comments';
export * from './messages';
export * from './inbound-email-addresses';
export * from './portal-magic-links';
export * from './invitations';
export * from './audit-log';
export * from './audit-suppressions';
export * from './billing-events';
export * from './newsletter-subscribers';
export * from './saved-views';

// --- V2 tables (scaffolded stubs; see ARCHITECTURE.md §5.4) ---
export * from './ad-platform-accounts';
export * from './ad-campaigns';
export * from './ad-groups';
export * from './ad-keywords';
export * from './ad-creatives';
export * from './tracking-node-versions';
export * from './tracking-templates';
export * from './audit-rules';
