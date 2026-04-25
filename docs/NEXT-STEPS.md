# Next Steps (as of 2026-04-25)

## Branch state

`claude/stupefied-vaughan-5f394f` was merged into `main` mid-session
(fast-forward; main was strictly behind). Three follow-up commits on
the branch since the merge — they need to land on main before the
production deploys catch up:

- `feat(client-tasks): inline recurring templates section`
- `feat(client-tasks): bulk selection + status grouping on client tab`
- `feat(billing): pre-flight tier-gate UX on recurring tasks page`

A second fast-forward of main → branch will pull them in, or wait
and squash a future bigger batch.

All commits pass `pnpm check` (29/29 green). Both apps build clean.

## Manual steps Ramtin still owes

### 1. Vercel: attach `phloz.com` to the `phloz-web` project

Confirmed via Vercel API that `phloz.com` is **not** in `phloz-web`'s
domain list — that's why "deployment not found" appeared. Steps:

1. Vercel dashboard → `phloz-web` project → Settings → Domains →
   "Add Domain" → enter `phloz.com`.
2. Add `www.phloz.com` with the redirect-to-apex option.
3. If Vercel says "in use elsewhere", check the `phloz` (app) project
   and remove it there first.

Production deployments on `phloz-web` are now green (the post-merge
build of `main` is `READY`). The previous production deployment from
`main` had errored — that's why no production deploy existed before
the merge.

### 2. DNS — drop the stale Vercel A record

`phloz.com` apex currently has two A records:
- ✅ `216.198.79.1` — Vercel's current recommended apex IP. Keep.
- ❌ `76.76.21.21` — Vercel's older anycast IP. Both happen to point
  at Vercel so DNS round-robin works, but it's redundant. Remove
  from Squarespace.

Add `www.phloz.com` as a CNAME → `cname.vercel-dns.com`, or A →
`216.198.79.1`. Without it the www subdomain won't resolve.

### 3. Supabase auth dashboard

Still required — the magic-link code fix is dormant without these:

1. Project Settings → Authentication → URL Configuration:
   - **Site URL**: `https://app.phloz.com`
   - **Redirect URLs** (add all three):
     - `https://app.phloz.com/auth/callback`
     - `https://app.phloz.com/auth/callback?**`
     - `http://localhost:3001/auth/callback?**`
2. Project Settings → Authentication → SMTP Settings → **Enable
   Custom SMTP** per `docs/DEPLOYMENT.md` Step 6 (host
   `smtp.resend.com`, port `465`, username `resend`, password = a
   Resend API key, sender `no-reply@phloz.com`).

### 4. Vercel env

Confirm `NEXT_PUBLIC_APP_URL=https://app.phloz.com` is set on the
`phloz-app` project (Production scope). The new
`getClientAppUrl()` helper reads it.

## Top backlog (next session)

1. **Subtask reordering (DnD).** `subtask-list.tsx` already renders
   an ordered list; add `dnd-kit` (or native HTML5 DnD) plus a
   `sort_order` column on `tasks` to persist.
2. **Saved-views polish.** Today only "save" + "delete". Add a small
   edit button per row for renaming, and a star icon to mark one
   view as "open this when I land on /tasks".
3. **Saved views — workspace-shared variant.** A second `is_shared`
   column would let owners publish a view all members see in their
   picker. Useful for agency-wide standards like "All overdue PPC
   tasks". Requires a small RLS policy tweak.
4. **Per-member digest preview link.** Settings → Notifications card
   gets a "Preview today's digest" button that fires the
   `digest/send-daily` Inngest event scoped to this workspace + this
   member. Useful for sanity-checking the new per-member filter
   without waiting until 9 AM tomorrow.
5. **Playwright smoke tests** for the recurring-tasks happy path
   (manual `recurring/process` event triggers a task; assertion that
   it appears in `/tasks`; cleanup) and the saved-views save/apply
   round-trip.
6. **Onboarding tier hint → checkout.** The signup form already
   captures `signup_tier_hint` in user metadata; the onboarding
   action could honor it (default `tier` on the workspace row to the
   hint when valid).

## SQL migrations queued

All 6 Drizzle migrations match Supabase state. Nothing pending.

| File | Status |
|---|---|
| `0000_melted_supreme_intelligence.sql` | ✅ applied |
| `0001_loving_marauders.sql` | ✅ applied 2026-04-24 |
| `0002_glamorous_susan_delgado.sql` | ✅ applied |
| `0003_wet_lake.sql` | ✅ applied |
| `0004_recurring_task_templates.sql` | ✅ applied 2026-04-24 |
| `0005_workspace_members_digest_enabled.sql` | ✅ applied 2026-04-25 |
| `0006_saved_views.sql` | ✅ applied 2026-04-25 |

## Env vars to light up dormant features

- **PostHog** — `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`.
- **GA4** — `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`.
- **Resend** — `RESEND_API_KEY`. Daily digest + recurring task crons
  fire silently without it.
- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`. Cron
  doesn't fire without them. Register at
  `app.phloz.com/api/inngest`.

## Deferred dep upgrades

Same skip list. Each is its own focused session:

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

`.env.local` files are gitignored + pre-filled with public Supabase
keys; only `SUPABASE_SERVICE_ROLE_KEY` + `DATABASE_URL` need real
values for local development.

## Accounts / provisioning status

- ✅ GitHub, Supabase (`tdvzhwhzxuskrsobdyrm`, RLS + JWT hook
  enabled, 7 migrations applied), GTM (`GTM-W3MGZ8V7`), Stripe
  sandbox (`acct_1RXbVlPomvpsIeGO`, 4 products × 3 prices live, API
  pinned to `2026-04-22.dahlia`), Vercel app project
  (`phloz`, live at `app.phloz.com`).
- 🚧 Vercel marketing project (`phloz-web`) — production deploy
  green, but `phloz.com` domain not yet attached to the project.
- ⏳ Supabase URL configuration + custom SMTP, Resend domain
  verification, Inngest app registration, PostHog project, Sentry
  project, GA4 property.
