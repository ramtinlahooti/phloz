# Next Steps (as of 2026-04-26 v5)

## Branch state

`claude/inspiring-wright-2ca122` is the active feature branch and
sits 24 commits ahead of `main`. Latest HEAD: `d8a0ac1` (star
toggle on per-client thread).

`pnpm check` 29/29 green, **zero lint warnings**. Both apps build
clean. **Playwright marketing smoke tests 11/11 green** locally
(chromium-headless-shell, ~14s). CI workflow now runs the suite on
every PR.

## Operational status

- ✅ **Inngest** — endpoint healthy, 7 functions, dashboard synced.
- ✅ **Resend** — API key set, `phloz.com` domain verified.
- ✅ **Supabase** — 12 Drizzle migrations applied (0000–0011);
  RLS + JWT hook enabled.
- ✅ **CI** — lint + typecheck + unit tests + per-app build + RLS
  invariants + pgTAP + Playwright marketing smoke. First Playwright
  CI run lands when this branch hits a PR.

## Top backlog (next session)

1. **App-level Playwright tests for `apps/app`.** Auth-gated tests
   need a test DB + seeded fixtures — the bigger setup. Approach:
   a throwaway Supabase project (or a CI Postgres + Supabase Auth
   emulator) with a fixture seed script, plus a Playwright auth
   setup that signs into a known test account once and reuses
   storage state. Critical paths to cover:
   - signup → create workspace → add client
   - client portal magic link
   - billing checkout (Stripe test mode)
   - tracking-map node CRUD
   - dashboard audit Run-now → cron simulation → snapshot lands
2. **PostHog wiring.** `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`
   in Vercel. Without them, `track()` calls log-only — we have a
   pile of typed events but no funnel data yet.
3. **GA4 Measurement Protocol** for server-side conversion events
   (`upgrade_tier`, `payment_failed`). `GA4_MEASUREMENT_ID` +
   `GA4_API_SECRET` in Vercel.
4. **Calendar hourly axis on week view.** Today's week view shows
   tasks stacked in chronological order within each day. A 24-row
   hourly axis with tasks positioned by `dueDate` hour would let
   users plan time-blocked work.
5. **Sentry wiring** beyond the SDK init — confirm DSN is set in
   Vercel, set up a release tag in CI, verify sourcemaps upload.
   Currently configured but never seen a real error event.
6. **Pre-existing low-impact known issue:**
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

All 12 Drizzle migrations applied to Supabase.

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
```

## Accounts / provisioning status

- ✅ GitHub, Supabase (`tdvzhwhzxuskrsobdyrm`, RLS + JWT hook
  enabled, 12 migrations applied), GTM, Stripe sandbox, Vercel app
  project (`phloz`, live at `app.phloz.com`, Inngest + Resend env
  vars set), Vercel marketing project (`phloz-web`, live at
  `phloz.com`), Supabase auth URLs + custom SMTP, DNS apex, Resend
  domain verified, Inngest dashboard synced.
- ⏳ PostHog project, Sentry project, GA4 property.
