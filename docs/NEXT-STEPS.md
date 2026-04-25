# Next Steps (as of 2026-04-25, late evening)

## Branch state

`claude/stupefied-vaughan-5f394f` is the active feature branch.
Three new feature commits since the last main-merge plus this
docs commit. Fast-forward main when ready.

`pnpm check` 29/29 green. Both apps build clean. 9 Drizzle
migrations all reconciled with Supabase.

## Top backlog (next session)

1. **Playwright smoke tests.** Coverage now spans recurring tasks,
   saved views, subtask DnD + Cmd-arrow reorder, digest preview,
   billing tier-hint redirect, platform-IDs copy, inline tracking
   map, clients-list filters. Worth automating the happy paths.
2. **Recurring template — next-fire estimate** in the per-client
   tasks tab. Owners want "fires next Monday" hints on the cards.
3. **Tier-limit upgrade CTAs in dialog disabled state.** When the
   recurring-template New button is disabled at-limit, surface an
   inline "Manage subscription" CTA that links to /billing.
4. **Audit engine: scheduled re-runs.** Inngest cron that re-
   evaluates every workspace's tracking maps weekly and pushes new
   findings into `audit_log` for the dashboard rollup card.
5. **Marketing blog post template polish.** Existing posts render
   fine but the layout is template-thin — typography pass, OG-image
   generator, related-posts strip.
6. **Team: "Send a nudge"** menu item for muted teammates. Fires
   `digest/send-daily` with the target member's `membership_id`
   so they get one ad-hoc send.
7. **Inline canvas perf gating.** Today the React Flow bundle
   downloads on every client-detail visit because the Tracking map
   tab is rendered (not just shown) by the Tabs primitive. Wrap
   in `next/dynamic` with `ssr: false` so the bundle only loads
   when the user actually opens the tab.

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

- ✅ GitHub, Supabase, GTM, Stripe sandbox (API pinned to
  `2026-04-22.dahlia`), Vercel app (`phloz`, live at
  `app.phloz.com`), Vercel marketing (`phloz-web`, live at
  `phloz.com`), Supabase auth URLs + custom SMTP, DNS apex
  (`216.198.79.1`).
- ⏳ Resend domain verification, Inngest app registration,
  PostHog project, Sentry project, GA4 property — these light up
  dormant features but aren't gating user-visible behaviour.
