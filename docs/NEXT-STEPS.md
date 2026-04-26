# Next Steps (as of 2026-04-26 v13)

## Branch state

`claude/inspiring-wright-2ca122` is the active feature branch and
sits 45 commits ahead of `main`. Latest HEAD: `c2bb045` (@mention
rendering as styled chips).

**Notifications surface is comprehensive** —
  - Five event types wired end-to-end (task_assignment,
    task_mention, inbound_message, task_approval,
    recurring_task_created)
  - Settings → Notifications panel with vacation mode + per-event
    toggles + per-client mute list
  - Per-task mute on the dialog header
  - Per-client mute on the client detail header
  - User-menu shortcut + email footer "Manage preferences" link
  - Vacation-mode banner above every workspace page
  - Mention chips in rendered comments + message bubbles

`pnpm check` 29/29 green, **zero lint warnings**. Both apps build
clean. **Playwright** — marketing 11/11 + app 7/7, all green
locally on chromium-headless-shell. CI runs both via a matrixed
`e2e` job on every PR. **Sentry** captures now carry release
(commit SHA) + user ID + workspace context.

## Operational status

- ✅ **Inngest** — endpoint healthy, 7 functions, dashboard synced.
- ✅ **Resend** — API key set, `phloz.com` domain verified.
- ✅ **Supabase** — 12 Drizzle migrations applied (0000–0011);
  RLS + JWT hook enabled.
- ✅ **CI** — lint + typecheck + unit tests + per-app build + RLS
  invariants + pgTAP + Playwright marketing smoke. First Playwright
  CI run lands when this branch hits a PR.

## Top backlog (next session)

1. **`@<displayname>` autocomplete in the comment composer.** The
   mention parser shipped today matches against
   `workspace_members.email` (full address OR local-part). Most
   users want to type `@Alex Chen` — that needs an autocomplete
   widget that resolves to a canonical token before it hits the
   regex. `comments.mentions` is already populated server-side so
   the rendering layer (highlighting, hover cards) can come along
   for the ride.
2. **Authenticated Playwright tests for `apps/app`.** Need a test
   DB + seeded fixtures + a Playwright auth setup that signs into
   a known test account once and reuses storage state. Approach:
   - Either a throwaway Supabase project, or a CI Postgres +
     Supabase Auth local-stack (`supabase start`)
   - Fixture seed script that creates: 1 user, 1 workspace,
     1 client, a few tasks, a few messages
   - `apps/app/e2e/global-setup.ts` that signs in via `/login` and
     persists storage state to a JSON file
   - Tests reuse `storageState` and bypass auth on each run
   Critical paths once that's in place: signup → create workspace
   → add client; client portal magic link; billing checkout
   (Stripe test mode); tracking-map node CRUD; audit Run-now →
   cron simulation → snapshot lands.
3. **PostHog wiring.** `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`
   in Vercel. Without them, `track()` calls log-only — we have a
   pile of typed events but no funnel data yet.
4. **GA4 Measurement Protocol** for server-side conversion events
   (`upgrade_tier`, `payment_failed`). `GA4_MEASUREMENT_ID` +
   `GA4_API_SECRET` in Vercel.
5. **Calendar hourly axis on week view.** Today's week view shows
   tasks stacked in chronological order within each day. A 24-row
   hourly axis with tasks positioned by `dueDate` hour would let
   users plan time-blocked work.
6. **Sentry source-map upload** via `withSentryConfig` wrapping
   `next.config.ts` so production events carry de-minified stack
   traces. Needs `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` +
   `SENTRY_PROJECT_{APP,WEB}` in Vercel.
7. **Audit page-level `requireRole` callsites** for the same
   throw-vs-redirect concern the layout had. Lower priority than
   the layout fix already shipped — page throws sit behind the
   layout's earlier redirect 99.9% of the time.
8. **Pre-existing low-impact known issue:**
   `workspace_members.email` can lag after Supabase email change.
   Documented in KNOWN-ISSUES; deferred until first real agency
   reports it.

## SQL migrations queued

| File | Status |
|---|---|
| `0000_melted_supreme_intelligence.sql` | ✅ |
| `0001_loving_marauders.sql` | ✅ |
| `0002_glamorous_susan_delgado.sql` | ✅ |
| `0003_wet_lake.sql` | ✅ |
| `0004_recurring_task_templates.sql` | ✅ |
| `0005_workspace_members_digest_enabled.sql` | ✅ |
| `0006_saved_views.sql` | ✅ |
| `0007_saved_views_is_shared.sql` | ✅ |
| `0008_tasks_sort_order.sql` | ✅ |
| `0009_workspace_members_default_saved_view.sql` | ✅ |
| `0010_workspace_members_digest_hour.sql` | ✅ |
| `0011_messages_starred.sql` | ✅ |
| `0012_notification_preferences.sql` | ✅ |

All 13 Drizzle migrations applied to Supabase.

## Env vars to light up dormant features

- ✅ **Inngest** — keys set + dashboard synced.
- ✅ **Resend** — key set + `phloz.com` domain verified.
- ⏳ **PostHog** — `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`.
- ⏳ **GA4** — `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`.

## Deferred dep upgrades

Same skip list — each is its own focused session:

- **zod 3 → 4** — cross-codebase schema migration.
- **vitest 2 → 4** — config breaking changes.
- **typescript 5 → 6** — major.
- **eslint 9 → 10** — flat-config tweaks.
- **@hookform/resolvers 3 → 5** — waits on zod 4.

## Local dev

```bash
pnpm --filter @phloz/app dev   # product app on :3001
pnpm --filter @phloz/web dev   # marketing on :3000

pnpm check                                       # lint + typecheck + unit tests
pnpm --filter @phloz/web test:e2e:install        # one-time, ~92 MiB chromium
pnpm --filter @phloz/web test:e2e                # 11 marketing smoke tests
pnpm --filter @phloz/app test:e2e:install        # same chromium reused
pnpm --filter @phloz/app test:e2e                # 6 app unauth smoke tests
```

Note: `apps/app` e2e needs `apps/app/.env.local` for the dev
server's middleware. In a worktree, symlink from the main
checkout: `ln -s /path/to/main/apps/app/.env.local apps/app/.env.local`.

## Accounts / provisioning status

- ✅ GitHub, Supabase (`tdvzhwhzxuskrsobdyrm`, RLS + JWT hook
  enabled, 12 migrations applied), GTM, Stripe sandbox, Vercel app
  project (`phloz`, live at `app.phloz.com`, Inngest + Resend env
  vars set), Vercel marketing project (`phloz-web`, live at
  `phloz.com`), Supabase auth URLs + custom SMTP, DNS apex, Resend
  domain verified, Inngest dashboard synced.
- ⏳ PostHog project, Sentry project, GA4 property.
