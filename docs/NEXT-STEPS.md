# Next Steps (as of 2026-04-25)

## Branch state

`claude/stupefied-vaughan-5f394f` is the active feature branch.
After two mid-session merges to main earlier today, two more commits
landed on the branch since:

- `feat(subtasks): drag-to-reorder` — schema + migration 0008 applied
- `feat(billing): tier-hint deep-link + per-card upgrade buttons`

Plus this docs commit. Fast-forward main when ready.

All commits pass `pnpm check` (29/29 green; 28 billing tests). Both
apps build clean.

## Manual steps Ramtin still owes

(Same as before — these still gate end-to-end auth + marketing.)

### Vercel dashboard

- `phloz-web` project → Settings → Domains → add `phloz.com` and
  `www.phloz.com`. Production deploy is green; the domain just needs
  to be wired.
- Confirm `NEXT_PUBLIC_APP_URL=https://app.phloz.com` is set on
  `phloz-app` (Production scope).

### Supabase auth

- Authentication → URL Configuration: Site URL =
  `https://app.phloz.com`. Redirect URLs: add
  `https://app.phloz.com/auth/callback{,?**}` and
  `http://localhost:3001/auth/callback?**`.
- Authentication → SMTP Settings → Enable Custom SMTP per
  `docs/DEPLOYMENT.md` Step 6.

### DNS

- Drop the stale `76.76.21.21` A record on `phloz.com`. Keep
  `216.198.79.1`.
- Add a CNAME `www.phloz.com → cname.vercel-dns.com` so the www
  subdomain resolves.

## Top backlog (next session)

1. **Playwright smoke tests.** Recurring-tasks happy path, saved-
   views save / apply / share / rename round-trip, subtask DnD
   reorder, digest preview returning ok, billing upgrade-hint
   redirect ending at Stripe checkout.
2. **Saved views: bookmark a default.** Star icon per row that
   marks "open this when I land on /tasks". Likely a
   `default_saved_view_id` column on `workspace_members` (per-user,
   scoped). Tasks page reads it on landing and redirects when no
   query params are set.
3. **Team-wide digest opt-out visibility.** Owners want to see who
   on the team has muted the daily digest. New column on the Team
   page row + a small "Send a nudge" link that fires the manual
   `digest/send-daily` event scoped to that member.
4. **Recurring template — pause / resume from cards.** The card on
   `/tasks/recurring` already toggles enabled state, but the
   per-template UI on the client tasks tab doesn't surface the
   toggle. Mirror the workspace page.
5. **Marketing site domain split.** Production deploy on `phloz-web`
   is green, just needs `phloz.com` attached. Once attached, remove
   `phloz.com` from the app project's domain list to stop the
   "DNS round-robin to two projects" risk.
6. **Subtask reorder — keyboard support.** DnD works with mouse +
   touch but power users will want ⌘↑/⌘↓ to nudge a subtask up or
   down. Same `reorderSubtasksAction` underneath.

## SQL migrations queued

All 8 Drizzle migrations match Supabase state. Nothing pending.

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

## Env vars to light up dormant features

- **PostHog** — `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`.
- **GA4** — `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`.
- **Resend** — `RESEND_API_KEY`. Daily digest + recurring-task
  crons + the Settings → Notifications "Preview today's digest"
  button all fire silently without it.
- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`. Cron
  doesn't fire without them.

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
  enabled, 9 migrations applied), GTM (`GTM-W3MGZ8V7`), Stripe
  sandbox (`acct_1RXbVlPomvpsIeGO`, 4 products × 3 prices live, API
  pinned to `2026-04-22.dahlia`), Vercel app project (`phloz`, live
  at `app.phloz.com`).
- 🚧 Vercel marketing project (`phloz-web`) — production deploy
  green, but `phloz.com` domain not yet attached to the project.
- ⏳ Supabase URL configuration + custom SMTP, Resend domain
  verification, Inngest app registration, PostHog project, Sentry
  project, GA4 property.
