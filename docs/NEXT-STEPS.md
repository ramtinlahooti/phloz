# Next Steps (as of 2026-04-25)

## Branch state

`claude/stupefied-vaughan-5f394f` is now **34 commits ahead of `main`**
(was 30 at last wrap). All commits pass `pnpm check` (29/29 green;
billing test suite at 28). Both apps build clean. Ready to squash-merge
to `main` whenever Ramtin is done dogfooding.

Vercel is wired and live. New commits trigger a fresh deploy.

## Manual steps Ramtin still owes

Highest priority — without these, magic-link login + transactional
emails don't work end-to-end on production:

### Supabase auth dashboard

1. Project Settings → Authentication → URL Configuration:
   - **Site URL**: `https://app.phloz.com`
   - **Redirect URLs** (add all three):
     - `https://app.phloz.com/auth/callback`
     - `https://app.phloz.com/auth/callback?**`
     - `http://localhost:3001/auth/callback?**`
2. Project Settings → Authentication → SMTP Settings → **Enable
   Custom SMTP** and fill in the Resend creds per
   `docs/DEPLOYMENT.md` Step 6 (host `smtp.resend.com`, port `465`,
   username `resend`, password = a Resend API key, sender
   `no-reply@phloz.com`). Pre-req: `phloz.com` verified in Resend.

### Vercel env

Confirm `NEXT_PUBLIC_APP_URL=https://app.phloz.com` is set on the
`phloz-app` project (Production scope). The new
`getClientAppUrl()` helper reads it.

### DNS / Vercel marketing project (still pending from last session)

`phloz.com` apex still resolves to the app project — that's why
`phloz.com/login` works. Long-term: spin up a second Vercel project
for `apps/web` rooted at `phloz.com`, remove `phloz.com` from the
app project's Domains. Otherwise marketing visitors keep getting
redirected through the app's `/login`.

## Top backlog (next session)

1. **Per-template UI on the client tasks tab.** V1 only surfaces
   workspace-wide `/tasks/recurring`. Client-specific pages should
   show client-scoped templates inline so agency owners discover
   them without leaving the client view.
   (`apps/app/app/[workspace]/clients/[clientId]/...`)
2. **Bulk selection on `/clients/[id]` tasks tab** — parity with
   the workspace `/tasks` page (lift `task-list-with-selection.tsx`
   shared logic).
3. **Subtask reordering (DnD)** — `subtask-list.tsx` already renders
   an ordered list; add `dnd-kit` (or native HTML5 DnD) plus a
   `sort_order` column on `tasks` to persist.
4. **Saved-views polish: rename in-place + bookmark default.**
   Today only "save" + "delete". Add a small edit button per row
   for renaming, and a star icon to mark one view as "open this
   when I land on /tasks".
5. **Wire the recurring-template tier-gate to the dialog UX.** The
   gate is enforced server-side, but the dialog doesn't pre-check
   — users only see the limit message after Submit. Fetch the
   count on render of `/tasks/recurring` and disable the New
   button + show "Pro upgrade" CTA when at-limit.
6. **Saved views — workspace-shared variant.** V1 is personal-only.
   A second `is_shared` column would let owners publish a view all
   members see in their picker. Useful for agency-wide standards
   like "All overdue PPC tasks".
7. **Playwright smoke test for the recurring-tasks happy path** —
   manual `recurring/process` event triggers a task; assertion that
   it appears in `/tasks`; cleanup. Bonus: snapshot test for the
   new `digest_enabled` toggle saving.

## SQL migrations queued

All 6 Drizzle migrations match Supabase state:

| File | Status |
|---|---|
| `0000_melted_supreme_intelligence.sql` | ✅ applied (initial) |
| `0001_loving_marauders.sql` | ✅ applied 2026-04-24 |
| `0002_glamorous_susan_delgado.sql` | ✅ applied (newsletter) |
| `0003_wet_lake.sql` | ✅ applied (audit_suppressions) |
| `0004_recurring_task_templates.sql` | ✅ applied 2026-04-24 |
| `0005_workspace_members_digest_enabled.sql` | ✅ applied 2026-04-25 |
| `0006_saved_views.sql` | ✅ applied 2026-04-25 |

Nothing queued. Future migrations: `pnpm --filter @phloz/db
db:generate` → SQL editor paste / `db:migrate`.

## Env vars to light up dormant features

- **PostHog** — `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`.
  Without these, `track()` is a no-op.
- **GA4** — `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`.
- **Resend** — `RESEND_API_KEY`. Without this every transactional
  email + the daily digest is a logged no-op. Recurring task
  templates still fire — just silently.
- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`. Cron
  doesn't fire without them. The `process-recurring-tasks` and
  `send-daily-digest` crons are dormant until they're set + the app
  is registered at `app.phloz.com/api/inngest`.

## Deferred dep upgrades

Same skip list as last session:

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
  pinned to `2026-04-22.dahlia`), Vercel app project (live).
- ⏳ Vercel marketing project, Supabase URL configuration + custom
  SMTP, Resend domain verification, Inngest app registration,
  PostHog project, Sentry project, GA4 property.
