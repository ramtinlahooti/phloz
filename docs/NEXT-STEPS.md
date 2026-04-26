# Next Steps (as of 2026-04-25, late evening v2)

## Branch state

`claude/inspiring-wright-2ca122` is the active feature branch and
sits 7 commits ahead of `main` after this session:

- `2052f6f` audit history (per-client timeline)
- `67d333e` pricing matrix
- `67f1373` activity pagination
- `74ac529` calendar drag-to-reschedule
- `9895719` per-member digest hour
- `f54f2dc` lint cleanup
- (+ docs)

`pnpm check` 29/29 green, **zero lint warnings**. Both apps build
clean. Inngest endpoint at `https://app.phloz.com/api/inngest`
confirms `has_event_key` + `has_signing_key` + `mode: cloud` + 7
functions. Resend API key + `phloz.com` domain are wired in Vercel.

## Pending Supabase action

**Apply migration #10** (`0010_workspace_members_digest_hour.sql`)
via Supabase MCP before the per-member digest hour feature can take
effect in production. The cron + UI both reference
`workspace_members.digest_hour`; until the column exists, the schema
mismatch will surface as a Postgres error in any digest run.

The migration is idempotent (`IF NOT EXISTS` + `EXCEPTION WHEN
duplicate_object`), so re-applying is safe.

## Top backlog (next session)

1. **Register the Inngest app** in the Inngest dashboard so the
   crons (`recompute-active-client-count`, `send-daily-digest`,
   `process-recurring-tasks`, `audit-weekly`) actually fire on
   schedule. Endpoint + keys are ready; needs only the dashboard
   sync click.
2. **Apply migration #10** (above).
3. **Playwright smoke tests.** Coverage now spans the audit
   timeline, pricing matrix, activity pagination, calendar
   drag-to-reschedule, digest hour selector, plus prior features
   (recurring tasks, saved-views, subtask DnD, digest preview/nudge,
   billing tier-hint redirect, platform-IDs copy, inline tracking
   map, multi-token client search + bulk-archive, blog
   reading-progress, keyboard shortcuts, message drafts, inbox
   j/k). Worth automating the happy paths before the next
   dogfooding pass.
4. **Surface digest-hour customisation on the Team page.** Owners
   can see who's opted out via a column today; a small "9 AM" /
   "7 AM" tag next to each member would let admins spot-check the
   distribution at a glance. Read-only — members still self-edit
   in their own Settings.
5. **Calendar week view** at `/tasks/calendar?view=week`. The
   month grid is solid for planning; a 7-column × 24-row hourly
   week view would help users with timed tasks. Reuses the same
   updateTaskAction primitive the month-grid DnD already calls.
6. **Audit history sparkline on the client detail page.** The
   per-client timeline (shipped this session) shows a vertical
   list with deltas. A small SVG sparkline above it would
   visualise the trend at a glance — mirrors the dashboard
   rollup card.

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
| `0010_workspace_members_digest_hour.sql` | ⏳ pending Supabase |

## Env vars to light up dormant features

- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` set in
  Vercel (live endpoint confirms). Just needs the Inngest dashboard
  "Sync" / register-app step.
- **Resend** — `RESEND_API_KEY` set, `phloz.com` domain verified.
  Transactional emails + digest + nudges are now live (will fire
  once the cron sync above lands).
- **PostHog** — `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`.
- **GA4** — `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`.

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
  enabled, 10 migrations applied, #10 pending), GTM, Stripe sandbox
  (API pinned to `2026-04-22.dahlia`), Vercel app project (`phloz`,
  live at `app.phloz.com`, Inngest + Resend env vars set), Vercel
  marketing project (`phloz-web`, live at `phloz.com`), Supabase
  auth URLs + custom SMTP, DNS apex, Resend domain verified.
- ⏳ Inngest app registration (env vars set; dashboard sync
  pending), PostHog project, Sentry project, GA4 property.
