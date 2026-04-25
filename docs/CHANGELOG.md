# Changelog

Append dated entries at the top. Style: what changed + where + why.

---

## 2026-04-25 — Tier hint, digest preview, saved-views rename + share

### Added — Onboarding honors `signup_tier_hint`

The `/pricing` page CTAs already wrote `signup_tier_hint` into auth
user metadata, but onboarding ignored it. Now: if the hint is a paid
tier (pro / growth / business / scale), the new owner lands on
`/[workspace]/billing?upgrade=<tier>` instead of the dashboard. The
workspace itself stays on starter — payment hasn't cleared — but
the upgrade is one click away. Hints are zod-narrowed against
`TIER_NAMES` first; malformed hints fall through to the normal path.

### Added — "Preview today's digest" button (Settings → Notifications)

Per-member preview of the daily digest. Clicking the button fires
`digest/send-daily` with both `workspaceId` and `membershipId` in
the event data. The cron's manual path now honours `membershipId`:
`runDigestForWorkspace` filters its `workspace_members` query to
that single row when present, so the preview lands in the caller's
inbox without notifying teammates. `previewDigestAction` self-targets
via `requireUser`. Inngest's API key being absent returns 200
(no-op), so the action's `ok: true` doesn't guarantee email
delivery — it depends on Resend + Inngest both being configured,
which the toast description calls out.

### Added — Saved views: in-place rename + workspace-shared variant

Schema: `saved_views.is_shared` boolean column, default false.
Migration 0007 applied to Supabase. RLS SELECT policy expanded to
return shared rows from any creator in the workspace; INSERT /
UPDATE / DELETE stay creator-only.

`createSavedViewAction` accepts an `isShared` flag and runs an
extra `requireRole(['owner','admin'])` check when true — members
can save personal views but not publish team-wide. Re-saving by
name UPSERTs the `is_shared` flag too so toggling share status is
a one-click re-save with the same name.

`renameSavedViewAction` is a thin update-by-(id, workspace_id, user_id)
that returns `not_found_or_not_owner` for any attempt to rename a
teammate's shared view.

UI:
- `SavedViewSummary` carries `isShared` + `isMine` so the picker
  can render the right per-row affordances without round-trips.
- Per-row rename pencil + delete trash render only on `isMine`
  rows — shared rows from teammates are read-only.
- Shared rows show a small "Shared" pill with a Users icon.
- Save section gets a "Share with the workspace" checkbox below the
  name field, rendered only when `canShare = true`.
- `/tasks` page switched to `requireRole` to derive `canShare` for
  the picker.

### Files touched

- `apps/app/app/onboarding/actions.ts`
- `apps/app/inngest/functions/send-daily-digest.ts`
- `apps/app/app/[workspace]/settings/notifications-{actions,form}.{ts,tsx}`
- `apps/app/app/[workspace]/tasks/{page,saved-views-actions,saved-views-picker}.{ts,tsx}`
- `packages/db/src/schema/saved-views.ts`
- `packages/db/src/rls/saved-views.sql`
- `packages/db/migrations/0007_saved_views_is_shared.sql`

### Verified

- `pnpm check` — 29/29 green.
- `pnpm --filter @phloz/app build` — clean; no route changes
  (existing pages now render the new affordances).

---

## 2026-04-25 — Client tasks tab parity + tier-gate UX

### Added — Recurring templates section on the client tasks tab

The client detail page's Tasks tab now renders a Recurring section
above the regular task list, listing templates filtered to this
client. Discoverable without leaving the client view — agency
owners no longer need to detour through `/tasks/recurring` and pick
the client from a dropdown.

`NewRecurringDialog` accepts an optional `clientId` prop (matches
`NewTaskDialog`'s shape). When set, the dialog hides the client
picker and locks new templates to that client on submit. The
workspace-wide `/tasks/recurring` route is unchanged.

`apps/app/app/[workspace]/clients/[clientId]/page.tsx`:
- Switched `requireUser` → `requireRole` so the page knows the
  caller's role; only owner/admin see the per-row Delete button on
  the recurring section (mirrors the workspace recurring page).
- New parallel query for `recurring_task_templates` filtered by
  `(workspace_id, client_id)`, ordered by title.

### Added — Bulk selection on the client tasks tab

Parity with the workspace `/tasks` page. Tasks group by status
(todo / in_progress / blocked / done — empty groups filtered out)
and use `TaskListWithSelection` instead of a flat `<ul>`. Each row
gets a checkbox; the floating action bar appears at the bottom of
the viewport when one or more tasks are selected and supports bulk
status change + bulk delete. No new server actions —
`bulkUpdateTasksAction` already filtered by `(workspaceId, taskIds)`.

### Added — Pre-flight tier-gate UX on recurring tasks

The `canAddRecurringTemplate` server gate already enforced limits,
but users only saw the limit message after filling the dialog. The
recurring page now runs the gate at render time and reflects the
result in the UI:

- Subtitle shows "X of Y used" (paid tiers) or omits when enterprise
- At-limit count renders in destructive red
- Trigger button on `NewRecurringDialog` is disabled with the gate's
  human-readable message as a `title` tooltip when at-limit

`NewRecurringDialog` gained two optional props (`disabled` +
`disabledMessage`) that pass straight onto the trigger Button. The
server-side gate inside `createRecurringTemplateAction` is still
authoritative — the disabled trigger is a UX hint, not a security
boundary.

### Files touched

- `apps/app/app/[workspace]/clients/[clientId]/page.tsx`
- `apps/app/app/[workspace]/tasks/recurring/page.tsx`
- `apps/app/app/[workspace]/tasks/recurring/new-recurring-dialog.tsx`

### Verified

- `pnpm check` — 29/29 green.
- `pnpm --filter @phloz/app build` — `/[workspace]/clients/[clientId]`
  + `/[workspace]/tasks/recurring` both surface in the build manifest.

---

## 2026-04-25 — Per-member digest, saved views, tier gating, magic-link fix

### Fixed — Magic-link / signup / reset emails embed canonical URL

The three auth forms built `emailRedirectTo` from
`window.location.origin`, so a user hitting `phloz.com/login` (DNS
still resolves the apex to the app project pre-marketing-project
split) got a magic-link with `redirect_to=https://phloz.com/` —
Supabase rewrote the path to its Site URL because the redirect
allowlist matched only the bare URL. New
`apps/app/lib/client-app-url.ts` exposes `getClientAppUrl()` that
prefers `NEXT_PUBLIC_APP_URL` (compiled into the client bundle) and
falls back to `window.location.origin`. All three forms now use it.
**Manual companion steps live in NEXT-STEPS** — Supabase Site URL
+ redirect allowlist + Resend SMTP need to be configured in the
dashboard before the link actually round-trips.

### Added — Per-member daily digest + opt-out

The digest now reaches every workspace member, filtered to their own
agenda. Schema: `workspace_members.digest_enabled` boolean, default
true. Migration 0005 applied to Supabase.

- **Owner / admin** still get the workspace-wide picture: every
  overdue / due-today / pending-approval task plus unreplied client
  messages and the audit-rollup card.
- **Member / viewer** get only their assigned task agenda
  (`tasks.assignee_id = membership.id` filter).
- Empty per-member digests are skipped — no "all clear" emails.

`runDigestForWorkspace` is now factored to fetch workspace-wide data
once (clients, message history, tracking nodes/edges) and reuse it
across the per-member loop. The Supabase admin lookup for the owner's
email is gone — cached `workspace_members.email` + `display_name`
(backfilled in 0001) cover every recipient.

Settings UI: role gate relaxed from `requireAdminOrOwner` to all
roles so members can finally edit their own profile + manage
notifications. New `NotificationsForm` card visible to every member;
the agency card stays gated to owner/admin via a conditional render.
`setDigestEnabledAction` is self-targeting via `requireUser` — no
admin override path because the preference is personal.

### Added — Saved filter views on /tasks

Personal, per-workspace, persisted filter combos. Click a saved view
→ single navigation to `/tasks?<searchParams>`. Schema: `saved_views`
table with `(workspace_id, user_id, scope, name)` unique. `scope` is
a discriminator — V1 only emits `tasks`, future surfaces (clients,
messages) reuse the same table. Migration 0006 applied to Supabase.

RLS makes views **personal** — even within the same workspace, a
member only sees their own rows
(`user_id = auth.uid() AND public.phloz_is_member_of(workspace_id)`).

UI: `SavedViewsPicker` dropdown next to the task search input. Lazy-
loads on open (no DB hit on /tasks renders for users who don't use
the feature). Per-row delete; inline name field with Save button at
the bottom for capturing the current URL search-params string. Re-
using a name UPSERTs via `onConflictDoUpdate`. When the current URL
matches a saved view, the trigger button shows the view name with a
check mark.

### Added — Tier-gate recurring task templates

V1 was unbounded — a free workspace with 1000 templates would chew
through Inngest steps every hour. Per-tier caps:
starter=2, pro=25, growth=75, business=250, scale=750, enterprise=∞.

`TierConfig.recurringTemplateLimit` typed as `number | 'unlimited'`.
`getRecurringTemplateCount(workspaceId)` counts every row regardless
of `enabled` (disabled templates still occupy a slot — no
disable-then-create skirting). New
`canAddRecurringTemplateCheck({tier, templateCount})` returns the
standard `CanResult` with `recurring_template_limit_reached` reason
+ `upgradeTo` hint. `canAddRecurringTemplate(workspaceId)` server
wrapper now sits inside `createRecurringTemplateAction` after the
role check.

`GateDenialReason` extended with the new variant. Billing test suite
gained 4 cases (under-limit / at-limit / enterprise-unlimited /
upgrade-suggestion) for a total of 28 passing.

### Files touched

- `packages/db/src/schema/{workspace-members,saved-views,index}.ts`
- `packages/db/src/rls/{saved-views.sql,index.ts}`
- `packages/db/migrations/0005_workspace_members_digest_enabled.sql`
- `packages/db/migrations/0006_saved_views.sql`
- `packages/billing/src/{tiers,gates,errors,active-clients,gates.test}.ts`
- `apps/app/inngest/functions/send-daily-digest.ts`
- `apps/app/app/[workspace]/settings/{page,notifications-actions,notifications-form}.{ts,tsx}`
- `apps/app/app/[workspace]/tasks/{page,saved-views-actions,saved-views-picker,recurring/actions}.{ts,tsx}`
- `apps/app/app/(auth)/{login/login-form,signup/signup-form,forgot-password/forgot-password-form}.tsx`
- `apps/app/lib/client-app-url.ts`

### Verified

- `pnpm check` — 29/29 green (28 billing tests, up from 24).
- `pnpm --filter @phloz/app build` — `/[workspace]/tasks`,
  `/[workspace]/tasks/recurring`, `/[workspace]/settings` all in the
  build manifest.

---

## 2026-04-24 — Recurring tasks + bulk dep update + DB catch-up

### Added — Recurring task templates (the headline feature)

A core agency workflow: weekly client check-ins, monthly billing
reminders, daily standups. Each template fires at 6 AM in the
workspace's local timezone via an hourly Inngest cron, instantiating
a fresh task with the template's title/description/priority/department/
visibility/assignee + a `due_offset_days`-driven due date.

**Schema (`packages/db/src/schema/recurring-task-templates.ts`):**
- New `recurring_task_templates` table mirrors the relevant `tasks`
  columns plus `cadence` (daily/weekly/monthly), `weekday`,
  `day_of_month`, `due_offset_days`, `enabled`, `last_run_at`.
- RLS matches `tasks.sql`: workspace members read; owner/admin/member
  mutate; owner/admin delete; client-tied templates respect
  per-member assignment. Inline RLS in migration; mirrored in
  `packages/db/src/rls/recurring-task-templates.sql` for
  `db:apply-rls`.
- Migration `0004_recurring_task_templates.sql` applied to Supabase
  (entry `recurring_task_templates`, 2026-04-24).
- Added to `TENANT_TABLES` so the CI invariant check covers it.

**Cron (`apps/app/inngest/functions/process-recurring-tasks.ts`):**
- Hourly trigger; for each workspace, gate on local hour == 6.
- Iterate enabled templates whose cadence predicate matches today's
  local date; insert a fresh `tasks` row; advance `last_run_at`.
- Skip if `last_run_at` is already on the same local date —
  retry-safe within the same hour-window.
- Monthly `day_of_month=31` clamps to last day of month so Feb
  fires on the 28th (or 29th in leap years) instead of skipping.
- Manual `recurring/process` event ignores the local-hour gate —
  useful for dashboard replays and previewing creation.

**UI (`apps/app/app/[workspace]/tasks/recurring/`):**
- New route `/[workspace]/tasks/recurring` lists templates with
  cadence summary, client name, department, "last fired" date, and
  per-row enable toggle (member-mutable). Delete button is
  owner/admin only.
- New-template dialog mirrors `NewTaskDialog`'s shape with extra
  cadence/weekday/day-of-month controls. Live preview line in the
  dialog header reflects the chosen cadence.
- Shared `cadence.ts` exports `RECURRING_CADENCES`,
  `describeCadence`, `cadenceMatches`, `localDateParts`,
  `sameLocalDate` — used by both the cron and the UI so cadence
  semantics live in exactly one place.
- Existing `/tasks` page header gets a "Recurring" link button
  next to Search / Export / New task.

### Changed — Bulk dependency update (16 packages)

**Security fix:** `next-mdx-remote` 5 → 6 (Vercel-flagged advisory;
v6 ships stricter JS-in-MDX defaults — our blog posts have no MDX
JS expressions so the upgrade was drop-in).

**Type alignment:** `react`/`react-dom` 19-rc → 19.2 GA, plus
`@types/react`(-dom) 18 → 19.2 — clears the long-standing
"React 19 with @types/react 18" peer warning. `@types/node` 22 → 25.

**SDK bumps:**
- Stripe SDK 22.0.2 → 22.1.0; pinned API version
  `2026-03-25.dahlia` → `2026-04-22.dahlia` in
  `packages/billing/src/stripe.ts`.
- `@supabase/ssr` 0.5 → 0.10. `drizzle-kit` 0.28 → 0.31.
  `pino` 9 → 10. `posthog-js` + `posthog-node` (5.x). `resend` 4 → 6.
  `@react-email/components` 1.0.12 (replaces deprecated 0.0.28).
  `@dagrejs/dagre` 1 → 3. `tailwind-merge` 2 → 3. `sonner` 1 → 2.

**Lucide v1 dropped the branded `Facebook` icon.** Meta Pixel
node-type now uses `Share2` (`packages/tracking-map/src/node-types/{registry,ads}.ts`).

**Skipped (deferred — see NEXT-STEPS):** zod 3 → 4 (cross-codebase
schema migration), vitest 2 → 4 (config breaking), typescript 5 → 6,
eslint 9 → 10, `@hookform/resolvers` 3 → 5 (waits on zod 4).

### Fixed — Migration 0001 catch-up

`packages/db/migrations/0001_loving_marauders.sql`'s primary payload
(`workspace_members.display_name` + `email` columns + the
auth.users → workspace_members backfill UPDATE) had never been
applied to Supabase, despite the column-by-column splits applied
piecewise. Detected via direct schema probe; applied via the
`workspace_members_identity_cache` migration entry. The team page
+ assignee picker now resolve teammates by name/email instead of
UUID prefix for **every** existing member, not just freshly-invited ones.

### Files touched

- `packages/db/src/schema/{recurring-task-templates,index}.ts`
- `packages/db/src/rls/{recurring-task-templates.sql,index.ts}`
- `packages/db/migrations/0004_recurring_task_templates.sql`
- `apps/app/app/[workspace]/tasks/recurring/{actions,cadence,page,
  new-recurring-dialog,recurring-row}.{ts,tsx}`
- `apps/app/app/[workspace]/tasks/page.tsx` (new "Recurring" link)
- `apps/app/inngest/{client,index}.ts`
- `apps/app/inngest/functions/process-recurring-tasks.ts`
- All 11 `package.json` files (+ `pnpm-lock.yaml`)
- `packages/billing/src/stripe.ts` (API version pin)
- `packages/tracking-map/src/node-types/{registry,ads}.ts` (Facebook → Share2)

### Verified

- `pnpm check` — 29/29 green.
- `pnpm --filter @phloz/web build` — 49 pages compile.
- `pnpm --filter @phloz/app build` — `/[workspace]/tasks/recurring`
  surfaces in the build manifest.

---

## 2026-04-24 — Daily digest is now timezone-aware

Bug fix more than a feature. The digest was firing at 9am **UTC**
for every workspace, meaning North-American agencies got it at
1–5am local time. Now each workspace gets it at 9am in its own
timezone (`workspaces.timezone`, defaulting to UTC).

- Cron switched from `TZ=UTC 0 9 * * *` to `TZ=UTC 0 * * * *`
  (hourly).
- Per-workspace gate skips unless
  `Intl.DateTimeFormat({ hour, timeZone: ws.timezone }).format(now)`
  is 9 (`DIGEST_LOCAL_HOUR`).
- Manual `digest/send-daily` event always runs — useful for
  previewing the email.
- Falls back to UTC if `ws.timezone` is empty or invalid (rather
  than crashing the whole cron because of one bad value).

Cost: Inngest function now invokes 24× per day instead of once.
At free-tier scale (50k steps/mo) still way under cap; revisit
if workspace count tops ~200.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Audit rule suppression (per-client snooze)

Without snooze the audit engine becomes annoying the moment a
client has a legitimate exception ("we don't use Meta CAPI here").
Shipped per-client suppression so the engine stays useful.

### Schema

- `audit_suppressions` table — `(workspace_id, client_id, rule_id)`
  unique, optional `reason`, `created_by`. RLS enabled with
  workspace-scoped SELECT policy; writes go through server
  actions (service-role bypass).
- Migration `0003_wet_lake.sql` — includes the RLS enable +
  policy inline, so applying the SQL is one paste.
- `packages/db/src/rls/audit-suppressions.sql` mirrors the
  inline migration for fresh databases via `db:apply-rls`.
- Added to `TENANT_TABLES` so CI invariant check covers it.

### Server actions

- `suppressAuditFindingAction` — owner/admin/member only.
  Validates `ruleId` against the engine's `AUDIT_RULE_IDS` enum.
  Re-snoozing is silent (`onConflictDoNothing`).
- `unsuppressAuditFindingAction` — accepts either `suppressionId`
  or `clientId + ruleId` for caller ergonomics.

### UI

- Per-finding **"Snooze"** button on each audit finding. Triggers
  a `window.prompt` for an optional reason (low-stakes action,
  not worth a dialog), then revalidates.
- **"Suppressed rules" footer section** with rule id + reason +
  snoozed-date + "Un-snooze" link.
- **All-clear-with-suppressions** state — when 0 active findings
  but ≥ 1 suppressed, panel shows "All clear" + hint about the
  list below.
- Suppressed rules filter out **before** render, so the
  Audit-tab badge count, the criticalCount, and the dashboard
  rollup card all respect them automatically.

### ⚠ Manual action

Apply migration `packages/db/migrations/0003_wet_lake.sql` in
Supabase SQL editor when ready. Includes RLS inline.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Seed starter tracking nodes (one-click kit)

Turns a blank tracking map into a working demo in one click.
Pairs with the audit engine: seed → see the map take shape → run
audit → understand what Phloz does.

Starter kit (6 nodes, 5 edges, pre-laid-out left-to-right):
- Website → GTM container (uses_data_layer)
- GTM container → GA4 property (sends_events_to)
- GTM container → Meta Pixel (fires_pixel)
- Meta Pixel → Meta CAPI (sends_server_events_to)
- GTM container → Google Ads (reports_conversions_to)

Deliberately includes Meta CAPI so the audit doesn't greet first-
time users with `meta-pixel-no-capi` on second one. All health
statuses = `unverified` — users bump timestamps as they verify.

Implementation:
- `seedStarterNodesAction` in `map/actions.ts`. Owner/admin/member
  only. Refuses to seed on top of an existing map (server-
  enforced via a LIMIT 1 existence check) so double-clicks don't
  duplicate. All inserts inside a Drizzle transaction.
- Each node's metadata comes from its descriptor's `defaults()`.
- `SeedStarterNodesButton` client component — toast + refresh.
- Mounted on the client-detail Tracking map tab only when
  `trackingNodeRows.length === 0`.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Sidebar nav badges (Tasks + Messages)

Count badges next to the Tasks and Messages nav items. Visible
on every authed page — first "something needs attention" signal
without having to land on the dashboard first.

- **Tasks** (red) — overdue tasks assigned to you (scoped to
  this workspace, subtasks excluded).
- **Messages** (amber) — clients with at least one unreplied
  inbound. Same heuristic as the inbox + dashboard widgets.
- Badges hide when count = 0. `99+` cap for layout stability.

Implementation:
- Layout runs 3 extra queries (overdue-mine count, inbound msgs,
  outbound msgs) inside the existing Promise.all. Computes the
  unreplied-client count in JS — same pattern as the dashboard.
- DashboardShell gains an optional `navBadges` prop + `NavItem`
  type with `badgeKey` + `badgeTone`, easily extensible to other
  nav items later.

Perf: fires on every navigation. Cheap at launch scale. Promote
to a correlated subquery or a denormalised
`workspaces.unreplied_clients_count` column (nightly cron refresh)
when workspaces have 50k+ messages.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Daily digest email

Retention infrastructure. Daily cron at 09:00 UTC sends the
workspace owner a summary of what needs attention — overdue
tasks, due-today tasks, pending client approvals, unreplied
messages, and critical tracking-audit findings. Same data the
dashboard shows, delivered to their inbox so they open the app
with intent.

### Scope (V1)

- **Audience**: workspace owner only. Per-member digests +
  per-user opt-out deferred to V2 (requires a settings column
  + timezone plumbing). Email tells recipient to reply to opt
  out — manual safety valve.
- **Timezone**: UTC. Per-workspace TZ is a V2 refinement —
  `workspaces.timezone` already exists in the schema.
- **Skip empty**: if nothing's actionable anywhere in the
  workspace, no email. Quiet mornings shouldn't generate
  notifications.

### Data mirrors the dashboard

Same queries + heuristics as the "This week" widget + "Clients
needing attention" + "Tracking audit" cards so the numbers in
the inbox line up with what users see when they click through.
Deep-links use `?task=<id>` and `?tab=audit` so clicks land
right on the item.

### Files

- `packages/email/src/templates/daily-digest.tsx` — React Email
  template with PreviewProps for dev preview.
- `packages/email/src/send.ts` — new `sendDailyDigest(input)`
  helper; caller owns the subject (formatted per-workspace).
- `apps/app/inngest/functions/send-daily-digest.ts` — cron
  function wired to `TZ=UTC 0 9 * * *` + manual trigger via
  `digest/send-daily` event. Per-workspace loop runs inside
  `step.run` for Inngest retries.
- `apps/app/inngest/index.ts` — registered.
- `apps/app/inngest/client.ts` — added `digest/send-daily`.

### Dormant until Ramtin sets up

- **Resend `RESEND_API_KEY`** — without it `sendDailyDigest`
  no-ops with a log line, same as other Phloz emails in dev.
- **Inngest `INNGEST_SIGNING_KEY`** — without it the cron never
  fires; registering the function is still safe.

Once both are set, the cron runs automatically at 9am UTC daily.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Tracking map `?node=<id>` scroll-focus

Closes the loop on audit findings. When a user clicks "View node
→" on an audit finding, the map now centers on that node and
opens its drawer automatically — previously they landed on a
full view of the map with no hint of which node the finding was
about.

### Implementation

- **`TrackingMapCanvas`** gains a `focusNodeId?: string | null`
  prop. When set:
  - Looks up the node's position in the current state.
  - `setCenter(pos.x + 120, pos.y + 60, { zoom: 1.2, duration: 500 })`
    animates the pan. The +120/+60 offsets account for the
    React Flow node's top-left anchor so the label ends up
    roughly centered.
  - Opens the drawer for that node.
  - Silently no-ops if the id doesn't match any loaded node
    (the URL is user-supplied; don't flash a 404 for a node
    that was deleted between audit and click).
- Effect deps are deliberately limited to `focusNodeId` — using
  `nodes` in the dep array would re-center every time a user
  nudges a node on the canvas, which would be maddening. The
  latest nodes are read via a ref.
- **`MapClient`** (apps/app) forwards the prop from the server
  page.
- **`/clients/[id]/map`** page reads `?node=<id>` from
  `searchParams` and passes it down.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Dashboard audit rollup + `?tab=` deep-link

Surfaces the audit-engine moat feature on the dashboard so users
hit it without navigating into a client. Also adds `?tab=…` to
the client detail page so any client tab is linkable.

### Rollup card

- Right-rail card, only renders when ≥ 1 active client has a
  critical or warning finding. Info-only clients are filtered —
  too low-signal for the dashboard.
- Summary line: `{N critical} · {M warnings}`.
- Up to 4 clients worst-first (criticals, then warnings),
  each row → that client's Audit tab.
- Sibling of "Clients needing attention" — right rail reads
  cohesively.

### Data

- Widened the dashboard's existing node query from
  `{clientId, healthStatus}` to a full `select()`, added a
  `trackingEdgeRows` fetch. Both feed the health scorer AND the
  audit engine — one fetch, two uses.

### `?tab=…` on client detail

- `/clients/[id]?tab=audit` (or overview / contacts / tasks /
  messages / map / audit / files) opens that tab on load.
- Invalid values fall through to overview.
- Used by the audit rollup card, easily reusable by future
  cross-page links.

### Perf note

- `auditMap()` runs per client in the dashboard render. Cheap
  at launch scale (< 100 × < 50). Promote to a
  `workspace_audit_rollup` materialised table when that stops
  being true.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Tracking-map audit engine (V1)

The moat feature from the scaling/features roadmap. Rules-based
audit of each client's tracking infrastructure, surfaced as an
"Audit" tab on the client detail page. What makes Phloz genuinely
useful vs. a generic PM tool.

### Rules shipped (V1)

Pure function over `{nodes, edges}` → triaged list of findings.

- **`broken-node`** (critical) — any node with health `broken`.
- **`missing-node`** (warning) — health `missing`.
- **`stale-verification`** (info) — working node, last_verified_at
  > 30 days ago.
- **`never-verified`** (info) — working node, never verified.
- **`orphan-gtm`** (warning) — GTM container with zero outgoing
  edges.
- **`ga4-no-measurement`** (warning) — GA4 property with empty
  `measurementIds`.
- **`meta-pixel-no-capi`** (warning) — Meta pixel without a CAPI
  node on the same client. iOS 14.5+ revenue leak.
- **`no-ga4`** (critical) — client has tracking nodes but zero
  GA4 property / stream.
- **`empty-map`** (info) — client has no nodes on the map at all.

### Implementation

- `packages/tracking-map/src/audit.ts` — pure, isomorphic, no
  external deps. Output sorted deterministically by (severity,
  ruleId). `AUDIT_RULE_IDS` exported for future suppress-rule UX.
- Client detail page now fetches full node + edge rows (was only
  fetching node health). Runs `auditMap()` every render — cheap.
- `AuditPanel` renders findings grouped by severity with a
  coloured left border per severity, title + description +
  "Suggested fix", "View node →" deep-link when node-scoped
  (navigates to the tracking map with `?node=<id>` — map page
  doesn't respect that param yet, follow-up).
- Tab trigger shows a count badge for critical/warning findings
  (red/amber).
- Empty state congratulates rather than blanks.

### Intentional scope

- No scheduled / background runs. Live on every page render.
- No rule suppression UI yet. `AUDIT_RULE_IDS` is exported so
  we can add `workspaces.suppressed_audit_rules` when needed.
- V2 rules that need external APIs (GA4 live signal, Google
  Ads account status) deferred until those integrations land.
- Tracking map `?node=<id>` scroll-focus is a follow-up — the
  link lands on the map page, just doesn't auto-scroll yet.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Client detail header — stats strip + health badge

The client detail page landed straight into a bare `<h1>` with no
context: how many open tasks, how many unreplied messages, is the
tracking setup healthy? Fixed.

### What's new

Horizontal strip of stat chips under the client name, only for
non-archived clients:

- **Health badge** — same scoring + colour as `/clients` (reuses
  `computeClientHealth`). Tooltip lists the reasons; score shown
  inline as "At risk · 55" etc.
- **Open tasks** — with sub-tail "N overdue" in red when any are
  overdue.
- **Unreplied messages** — amber chip, only rendered when > 0.
  Uses the same inbound-newer-than-last-outbound definition as
  the inbox + the dashboard.
- **Tracking nodes** — total count with sub-tail showing broken +
  missing count when > 0 (red / amber based on severity).
- **Contacts** — with sub-tail "N with portal access" if any.

### Implementation

- Added a per-client tracking-node health query
  (`SELECT health_status WHERE client_id = ?`) to the existing
  `Promise.all`.
- Computes overdue / unreplied / node counts in JS from data
  already fetched on the page — no extra queries beyond the node
  one.
- Feeds a single `computeClientHealth` call; HEALTH_COLORS picks
  the badge tone.
- `StatChip` lives at the bottom of the same file — tight scope,
  no shared module needed yet.

### Noted follow-ups

- The chips aren't clickable yet. Making them jump to the right
  tab (e.g. unreplied chip → Messages tab, overdue chip → Tasks
  tab filtered) is a nice follow-up.
- Archived clients don't render the strip at all. They could
  instead show an "Archived — reason" chip; deferred.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Task deep-links (?task=&lt;id&gt;)

Tasks were previously only openable by clicking their row —
no way to share a link to a specific task. Fixed.

- **`TaskRow`** now reads `?task=<id>` from `useSearchParams` on
  mount; when the id matches its task, the detail dialog opens
  automatically. Closing the dialog clears the param via
  `router.replace` (history-neutral).
- **Command palette** task activation upgraded from
  `?q=<title>` to `?task=<id>`:
  - Workspace tasks → `/tasks?task=<id>`
  - Client-scoped tasks → `/clients/<clientId>?task=<id>` (lands
    on the richer client-detail context: approval, map, files,
    messages).
- Only clears the `task` param when the row that was deep-linked
  was the one closing — prevents stripping the param if a user
  opens + closes a different task's dialog manually.

### Dashboard widgets upgraded

- **Overdue** / **Due this week** / **Pending approval** cards
  on the dashboard now include `?task=<id>` in their row links,
  so clicking an item opens the task directly instead of just
  navigating to its client page. Unchanged visually — but the
  "click → see the thing" flow drops one click.

### Shareable URLs

- Paste a `/tasks?task=…` link in Slack/email and it opens the
  detail dialog for the recipient (assuming they have access).

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Bulk task actions

Real agency workflow unlock: weekly reviews, "mark all done",
"clear out done tasks from last quarter." Checkbox selection on
the workspace `/tasks` page + floating bottom action bar.

### Server

- **`bulkUpdateTasksAction`** (new) — accepts `{ workspaceId,
  taskIds[], action: { kind: 'status' | 'delete', ... } }`.
  Role-gated owner/admin/member, max 200 ids per call. No
  per-task analytics fan-out — treats a bulk op as one user-intent
  event. `parent_task_id` cascade means deleting parents drops
  subtasks too.

### UI

- **`TaskListWithSelection`** — client wrapper that replaces the
  direct Card + TaskRow rendering. Per-row checkbox on the left;
  indeterminate-aware "select all in group" checkbox in each
  status-group header. Selected rows get a subtle primary tint.
- **Floating action bar** when selection > 0:
  - "N selected"
  - Status dropdown (todo / in_progress / blocked / done)
  - Delete (confirm()-guarded)
  - ✕ to clear
- **Escape** clears selection (unless a dialog is open — palette
  or detail dialog take priority on the same key).

### Intentional scope

- Assignee / priority / department bulk not yet. Server schema
  extends trivially; UI would get cluttered. Ship on request.
- `/clients/[id]` tasks tab still uses the non-selection render —
  bulk actions only live on `/tasks` for V1.
- No undo. Delete is confirm()-gated; status is reversible.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Command palette (⌘K)

Global keyboard-driven navigation. Opens on ⌘K / Ctrl+K from
anywhere under the authenticated workspace layout. Biggest polish
feature — makes the app feel premium and unlocks multiple
navigation flows from a single shortcut.

### Sections

- **Shortcuts** — New client, Invite teammate (navigates to the
  pages that already host those forms).
- **Pages** — Overview, Clients, Tasks, Messages, Team, Billing,
  Settings.
- **Clients** — up to 100 recent active clients, lazy-fetched on
  first open.
- **Tasks** — up to 200 recent parent tasks (subtasks excluded).
  Clicking navigates to the client page or
  `/tasks?q=<title>` for unassigned ones.

### Interaction

- ↑↓ navigate across groups. ↵ activates. Esc closes.
- Substring filter on label + subtitle.
- Hover also moves the cursor so mouse + keyboard compose.
- Footer hint inside the dialog shows the bindings.

### Files

- `app/[workspace]/command-palette-actions.ts` — read-only
  `listCommandPaletteItemsAction`. Viewers allowed — the palette
  is navigation, not mutation.
- `components/command-palette.tsx` — the dialog. Lazy-fetches
  on first open, caches for subsequent opens.
- `components/command-palette-trigger.tsx` — sidebar
  "Search… ⌘K" button. Click dispatches a synthetic ⌘K keydown
  so the palette's internal open-state stays single-source.
- Mounted in `/[workspace]/layout.tsx`.

### Intentional scope

- No recents history, no fuzzy match. Plain substring.
- Task activation navigates with a prefilled search rather than
  auto-opening the detail dialog — upgrade when the tasks page
  learns a `?task=<id>` deep-link.
- No "Sign out" action (UserMenu still has it).

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Inbox: text search + "Needs reply" filter

The messages inbox had filter pills for direction/channel but no
text search and no way to answer "which conversations do I owe a
reply on?" — the single question an agency operator asks their
inbox every morning. Shipped both.

### Added

- **`?q=` text search** — subject + body (case-insensitive
  substring). Uses the shared `SearchInput` component from the
  clients/tasks pages so the pattern is identical across the app.
  Lives in the header next to the page title.
- **"Needs reply" filter pill** — `?needs_reply=1` shows only
  inbound messages (excluding internal notes) newer than the last
  outbound reply for the same client, capped at the last 60 days.
  Reuses the same "last outbound per client" logic as the
  dashboard's "Waiting on a reply" widget — one source of truth
  for what "unanswered" means.
- **Clear filters** link in the empty state when filters are
  active and nothing matches.
- **Filter-pill refactor** — each pill now uses a shared
  `hrefWith(key, value)` that toggles a single param while
  preserving the rest. Clicking an active pill clears it;
  clicking any filter preserves `q` (and vice versa).

### Intentional scope

- "Needs reply" only surfaces inbound messages — if an outbound
  was sent but never acknowledged, that's not the agency's
  problem to resolve.
- 60-day window is hardcoded. Add a per-workspace setting only
  when someone asks.
- No client filter yet — a user who wants to see one client's
  messages can click through to that client.
- No unread-state column. We don't have a `read_at` anywhere;
  "needs reply" is the behavioral stand-in.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Task subtasks (checklist inside the detail dialog)

The `tasks.parent_task_id` column has been in the schema since day
one (ARCHITECTURE.md §5.1), but the UI never exposed it. Shipped:
task rows can now have a checklist of subtasks, with one-level
nesting enforced server-side.

### Server

- **`createTaskAction`** extended with `parentTaskId?: string`. When
  set:
  - Fetches the parent row (same workspace, belt-and-braces against
    cross-tenant trickery).
  - Rejects if the parent itself has a parent — one level only.
  - Inherits `client_id` from the parent, ignoring whatever the
    caller passed.
- **`listSubtasksAction({ workspaceId, parentTaskId })`** — new.
  Returns `{ id, title, status }` sorted by createdAt. Viewers
  can read.
- **`toggleSubtaskAction({ workspaceId, subtaskId, done })`** —
  new. Single-purpose status flip (todo ↔ done). Separate from
  `updateTaskAction` to avoid analytics chaining / approval-state
  side effects for the high-frequency checkbox interaction.
- Parent-task `ON DELETE CASCADE` on `parent_task_id` means
  deleting a parent also deletes its subtasks.

### Top-level queries filtered

Every query that lists tasks at the top level now adds
`parent_task_id IS NULL`:
- Workspace `/tasks` page
- Client detail page tasks tab
- Portal page (clients never see subtasks)
- CSV export route
- Dashboard: openTaskCount, recentTasks, recentApprovals,
  overdueTasks, dueThisWeekTasks, pendingApprovalTasks,
  overdueTaskClientRows
- Clients list: overdue count for the health scorer

Otherwise a task with 5 subtasks would count as 6 open items.

### UI

- **`SubtaskList`** (new) — client component rendered in
  `TaskDetailDialog` above the comments section. Lazy-loads on
  first render, optimistic checkbox flips, inline "Add subtask"
  form, per-row delete icon on hover.
- **Progress pill on `TaskRow`** — when a task has subtasks, the
  row shows `2/5` (checklist icon + done/total). Turns green
  when all done. Hidden when a task has no subtasks.
- `TaskRowModel` extended with `subtaskStats?: { total, done }`.
  Both pages that build rows (`/tasks`, `/clients/[id]`) now
  fetch a parent_task_id rollup and attach stats per parent.

### Intentional scope

- Subtasks don't have their own priority / department / due date /
  assignee / visibility / approval state in the UI — they're
  checklist items, not mini-tasks. The underlying columns still
  exist (subtasks inherit the `tasks` table).
- Subtasks are excluded from the CSV export. If someone needs a
  flat report, follow-up.
- No reordering of subtasks yet. Add DnD when a user asks.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — "Clients needing attention" card on the dashboard

Makes the client-health scoring I shipped earlier discoverable on
the most-visited page. Reuses `computeClientHealth` directly, so
the numbers + weights on the dashboard line up exactly with the
/clients list.

### What it does

- New right-rail card that only renders when at least one non-
  archived client has a non-healthy health tier.
- Shows up to 5 entries, worst first (needs_attention beats at_risk;
  within a tier, lower score wins). Each row: coloured dot + client
  name + score + top 2 reasons.
- Click-through goes straight to the client detail page. Hover
  tooltip shows the full reason list.
- Footer link "See all clients →" for the user who wants to triage
  them all.

### Implementation

- Two new queries in the dashboard's `Promise.all`:
  - All overdue open tasks (client_id only) — for the per-client
    count the scorer wants.
  - All tracking-node (client_id, health_status) pairs — for the
    broken/missing-node counts.
- Expanded the existing clients query to include `archived_at` +
  `last_activity_at` (the scorer uses both).
- Per-client aggregation + `computeClientHealth` loop inline on the
  page. Output is sorted + truncated to top 5.
- `AttentionClientsCard` component lives at the bottom of
  `apps/app/app/[workspace]/page.tsx` alongside `OnboardingCard`
  and `AttentionCard` (the This-Week widget card).

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — CSV export for clients + tasks

Agencies live in spreadsheets. Not having export is table stakes
missing. Shipped one-click CSV download that respects the current
search/filter state, so "Export" always exports exactly what the
user is looking at.

### What's new

- **`apps/app/lib/csv.ts`** — minimal RFC 4180-ish serialiser.
  Handles commas/newlines/quotes, null→empty, Date→ISO 8601,
  booleans. Returns the CSV string + `csvResponseHeaders()` helper
  for the route handlers.
- **`GET /api/workspaces/[id]/clients/export`** — owner/admin/
  member only. Accepts `?q=` (substring across name/business_
  name/industry/website/email) and `?includeArchived=true`.
  Columns: id, name, business_*, website, industry, size, budget,
  target_cpa, notes, archived, archived_at, last_activity_at,
  created_at, updated_at. Omits JSONB blobs deliberately.
- **`GET /api/workspaces/[id]/tasks/export`** — same role gate.
  Mirrors the `/tasks` page's filter surface: `?q`, `?department`,
  `?status`, `?client`, `?assignee`. Columns: id, title, status,
  priority, department, visibility, approval_state, client (name),
  assignee (display label), due_date, completed_at, created_at,
  updated_at, description.
- **`apps/app/components/export-button.tsx`** — shared button.
  Inherits the current URL's query params so the export is
  filter-respecting by default. Extra params (e.g.
  `includeArchived=true` for clients) merge on top.

### Mounted in the UI

- Clients list header → "Export CSV" button next to Search +
  Add client. `includeArchived=true` is set via `extraParams`
  because the export makes more sense as "give me everything" by
  default.
- Tasks list header → "Export CSV" next to Search + New task.

### Noted follow-ups

- **No rate limiting yet.** If someone abuses the export endpoint
  we'll notice in Vercel logs; add an Upstash Redis counter then.
- **No UTF-8 BOM prefix.** Most spreadsheets handle UTF-8 fine,
  but Excel on Windows occasionally misreads. If a user reports
  mojibake, prepend `\uFEFF` to the CSV string.
- **No JSONB columns** (settings, geo_targeting, custom_fields).
  If an agency needs that, recommend Supabase SQL Editor — a
  cleaner channel than CSV for structured data.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Text search on clients + tasks lists

Real usability gap once a workspace has more than 20 rows.

- **`apps/app/components/search-input.tsx`** (new, shared). URL-
  param-backed (`?q=…`), 250 ms debounced, preserves other query
  params when writing. Uses `router.replace` (not push) so search
  typing doesn't pile up back-button history.
- **Tasks list** (`/tasks`): `q` filters task titles (case-
  insensitive substring). Live match count appears under the
  header. The search is one of the filter dimensions now, so
  "Reset all filters" clears it.
- **Clients list** (`/clients`): `q` matches on name,
  business_name, industry, website_url, and business_email.
  Includes archived clients in the search (they disappear from
  the default view but remain findable). Match count + a
  dedicated "no matches" empty state with a clear-search CTA.

### Performance note

Both pages filter in-memory over the rows already fetched for the
list. Fine while list sizes are small; when a workspace has
multiple thousand tasks this should move into a SQL `WHERE title
ILIKE '%…%'` (or a GIN `pg_trgm` index). The SearchInput is
URL-compatible either way, so the swap is local to the page.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Task assignee visible on rows + "Mine" filter

The assignee picker (shipped previously) was invisible on task rows
— you had to open the detail dialog to see who owned a task. Fixed:

### Task rows now show the assignee

- `TaskRowModel` extended with `assigneeLabel` (e.g. "Sarah",
  "You") and `assigneeIsSelf` (boolean). Both are derived
  server-side by the pages that build the rows so `TaskRow` stays
  purely presentational.
- Pill on each row: initial-circle avatar + name. Rows for tasks
  assigned to the current user get a primary tint; everyone else
  is neutral. Unassigned tasks show nothing (clean).
- Both call sites populate the fields: workspace `/tasks` page and
  the client detail page. A single assignee-label builder keeps
  the precedence (You → display_name → email → UUID prefix)
  consistent.

### "Mine" quick-filter pill

- Added next to the existing "All" pill on the `/tasks` filter
  bar. One-click jump to "tasks assigned to me."
- Clicking again toggles it off (same pattern as the other pills).
- Only renders if the current user has a `workspace_members` row —
  no-op for anonymous or phantom sessions.
- Bug fix along the way: the `/tasks` page used to fetch "the
  first member" as `currentMembership` — a placeholder that
  was unused but wrong. Replaced with a proper lookup in the
  already-fetched `memberRows`.

### New helper

- `hrefWithAssignee(assigneeId, ctx)` — sibling of the existing
  `hrefWith`. Builds a filter-toggle href that targets the
  assignee param specifically.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Onboarding checklist

Replaces the static "Getting started" card with a stateful 6-step
checklist derived from live DB presence probes. Critical for
first-user activation: a new workspace owner now has an obvious,
dopamine-paced path from "blank dashboard" to "product makes sense."

### Steps (in order — each builds on the previous)

1. **Add your first client** — gate to everything else.
2. **Add a contact for that client** — unlocks messages + portal.
3. **Create a task** — the core work surface.
4. **Map one client's tracking setup** — highlighted as "the Phloz moat."
5. **Send a client message** — kicks off the inbox loop.
6. **Invite a teammate** — intentionally last; solo owners should
   feel productive before collaborating.

### Implementation

- `apps/app/lib/onboarding-checklist.ts` — pure computation. Takes
  already-fetched booleans/counts, returns `{ steps, doneCount,
  nextStep, complete }`. No extra DB reads beyond the three
  presence probes wired into the dashboard's `Promise.all` below.
- Dashboard page adds three `LIMIT 1` probes for
  client_contacts / tracking_nodes / messages (cheap — one row max
  each). Existing count queries cover the other signals.
- `OnboardingCard` component renders:
  - Progress bar + `doneCount / totalCount` header
  - Each step as a row: checkmark (done) or empty circle (pending)
  - "Next up" row is highlighted (primary tint + arrow icon)
  - When complete, the dashboard stops rendering the card entirely
    — no stale congratulations widget forever.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Dashboard "This week" + client health scoring

First-login impression was a blank-ish dashboard with three vanity
counters. Now it opens with an actionable panel showing **what needs
attention this week**, and the clients list shows a quick visual
health signal per client. Both use only data that's already in the
DB — no external services, no new costs.

### Client health (`apps/app/lib/client-health.ts`)

Pure computation. 0–100 score, three tiers:
- **≥ 70 healthy** (green)
- **40–69 at_risk** (amber)
- **< 40 needs_attention** (red)

Weights (explainable to the user — the UI surfaces the reason list
as a tooltip):
- Inactivity: -10 at 7d, -30 at 30d, -60 at 60d
- Overdue tasks: -10 each up to -30
- Unreplied inbound messages: -5 each up to -20
- Broken tracking nodes: -5 each up to -20
- Missing tracking nodes: -3 each up to -12

Archived clients short-circuit to score 0. Callers render a dim dot
there to distinguish "archived" from "needs attention" visually.

### Dashboard "This week" widget (`apps/app/app/[workspace]/page.tsx`)

New panel above the existing count cards. Four attention cards:

1. **Overdue** (red) — open tasks with due_date < now. Top 3 titles
   + days overdue.
2. **Due this week** (amber) — open tasks with due_date in the next
   7 days. Top 3 with "today" / "tomorrow" / "in Nd".
3. **Pending client approval** (primary) — `approvalState='pending'`
   client-visible tasks. Top 3 with client name.
4. **Waiting on a reply** (purple) — per-client: oldest inbound
   message newer than the last outbound. Top 3 with "Nd waiting".

Cards glow with a subtle colored ring when count > 0, render a
muted "clear" state when count = 0. Each has a contextual "See
all tasks" / "Open inbox" CTA underneath.

### Clients list (`apps/app/app/[workspace]/clients/page.tsx`)

- Added per-client aggregation queries (overdue tasks, unreplied
  inbound, broken/missing nodes) that feed the scorer.
- Each row now shows:
  - A colored health dot (green/amber/red, or dim grey for
    archived).
  - A health badge with score (e.g. "At risk · 55") when the
    tier is not healthy. Hover tooltip lists the reasons.

### Performance note

Both pages fetch messages in full (last 60d inbound + all outbound
— excluding internal notes) and compute unreplied-inbound in JS
because the volume at launch is small. When this starts to bite
(probably around 10k+ messages per workspace), rewrite as a
correlated subquery or a materialized view.

`pnpm check` 29/29 green. Local build clean.

---

## 2026-04-24 — Error boundaries (launch blocker)

Code audit flagged one real issue: both apps had `not-found` only on
`apps/app` and no route-level / global error boundaries anywhere.
Unhandled exceptions would render the raw Next.js error overlay to
users in production.

Fixed:

- **`apps/app/app/error.tsx`** — route-level boundary. Catches
  errors in any segment below the root layout. Shows a friendly
  fallback with a `Try again` button (calls Next's `reset()`) +
  `Go home`. Captures to Sentry with tag `app_route_error` and
  the Next-supplied `digest` in `extra`.
- **`apps/app/app/global-error.tsx`** — last-resort boundary.
  Replaces the root layout when an error escapes `error.tsx` or
  fires from the layout itself. Renders its own `<html>` + `<body>`
  with inline styles — no `@phloz/ui` imports, since those could
  be the thing that crashed.
- **`apps/web/app/not-found.tsx`** — marketing-site 404 with
  deep links to Home / Pricing / Blog. `noindex` metadata.
- **`apps/web/app/error.tsx`** — same pattern as apps/app.
  Sentry tag `web_route_error`.
- **`apps/web/app/global-error.tsx`** — same pattern as apps/app.
  Sentry tag `web_global_error`.

Sentry was already configured with graceful no-op when DSN is
unset, so these boundaries are harmless in dev without
`SENTRY_DSN`.

`pnpm check` 29/29 green. Both apps build clean locally.

---

## 2026-04-24 — Newsletter signup

Closes the last entry in the analytics event catalog and ships a
real email-capture feature on the marketing site.

### Schema

- **`newsletter_subscribers`** table — `email` (unique), `source`,
  `subscribed_at`, `unsubscribed_at`, `metadata` JSONB. Not
  tenant-scoped (cross-workspace audience). RLS enabled with **no
  policies** so anon/authenticated roles can't touch the table —
  only service-role (which bypasses RLS) can write.
- Migration `0002_glamorous_susan_delgado.sql` (generated by
  drizzle-kit, extended with the `ENABLE ROW LEVEL SECURITY`
  statement).

### API

- **`POST /api/newsletter/subscribe`** on `apps/app` (same place
  as other DB-touching routes). Accepts `{ email, source }`, does
  an idempotent `ON CONFLICT DO NOTHING` insert, fires
  `newsletter_signup` with the provided `source` tag. distinctId
  is the SHA-256 hash of the lowercased email so re-submissions
  don't create a new PostHog identity.
- CORS-aware: `OPTIONS` handler + origin allow-list
  (`phloz.com`, `www.phloz.com`, localhost, and whatever
  `NEXT_PUBLIC_MARKETING_URL` is). Marketing form POSTs
  cross-origin directly.

### UI

- **`apps/web/components/newsletter-form.tsx`** — client component.
  Email input + submit button + inline success/error states
  (no toast lib import, keeps the marketing bundle lean). Two
  variants: `default` (stacked on mobile / inline on sm+) and
  `compact` (always inline, smaller). Each form instance gets a
  required `source` prop that feeds both the DB row + analytics
  event.
- **Mounted** on:
  - Homepage bottom (new `<section>` below the existing CTA),
    `source="homepage_bottom"`.
  - Blog post footer (aside below the article body),
    `source="blog_<category>"`.

### Noted follow-ups (intentional scope)

- Proper **unsubscribe** via signed-token link is deferred. For
  now, `unsubscribed_at` is only settable by service-role —
  users email Ramtin and he flips the flag. A V1 iteration is a
  tokened `/unsubscribe` page.
- **Resend audiences** integration — add a handler that syncs new
  subscribers into a Resend audience for broadcasts. Trivial
  once we want to send a newsletter.
- **Double opt-in** (confirm-email link before marking
  subscribed) — GDPR-belt-and-braces but not required under
  North-American consumer-soft-opt-in. Add before EU launch.

### Files touched

- `packages/db/src/schema/newsletter-subscribers.ts` (new)
- `packages/db/src/schema/index.ts`
- `packages/db/migrations/0002_glamorous_susan_delgado.sql` (new)
- `packages/db/migrations/meta/{_journal,0002_snapshot}.json`
- `apps/app/app/api/newsletter/subscribe/route.ts` (new)
- `apps/web/components/newsletter-form.tsx` (new)
- `apps/web/app/page.tsx`
- `apps/web/app/blog/[slug]/page.tsx`

**⚠ Ramtin — one SQL migration to apply**: paste
`packages/db/migrations/0002_glamorous_susan_delgado.sql` into
the Supabase SQL editor (or run
`pnpm --filter @phloz/db db:migrate` with a service-role
`DATABASE_URL`). Until that runs, the subscribe endpoint will
500 with a missing-table error.

`pnpm check` 29/29 green. Both apps build clean locally.

---

## 2026-04-24 — Portal + client/workspace edit analytics

Closes the remaining analytics gaps. The full event catalog from
ARCHITECTURE.md §11.2 is now wired where it has a natural home —
only `newsletter_signup` and `page_view` (handled by GA4/PH
automatically) remain on the not-wired list, both justifiably so.

### Portal events

- **`portal_link_sent`** — `generatePortalLinkAction` in
  `apps/app/app/[workspace]/clients/[clientId]/contacts/actions.ts`.
  Fires only when the agency actually emailed the link via Resend
  (`emailed === true`). Copy-to-clipboard and silent email-send
  failures don't count — the event measures outreach that reached
  the inbox.
- **`portal_accessed`** — `apps/app/app/portal/[token]/layout.tsx`.
  Fires exactly once per magic-link consumption (the first render
  after the link is clicked). Subsequent portal navigations
  within the 7-day window don't re-fire. distinctId is the hashed
  `client_contact_id` (portal users aren't in `auth.users`; they
  live in a separate PostHog identity namespace, tagged with
  `workspace_id` for segmentation).
  - Needed `validatePortalMagicLink` to expose whether this is
    the first use. `packages/auth/src/portal.ts` now returns
    `{ ...link, firstUse: boolean }` where `firstUse` captures
    whether `lastUsedAt` was `null` before the touch. Existing
    callers are backwards-compatible.

### Message events

- **`message_received` (channel: email)** — Resend inbound webhook
  at `apps/app/app/api/webhooks/resend/inbound/route.ts`. distinctId
  is the workspace owner (same pattern as the Stripe webhook —
  no user session to attribute to). fireTrack no-ops if the owner
  row is missing.
- **`message_received` (channel: portal)** — `sendPortalReplyAction`
  in `apps/app/app/portal/[token]/actions.ts`. distinctId is the
  hashed `client_contact_id` — the portal user is the actor.

### Edit events

- **`client_updated`** — `updateClientAction`. Emits one event per
  changed field (notes, name, business_name, business_email,
  business_phone, website_url, industry) with a snake_case
  `field_changed`. PostHog can then show which fields agencies
  edit most often.
- **`workspace_settings_updated`** — PATCH
  `/api/workspaces/[workspaceId]`. Emits one event per changed
  setting (name, description, website_url, timezone).

### Files touched

- `packages/auth/src/portal.ts` (firstUse flag)
- `apps/app/app/[workspace]/clients/[clientId]/contacts/actions.ts`
- `apps/app/app/portal/[token]/layout.tsx`
- `apps/app/app/portal/[token]/actions.ts`
- `apps/app/app/api/webhooks/resend/inbound/route.ts`
- `apps/app/app/[workspace]/clients/[clientId]/update-actions.ts`
- `apps/app/app/api/workspaces/[workspaceId]/route.ts`

`pnpm check` 29/29 green. Both apps build clean locally.

---

## 2026-04-24 — Marketing site analytics + @phloz/analytics server split

### @phloz/analytics server/client split (Vercel build fix)

Commit `0aeb3d0` broke the Vercel build with Turbopack error
`"the chunking context (unknown) does not support external modules
(request: node:fs)"`. Root cause: the main `@phloz/analytics`
barrel re-exported server-only helpers that statically imported
`posthog-node` → `node:fs`. A client component doing
`import { track } from '@phloz/analytics'` pulled the whole module
graph, Node built-ins included.

Two fixes:
1. `track.ts` now lazy-loads server modules via `await import()`
   inside the `!isBrowser()` branch. Client bundles never include
   `posthog-node`.
2. The main barrel is now **client-safe only**. Server helpers
   (`hashAuthUidServer`, `captureServer`, `sendGa4ServerEvent`,
   `isPostHogServerConfigured`, `isGa4ServerConfigured`,
   `shutdownPostHogServer`) moved to a new
   `@phloz/analytics/server` subpath. Callers that need them
   (`apps/app/lib/analytics.ts`, `apps/app/app/onboarding/actions.ts`)
   updated.

Local `pnpm --filter @phloz/app build` now succeeds end-to-end. Shipped
in `3f4bd29`.

### Marketing site analytics (apps/web)

All five marketing events from ARCHITECTURE.md §11.2 wired up.

- **`TrackOnMount`** (`apps/web/components/analytics/track-on-mount.tsx`).
  Client component. Fires a single `track()` call when it mounts;
  double-fire guarded via a ref sentinel (survives React Strict
  Mode). Used on server-rendered pages that want to emit a
  one-shot view event.
- **`TrackedCtaLink`** (`apps/web/components/analytics/tracked-cta-link.tsx`).
  Drop-in replacement for `next/link` `<Link>`. Fires `cta_click`
  with `{cta_location, cta_label, destination}` then lets the
  native navigation proceed. Keeps the event taxonomy consistent
  across the site.

**Events wired:**

- `blog_post_view` — `apps/web/app/blog/[slug]/page.tsx` mounts
  `TrackOnMount` with `{post_slug, post_category}`.
- `compare_page_view` — `apps/web/app/compare/[competitor]/page.tsx`
  mounts `TrackOnMount` with `{competitor}`. Bottom CTA
  ("Try Phloz free") also swapped to `TrackedCtaLink` with
  per-competitor location label.
- `pricing_page_view_tier` + `cta_click` — new
  `apps/web/app/pricing/tier-cta.tsx` client component. On click
  it fires `pricing_page_view_tier` with the tier slug plus
  `cta_click` with a tier-specific label. We fire on click (not
  mount) because mounting the pricing page would emit N events
  per pageview which is noise; click = real engagement.
- `cta_click` (homepage hero × 2) — "Start free — no credit card"
  and "See every feature", location `homepage_hero`.
- `cta_click` (homepage bottom × 2) — "Start your free trial"
  and "View pricing →", location `homepage_bottom`.
- `cta_click` (site header × 2) — "Sign in" and "Start free",
  location `site_header`. Appears on every marketing page.
- `cta_click` (compare bottom) — "Try Phloz free", location
  `compare_{competitor}_bottom`.

**Not wired (newsletter_signup):** no newsletter form exists yet.
Deferred until there's a form to instrument.

### Files touched

- `packages/analytics/src/{index,track,server}.ts` + `package.json`
- `apps/app/lib/analytics.ts`, `apps/app/app/onboarding/actions.ts`
- `apps/web/components/analytics/{track-on-mount,tracked-cta-link}.tsx` (new)
- `apps/web/app/pricing/tier-cta.tsx` (new)
- `apps/web/app/{page,blog/[slug]/page,compare/[competitor]/page,pricing/page}.tsx`
- `apps/web/components/site-header.tsx`

`pnpm check` 29/29 green. `pnpm --filter @phloz/app build` +
`pnpm --filter @phloz/web build` both clean locally.

---

## 2026-04-24 — Billing + map analytics + ownership transfer

### Stripe webhook analytics

Previously the webhook updated `workspaces.tier` silently; now it
fetches the prior tier + owner, then emits the right event when the
tier changes. All events run through `fireTrack` — PostHog/GA4 outage
can't fail webhook reconciliation.

- `upgrade_tier` — fires when a subscription created/updated event
  moves the workspace to a higher tier. Includes `from_tier`,
  `to_tier`, `billing_period` (derived from
  `sub.items[0].price.recurring.interval`), and `value` (USD
  cents from `TIERS[tier].{monthly,annual}PriceUsd`).
- `downgrade_tier` — same event, opposite direction.
- `subscription_canceled` — fires on
  `customer.subscription.deleted` with `from_tier` + Stripe's
  `cancellation_details.reason`.
- `payment_failed` — fires on `invoice.payment_failed` with the
  current tier.

Ownership attribution: the webhook has no user session, so events use
`workspaces.owner_user_id` as the distinctId. No-op if the owner row
is missing.

### Tracking-map analytics (full coverage)

- `node_updated` — `updateNodeAction`. Position-only updates
  (drag autosave → debounced) are excluded from the event via a
  `pickPrimaryField` helper; otherwise PostHog would get flooded
  with one event per pixel moved.
- `node_health_changed` — fires on top of `node_updated` when the
  health status actually transitioned, with old/new status.
- `node_deleted` — `deleteNodeAction` now reads `nodeType` before
  the delete so the event can carry it.
- `edge_created` — `createEdgeAction` now pulls `nodeType` from
  both endpoints in the existing validation query (no extra
  roundtrip), lets the event carry `source_type` + `target_type`.
- `edge_deleted` — `deleteEdgeAction`.
- `map_layout_arranged` — new `onLayoutArranged` callback prop
  on `TrackingMapCanvas`. The consumer (`map-client.tsx`) fires
  `track('map_layout_arranged', {})`. Kept as a callback so the
  `@phloz/tracking-map` package stays decoupled from
  `@phloz/analytics`.

### Team events

- `member_role_changed` — `changeMemberRoleAction`.
- `member_removed` — `removeMemberAction`.

### Ownership transfer

Previously blocked in `changeMemberRoleAction` with a "not supported
yet" error. Now fully shipped.

- **`transferOwnershipAction`** (new, in `team/actions.ts`). Runs
  inside a Drizzle transaction so the workspace is never left
  owner-less:
  1. Demote current owner to `admin`
  2. Promote target member to `owner`
  3. Update `workspaces.owner_user_id`
  4. Insert `audit_log` row with action `ownership_transferred`
     and `{from_user_id, to_user_id, ...}` metadata
- **Guards**:
  - `requireOwner(workspaceId)` — only the current owner can
    initiate.
  - Confirmation phrase must equal `"TRANSFER"` (case-sensitive).
  - Target must be a non-owner member.
- **`TransferOwnershipDialog`** (new component). Typed-confirmation
  modal — button stays disabled until the user types `TRANSFER`.
  Shown via a "Transfer ownership…" item in the member row's
  dropdown (visible only to the current owner, never on self).
- **`changeMemberRoleAction`** error message updated to route users
  to the new flow when they pick "owner" from the radio group.
- Emits two `member_role_changed` events (old-owner → admin,
  target → owner). No new event added to the taxonomy — the audit
  log is the authoritative record of the transfer semantics.

### Files touched

- `apps/app/app/api/webhooks/stripe/route.ts`
- `apps/app/app/[workspace]/clients/[clientId]/map/actions.ts`
- `apps/app/app/[workspace]/clients/[clientId]/map/map-client.tsx`
- `packages/tracking-map/src/canvas/index.tsx` (new `onLayoutArranged` prop)
- `apps/app/app/[workspace]/team/actions.ts` (transferOwnershipAction, analytics)
- `apps/app/app/[workspace]/team/transfer-ownership-dialog.tsx` (new)
- `apps/app/app/[workspace]/team/member-row.tsx`

`pnpm check` 29/29 green.

---

## 2026-04-24 — Analytics track() wiring across product actions

### Plumbing

1. **`apps/app/lib/analytics.ts`** (new). Two helpers:
   - `serverTrackContext(userId, workspaceId?)` — builds the
     `TrackContext` with hashed auth uid + workspace id tag.
   - `fireTrack(event, params, context)` — fire-and-forget server
     wrapper around `track()`. Errors are logged + swallowed so
     PostHog / GA4 hiccups can't fail a client create or a task
     save.
2. **PostHog provider refactor.** Previously imported `posthog-js`
   directly and called `posthog.init` / `posthog.capture` — a
   violation of the golden rule in CLAUDE.md §2. Now uses
   `initClientPostHog` + `captureClient` from `@phloz/analytics`.
3. **`components/analytics-identify.tsx`** (new). Client component
   mounted inside the authed workspace layout. Hashes the user id
   via SubtleCrypto and calls `identifyClient` so PostHog sessions
   are attributed to the user (with `tier` + `role` + `workspace_id`
   traits) from the first event onward.

### Events wired (ARCHITECTURE.md §11.2)

Client-side (forms fire `track()` directly):
- `sign_up` (method: email) — signup-form success
- `login` (method: email) — login-form password success
- `login` (method: magic_link) — auth callback on successful session
  exchange (skipped on signup-confirmation + password-reset flows
  to avoid double-firing)
- `password_reset_requested` — forgot-password form submit
- `logout` — user menu, fires before PostHog reset + Supabase signOut
- `begin_checkout` — billing-actions "Upgrade" button, fires before
  the redirect to Stripe so the event lands even if the user
  abandons on Stripe's hosted page

Server-side (`fireTrack` through server actions):
- `workspace_created` — onboarding action (workspace_id_hash
  included)
- `member_invited` — team invitations API route
- `member_accepted_invite` — accept-invite page (only on the first
  acceptance, not on re-clicks of an already-used link)
- `client_created` — clients POST route
- `client_archived` / `client_unarchived` — archive actions
- `gate_hit` (gate: client_limit) — clients POST route when
  `canAddClient` denies, so PostHog funnels can measure ceiling
  pain vs. successful adds
- `task_created` — with has_due_date + has_assignee booleans
- `task_status_changed` — fires on any status transition; fetches
  prior status first so `from_status` is accurate
- `task_completed` — with `time_to_complete_hours` rounded to 1
  decimal
- `task_assigned` — fires when the update payload includes a
  non-null `assigneeMembershipId`
- `node_created` — tracking-map createNodeAction, with node_type
- `message_sent` (channel: email) — sendEmailReplyAction
- `message_sent` (channel: internal_note) — postInternalNoteAction

### Not wired yet (deferred)

- `upgrade_tier` — lives in the Stripe webhook handler, needs the
  prior/next tier + MRR calculation. Next session.
- `client_updated` / `workspace_settings_updated` — many edit paths
  spread across page-specific components; worth a dedicated pass.
- `node_updated` / `node_deleted` / `edge_created` / `edge_deleted`
  / `map_layout_arranged` — dedicated tracking-map pass.
- `portal_accessed` / `portal_link_sent` / `message_received` —
  need care around portal vs. agency identity.
- Marketing site events (cta_click, pricing_page_view_tier, etc.)
  — separate pass, different app.

### Files touched

- `apps/app/lib/analytics.ts` (new)
- `apps/app/components/{posthog-provider,analytics-identify}.tsx`
- `apps/app/app/[workspace]/layout.tsx`
- `apps/app/app/(auth)/{signup/signup-form,login/login-form,forgot-password/forgot-password-form}.tsx`
- `apps/app/app/auth/callback/route.ts`
- `apps/app/components/user-menu.tsx`
- `apps/app/app/onboarding/actions.ts`
- `apps/app/app/accept-invite/page.tsx`
- `apps/app/app/api/workspaces/[workspaceId]/invitations/route.ts`
- `apps/app/app/api/workspaces/[workspaceId]/clients/route.ts`
- `apps/app/app/[workspace]/clients/[clientId]/archive-actions.ts`
- `apps/app/app/[workspace]/clients/[clientId]/map/actions.ts`
- `apps/app/app/[workspace]/tasks/actions.ts`
- `apps/app/app/[workspace]/messages/actions.ts`
- `apps/app/app/[workspace]/billing/billing-actions.tsx`

**When it starts working:** events dispatch as soon as the env
vars are set:
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` →
  browser-side PostHog + pageviews + identify
- `POSTHOG_API_KEY` → server-side PostHog (node SDK)
- `GA4_MEASUREMENT_ID` + `GA4_API_SECRET` → server-side `sign_up` +
  `upgrade_tier` via the Measurement Protocol
- `NEXT_PUBLIC_GTM_ID` → client-side GTM on the marketing site
Without any of these set, `track()` is a no-op — zero network
calls, no errors.

`pnpm check` 29/29 green.

---

## 2026-04-24 — Member display names + task assignee picker

### Schema

1. **`workspace_members.display_name` + `workspace_members.email`** —
   cached identity columns so the Team page + task assignee picker
   don't have to show UUID prefixes (or cross-schema-join against
   `auth.users` on every read).
   - New migration `0001_loving_marauders.sql`. Written idempotently
     with `ADD COLUMN IF NOT EXISTS` because the live DB has been
     receiving schema changes via `db:push` ahead of the migration
     file — the 0001 also formalises that drift (description /
     website_url / timezone on workspaces, last_activity_at on
     clients, client_visible on client_assets, approval_* on tasks).
   - Backfill stanza at the bottom reads `auth.users.raw_user_meta_data`
     and `auth.users.email` with `COALESCE` so re-runs are safe.

### Write paths

2. **Identity cached at insert time.** `apps/app/app/onboarding/
   actions.ts`, `apps/app/app/accept-invite/page.tsx`, and the
   `packages/db/src/seed/index.ts` owner-row insert now populate
   `display_name` + `email` from the signed-in user's Supabase metadata.
3. **Profile sync.** `apps/app/app/[workspace]/settings/profile-actions.ts`
   updates `auth.users.user_metadata.full_name` **and** fans the new
   name out to `workspace_members.display_name` for every workspace
   the user belongs to. Fan-out is best-effort (logs + continues if
   it fails) because the sidebar user-menu label is the primary
   signal.

### Read paths

4. **Team page renders real names.** `apps/app/app/[workspace]/team/
   page.tsx` + `member-row.tsx` use precedence
   `display_name → email → UUID prefix`, plus a secondary email line
   when the label is a name.
5. **Tasks `memberOptions` carry names.** Workspace `/tasks` and
   `/clients/[clientId]` pages build `{ id, label }` options with the
   same precedence, sorted so "You" is first then alphabetical.

### Task assignee picker

6. **`NewTaskDialog`** — new optional `members` prop. When present,
   renders an Assignee Select (defaults to Unassigned) next to the due
   date. Schema + submit wire `assigneeMembershipId` through to
   `createTaskAction` (which already accepted it).
7. **`TaskDetailDialog`** — new optional `members` prop. Edit-mode now
   shows an Assignee Select seeded from `task.assigneeMembershipId`.
   The update payload only includes `assigneeMembershipId` when the
   picker was actually rendered, so callers that don't pass members
   don't null out assignees on save.
8. **`TaskRowModel` gains `assigneeMembershipId`** so detail-dialog
   edit mode can show the current assignee.
9. **Client detail page** now fetches `workspaceMembers` in the main
   `Promise.all` and threads `memberOptions` through
   `NewTaskDialog` + each `TaskRow`.

### Files touched

- `packages/db/src/schema/workspace-members.ts`
- `packages/db/migrations/0001_loving_marauders.sql` (new)
- `packages/db/migrations/meta/{_journal,0001_snapshot}.json`
- `packages/db/src/seed/index.ts`
- `apps/app/app/accept-invite/page.tsx`
- `apps/app/app/onboarding/actions.ts`
- `apps/app/app/[workspace]/settings/profile-actions.ts`
- `apps/app/app/[workspace]/team/{page,member-row}.tsx`
- `apps/app/app/[workspace]/tasks/{page,new-task-dialog,task-detail-dialog,task-row}.tsx`
- `apps/app/app/[workspace]/clients/[clientId]/page.tsx`

`pnpm check` 29/29 green.

---

## 2026-04-23 — Invite refresh + DNS fix + task-client bug + rich settings

### Fixes

1. **Pending invitation appears in real-time.** InviteMemberCard
   called `form.reset()` but never `router.refresh()` — the new
   pending row only showed after a manual reload. Added the refresh.
2. **Accept-invite + portal links no longer dead-end at
   `app.phloz.com`.** Every URL-building site hardcoded
   `NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com'`. When the env var
   wasn't set, emails embedded a domain that isn't DNS-wired yet.
   New `lib/app-url.ts` helper exposes `getAppUrl()` (server actions,
   via `headers()`) and `getAppUrlFromRequest(request)` (route
   handlers) — prefers the env var, falls back to the request host +
   `x-forwarded-proto`. Wired through invitations route, contacts
   portal-link action, portal-approval notifications, Stripe
   checkout / billing-portal return URLs. Vercel preview URLs work
   out of the box.
3. **Tasks created from /tasks attach to the selected client.** The
   NewTaskDialog tracked `selectedClientId` in a loose `useState`
   next to react-hook-form state — stale-state window on submit.
   Moved it into the form schema as a `clientId` field with a
   proper `FormField` controller and explicit reset.

### Settings expanded

- **Your profile** section — editable Name (writes to
  `auth.users.user_metadata.full_name` via Supabase `updateUser`) +
  read-only Email. New `updateUserProfileAction`.
- **Agency / Workspace** section — Name, Description (up to
  1,000 chars), Website URL, Timezone (IANA). Three new nullable
  columns on `workspaces` (`description`, `website_url`, `timezone`)
  via the `workspaces_description` migration. PATCH endpoint
  accepts all four.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Node-create bug + client edit + task filters + team mgmt

### Fix: tracking-map "Add node" blew up with Zod errors

`createNodeAction` was running the full descriptor schema against
`descriptor.defaults()`, which by design contains empty placeholder
fields (e.g. GA4 data stream's `streamId: ''`, `measurementId: ''`).
The user filling those in via the drawer is the whole point. Dropped
the create-path validation — defaults come from trusted code, strict
validation still runs on save via `updateNodeAction`.

### Editable client details

Previously only notes were editable. Added `ClientOverviewForm`:
- Read mode renders a two-column `<dl>` of name / business name /
  email (mailto link) / phone / website (https link) / industry.
  Em-dash placeholders for empty fields.
- Edit button flips the card into a react-hook-form that submits
  all fields via the generic `updateClientAction`, then
  `router.refresh()`es so the page header name updates too.
- Sits above Notes on the Overview tab.

### Tasks page — client filter, assignee filter, sort dropdown

On top of the existing department + status pills:
- **Client filter** — All clients / Unassigned / each client by name.
- **Assignee filter** — Anyone / Unassigned / each workspace member
  ("You" for the current user, short uuid + role for teammates
  until Supabase Admin-API name lookup lands).
- **Sort dropdown** — Priority (default, high→low with due-date
  tiebreaker), Due soonest / latest, Recently updated / created.
- Active filters render as X-able chips with a Clear all link.
- All URL-backed so views are shareable and refresh-safe.

### Team management

`/[workspace]/team` previously could invite but couldn't:
- **`changeMemberRoleAction`** — owner/admin only. Can't demote
  yourself, can't promote to owner (ownership transfer is V2),
  non-owners can't demote an owner.
- **`removeMemberAction`** — same guards, deletes the
  `workspace_members` row (Supabase auth.users untouched).
- **`revokeInvitationAction`** — deletes a pending row so email
  typos can be corrected.
- New `MemberRow` client component exposes a `⋯` dropdown with a
  role radio group and a red Remove item; only shown when the row
  is manageable (not self, not owner unless viewer is owner).
- New `InvitationRow` with an ✕ revoke button.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Task comments + task edit dialog

### Task comments

The `comments` table + RLS shipped with Phase 1 but had no UI —
threads were invisible. Now every task row opens a detail dialog
with an inline comments thread.

Server actions (`comments-actions.ts`):
- `listCommentsAction` — all four roles can read. Batched author
  lookups (member → "You" / "Teammate", contact →
  `client_contacts.name`). Computes `canDelete` per row (author or
  owner/admin).
- `createCommentAction` — owner/admin/member only. Inserts with
  `authorType=member`, `authorId=workspace_members.id`, and an
  optional `visibility=client_visible` flag.
- `deleteCommentAction` — comment author OR owner/admin.

UI (`task-detail-dialog.tsx`):
- Lazy-loads comments on open so the task list query stays cheap.
- Each bubble shows author + relative timestamp + delete button
  (author / admin only). Client-visible comments get a primary-
  tinted bubble + badge.
- Compose textarea with an inline "Client-visible (shown on the
  portal)" checkbox. Optimistic append on post.

### Task edit from the detail dialog

Pencil button in the dialog header flips it into edit mode with
fields for title, description, priority, department, visibility,
and due date. Save dispatches the existing `updateTaskAction` (no
new server plumbing), exits edit mode, `router.refresh()`es so the
outer list updates. Edit state resets from the latest `task` prop
on every open.

Task rows' titles are now buttons that open the dialog — shared
between workspace-wide and per-client surfaces via the existing
`TaskRow` component, so both surfaces get comments + edit for free.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Three production fixes + editable notes + activity feed

### Three production-QA fixes

1. **Sentry: `/favicon.ico` crashed `/[workspace]`**. Browsers
   requesting the favicon matched the dynamic workspace segment
   and fed `"favicon.ico"` to Supabase as a UUID. Layout now
   guards with a strict RFC-4122 regex and calls `notFound()`
   before hitting the DB. Added a real favicon via Next's
   `icon.tsx` convention (edge `ImageResponse` renders a 32×32
   "P" on the primary accent; works in both apps, no binary asset).
2. **Buttons rendered as plain text**. Tailwind v4 auto-detects
   content from the project's own files but doesn't follow
   workspace imports into `packages/*`. Added `@source` directives
   to both apps' `globals.css` so Tailwind scans `@phloz/ui` and
   `@phloz/tracking-map` — Button / Badge / Card / Sheet / Dialog
   styles now make it into the bundle.
3. **Supabase auth emails came from `noreply@mail.app.supabase.io`**.
   Documented the two-minute SMTP config in `docs/DEPLOYMENT.md`
   Step 6 (Resend as the custom SMTP provider in Supabase
   dashboard). No code change — one-time dashboard setting.

### Editable client notes

- Generic `updateClientAction` server action accepts an optional
  subset of { name, businessName, businessEmail, businessPhone,
  websiteUrl, industry, notes } and PATCH-updates only the fields
  passed.
- `ClientNotesEditor` — inline read-only view with a Pencil button
  that swaps to a textarea. Save / Cancel, toast on success.
  Replaces the static "No notes yet." block on the Overview tab.

### Activity feed on workspace overview

Replaced the right-rail two-card grid with:
- **Recent activity** (2/3 width): merges tasks (new + completed),
  messages (inbound / outbound / internal notes / portal), file
  uploads, and approval outcomes into a chronological stream with
  icons + colour-coded badges. Each row deep-links to the client.
  Approval comments show inline.
- Right rail keeps Getting-started + Your-plan cards.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (both apps) — compile cleanly.

---

## 2026-04-23 — Shared portal files + approval email notifications

### Shared files on the portal

- DB: new `client_assets.client_visible boolean default false` with a
  partial index on `= true`. Agency opts each asset in explicitly —
  nothing leaks by default. Migration `client_assets_client_visible`
  applied via MCP.
- Agency Files tab — per-row Eye / EyeOff toggle
  (`toggleAssetClientVisibleAction`) + "Shared with client" badge.
- Portal signed-URL action (`getPortalAssetSignedUrlAction`) —
  validates magic-link token, confirms `client_visible=true`, uses
  the service-role Supabase client to mint a 5-minute URL (portal
  users have no Supabase session, so the cookie client can't read
  storage).
- `PortalFiles` component — read-only list with type-icons +
  Download buttons. Portal page Promise.all loads
  `client_assets WHERE client_visible = true` and renders a
  "Shared files" section below Conversations.

### Approval email notifications

`setClientApprovalAction` gained a fire-and-forget
`notifyAgencyOfApproval` step: looks up the workspace owner's
email via service-role admin, composes a plain-text email
(`[{Agency}] {Client} approved|rejected|asked for changes on
"{task title}"`), sends via `sendPlainEmail` with
`category=portal_approval` + state tags. Failures are logged but
don't block the approval. No-ops when Resend isn't configured or
the owner has no email.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Client-bundle env fix + task templates

### Client-side env fix

`createBrowserSupabase()` was calling
`requireEnv('NEXT_PUBLIC_SUPABASE_URL')` — works on the server,
throws on the browser. Next.js only inlines `NEXT_PUBLIC_*` env
vars when they're referenced as `process.env.LITERAL_NAME` in
source; dynamic reads through a helper lose them. Clicking "Sign
in" / "Create account" hit the bug.

Fix: `packages/auth/src/client.ts` reads
`process.env.NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY` directly as
literals. Inline comment explains why. Error message now tells you
to set the var *and* restart `next dev` — Next inlines at build,
not at request time.

### Task templates

Five built-in templates for workflows agencies repeat:
- **New campaign launch** (PPC) — 6 tasks, media plan → post-launch.
- **Monthly client report** (reporting) — 4 tasks.
- **Tracking infrastructure audit** (onboarding) — 4 tasks.
- **SEO onboarding** — 4 tasks.
- **Social content — one month** — 5 tasks with approval gate.

Each item carries title / description / priority / department /
visibility / `dueInDays` (relative to apply time). Templates in
code at `apps/app/app/[workspace]/tasks/templates.ts` — zero admin
UI, changes ship via PR. Per-workspace customisation is V2.

- `applyTaskTemplateAction` — role-gated, batch-inserts with
  `dueDate = now + dueInDays * day`. Revalidates /tasks + client
  detail.
- `ApplyTemplateButton` dropdown on the client Tasks tab next to
  "New task". Grouped by category with name + summary + task count.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Contacts + portal link generator + archive

### Contacts tab on the client detail page

Previously `client_contacts` and `portal_magic_links` had schema +
helpers but no UI — which is why `portal_magic_links` stayed empty
in normal use. New **Contacts** tab closes that gap.

- Server actions (`contacts/actions.ts`):
  - `createContactAction`, `togglePortalAccessAction`,
    `deleteContactAction` — role-gated, Zod-validated.
  - `generatePortalLinkAction` — calls `generatePortalMagicLink()`,
    builds the full `/portal/<token>` URL. With `sendEmail=true` +
    a contact email, also calls `sendPortalMagicLink` via Resend.
    Graceful fallback: if Resend isn't configured (dev), still
    returns the URL so the agency can copy + paste.
- `ContactsPanel` client component — new-contact dialog (name,
  email, phone, role, portal-access toggle). Per-row actions:
  Grant/Revoke portal access, Email link, Copy link, Remove.
- Client detail page loads contacts alongside other tab data;
  "Contacts" tab trigger sits between Overview and Tasks.

### Archive / unarchive clients

- `archiveClientAction` — flips `archivedAt` to now + optional
  reason; revalidates list + detail + overview.
- `unarchiveClientAction` — delegates to
  `@phloz/billing.canUnarchiveClient` which enforces the tier cap
  and the unarchive throttle.
- `ArchiveButton` — dialog with optional-reason input when
  archiving, direct action when unarchiving. Mounted in the client
  detail header next to the Archived badge.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Proxy fix + reply-from-portal + client status

### Proxy runtime fix

Next 16's edge proxy rejects any non-`Response` return. The app's
`proxy.ts` was returning `updateSession`'s `{ response, user }`
object directly. Destructured `.response` before returning — the
ergonomic `{ response, user }` shape from `@phloz/auth/middleware`
stays intact for future middleware-layer auth checks.

### Reply-from-portal

- `sendPortalReplyAction` in `apps/app/app/portal/[token]/actions.ts`
  — authenticates via magic-link token, inserts a `messages` row
  with `direction=inbound`, `channel=portal`, `fromType=contact`,
  `fromId=link.clientContactId`. Threads on the supplied `threadId`
  when continuing a conversation.
- Portal UI — new `PortalMessages` + `ThreadCard` + `ReplyForm`.
  Groups messages by `threadId`, newest thread first, chronological
  within. Each thread has an inline Reply button; a "Start a new
  conversation" card at the bottom starts fresh threads.
- Portal page query now selects `channel` and filters via
  `inArray(['email','portal'])` so clients see both agency email
  and their own portal replies. Internal notes stay hidden.
- Agency-side is channel-aware via `MessageThread`'s `ChannelIcon`
  fallback — portal messages show with a MessageSquare icon and
  `inbound` badge in the client Messages tab without any extra work.

### Client status — at-risk / inactive badges

- Schema: new `clients.last_activity_at timestamptz` column with
  index. Migration `clients_last_activity_at` applied via MCP and
  seeded from `created_at`.
- Inngest `recomputeActiveClientCount` cron extended: after the
  existing tier-cap checks it runs one UPDATE per workspace that
  recomputes `last_activity_at` as the greatest of
  `created_at` + `max(updated_at)` across tasks / messages /
  tracking_nodes / tracking_edges / client_assets.
- UI: clients list renders amber **At risk · Nd** for 30 ≤ days <
  60, red **Inactive · Nd** for ≥ 60. Right column shows
  last-active date instead of updated-at when available.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Env-var fix + approvals + breadcrumbs

### `@phloz/config` env.ts fix

Wrapped the Zod schema in a top-level `z.preprocess` that rewrites
`''` to `undefined` for every key before validation. Fixes the
runtime crash where placeholder lines like `NEXT_PUBLIC_SENTRY_DSN=`
in `.env.local` tripped `.url().optional()` — empty string failed
URL validation because `optional()` only tolerates `undefined`, not
`''`. Two regression tests pin the behaviour.

### Approvals on client-visible tasks

- `APPROVAL_STATES` enum in `@phloz/config` (none / pending /
  approved / rejected / needs_changes).
- Supabase migration `tasks_approval_state` (applied via MCP) adds
  `approvalState`, `approvalComment`, `approvalUpdatedAt` columns
  with a check constraint + index.
- **Agency** — `setTaskApprovalAction` toggles between `none` ↔
  `pending` on client-visible tasks. Terminal states are reserved
  for the client.
- **Portal** — `setClientApprovalAction` in
  `apps/app/app/portal/[token]/actions.ts` authenticates via
  magic-link token (no Supabase user), scopes to the link's
  workspace + client, accepts only approved / rejected /
  needs_changes + optional comment.
- **UI** — `TaskRow` shows a colour-coded approval badge (amber /
  green / red / orange) and a dropdown toggle to Request / Reset.
  New `PortalTaskCard` on the portal renders Approve / Request
  changes / Reject buttons when state is `pending`. Reject and
  needs-changes open an inline textarea for an optional comment;
  comments render as an italic blockquote on both sides.

### Breadcrumbs

- New `Breadcrumbs` component in `@phloz/ui/components`. Terminal
  item renders as text with `aria-current="page"`; intermediate
  items are links with hover state.
- Applied on three deep pages: client detail, map (3-level chain),
  new-client. Replaces one-link "← back" navs.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Map edge polish + file uploads

### Tracking-map edge polish

- `EdgeEditDialog` — shared shadcn Dialog that opens in `create` mode
  when the user drags a connection between two nodes, and in `edit`
  mode when they click an existing edge. Picks `edgeType` via a Select
  of the 8 enum values (with human labels exported as
  `EDGE_TYPE_LABELS`) and an optional 120-char free-text label. Edit
  mode has a Remove button.
- `onConnect` no longer persists immediately — it stages source/target
  on the dialog state and waits for the user to click Save. The save
  path is optimistic + rollback-on-error, same as the rest of the map.
- `onEdgeClick` opens the dialog pre-filled.
- Canvas `CanvasAction` type grew two new kinds: `update-edge` and
  `import`.
- `ImportMapDialog` — shadcn Dialog with drop-file + paste-JSON
  support. Pairs with the existing Export button.

### File uploads (Supabase Storage)

- DB migration `client_assets_storage_bucket` (applied via MCP):
  * Private `client-assets` bucket, 50MB hard limit.
  * Path convention `{workspaceId}/{clientId}/{timestamp}-{safeName}`.
  * RLS on `storage.objects`: SELECT/INSERT/UPDATE for any workspace
    member, DELETE restricted to owner/admin/member (viewers read
    only). Uses the existing `phloz_is_member_of` +
    `phloz_has_role_in` helpers.
- `apps/app` — `/[workspace]/clients/[clientId]/files/`:
  * `uploadAssetAction` — FormData-based (works with `useActionState`),
    4MB cap (stays under Vercel's 4.5MB body limit), MIME allowlist
    (images, PDFs, office docs, common videos), uploads via
    `@phloz/auth/server` + inserts `client_assets` row.
  * `getAssetSignedUrlAction` — 5-minute signed download URL.
  * `deleteAssetAction` — removes the Storage object + row.
- `FilesPanel` client component — file-picker form, type-specific
  icon per row (image / video / document / other), download opens a
  signed URL in a new tab, delete with confirm.
- Client detail Files tab swaps the stub for `FilesPanel`.

### `apps/app/app/[workspace]/clients/[clientId]/map/actions.ts`

- `updateEdgeAction` — Zod-validated patch for `edgeType` + `label`.
- `importMapAction` — runs in `db.transaction<ImportResult>()`, Zod-
  validates each node's metadata against the registry schema, re-links
  edges by local→real id. Aborts the whole transaction on any per-node
  metadata failure.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Messages module + portal dashboard

### Messages module

**`@phloz/email`:**
- New `sendPlainEmail({ to, subject, text, html, replyTo, inReplyTo,
  references })` — non-template outbound send. Agency replies default
  `replyTo` to the client's inbound address so responses thread back.

**`apps/app` — `/[workspace]/messages/` + per-client tab:**
- Server actions: `sendEmailReplyAction` (role-gated, resolves inbound
  address, calls Resend, inserts outbound `messages` row),
  `postInternalNoteAction` (internal_note channel, no Resend).
- `MessageThread` client component — groups by `threadId`, colour-
  coded bubbles per direction + channel, compose pane with Email /
  Internal note tabs, auto-prefilled `Re: …` subject.
- Client-detail **Messages** tab swaps the stub for `MessageThread`.
- `/[workspace]/messages` — unified inbox with direction + channel
  filter pills, compact list, click jumps to client page.

### Portal fleshout

`/portal/[token]` — swapped the "Recent updates" stub for a read-only
dashboard:
- Open **client-visible tasks** (visibility=client_visible + status
  in todo/in_progress/blocked).
- **Recent messages** on the email channel only (internal notes
  hidden), conversation-style timeline.
- Footer explains reply-by-email path (no compose button yet).

V1 stays read-only; reply/self-update await a portal-session-aware
action layer.

### Local-dev helpers

- `apps/app/.env.local` + `apps/web/.env.local` (gitignored) created
  with public values pre-filled. Only two secrets are TODO for the
  product app: `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`
  (transaction pooler, port 6543).

### Verified

- `pnpm check` — 29/29 green.
- `next build` (apps/app) — 31 routes compile.

---

## 2026-04-23 — Post-Prompt-2 (deps, map polish, tasks module)

### Dependency upgrade — local === Vercel

Vercel's install was resolving to newer majors than our caret ranges
allowed, so local tests ran against one version and prod got another.
Upgraded locally to match:

- `@sentry/nextjs` 8 → 10 — transparent.
- `drizzle-orm` 0.36 → 0.45 — transparent.
- `inngest` 3 → 4 — breaking. Ported: dropped `EventSchemas` /
  `fromRecord()` for a flat `INNGEST_EVENT_NAMES` tuple; moved
  triggers into `createFunction` options (v4 went 3-arg → 2-arg);
  dropped `signingKey` from `serve()` (v4 reads env vars automatically).

### Tracking-map polish

- Keyboard shortcuts: `n` opens add-node menu, `/` (or `⌘K`) opens
  node search, `Esc` closes the drawer. All ignored when focus is
  inside an input.
- `NodeSearchDialog` — shadcn Dialog that filters nodes by label or
  type. Selecting a node centers it in the viewport and opens the
  editor drawer.
- `AddNodeMenu` — controlled `open` / `onOpenChange` so the keyboard
  handler can drive it.
- **Export JSON** toolbar button downloads a timestamped snapshot.
- Soft 200-node cap indicator (warning colour + tooltip).
- Map-page header now shows the three keyboard shortcuts inline.

### Tasks module

Server actions (`apps/app/app/[workspace]/tasks/actions.ts`):
- `createTaskAction`, `updateTaskAction`, `deleteTaskAction` — each
  Zod-validated, role-gated (owner/admin/member), revalidates the
  affected paths.

UI:
- `NewTaskDialog` (reused from workspace + per-client) — shadcn Dialog
  + react-hook-form + Zod. Fields: title, description, priority,
  department, visibility, due date, optional client.
- `TaskRow` — status toggle dropdown with optimistic update +
  rollback, priority colour-coded, overdue + client-visible badges,
  delete inside the same dropdown.
- `/[workspace]/tasks` — grouped by status (todo / in_progress /
  blocked / done) with filter pills for departments + statuses.
- Per-client tasks tab (`/[workspace]/clients/[clientId]`) reuses
  TaskRow + NewTaskDialog.
- Workspace overview card shows **open** task count (todo +
  in_progress + blocked) instead of total.

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `next build` (`apps/app`) — 30 routes compile.

---

## 2026-04-23 — Prompt 2 — tracking-map editor

### `@phloz/tracking-map` — fleshed out from scaffold

- **21 node-type descriptors** across 8 categories (analytics,
  tag-management, server, paid-media, commerce, email, crm, other).
  Each pairs a Zod metadata schema with an icon + accent colour +
  `defaults()` factory.
- **React Flow canvas** (`"use client"`) — custom Phloz node with
  icon, label, health dot, last-verified-ago, left/right handles.
  MiniMap + Controls + dotted Background + Phloz dark theme.
- **Add-node dropdown** grouped by category.
- **"Arrange" button** runs dagre LR auto-layout.
- **Right drawer** (shadcn `Sheet`) edits label + Zod-driven metadata
  form (string / number / boolean / enum / string-array) + health
  state + "Save + mark verified".
- **Optimistic CRUD** with tempId → real-id swap on server confirm.
  Position autosave debounced at 500ms.
- `readOnly` mode gates all writes.

### `apps/app`

- Route `/[workspace]/clients/[clientId]/map/` loads nodes + edges
  and renders the canvas.
- `actions.ts` — five server actions (createNode / updateNode /
  deleteNode / createEdge / deleteEdge) gated via `requireRole(['owner','admin','member'])`
  and validated per-type against the registry's Zod schema.
- `map-client.tsx` binds actions to the canvas so the page stays a
  server component.
- Client detail page's "Tracking map" tab now links to the editor.
- `next.config.ts` adds `@xyflow/react` to `transpilePackages`.

### Deps added

- `@phloz/tracking-map` → `@dagrejs/dagre`, `@phloz/ui`, `clsx`,
  `lucide-react`. Subpath exports: `./canvas`, `./layout`, `./styles`.

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `next build` (`apps/app`) — 30 routes compile (29 + the new map).

---

## 2026-04-23 — Phase 1 Steps 10–13 (Inngest, observability, CI, deploy)

### Step 10 — Inngest

- `apps/app/inngest/client.ts` — typed EventSchemas catalog (5 events).
- 4 functions: `recomputeActiveClientCount` (cron nightly +
  event trigger), `sendTrialEndingReminder` (cron daily, reads
  Stripe `trial_end`), `onWorkspaceCreated` (V2 seed hook),
  `onClientAdded` (mints opaque inbound email address).
- `/api/inngest/route.ts` via `inngest/next` `serve()`.
- Event emission wired at 3 sites (onboarding action, client-create
  API route, Stripe webhook reconcile).
- `docs/INNGEST-SETUP.md`.

### Step 11 — Observability

- `@sentry/nextjs` in both apps (client/server/edge configs +
  `instrumentation.ts`). Product app enables session replay with
  masked text/inputs/media. Graceful no-op without DSN.
- PostHog provider in `apps/app` — captures `$pageview` on every
  client-side route change (Suspense-wrapped in root layout).
- `@phloz/config/logger` — pino singleton with redaction for
  password/token/cookie/apiKey/stripeSecretKey/serviceRoleKey.
  `requestLogger(ctx)` child for per-request context.
- `docs/OBSERVABILITY.md` consolidates all four pillars.

### Step 12 — CI

- `.github/workflows/ci.yml` with 4 jobs: `check` (pnpm check),
  `build` (matrix web + app), `rls-invariants` (postgres:16 +
  `check-rls-invariants.ts` asserting `rowsecurity=true` on every
  `TENANT_TABLES` entry), `pgtap` (pg_prove against
  `packages/db/tests/rls/*.test.sql`).
- `.github/dependabot.yml` — monthly updates grouped into
  next/react, ui/radix, infra.
- `packages/db/scripts/check-rls-invariants.ts` + script exposed as
  `pnpm --filter @phloz/db check:rls-invariants`.

### Step 13 — Deployment

- `apps/web/vercel.json` + `apps/app/vercel.json` — Next preset,
  pnpm frozen-lockfile install, turbo-scoped builds, iad1 region.
  App webhook routes get `maxDuration: 30`, Inngest route gets `300`.
- `docs/DEPLOYMENT.md` — end-to-end Vercel setup: project creation,
  env var matrix, domains, Stripe + Resend + Inngest webhooks,
  sanity-check URLs, rollback, quarterly secret-rotation schedule.

### Changed

- Root `package.json` — approved `@sentry/cli` postinstall.
- `packages/db/tsconfig.json` — include `scripts/` and `tests/`.
- `packages/config` — added `pino` dep + `./logger` subpath export.
- `apps/app` — added `@sentry/nextjs`, `posthog-js`, `inngest`.
- `apps/web` — added `@sentry/nextjs`.

### Verified

- `pnpm check` — 29/29 green.
- Both apps build cleanly.

### Next

Phase 1 scaffold is complete. Per PROMPT_1 final line: return to the
planning chat for **Prompt 2 — the tracking map editor** (canvas UI
built on `packages/tracking-map` + the node/edge schema already in
place).

---

## 2026-04-23 — Phase 1 Step 9 (apps/app product scaffold)

### Added — `@phloz/ui` primitives

- `Button` gained `asChild` support via `@radix-ui/react-slot`.
- Ten new Radix-backed primitives: `Dialog`, `DropdownMenu`, `Sheet`,
  `Tabs`, `Avatar`, `Tooltip`, `Popover`, `Select`, `Toaster` (sonner),
  `Form` (react-hook-form wrappers).
- `lucide-react` wired for icons.

### Added — `apps/app`

- **Config:** `next.config.ts` (security headers + transpilePackages),
  `tsconfig.json`, `postcss.config.mjs`, `globals.css`, Next-16 edge
  proxy (`proxy.ts`, formerly `middleware.ts`) that refreshes Supabase
  sessions.
- **Auth routes** in the `(auth)` group: `/login`, `/signup`,
  `/forgot-password`, `/reset-password`, plus `/auth/callback` PKCE
  handler with an open-redirect guard. Password + magic-link in the
  same login form; email-confirm supported in signup.
- **Onboarding** (`/onboarding`) — server action creates the
  workspace + workspace_members row, sets
  `user_metadata.active_workspace_id`, and redirects to `/[workspace]`.
- **Dashboard shell** (`/[workspace]/...`) with sidebar nav, workspace
  switcher, user menu, billing-only-for-admins gating.
- **Feature pages:** overview (live metrics via
  `getActiveClientCount`), clients list, `/clients/new` (with
  `canAddClient` tier gate), client split-pane detail (tabs:
  overview, tasks, messages, tracking map, files — last four are
  in-app stubs pointing at upcoming sessions / Prompt 2 for the map
  editor), tasks, messages, team (with invite card), billing, settings.
- **Portal** (`/portal/[token]`) — layout validates the magic link on
  every request, 404s on any failure, so existence vs expiry isn't
  leaked to guessing clients.
- **Accept-invite** (`/accept-invite?token=`) flow — validates the
  token, requires email match, creates membership, marks invitation
  accepted, switches active workspace.
- **API routes:**
  - `POST /api/workspaces/switch`
  - `PATCH /api/workspaces/[id]` (rename)
  - `POST /api/workspaces/[id]/clients` (tier-gated via `canAddClient`)
  - `POST /api/workspaces/[id]/invitations` (writes row + sends email)
  - `POST /api/workspaces/[id]/billing/checkout` (Stripe Checkout)
  - `POST /api/workspaces/[id]/billing/portal` (Stripe Billing Portal)
  - `POST /api/webhooks/stripe` — signature verify + idempotent record
    + reconcile tier/subscription on checkout/subscription/cancellation.
    `PRICE_TO_TIER` map uses the 12 sandbox price IDs wired today.
  - `POST /api/webhooks/resend/inbound` — svix signature verify +
    `parseResendInbound` + route via `inbound_email_addresses` into a
    `messages` row.
  - `GET /api/health` — db round-trip.

### Changed

- `@phloz/auth` package.json exports expanded to surface `./middleware`,
  `./session`, `./roles`, `./workspace-switch` subpaths.
- `apps/app/package.json` gained `drizzle-orm`, `@hookform/resolvers`,
  `lucide-react`, `nanoid`, `react-hook-form`, `sonner`, `stripe`,
  `@tailwindcss/postcss`.

### Stubbed for later sessions

These exist as navigable pages with copy explaining what's coming:

- Workspace-wide tasks board (boards + timelines).
- Unified messages inbox.
- Tracking infrastructure map (deferred to **Prompt 2**).
- Client split-pane sub-tabs (tasks per client, file uploads, message
  thread UI).
- Client-portal pages past `/portal/[token]` (tasks, approvals,
  deliverables).

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `next build` (apps/app) — 28 routes compile cleanly.

---

## 2026-04-23 — Phase 1 Step 8 (apps/web marketing site)

### Added — 49 static pages

Core scaffold:
- `apps/web/next.config.ts`, `tsconfig.json`, `postcss.config.mjs`,
  `next-env.d.ts` — Next 16 + Tailwind v4 + MDX pipeline wired.
- `app/layout.tsx` — root layout with Geist fonts (from
  `@phloz/ui/fonts`), GTM script (container `GTM-W3MGZ8V7` default),
  Organization JSON-LD, sticky header + footer.
- `app/globals.css` — imports shared `@phloz/ui/styles/globals.css`
  plus a lean `.phloz-prose` rule set for MDX blog content (avoids
  `@tailwindcss/typography` dep).
- `components/site-header.tsx`, `components/site-footer.tsx`,
  `components/gtm.tsx`.
- `lib/site-config.ts` — one source of truth for URLs, nav, footer,
  and programmatic-SEO registries (competitors, use cases,
  departments, integrations).
- `lib/metadata.ts` — `buildMetadata()` helper enforcing canonical
  URLs, OG, Twitter card, robots, and site-wide JSON-LD.

Static pages:
- `/` home (hero + 6 features grid + CTA, SoftwareApplication JSON-LD)
- `/features`, `/pricing` (reads `TIERS` from `@phloz/billing`),
  `/about`, `/contact`, `/help`
- `/legal/terms`, `/legal/privacy` — draft placeholders (flagged
  in-copy; counsel review scheduled before first customer).

Blog — MDX via `next-mdx-remote/rsc` + `gray-matter` + `remark-gfm` +
`rehype-slug` + `rehype-autolink-headings`:
- `lib/blog.ts` — frontmatter Zod-validated.
- `/blog` index + `/blog/[slug]` with Article JSON-LD + reading time.
- 3 seed posts: `why-we-built-phloz`, `tracking-infrastructure-map`,
  `per-active-client-pricing`.

Programmatic SEO (all use `generateStaticParams` from
`site-config.ts`):
- `/compare/[competitor]` × 10 (HubSpot, Monday, ClickUp, Asana,
  Notion, Teamwork, Productive, Rocketlane, Function Point, Accelo).
- `/use-cases/[slug]` × 4.
- `/crm-for/[slug]` × 8 departments (ppc, seo, social-media, cro,
  web-design, performance-marketing, ecommerce, b2b).
- `/integrations` index + `/integrations/[slug]` × 9 tools (with
  V1/V2 blurbs per integration).

SEO infrastructure:
- `app/robots.ts` via `MetadataRoute.Robots`.
- `app/sitemap.ts` — auto-includes every registry slug + every blog
  post slug. Add a slug to `site-config.ts` → sitemap updates.
- `app/llms.txt/route.ts` — categorized index per the llmstxt.org
  spec, 1-hour revalidate.

### Dependencies added (apps/web)

- `@phloz/billing`, `gray-matter`, `next-mdx-remote`, `reading-time`,
  `rehype-autolink-headings`, `rehype-slug`, `remark-gfm`.
- `@tailwindcss/postcss` (dev).

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `pnpm --filter @phloz/web build` — 49 static pages generated in
  2.6s, 0 errors.

### Next

Step 9 — `apps/app` product (auth, dashboard, portal, API routes).
This is the biggest session on the roadmap (6-8h). Can be paused
after Step 8 for the user to QA the marketing site in dev / preview.

---

## 2026-04-23 — Stripe sandbox products + prices wired

### Added

- 4 Stripe Products in Phloz sandbox (`acct_1RXbVlPomvpsIeGO`):
  - `prod_UOFldR2CCkSDqS` — Phloz Pro (10 clients, 5 seats)
  - `prod_UOFlJvP0zTegxV` — Phloz Growth (30 clients, 8 seats)
  - `prod_UOFl7RRqfyEmce` — Phloz Business (100 clients, 15 seats)
  - `prod_UOFlG1UTSfSyGe` — Phloz Scale (250 clients, 30 seats)
- 12 recurring Prices (monthly + annual + extra-seat-monthly per tier,
  USD). Amounts match ARCHITECTURE.md §7.1.
- Price IDs wired into `packages/billing/src/tiers.ts` with inline
  product-ID comments for traceability.

### Verified

- `pnpm check` — 29/29 green. All 24 billing tests still pass against
  the real IDs.

### Notes

- Two orphan products from earlier experiments (`prod_SSWcZ5D3sAcqgx`
  "Premium", `prod_SSWb4vOPLGNW4K` "Pro", both with no prices) remain
  in the sandbox and should be archived via the Stripe dashboard.
- Live-mode prices will be created in Step 13 (deployment) and swapped
  in before launch.

---

## 2026-04-23 — Phase 1 Steps 5–7 (email, analytics, ui)

### Step 5 — `packages/email`

- Resend client with graceful `isResendConfigured()` gate for dev.
- React Email templates: `InvitationEmail`, `PortalMagicLinkEmail`,
  `PasswordResetEmail` — shared `EmailLayout` with Geist + Tailwind,
  consistent footer.
- `sendInvitation` / `sendPortalMagicLink` / `sendPasswordReset` helpers;
  each no-ops when `RESEND_API_KEY` is absent.
- `verifyResendSignature` — Standard Webhooks (svix) HMAC-SHA256 verifier
  with timestamp-tolerance window + timing-safe compare.
- `parseResendInbound` — Zod-validated envelope parser; drops attachments
  per ARCHITECTURE §10.3, HTML-to-text fallback, 5MB attachment limit.
- `generateInboundAddress` / `extractInboundId` — opaque 12-char nanoid
  addresses (`client-<id>@inbound.phloz.com`) per §10.1.
- 13 unit tests passing.
- `docs/DNS-SETUP.md` — SPF/DKIM/DMARC for `phloz.com`, MX for
  `inbound.phloz.com`, Resend webhook + routing config, verification
  checklist.

### Step 6 — `packages/analytics`

- `EventMap` — typed catalog mirroring ARCHITECTURE §11.2 (every event
  from marketing, auth, workspace, team, clients, tracking map, tasks,
  messages, billing, feature gates).
- `track(event, params, context?)` — dispatcher. Browser path: GTM
  dataLayer + PostHog. Server path: PostHog-node + GA4 Measurement
  Protocol when the event is in `SERVER_GA4_EVENTS` (sign_up,
  upgrade_tier).
- GTM bootstrap helpers (`gtmBootstrapScript`, `gtmNoscriptIframeSrc`)
  with container id GTM-W3MGZ8V7 as the single source of truth.
- PostHog init/identify/reset (client) + captureServer (server); both
  no-op gracefully without keys.
- `sendGa4ServerEvent` — server fetch-based emitter; strips undefined
  params; throws on non-2xx.
- `hashAuthUid{Server,Client}` — SHA-256 hex with cross-runtime parity.
- 8 unit tests passing.

### Step 7 — `packages/ui`

- `cn()` helper (clsx + tailwind-merge).
- `packages/ui/styles/globals.css` — Tailwind v4 CSS-first config via
  `@theme`. Dark-first palette + deep-blue accent (per DECISIONS
  2026-04-23) + tracking-map health colour vars (ARCHITECTURE §8.2).
  Light-mode opt-in via `.light` on `<html>`.
- Primitives (shadcn-style, no Radix deps yet): `Button` (6 variants, 4
  sizes), `Input`, `Label`, `Card` (+ Header/Title/Desc/Content/Footer),
  `Badge` (6 variants), `Skeleton`, `Separator`.
- Shared components: `PageHeader`, `EmptyState`, `LoadingSpinner`,
  `TierBadge`.
- `loadGeistFonts()` — lazy `next/font` Geist Sans + Mono loader returning
  CSS-variable class names; matches `--font-geist-sans` /
  `--font-geist-mono` in the shared stylesheet.

### Other

- Stripe SDK bumped to `^22.0.2` to support the `2026-03-25.dahlia` API
  version selected for the Phloz sandbox.
- `packages/auth/src/server.ts` — replaced `require('@supabase/supabase-js')`
  with dynamic `await import()`; `createServiceRoleSupabase()` is now
  async. Closes the long-standing KNOWN-ISSUES entry.
- `packages/auth/src/{server,middleware}.ts` — typed `setAll` params.
- Added `@types/node` to `@phloz/config` and `next` + `@types/node` to
  `@phloz/auth` peers/devDeps.
- `@phloz/types` — added `@phloz/config` workspace link so its
  `tsconfig.base.json` resolves.
- `db` + `auth` `test` scripts: `vitest run --passWithNoTests` (neither
  has vitest files yet).
- Next 16 removed `next lint`; swapped `apps/web` + `apps/app` lint to
  `eslint . --no-error-on-unmatched-pattern`.
- Root `package.json` — `"type": "module"` to silence ESM parse warning.
- `.env.example` — comprehensive rewrite with per-service sections,
  `[web]/[app]/[both]` tags, new `sb_publishable_*` / `sb_secret_*`
  key-format notes, DATABASE_URL pooler-vs-direct guidance.

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- 21 unit tests across `@phloz/config` (4), `@phloz/billing` (24),
  `@phloz/email` (13), `@phloz/analytics` (8) — all passing.

---

## 2026-04-23 — Supabase wiring (post-session-1)

### Added

- `pnpm.onlyBuiltDependencies` in root `package.json` approving postinstalls
  for `core-js`, `esbuild`, `protobufjs`, `sharp`, `unrs-resolver`.
- `pnpm-lock.yaml` — lockfile committed after clean install (10.5s).
- `packages/db/migrations/0000_melted_supreme_intelligence.sql` — Drizzle-
  generated schema SQL for all 25 tables (17 V1 + 8 V2 stubs) with FKs +
  indexes.
- `packages/db/src/supabase-types.ts` — generated Supabase `Database` type
  for use with `@supabase/supabase-js` (the Drizzle types remain the
  default; these are for direct Supabase SDK calls).
- Two applied Supabase migrations (via MCP):
  - `initial_schema` — 25 tables, 41 foreign keys, 45 indexes, all idempotent.
  - `rls_policies` — `phloz_is_member_of` / `phloz_has_role_in` /
    `phloz_is_assigned_to` / `touch_updated_at` helpers + full V1 policies
    + V2 default-deny.
  - `custom_access_token_hook` — the JWT claim hook (requires dashboard
    activation).
  - `function_search_path_hardening` — fixed advisor WARN for two
    plpgsql functions missing `SET search_path`.

### Verified

- All 25 tables have `rowsecurity = true` (checked via `pg_tables` query).
- `get_advisors` → security: only INFO-level `rls_enabled_no_policy`
  warnings remain, all for V2 stubs and `portal_magic_links` (by design:
  no policy = default deny, service role bypasses).

### Changed

- `packages/db/src/rls/_functions.sql` — `touch_updated_at` now declares
  `SET search_path = public` (matches advisor fix).
- `packages/auth/src/hooks/custom-access-token-hook.sql` — function now
  declares `SET search_path = public, auth`.

### Deferred

- Stripe MCP is connected to `acct_1QFi6lBVrlan59Tv` (Exchange Rate
  Management), not the Phloz account `acct_1RXbVfLUfWiw9Veu`. Reconnect
  the MCP before creating products.
- Custom Access Token hook SQL function exists, but enabling it is a
  Supabase Dashboard step (Authentication → Hooks → Custom Access Token).
- Service role key + direct `DATABASE_URL` not yet in `.env.local`.

---

## 2026-04-23 — Phase 1 Steps 0–4

### Added

- Foundation docs committed: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `PROMPT_1.md`.
- Turborepo workspace: `pnpm-workspace.yaml`, `turbo.json`, flat ESLint
  config, Prettier, editorconfig, `.env.example` enumerating every env var.
- `packages/config` — Zod `envSchema` with `loadEnv`/`requireEnv`/`hasEnv`,
  a `tsconfig.base.json` every workspace extends, and centralised constants
  (tiers, roles, statuses, node/edge types, departments, task states).
- `packages/types` — `Result<T,E>` helpers.
- Package stubs: `packages/{db,auth,billing,email,analytics,ui,tracking-map}`
  and `apps/{web,app}` with minimal `package.json` so `pnpm install` can
  resolve the workspace graph.
- `packages/ui/src/tokens.ts` — design tokens with confirmed deep-blue
  accent (see DECISIONS.md).
- `packages/db`:
  - Full Drizzle schema for every V1 tenant table (ARCHITECTURE.md §5.1).
  - V2 stub tables (§5.4) with minimal shape + TODO markers.
  - Per-table RLS policy SQL files under `src/rls/`, plus
    `_functions.sql` with `phloz_is_member_of` / `phloz_has_role_in` /
    `phloz_is_assigned_to` SECURITY DEFINER helpers.
  - `src/rls/index.ts` exports `RLS_FILES` (apply order) and
    `TENANT_TABLES` (CI registry).
  - `src/rls/apply.ts` CLI applies every policy file against `DATABASE_URL`.
  - `tests/rls/workspace-isolation.test.sql` — pgTAP test covering the
    three RLS invariants from PROMPT_1 Step 2.
  - `src/seed/index.ts` — demo workspace + 2 clients + 3 tracking nodes +
    2 edges.
  - README with add-a-tenant-table checklist.
- `packages/auth`:
  - `server.ts` — `createServerSupabase` (cookie-bound) +
    `createServiceRoleSupabase` (RLS-bypass).
  - `client.ts` — `createBrowserSupabase`.
  - `middleware.ts` — `updateSession` for Next middleware.
  - `session.ts` — `getCurrentUser`, `requireUser`, `getActiveWorkspaceId`.
  - `roles.ts` — `getMembershipRole`, `requireRole`, `requireAdminOrOwner`,
    `requireOwner`.
  - `portal.ts` — `generatePortalMagicLink` (40-char nanoid, 7-day TTL) +
    `validatePortalMagicLink` + `revokePortalMagicLink`.
  - `workspace-switch.ts` — `switchWorkspace(id)` updates user_metadata
    and refreshes session.
  - `src/hooks/custom-access-token-hook.sql` — Supabase auth hook that
    copies `user_metadata.active_workspace_id` into JWT claims.
  - Typed `AuthError` with codes.
- `packages/billing`:
  - `tiers.ts` — `TIERS` config matching ARCHITECTURE.md §7.1 + helpers.
  - `active-clients.ts` — `getActiveClientCount` (60-day window, single
    query), plus unarchived / total / paid-seat counts.
  - `gates.ts` — `canAddClient`, `canInviteMember`, `canUnarchiveClient`,
    `canDowngrade` with pure `*Check` variants for unit tests.
  - `stripe.ts` — lazy client, `createCustomer`, `createCheckoutSession`,
    `createBillingPortalLink`.
  - `webhooks.ts` — `constructWebhookEvent`, `recordBillingEvent`
    (idempotent), `markBillingEventProcessed`, `HANDLED_EVENT_TYPES`.
  - 24 unit tests in `gates.test.ts` + `tiers.test.ts`.
  - README with add-a-tier and add-a-gate workflows.

### Deferred (see NEXT-STEPS.md + KNOWN-ISSUES.md)

- `pnpm install` — not yet run. First action next session.
- Steps 5–17 of PROMPT_1 — email, analytics, ui, marketing site, app,
  Inngest, observability, CI, deployment, final verification.
- Stripe price IDs are null in `TIERS`; wire when the Stripe account is
  created.
- Supabase project not provisioned; the custom JWT hook must be installed
  manually once it is.
- Drizzle migrations not generated (needs `DATABASE_URL`).

### Commits

- `5c57125` docs: add foundation architecture and Claude Code rules
- `169dba4` chore: scaffold turborepo workspace with packages/config
- `dc8b3e2` feat(db): schema, RLS policies, pgTAP tests, seed
- `(0cd6f8c)` feat(auth): Supabase SSR helpers, roles, portal magic links, workspace switch
- `(new)` feat(billing): tier config, gates, Stripe client, webhooks, unit tests
- `(this commit)` docs: session-wrap for Phase 1 Steps 0–4
