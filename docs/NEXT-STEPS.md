# Next Steps (as of 2026-04-26)

## Branch state

`claude/inspiring-wright-2ca122` is the active feature branch and
sits 13 commits ahead of `main` after this session. Latest HEAD:
`e187b36` (per-client audit Run-now).

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

1. **Calendar week view** at `/tasks/calendar?view=week`. The month
   grid is solid; a 7-column day-of-week (or × 24-row hourly) view
   would help users with timed tasks. Reuse the same updateTaskAction
   + CalendarMonthGrid DnD primitive. Add a Month/Week toggle pill in
   the calendar header.
2. **"Last ran X ago" suffix on the audit trend line.** With the new
   manual Run-now buttons firing throughout the day, the implicit
   "last run" reference in the trend copy gets ambiguous. Pull
   `recentAuditSummaries[0].createdAt` and append "· last run X
   minutes/hours/days ago" to the trend line. Tiny addition.
3. **Playwright smoke tests.** Coverage now spans audit timeline +
   sparkline + workspace + per-client Run-now, pricing matrix,
   activity pagination, calendar drag-to-reschedule, digest hour
   selector, Team digest-hour badge, plus prior features (recurring
   tasks, saved-views, subtask DnD, digest preview/nudge, billing
   tier-hint redirect, platform-IDs copy, inline tracking map,
   multi-token client search + bulk-archive, blog reading-progress,
   keyboard shortcuts, message drafts, inbox j/k). Worth automating
   the happy paths before the next dogfooding pass.
4. **PostHog wiring.** `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`
   in Vercel. Without them, `track()` calls log-only — we have a
   pile of typed events but no funnel data yet.
5. **GA4 Measurement Protocol** for server-side conversion events
   (`upgrade_tier`, `payment_failed`). `GA4_MEASUREMENT_ID` +
   `GA4_API_SECRET` in Vercel.
6. **Inbox star/pin** — let users mark a thread as needing follow-up
   so it pins to the top of the messages list across sessions.
   Adds a `messages.starred boolean default false` column +
   migration #11. Bigger surface (UI + action + thread sort).
7. **Pre-existing low-impact known issue:**
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

All 11 Drizzle migrations applied to Supabase.

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
  enabled, 11 migrations applied), GTM, Stripe sandbox (API pinned
  to `2026-04-22.dahlia`), Vercel app project (`phloz`, live at
  `app.phloz.com`, Inngest + Resend env vars set), Vercel marketing
  project (`phloz-web`, live at `phloz.com`), Supabase auth URLs +
  custom SMTP, DNS apex, Resend domain verified, Inngest dashboard
  synced.
- ⏳ PostHog project, Sentry project, GA4 property.
