# Next Steps (as of 2026-04-24)

## Branch state

Currently on `claude/stupefied-vaughan-5f394f`, **28 commits ahead
of `main`**. All commits pass `pnpm check` (29/29 green) and both
apps build clean locally. Ready to squash-merge when Ramtin is
done dogfooding.

## Manual actions Ramtin still owes (tracked across sessions)

### Required for the app to be live at the right domains

1. **Vercel: second project for `apps/web`.** The repo has both
   `apps/app/vercel.json` and `apps/web/vercel.json` but only one
   project exists today (the app). That's why `phloz.com` currently
   redirects to `/login` — DNS hits the app project and the root
   route redirects anonymous users.
   - Add New Project → import `ramtinlahooti/phloz` → set Root
     Directory = `apps/web`. Env vars: just
     `NEXT_PUBLIC_APP_URL=https://app.phloz.com`,
     `NEXT_PUBLIC_MARKETING_URL=https://phloz.com`,
     `NEXT_PUBLIC_GTM_ID=GTM-W3MGZ8V7`. **Don't** copy DB / Stripe
     vars to the marketing project.
   - Settings → Domains: add `phloz.com` + `www.phloz.com`.
   - In the existing `apps/app` project: remove `phloz.com` from
     Domains, ensure `app.phloz.com` is there.

### SQL migrations queued for Supabase

Apply in order via the SQL editor (or `pnpm --filter @phloz/db
db:migrate` with a service-role `DATABASE_URL`). All idempotent.

| File | What |
|---|---|
| `packages/db/migrations/0001_loving_marauders.sql` | ✅ already applied per Ramtin earlier; member display_name + email |
| `packages/db/migrations/0002_glamorous_susan_delgado.sql` | newsletter subscribers — endpoint 500s until applied |
| `packages/db/migrations/0003_wet_lake.sql` | audit suppressions — includes RLS policy inline |

### Env vars to light up dormant features

- **PostHog** (product analytics) — `NEXT_PUBLIC_POSTHOG_KEY` +
  `POSTHOG_API_KEY`. Without these, `track()` is a no-op.
- **GA4** (marketing attribution) — `GA4_MEASUREMENT_ID` +
  `GA4_API_SECRET`.
- **GTM** — `NEXT_PUBLIC_GTM_ID=GTM-W3MGZ8V7` (apps/web only).
- **Resend** — `RESEND_API_KEY`. Without this every transactional
  email + the daily digest is a logged no-op.
- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`. Cron
  doesn't fire without them. Register the app at
  `app.phloz.com/api/inngest` after first deploy.

## What's been built since main (28 commits)

Listed newest-first. Every entry has a deeper write-up in
`docs/CHANGELOG.md`.

### Foundation polish

- Member display names + email cached on `workspace_members`
  (used by team page + assignee picker).
- Task assignee picker on `NewTaskDialog` + detail dialog edit
  mode; assignee pill on every row; "Mine" quick-filter on
  `/tasks`.
- URL-param-backed search on `/clients`, `/tasks`, and the
  inbox. Deep-link `?task=<id>` on tasks; `?tab=<name>` on
  client detail; `?node=<id>` on the tracking map.
- CSV export for clients + tasks (respecting current filters).
- Bulk task actions: multi-select + floating bar (status,
  delete) on `/tasks`.
- Subtasks (the `parent_task_id` column was always there, the
  UI now exposes it). Checklist inside the task detail dialog;
  progress pill on parent rows.
- Onboarding checklist replaces static "Getting started" — 6
  state-derived steps; card disappears when all done.
- Sidebar nav badges on Tasks (overdue-mine count, red) and
  Messages (unreplied-clients count, amber).
- ⌘K command palette — pages, shortcuts, clients, tasks. Sidebar
  trigger button for discovery.

### Analytics

- All ~30 events from ARCHITECTURE.md §11.2 wired. Auth, workspace,
  team, clients, tasks, tracking map, messages, billing checkout,
  Stripe webhook, portal, marketing site CTAs, edit paths.
- `apps/app/lib/analytics.ts` `serverTrackContext` + `fireTrack`
  helpers. `AnalyticsIdentify` mounted in workspace layout.
- `@phloz/analytics` was split into client + `/server` subpath
  to fix a Vercel build failure (posthog-node was leaking
  `node:fs` into client bundles).

### The moat (tracking map)

- **Audit engine V1** (`packages/tracking-map/src/audit.ts`) — 9
  rules (broken/missing nodes, never-verified, stale-verification,
  orphan-gtm, ga4-no-measurement, meta-pixel-no-capi, no-ga4,
  empty-map). Pure function over `{nodes, edges}` → triaged
  `Finding[]`.
- **Audit tab** on the client detail page renders findings
  grouped by severity with "View node" deep-links into the map.
- **Dashboard rollup card** — top 4 clients with criticals/warnings.
- **Per-client suppression** with optional reason. Snooze/un-snooze
  buttons; suppressed-rules section in the audit tab. Filtered out
  before render so the badge counts respect them.
- **Map node `?node=<id>` deep-link** — centers + opens drawer.
- **One-click "Seed starter setup"** on empty maps — adds Website +
  GTM + GA4 + Meta Pixel + Meta CAPI + Google Ads + 5 canonical
  edges in a transaction.

### Dashboard cockpit

- "This week" widget — Overdue / Due this week / Pending approval
  / Waiting on a reply, top 5 each with deep-links.
- Client health scoring — 0–100 + tier (healthy/at_risk/needs_attention)
  with reason list. Visible on `/clients` rows + client detail
  header stats strip + dashboard "Clients needing attention" card.
- Stateful onboarding checklist (6 steps).
- Tracking audit rollup (mentioned above).
- Pre-existing 3 vanity counters + activity feed retained.

### Inbox

- Text search on subject/body.
- "Needs reply" filter pill — clients with inbound newer than
  last outbound. Mirrors the dashboard widget exactly.

### Client detail

- Header stats strip (health badge + open tasks + unreplied
  messages + tracking nodes + contacts).
- All 7 tabs: Overview, Contacts, Tasks, Messages, Tracking map,
  Audit (new), Files.

### Marketing site

- Newsletter signup form on homepage + blog post footer.
  POSTs cross-origin to the app's
  `/api/newsletter/subscribe` (CORS allow-list).
- Analytics events on every CTA (cta_click) + page view
  (compare/blog/pricing).
- Both apps have full error boundaries (`error.tsx`, `not-found.tsx`,
  `global-error.tsx`) — Sentry-wired with severity-tagged events.

### Ownership transfer

Atomic flow: demote current owner → promote target → update
`workspaces.owner_user_id` → audit_log row, all in one Drizzle
transaction. Typed-confirmation dialog ("type TRANSFER").

### Daily digest email

Inngest cron at 9am **local time** for each workspace
(`workspaces.timezone` aware, falls back to UTC). React Email
template with overdue / due today / pending approval / unreplied
/ critical-audit sections. Skips empty mornings. Dormant until
`RESEND_API_KEY` + `INNGEST_SIGNING_KEY` are set.

## Demo flow (60 seconds)

1. Sign up → workspace → `/` shows onboarding checklist.
2. "Add your first client" → fill form → land on client detail
   page with a stats strip + 7 tabs.
3. Tracking map tab → "Seed starter setup" → 6 nodes + 5 edges.
4. Audit tab → "All clear" (because Meta CAPI was seeded).
5. Delete the CAPI node on the map → return to Audit → see
   `meta-pixel-no-capi` warning surface immediately.
6. Click Snooze → reason "iOS-only client" → finding moves to
   "Suppressed rules" section.
7. Back to dashboard → audit rollup card reflects the change;
   nav badges show overdue tasks + unreplied messages once
   real activity exists.
8. Press ⌘K from anywhere → command palette navigates to any
   client / task / page.

## Backlog (in roughly priority order)

1. **Recurring tasks** — schema + Inngest cron that fires
   templates on a schedule. Real agency workflow.
2. **Per-member daily digest + per-user opt-out** — current
   digest goes to owner only with workspace-wide content.
   Per-member would need each user's `assigned-to-me` agenda
   filtered, plus a `workspace_members.digest_enabled` column.
3. **Saved filter views on `/tasks`** — name + persist a filter
   combo. New `saved_views` table.
4. **Bulk selection on `/clients/[id]` tasks tab** — parity
   with `/tasks` (small).
5. **Subtask reordering (DnD)** — polish.
6. **More marketing content** — blog posts, richer compare
   pages, full department pages.
7. **Playwright smoke tests** — deferred until there's a second
   dev / a real bug forces it.
8. **Email change sync to `workspace_members.email`** — known
   minor staleness in `KNOWN-ISSUES.md`. Defer until reported.
9. **V2 ad-platform integrations** (Google Ads / Meta Ads /
   GA4 Admin API) — separate phase, real moat-deepening work.

## Local dev

```bash
pnpm --filter @phloz/app dev   # product app on :3001
pnpm --filter @phloz/web dev   # marketing on :3000

pnpm check                     # lint + typecheck + unit tests
```

`.env.local` files are gitignored + pre-filled with public
Supabase keys; only `SUPABASE_SERVICE_ROLE_KEY` + `DATABASE_URL`
need real values for local development.

## Accounts / provisioning status

- ✅ GitHub, Supabase (`tdvzhwhzxuskrsobdyrm`, RLS + JWT hook
  enabled), GTM (`GTM-W3MGZ8V7`), Stripe sandbox
  (`acct_1RXbVlPomvpsIeGO`, 4 products × 3 prices live).
- ⏳ Vercel marketing project, Resend domain verification,
  Inngest app registration, PostHog project, Sentry project,
  GA4 property — optional for local dev, required for prod.
