# Next Steps (as of 2026-04-25, post-evening)

## Branch state

`claude/inspiring-wright-2ca122` is the active feature branch and
sits 3 commits ahead of `main` after this session
(`2052f6f` audit history, `67d333e` pricing matrix, `67f1373`
activity pagination). Earlier sessions today fast-forwarded into
`main` already.

`pnpm check` 29/29 green. Both apps build clean. 9 Drizzle
migrations are reconciled with Supabase (0000-0009). Inngest
endpoint at `https://app.phloz.com/api/inngest` confirms
`has_event_key` + `has_signing_key` + `mode: cloud` + 7 functions —
crons are wired and will start firing on schedule.

Vercel + Supabase + DNS + custom SMTP are wired live —
`phloz.com` (marketing) and `app.phloz.com` (product) both serving.

## Top backlog (next session)

1. **Register the Inngest app** in the Inngest dashboard so the
   crons (`recompute-active-client-count`, `send-daily-digest`,
   `process-recurring-tasks`, `audit-weekly`) actually fire on
   schedule. The endpoint is responsive and keys are present, but
   Inngest still needs to know the app exists. Once registered, the
   per-client audit history list shipped today starts populating
   with real production rows.
2. **Wire `RESEND_API_KEY` + verify the `phloz.com` domain in Resend**
   so transactional emails (invitations, magic links, daily digest,
   recurring-task notifications, "Send digest now" nudges) actually
   deliver. They currently log + no-op without the key.
3. **Calendar drag-to-reschedule** on `/tasks/calendar`. Pills
   currently link to the list view's detail dialog. Dragging a pill
   onto a different cell would call `updateTaskAction` with the new
   due date — high-impact UX win that builds on the subtask DnD
   primitive. Bigger surface area than today's items; deserves a
   focused session.
4. **Per-member preference: digest hour-of-day.** The digest fires
   at 9 AM workspace-local. A `digest_hour` column on
   `workspace_members` + a Settings selector would let members opt
   into earlier/later delivery without breaking the cron loop.
   Needs migration #10.
5. **Playwright smoke tests.** Coverage now spans recurring tasks,
   saved-views (save/apply/share/rename/star-default), subtask DnD +
   Cmd-arrow reorder, digest preview + nudge, billing tier-hint
   redirect, platform-IDs copy, inline tracking map, clients-list
   multi-token search + bulk-archive, blog reading-progress + related
   posts, keyboard shortcuts, activity filter + pagination, calendar
   navigation, message drafts, inbox j/k, per-client audit history,
   pricing comparison table. Worth automating the happy paths before
   the next dogfooding pass.
6. **Pre-existing lint warnings.** Two unused-import warnings remain:
   `apps/app/app/[workspace]/clients/page.tsx` (unused `asc`) and
   `apps/app/app/[workspace]/tasks/calendar/page.tsx` (unused
   `monthEnd`). Trivial cleanup, not blocking anything.

## SQL migrations queued

All 9 Drizzle migrations are applied to Supabase. Nothing pending.
A future migration #10 is queued for the per-member digest-hour
column above.

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

- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` are
  set in Vercel env (the `/api/inngest` payload confirms
  `has_event_key: true` + `has_signing_key: true`). Just needs the
  Inngest dashboard "Sync" / register-app step.
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
  `app.phloz.com`, Inngest env vars set), Vercel marketing project
  (`phloz-web`, live at `phloz.com`), Supabase auth URLs + custom
  SMTP, DNS apex.
- ⏳ Inngest app registration (env vars set; just needs the dashboard
  sync), Resend domain verification, PostHog project, Sentry
  project, GA4 property — these light up dormant features but
  aren't gating user-visible behaviour beyond email delivery + cron
  firing.
