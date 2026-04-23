---
name: phloz-analytics
description: Use this skill whenever adding, modifying, or reviewing analytics tracking code in Phloz. Apply when instrumenting a new user action, adding a new event to the event catalog, wiring up GTM/GA4, or reviewing tracking compliance. Every user-facing action in Phloz should fire a tracked event — this skill defines how.
---

# Phloz Analytics Skill

Phloz tracks user actions through a **typed event layer** in `packages/analytics`. Every tracked event is type-safe, uses GA4-compatible naming, and fires to GTM dataLayer + PostHog simultaneously.

**GTM Container:** `GTM-W3MGZ8V7`

## When to apply this skill

Use whenever you:
- Add a new user-facing action that needs tracking
- Modify an existing tracked event (rename, add/remove params)
- Set up tracking on a new page
- Debug an event that's not firing
- Review a PR for proper instrumentation

## The golden rule

**Every tracked event goes through `track()` from `packages/analytics`. No exceptions.**

- ❌ `gtag('event', 'foo')` — forbidden
- ❌ `dataLayer.push({ event: 'foo' })` — forbidden
- ❌ `posthog.capture('foo')` — forbidden
- ✅ `track('foo', { ... })` — required

## The event catalog

The complete list lives in `packages/analytics/event-map.ts`. Events are organized into sections matching `ARCHITECTURE.md §11.2`:

- Marketing site: `page_view`, `cta_click`, `pricing_page_view_tier`, etc.
- Authentication: `sign_up`, `login`, `logout`
- Workspace lifecycle
- Team
- Clients
- Tracking map
- Tasks
- Messages
- Billing
- Feature gates

See `ARCHITECTURE.md §11.2` for the canonical list.

## Adding a new tracked event

1. **Add to the event map** in `packages/analytics/event-map.ts`:

   ```typescript
   export type EventMap = {
     // ... existing events
     node_bulk_deleted: {
       count: number;
       node_types: string[];
     };
   };
   ```

2. **Call `track()` at the right moment**:

   ```typescript
   import { track } from '@phloz/analytics';

   async function handleBulkDelete(nodeIds: string[]) {
     const nodes = await fetchNodes(nodeIds);
     await deleteNodes(nodeIds);

     track('node_bulk_deleted', {
       count: nodes.length,
       node_types: [...new Set(nodes.map(n => n.type))],
     });
   }
   ```

3. **Document the event** in `ARCHITECTURE.md §11.2` — append to the relevant section

4. **If the event is critical** (signup, purchase, tier upgrade), also fire server-side via GA4 Measurement Protocol so it's captured even if client-side blocked by ad blockers. Use `trackServer()`.

## Naming conventions

- `snake_case` always
- Verb-noun format: `client_created`, `task_completed`, `edge_deleted`
- GA4 recommended events used where they fit: `sign_up`, `login`, `purchase`, `begin_checkout`, `share`
- Past-tense for completed actions: `client_created` not `create_client`
- Present-tense for states: `gate_hit` not `gate_was_hit`

## Parameter conventions

- `snake_case` keys
- No PII ever: no emails, names, phone numbers, addresses
- Hash sensitive IDs: `workspace_id_hash`, not `workspace_id`
- Use enums for categorical data: `method: 'email' | 'google' | 'magic_link'`
- Include `value` parameter for revenue events (GA4 standard)
- Include `currency: 'USD'` for monetary events

## GA4 standards to follow

Use GA4's recommended event names when applicable:

| User action | GA4 event name |
|---|---|
| Sign up | `sign_up` (param: `method`) |
| Log in | `login` (param: `method`) |
| View an item | `view_item` |
| Start checkout | `begin_checkout` |
| Complete purchase | `purchase` (params: `value`, `currency`, `transaction_id`) |
| Search | `search` |
| Share | `share` |

For custom events unique to Phloz (tracking nodes, client ops), invent a clear `snake_case` name.

## The `track()` function

```typescript
// packages/analytics/track.ts

export function track<T extends keyof EventMap>(
  event: T,
  params: EventMap[T],
): void {
  // 1. Push to GTM dataLayer (→ GA4)
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({
      event,
      ...params,
      timestamp: Date.now(),
    });
  }

  // 2. Send to PostHog
  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(event, params);
  }

  // 3. Dev mode: log to console
  if (process.env.NODE_ENV === 'development') {
    console.debug('[track]', event, params);
  }
}
```

## Server-side tracking

For events that must not miss (sign_up, upgrade_tier, subscription_canceled):

```typescript
// packages/analytics/track-server.ts

export async function trackServer<T extends keyof EventMap>(
  event: T,
  params: EventMap[T],
  options: { userId?: string; clientId: string },
): Promise<void> {
  // Fire to GA4 Measurement Protocol
  await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`, {
    method: 'POST',
    body: JSON.stringify({
      client_id: options.clientId,
      user_id: options.userId,
      events: [{ name: event, params }],
    }),
  });

  // Fire to PostHog server SDK
  await posthogServer.capture({
    distinctId: options.userId ?? options.clientId,
    event,
    properties: params,
  });
}
```

## Page views

- Marketing site: auto-tracked by GA4 config tag
- App: auto-tracked via `usePathname()` in the root layout

Don't fire `page_view` manually — it's automatic.

## User identification

- Anonymous users get a PostHog distinct ID (stored in localStorage)
- On login, call `identify(userId, { workspace_id_hash, tier, role })` — links the anonymous session to the user
- On logout, call `reset()` to clear identity
- Never identify with email — use hashed user ID

## Consent mode

- EU visitors see a cookie banner before any non-essential tracking fires
- GTM Consent Mode is enabled by default (`ad_storage`, `analytics_storage` = denied)
- On accept, consent is granted and tracking resumes
- Consent state stored in a cookie and checked by GTM

## Debugging

- Use GA4 DebugView (enable via GTM preview mode or `debug_mode: true` on events in dev)
- PostHog has an in-app event inspector
- Chrome extension: Google Tag Assistant Legacy
- Network tab: filter by `google-analytics` or `posthog`

## Common mistakes

- ❌ Calling `gtag` or `dataLayer.push` directly — goes around the type system
- ❌ Firing events with PII (emails, full names)
- ❌ Inconsistent naming (`clientCreate` vs `client_created` vs `create_client`)
- ❌ Firing duplicate events (e.g. both `client_created` and `add_client`)
- ❌ Adding params that aren't in the EventMap type
- ❌ Forgetting to update `ARCHITECTURE.md §11.2` when adding a new event
- ❌ Tracking every state change — track meaningful actions, not noise
