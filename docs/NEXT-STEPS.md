# Next Steps (as of 2026-04-26)

## Branch state

`claude/bold-johnson-f87ad7` was the active branch this session.
Three commits landed on top of `main`:

- `feat(client-audit): per-client audit history timeline + sparkline`
- `chore(app): drop two stale unused-symbol lint warnings`
- `chore(claude): allow pnpm check * in local permissions`

Pushed to `origin/claude/bold-johnson-f87ad7`. PR creation link:
<https://github.com/ramtinlahooti/phloz/pull/new/claude/bold-johnson-f87ad7>

`pnpm check` 29/29 green, **0 lint warnings**. Both apps build
clean. 9 Drizzle migrations are reconciled with Supabase
(0000–0009). Vercel + Supabase + DNS + custom SMTP wired live.

## Top backlog (next session)

1. **Wire `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` in Vercel env**
   on the `phloz` project + register the Inngest app at
   `https://app.phloz.com/api/inngest`. Until that ships,
   `recompute-active-client-count`, `send-daily-digest`,
   `process-recurring-tasks`, and `audit-weekly` all sit dormant.
   The new per-client audit-history timeline only gets real data
   once the cron runs (or someone hits Run-now).
2. **Wire `RESEND_API_KEY` + verify the `phloz.com` domain in
   Resend** so transactional emails (invitations, magic links,
   daily digest, recurring-task notifications, "Send digest now"
   nudges) actually deliver. They currently log + no-op without
   the key.
3. **Playwright smoke tests** for the recently-shipped surfaces:
   recurring tasks, saved-views, subtask DnD + Cmd-arrow
   reorder, calendar month-grid, message drafts, inbox `j`/`k`,
   audit Run-now, per-client tier-gate, audit history tab. Worth
   automating the happy paths before the next dogfooding pass.
4. **Per-tier comparison table on `/pricing`.** The homepage
   pricing strip + the dedicated `/pricing` cards both list each
   tier's caps, but a side-by-side feature matrix is missing.
   Pulls from the same `publicTiers()` source.
5. **Calendar drag-to-reschedule.** Pills on `/tasks/calendar`
   currently link to the list view's detail dialog. Dragging a
   pill onto a different cell could call `updateTaskAction` with
   the new due date — high-impact UX win that builds on the
   subtask DnD primitive.
6. **Activity feed pagination.** Currently capped at 30 items.
   "Show 30 more" or `?activity_offset=` would let users scroll
   back further when reviewing what changed.
7. **Per-member preference: digest hour-of-day.** The digest
   fires at 9 AM workspace-local. Some members want it earlier
   or later; a `digest_hour` column on `workspace_members` + a
   Settings selector would cover that without breaking the cron
   loop.
8. **Audit history: 90-day rollup mode.** The new per-client
   timeline shows up to 8 weekly snapshots. A toggle for "last
   90 days, daily" would help once the cron has been running
   long enough to accumulate that volume.

## SQL migrations queued

All 9 Drizzle migrations are applied to Supabase. Nothing pending.

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

## Env vars to light up dormant features

- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`. Cron
  doesn't fire without them; biggest "things go silent" risk on
  production right now. Per-client audit history needs this to
  populate.
- **Resend** — `RESEND_API_KEY`. Transactional emails + digest +
  nudges all log + no-op without it.
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
  enabled, 10 migrations applied), GTM, Stripe sandbox (API
  pinned to `2026-04-22.dahlia`), Vercel app project (`phloz`,
  live at `app.phloz.com`), Vercel marketing project
  (`phloz-web`, live at `phloz.com`), Supabase auth URLs +
  custom SMTP, DNS apex.
- ⏳ Resend domain verification, Inngest app registration,
  PostHog project, Sentry project, GA4 property — these light
  up dormant features but aren't gating user-visible behaviour
  beyond email delivery + cron firing.
