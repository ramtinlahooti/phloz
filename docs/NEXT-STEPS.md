# Next Steps (as of 2026-04-25)

## Branch state

`claude/stupefied-vaughan-5f394f` is the active feature branch.
After merging to main earlier this session, three follow-up batches
shipped on top:

1. Client tasks tab parity (per-template inline + bulk selection +
   tier-gate UX).
2. Onboarding tier-hint redirect + per-member digest preview button.
3. Saved-views in-place rename + workspace-shared variant
   (`is_shared` column, migration 0007).

All commits pass `pnpm check` (29/29 green; 28 billing tests). Both
apps build clean. Ready to fast-forward main when Ramtin says go.

## Manual steps Ramtin still owes

(Same as the previous session-wrap — the ones still pending.)

### 1. Vercel: attach `phloz.com` to `phloz-web`

API confirms the domain isn't in the `phloz-web` project yet.
Dashboard → `phloz-web` → Settings → Domains → "Add Domain" →
`phloz.com` and `www.phloz.com`. Production deploys are now green —
the domain just needs to be wired.

### 2. DNS — drop `76.76.21.21` A record

Stale Vercel IP. Keep `216.198.79.1` (current). Add `www.phloz.com`
as a CNAME → `cname.vercel-dns.com`.

### 3. Supabase auth dashboard

Magic-link code fix is dormant without these:

1. Authentication → URL Configuration:
   - **Site URL**: `https://app.phloz.com`
   - **Redirect URLs**:
     - `https://app.phloz.com/auth/callback`
     - `https://app.phloz.com/auth/callback?**`
     - `http://localhost:3001/auth/callback?**`
2. Authentication → SMTP Settings → Enable Custom SMTP per
   `docs/DEPLOYMENT.md` Step 6.

### 4. Vercel env

Confirm `NEXT_PUBLIC_APP_URL=https://app.phloz.com` on `phloz-app`
(Production scope).

## Top backlog (next session)

1. **Subtask reordering (DnD).** `subtask-list.tsx` already renders
   an ordered list. Add a `sort_order` integer column on `tasks` +
   migration; use HTML5 native DnD or `@dnd-kit/core` to drag rows
   inside the task-detail dialog; persist via a new
   `reorderSubtasksAction`.
2. **Playwright smoke tests.** Recurring-tasks happy path (manual
   `recurring/process` event + assertion). Saved-views save /
   apply / share round-trip. Per-member digest preview returning ok.
3. **Onboarding tier hint → checkout.** V1 redirects to
   `/[workspace]/billing?upgrade=<tier>` but the billing page
   doesn't currently parse the `upgrade` param. Read it and either
   pre-select the matching tier card or fire Stripe checkout
   immediately.
4. **Saved views: bookmark a default.** A star icon per row that
   toggles "open this when I land on /tasks". Maybe a
   `default_view_id` column on `workspace_members` (per-user, scoped).
5. **Per-template UI: shared workspace-wide view of all team
   members' digest opt-out states.** Owners want to see who's
   muted at a glance. Settings → Team would be the natural spot.
6. **Marketing site domain split.** Spin up the second Vercel
   project entirely (already done), then remove `phloz.com` from
   the app project's domain list to stop double-attachment risk.

## SQL migrations queued

All 7 Drizzle migrations match Supabase state. Nothing pending.

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

## Env vars to light up dormant features

- **PostHog** — `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`.
- **GA4** — `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`.
- **Resend** — `RESEND_API_KEY`. Daily digest + recurring-task crons
  + the new "Preview today's digest" button all fire silently
  without it.
- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`. Cron
  doesn't fire without them. Register at
  `app.phloz.com/api/inngest`.

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
  enabled, 8 migrations applied), GTM (`GTM-W3MGZ8V7`), Stripe
  sandbox (`acct_1RXbVlPomvpsIeGO`, 4 products × 3 prices live, API
  pinned to `2026-04-22.dahlia`), Vercel app project (`phloz`, live
  at `app.phloz.com`).
- 🚧 Vercel marketing project (`phloz-web`) — production deploy
  green, but `phloz.com` domain not yet attached to the project.
- ⏳ Supabase URL configuration + custom SMTP, Resend domain
  verification, Inngest app registration, PostHog project, Sentry
  project, GA4 property.
