# Next Steps (as of 2026-04-26 v3)

## Branch state

`claude/inspiring-wright-2ca122` is the active feature branch and
sits 18 commits ahead of `main`. Latest HEAD: `f465756` (inbox
star/pin).

`pnpm check` 29/29 green, **zero lint warnings**. Both apps build
clean.

## Operational status

- ✅ **Inngest** — endpoint healthy at
  `https://app.phloz.com/api/inngest`, 7 functions registered, both
  keys present, `mode: cloud`, dashboard synced. Crons fire on
  schedule.
- ✅ **Resend** — API key + `phloz.com` domain verified. Email
  delivery is live.
- ✅ **Supabase** — 11 Drizzle migrations applied (0000–0010);
  RLS + JWT hook enabled; security advisors clean other than
  pre-existing V2-stub-table info noise (documented in
  KNOWN-ISSUES).

## Top backlog (next session)

1. **Playwright smoke tests.** Surface area now spans audit
   timeline + sparkline + workspace + per-client Run-now, pricing
   matrix, activity pagination, calendar month + week DnD, digest
   hour selector, Team digest-hour badge, inbox star/pin + `s`
   shortcut, plus prior features (recurring tasks, saved-views,
   subtask DnD, digest preview/nudge, billing tier-hint redirect,
   platform-IDs copy, inline tracking map, multi-token client
   search + bulk-archive, blog reading-progress, keyboard
   shortcuts, message drafts, inbox j/k). Worth automating the
   happy paths before the next dogfooding pass.
2. **Surface starred state on the per-client message thread**
   so users see the same star they pinned in the inbox when they
   drill into a client's messages tab. Read-only first pass; the
   per-client thread already shares schema + UI primitives with
   the inbox — small wiring change.
3. **PostHog wiring.** `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`
   in Vercel. Without them, `track()` calls log-only — we have a
   pile of typed events but no funnel data yet.
4. **GA4 Measurement Protocol** for server-side conversion events
   (`upgrade_tier`, `payment_failed`). `GA4_MEASUREMENT_ID` +
   `GA4_API_SECRET` in Vercel.
5. **Calendar hourly axis on week view.** Today's week view shows
   tasks stacked in chronological order within each day. A 24-row
   hourly axis with tasks positioned by `dueDate` hour would let
   users plan time-blocked work. Bigger scope — adds an hour
   dimension to the DnD drop targets.
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

pnpm check                     # lint + typecheck + unit tests
```

## Accounts / provisioning status

- ✅ GitHub, Supabase (`tdvzhwhzxuskrsobdyrm`, RLS + JWT hook
  enabled, 12 migrations applied), GTM, Stripe sandbox (API pinned
  to `2026-04-22.dahlia`), Vercel app project (`phloz`, live at
  `app.phloz.com`, Inngest + Resend env vars set), Vercel marketing
  project (`phloz-web`, live at `phloz.com`), Supabase auth URLs +
  custom SMTP, DNS apex, Resend domain verified, Inngest dashboard
  synced.
- ⏳ PostHog project, Sentry project, GA4 property.
