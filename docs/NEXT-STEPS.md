# Next Steps (as of 2026-04-24)

## What shipped this session

**Part 1:** team member name resolution + task assignee picker
(commit `135fdec`). `workspace_members.display_name` + `email`
cached; used across team page, assignee picker/filter.

**Part 2:** ~18 analytics `track()` events wired across auth,
workspace, team, clients, tasks, node map, messages, billing
checkout (commit `49f7acf`). Plus `serverTrackContext` + `fireTrack`
helpers and `AnalyticsIdentify` client component.

**Part 3:** analytics picture completed + ownership transfer.

- **Stripe webhook** now emits `upgrade_tier` / `downgrade_tier` /
  `subscription_canceled` / `payment_failed` with correct
  from/to + billing period + USD-cents value. Events attributed
  to `workspaces.owner_user_id`.
- **Tracking map** full coverage: `node_updated` (position-only
  updates excluded to avoid drag-noise), `node_health_changed`,
  `node_deleted`, `edge_created` (with source_type + target_type),
  `edge_deleted`, `map_layout_arranged` (via new canvas callback
  prop).
- **Team events**: `member_role_changed`, `member_removed`.
- **Ownership transfer** (NEXT-STEPS item) — new
  `transferOwnershipAction` wrapped in a DB transaction (demote
  owner → promote target → update workspaces.owner_user_id →
  audit_log insert, all atomic). Typed-confirmation dialog
  (`TRANSFER`) in the team page. Only the current owner sees
  the "Transfer ownership…" menu item.

`pnpm check` 29/29 green. Nothing user-visible in analytics until
keys are set; transfer UX is live as soon as deployed.

## To actually see the analytics data

Set these env vars in `.env.local` (local) or Vercel (prod):

- **PostHog** (product analytics, session replay, funnels):
  - `NEXT_PUBLIC_POSTHOG_KEY` — project API key from
    app.posthog.com → Project Settings
  - `NEXT_PUBLIC_POSTHOG_HOST` — defaults to
    `https://us.i.posthog.com` if unset
  - `POSTHOG_API_KEY` — same key, for server-side events
- **GA4** (marketing attribution, conversion reporting):
  - `GA4_MEASUREMENT_ID` — `G-XXXXXXXXXX` from GA4 admin
  - `GA4_API_SECRET` — from GA4 Admin → Data Streams →
    Measurement Protocol API secrets
- **GTM** (marketing site tag manager, already has container
  `GTM-W3MGZ8V7`):
  - `NEXT_PUBLIC_GTM_ID` — the container ID. Fires on
    apps/web, not apps/app.

Without these, `track()` is a pure no-op.

---

# Previous Next Steps (as of 2026-04-23, end of the intense feature session)

## Where Phloz stands

Phase 1 scaffold shipped in full (PROMPT_1 Steps 0–13). Prompt 2
(tracking-map editor) shipped. Since then we've built the agency
product out substantially.

### Working end-to-end

- **Auth** — signup / login / magic link / password reset / OAuth
  callback. Supabase JWT hook enabled. Email uses Supabase's
  default sender until Resend SMTP is configured
  (`docs/DEPLOYMENT.md` Step 6).
- **Onboarding** — workspace creation, sets `active_workspace_id`,
  fires `workspace/created` to Inngest.
- **Dashboard shell** — sidebar nav, workspace switcher, user menu.
- **Workspace overview** — 3 live count cards + an activity feed
  merging tasks / messages / file uploads / approval outcomes with
  deep links.
- **Clients** — list with at-risk / inactive badges (driven by a
  cached `last_activity_at` the nightly Inngest cron populates).
  Create, archive / unarchive (tier-gated via `canUnarchiveClient`),
  editable details on Overview, editable notes.
- **Contacts** (on each client) — CRUD + grant portal access +
  "Email link" (via Resend template) + "Copy link". **This is how
  you create portal magic-links.**
- **Tasks** — per-client tab + workspace-wide `/tasks` page.
  Filters: department / status / client / assignee. Sort:
  priority / due soonest / due latest / recently
  updated / recently created. Optimistic status toggles. Detail
  dialog with comments + full edit form. 5 built-in templates
  (Apply template dropdown) instantiate N tasks at once with
  staggered due dates.
- **Comments** — polymorphic. Task comments thread in the detail
  dialog with a "Client-visible" checkbox.
- **Messages** — per-client thread UI + workspace unified inbox.
  Compose Email (via Resend) or Internal note tabs. Per-client
  inbound address surfaced at the top.
- **Files** — Supabase Storage with RLS scoped by workspace path.
  Upload (4 MB cap, MIME allowlist), signed-URL download (5 min),
  delete, per-file "Share with client" toggle.
- **Tracking map** — canvas, 21 node types with Zod metadata,
  edge-type picker, keyboard shortcuts (`n`, `/`, `Esc`), node
  search, JSON export + import, dagre auto-layout, 200-node soft
  cap. Creating a node no longer validates against the strict
  schema (filled in via the drawer).
- **Team** — invite (Resend email), change role, remove member,
  revoke pending invitation. Real-time refresh after invite send.
- **Billing** — Stripe sandbox with 4 tiers × 3 prices; Checkout
  + Customer Portal links, webhook reconciles tier + subscription.
  SDK pinned to `2026-03-25.dahlia`.
- **Portal** (magic-link authenticated):
  - Client-visible tasks with approve / reject / needs-changes
    buttons and optional comment. Emails the workspace owner on
    any state change.
  - Messages thread with inline reply + "start new conversation".
  - Shared files (only assets the agency toggled visible).
- **Settings** — user profile (name + read-only email) + agency
  details (name, description, website, timezone).
- **Inngest jobs** — `recomputeActiveClientCount` (nightly, also
  refreshes `clients.last_activity_at`),
  `sendTrialEndingReminder`, `onWorkspaceCreated`, `onClientAdded`.
- **Observability** — Sentry (graceful no-op without DSN),
  PostHog provider, pino logger in `@phloz/config/logger`.
- **CI** — GitHub Actions: lint/typecheck/test, build matrix,
  RLS-invariants on postgres:16, pgTAP.

### Remaining

- **Tests** — only the package-level ones ship. No Playwright
  smoke tests for the actual app flows. Add when there's a second
  developer.
- **Analytics tracking wiring** — ✅ complete. Every event in
  ARCHITECTURE.md §11.2 is wired. `page_view` is handled by GA4's
  automatic config tag + PostHog's `$pageview` capture (not a
  manual event).
- **Ownership transfer** — ✅ shipped 2026-04-24.
- **Newsletter signup** — ✅ shipped 2026-04-24 (homepage +
  blog post footer). ⚠ Apply migration
  `packages/db/migrations/0002_glamorous_susan_delgado.sql` in
  Supabase before the endpoint works.
- **Name resolution for teammates** — ✅ shipped 2026-04-24.
- **Task assignee picker** — ✅ shipped 2026-04-24.
- **Email change sync to `workspace_members.email`** — users
  who change their email via the Supabase email-change flow will
  have stale `workspace_members.email` until next profile edit.
  Rare; acceptable for V1. Future fix: Inngest handler on
  `auth.users` update event, or drop the column and join lazily.

## What Ramtin needs to do to go live

1. **Supabase SMTP** — so auth emails come from `phloz.com`, not
   `noreply@mail.app.supabase.io`. Walkthrough in
   `docs/DEPLOYMENT.md` Step 6. Pre-req: domain verified in Resend.
2. **Set `NEXT_PUBLIC_APP_URL` in Vercel** to the real domain
   once DNS is pointed. Otherwise the request-host fallback takes
   over — still works, just less pretty in emails.
3. **Stripe live-mode products** — still sandbox. Recreate when
   ready to launch.
4. **Inngest app** — register at `app.phloz.com/api/inngest`,
   paste `INNGEST_SIGNING_KEY` into Vercel env.

## Local dev

```bash
# Start
pnpm --filter @phloz/app dev   # product app on :3001
pnpm --filter @phloz/web dev   # marketing on :3000

# Before committing
pnpm check                     # lint + typecheck + unit tests
```

`apps/app/.env.local` + `apps/web/.env.local` are gitignored +
pre-filled with public Supabase keys; only
`SUPABASE_SERVICE_ROLE_KEY` + `DATABASE_URL` need real values.

## Accounts / provisioning

- ✅ GitHub, Supabase (`tdvzhwhzxuskrsobdyrm`, 25 tables + RLS +
  hook enabled), GTM (`GTM-W3MGZ8V7`), Stripe sandbox
  (`acct_1RXbVlPomvpsIeGO`, 4 products + 12 prices wired).
- ⏳ Vercel deploy, Resend domain, Inngest app, PostHog, Sentry,
  GA4 — optional for local dev.
