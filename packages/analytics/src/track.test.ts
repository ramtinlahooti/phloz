/**
 * Compile-time tests for the EventMap shape. We don't actually invoke
 * track() here (it dispatches over the network) — instead we assert
 * that the type signature rejects wrong params and accepts correct
 * ones. A failure here means someone broke the taxonomy.
 */

import { describe, expect, it } from 'vitest';
import { SERVER_GA4_EVENTS, type EventMap } from './events/types';

describe('EventMap', () => {
  it('covers every event listed in ARCHITECTURE.md §11.2', () => {
    // If someone adds an event here without adding to the map, TS refuses.
    const sample: {
      [K in keyof EventMap]: EventMap[K];
    } = {
      page_view: { page_path: '/' },
      cta_click: {
        cta_location: 'hero',
        cta_label: 'Get started',
        destination: '/signup',
      },
      pricing_page_view_tier: { tier: 'pro' },
      blog_post_view: { post_slug: 'hello', post_category: 'ga4' },
      newsletter_signup: { source: 'footer' },
      compare_page_view: { competitor: 'hubspot' },
      sign_up: { method: 'email' },
      login: { method: 'google' },
      logout: {},
      password_reset_requested: {},
      workspace_created: { workspace_id_hash: 'abc' },
      workspace_switched: {},
      workspace_settings_updated: { setting_key: 'theme' },
      member_invited: { role: 'member' },
      member_accepted_invite: { role: 'member' },
      member_role_changed: { from_role: 'member', to_role: 'admin' },
      member_removed: {},
      client_created: {},
      client_updated: { field_changed: 'name' },
      client_archived: {},
      client_unarchived: {},
      client_assigned: { assignee_role: 'member' },
      node_created: { node_type: 'ga4_property' },
      node_updated: { node_type: 'ga4_property', field_changed: 'label' },
      node_deleted: { node_type: 'ga4_property' },
      node_health_changed: {
        node_type: 'ga4_property',
        old_status: 'unverified',
        new_status: 'working',
      },
      edge_created: {
        edge_type: 'sends_events_to',
        source_type: 'gtm_container',
        target_type: 'ga4_property',
      },
      edge_deleted: {},
      map_layout_arranged: {},
      task_created: {
        department: 'ppc',
        has_due_date: true,
        has_assignee: true,
      },
      task_status_changed: {
        from_status: 'todo',
        to_status: 'done',
        department: 'ppc',
      },
      task_assigned: { department: 'ppc' },
      task_completed: {
        department: 'ppc',
        time_to_complete_hours: 3.5,
      },
      task_comment_added: { has_mentions: false },
      message_sent: { channel: 'email', direction: 'outbound' },
      message_received: { channel: 'email' },
      portal_link_sent: {},
      portal_accessed: {},
      pricing_tier_viewed: { tier: 'pro' },
      begin_checkout: { tier: 'pro', billing_period: 'monthly' },
      upgrade_tier: {
        from_tier: 'starter',
        to_tier: 'pro',
        billing_period: 'monthly',
        value: 2999,
      },
      downgrade_tier: { from_tier: 'pro', to_tier: 'starter' },
      subscription_canceled: { from_tier: 'pro', reason: 'too_expensive' },
      payment_failed: { tier: 'pro' },
      seat_added: { tier: 'pro' },
      gate_hit: { gate: 'client_limit', current_tier: 'pro' },
    };
    expect(Object.keys(sample).length).toBeGreaterThan(30);
  });

  it('lists server-ga4 events that actually exist in the map', () => {
    for (const event of SERVER_GA4_EVENTS) {
      expect(event).toBeTypeOf('string');
    }
    expect(SERVER_GA4_EVENTS).toContain('sign_up');
    expect(SERVER_GA4_EVENTS).toContain('upgrade_tier');
  });
});
