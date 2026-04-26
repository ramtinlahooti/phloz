# Next Steps (as of 2026-04-25, late evening v3)

## Branch state

`claude/inspiring-wright-2ca122` is the active feature branch and
sits 11 commits ahead of `main` after this extended session. Latest
HEAD: `eb2d147` (audit Run-now button).

`pnpm check` 29/29 green, **zero lint warnings**. Both apps build
clean.

## Operational confirmations (this session)

- **Inngest endpoint** healthy — `https://app.phloz.com/api/inngest`
  reports `function_count: 7`, both keys present, `mode: cloud`.
  User completed the dashboard "Sync" step.
- **Resend** wired in Vercel (`RESEND_API_KEY` set, `phloz.com`
  domain verified). Transactional emails will now actually deliver.
- **Migration #10 applied to Supabase** via MCP.
  `workspace_members.digest_hour smallint` column verified live with
  the 0–23 CHECK constraint. Security advisors show no new findings
  (only the pre-existing V2-stub-table RLS-without-policies info,
  documented in KNOWN-ISSUES).

## Top backlog (next session)

1. **Calendar week view** at `/tasks/calendar?view=week`. The month
   grid is solid; a 7-column × 24-row hourly week view would help
   users with timed tasks. Reuse the same updateTaskAction +
   CalendarMonthGrid DnD primitive.
2. **Playwright smoke tests.** Coverage now spans audit
   timeline + sparkline, Run-now button, pricing matrix, activity
   pagination, calendar drag-to-reschedule, digest hour selector,
   Team digest-hour badge, plus prior features (recurring tasks,
   saved-views, subtask DnD, digest preview/nudge, billing
   tier-hint redirect, platform-IDs copy, inline tracking map,
   multi-token client search + bulk-archive, blog reading-progress,
   keyboard shortcuts, message drafts, inbox j/k). Worth automating
   the happy paths before the next dogfooding pass.
3. **Per-client "Run audit now"** by adding `clientId` to the
   `audit/run-weekly` event data and short-circuiting the cron's
   workspace sweep to one client. Mirrors the workspace-level button
   shipped this session; useful after fixing a tracking issue when
   you want to confirm the audit reflects it without re-auditing
   every client.
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

All 10 Drizzle migrations applied to Supabase.

## Env vars to light up dormant features

- ✅ **Inngest** — keys set + dashboard synced. Crons will fire.
- ✅ **Resend** — key set + `phloz.com` domain verified. Email
  delivery is live.
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
