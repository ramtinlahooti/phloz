# Next Steps (as of 2026-04-25, late evening)

## Branch state

`claude/stupefied-vaughan-5f394f` is the active feature branch and
has been mid-session-merged into `main` repeatedly throughout the
day. Current `main` HEAD: see `git log -1 main` (last few sessions
have all fast-forwarded cleanly).

`pnpm check` 29/29 green. Both apps build clean. 9 Drizzle
migrations are reconciled with Supabase (0000-0009).

Vercel + Supabase + DNS + custom SMTP are wired live —
`phloz.com` (marketing) and `app.phloz.com` (product) both serving.

## Top backlog (next session)

1. **Wire `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`** in Vercel
   env on the `phloz` project + register the Inngest app at
   `https://app.phloz.com/api/inngest`. Until that ships,
   `recompute-active-client-count`, `send-daily-digest`,
   `process-recurring-tasks`, and the new `audit-weekly` crons all
   sit dormant. The dashboard's audit trend + sparkline only get
   real data once the cron runs.
2. **Playwright smoke tests.** Coverage now spans recurring tasks,
   saved-views (save / apply / share / rename / star-default),
   subtask DnD + Cmd-arrow reorder, digest preview + nudge, billing
   tier-hint redirect, platform-IDs copy, inline tracking map,
   clients-list multi-token search + bulk-archive, blog reading-
   progress + related posts, keyboard shortcuts, activity filter,
   calendar navigation, message drafts, inbox j/k. Worth automating
   the happy paths before the next dogfooding pass.
3. **Wire `RESEND_API_KEY` + verify the `phloz.com` domain in Resend**
   so transactional emails (invitations, magic links, daily digest,
   recurring-task notifications, "Send digest now" nudges) actually
   deliver. They currently log + no-op without the key.
4. **Surface the audit_log timeline on a client detail tab.** The
   weekly cron writes per-client `audit_run.client_summary` rows
   already; render them as a small history list inside the existing
   Audit tab so users can see when each finding first appeared.
5. **Per-tier comparison table on `/pricing`.** The homepage
   pricing strip + the dedicated `/pricing` cards both list each
   tier's caps, but a side-by-side feature matrix is missing.
   Pulls from the same `publicTiers()` source.
6. **Calendar drag-to-reschedule.** Pills on `/tasks/calendar`
   currently link to the list view's detail dialog. Dragging a
   pill onto a different cell could call `updateTaskAction` with
   the new due date — high-impact UX win that builds on the
   subtask DnD primitive.
7. **Activity feed pagination.** Currently capped at 30 items.
   "Show 30 more" or `?activity_offset=` would let users scroll
   back further when reviewing what changed.
8. **Per-member preference: digest hour-of-day.** The digest fires
   at 9 AM workspace-local. Some members want it earlier or later;
   a `digest_hour` column on `workspace_members` + a Settings
   selector would cover that without breaking the cron loop.

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
  doesn't fire without them; this is the single biggest "things go
  silent" risk on production right now.
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
  enabled, 10 migrations applied), GTM, Stripe sandbox (API pinned
  to `2026-04-22.dahlia`), Vercel app project (`phloz`, live at
  `app.phloz.com`), Vercel marketing project (`phloz-web`, live at
  `phloz.com`), Supabase auth URLs + custom SMTP, DNS apex.
- ⏳ Resend domain verification, Inngest app registration,
  PostHog project, Sentry project, GA4 property — these light up
  dormant features but aren't gating user-visible behaviour beyond
  email delivery + cron firing.
