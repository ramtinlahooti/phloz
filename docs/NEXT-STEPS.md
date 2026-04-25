# Next Steps (as of 2026-04-25, evening)

## Branch state

`claude/stupefied-vaughan-5f394f` is the active feature branch.
Three new feature commits since the last main-merge:

- `feat(saved-views)`: bookmark a default + auto-redirect bare /tasks
- `feat(team)`: surface "Digest off" badge when a member has muted
- `feat(subtasks)`: keyboard reorder (Cmd/Ctrl-↑/↓)

Plus a docs commit. Fast-forward main when ready.

`pnpm check` 29/29 green. Both apps build clean. 9 Drizzle
migrations all reconciled with Supabase.

## Top backlog (next session)

1. **Playwright smoke tests.** Coverage is now broad enough to
   benefit from automation:
   - Recurring-tasks happy path (manual `recurring/process` event +
     assertion).
   - Saved-views: save / apply / share / rename / star-default round-trip.
   - Subtask DnD + Cmd-↑/↓ reorder.
   - Digest preview returning ok.
   - Billing upgrade-hint redirect ending at Stripe checkout.
2. **Recurring template — pause / resume from cards.** The toggle
   already exists (RecurringRow component is shared between the
   workspace `/tasks/recurring` page and the per-client tasks tab),
   but the per-client variant doesn't surface the cadence next-fire
   estimate. Owners want to know "this fires next Monday".
3. **Per-template UI: usage hints.** When a workspace is at the
   recurring-template tier limit, the dialog already disables the
   New button. Add a "Manage subscription" inline CTA that links
   to /[workspace]/billing — closes the upgrade loop.
4. **Saved views: rename a shared view as the creator.** V1 only
   lets a member rename their own private views. The owner who
   shared a view should be able to rename it from the picker too —
   the action already permits it server-side
   (`user_id = auth.uid()` clause), the UI just hides the pencil
   on shared rows. Show pencil on shared rows when `isMine`.

   ✅ Already supported by the picker — `isMine` is true for shared
   rows the caller created, so rename appears. **Verify by hand
   then strike off the backlog if confirmed.**
5. **Team: "send a nudge"** menu item for a muted teammate. Fires
   `digest/send-daily` with the target member's `membership_id` so
   they get one ad-hoc send. Useful when an owner wants to remind
   someone what the digest looks like.
6. **Marketing site: blog post template polish.** Existing blog
   posts render fine but the layout is template-thin — typography
   pass, OG-image generator, related-posts strip.
7. **Audit engine: scheduled re-runs.** Inngest cron that
   re-evaluates every workspace's tracking maps weekly and pushes
   new findings into `audit_log` for the dashboard rollup card.

## SQL migrations queued

All 9 Drizzle migrations match Supabase state. Nothing pending.

| File | Status |
|---|---|
| `0000_melted_supreme_intelligence.sql` | ✅ applied |
| `0001_loving_marauders.sql` | ✅ applied 2026-04-24 |
| `0002_glamorous_susan_delgado.sql` | ✅ applied |
| `0003_wet_lake.sql` | ✅ applied |
| `0004_recurring_task_templates.sql` | ✅ applied 2026-04-24 |
| `0005_workspace_members_digest_enabled.sql` | ✅ applied 2026-04-25 |
| `0006_saved_views.sql` | ✅ applied 2026-04-25 |
| `0007_saved_views_is_shared.sql` | ✅ applied 2026-04-25 |
| `0008_tasks_sort_order.sql` | ✅ applied 2026-04-25 |
| `0009_workspace_members_default_saved_view.sql` | ✅ applied 2026-04-25 |

## Env vars to light up dormant features

- **PostHog** — `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`.
- **GA4** — `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`.
- **Resend** — `RESEND_API_KEY`. Daily digest + recurring-task
  crons + Settings → Notifications "Preview today's digest" all
  fire silently without it.
- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`.

## Deferred dep upgrades

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
  to `2026-04-22.dahlia`), Vercel app (`phloz`, live at
  `app.phloz.com`), Vercel marketing (`phloz-web`, live at
  `phloz.com`), Supabase auth URLs + custom SMTP.
- ⏳ Resend domain verification, Inngest app registration, PostHog
  project, Sentry project, GA4 property — these light up dormant
  features but aren't gating anything user-visible right now.
