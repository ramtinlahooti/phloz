# Next Steps (as of 2026-04-24)

## Branch state

`claude/stupefied-vaughan-5f394f` is **30 commits ahead of `main`**
(was 28, this session added the recurring-tasks feature commit + a
bulk dep-update commit). All commits pass `pnpm check` (29/29 green)
and both apps build clean. Ready to squash-merge to `main` when
Ramtin is done dogfooding.

Vercel deployment is already wired and live. New commits will
trigger a fresh deploy. The `next-mdx-remote` advisory should clear
once the marketing project rebuilds against `^6.0.0`.

## Top backlog (next session)

1. **Per-member daily digest + per-user opt-out** — currently the
   digest goes to the workspace owner only with workspace-wide
   content. Add a `workspace_members.digest_enabled` column,
   filter the agenda by `assignee_id = me`, and ship a settings
   toggle. (`apps/app/inngest/functions/send-daily-digest.ts` +
   `apps/app/app/[workspace]/settings/page.tsx`.)
2. **Saved filter views on `/tasks`** — name + persist a filter
   combo. New `saved_views` table; a "Save current view" button
   on `task-filters.tsx` populates it; a dropdown above the pills
   lists the user's saved views.
3. **Bulk selection on `/clients/[id]` tasks tab** — parity with
   the workspace `/tasks` page (small; lift
   `task-list-with-selection.tsx` shared logic).
4. **Subtask reordering (DnD)** — `subtask-list.tsx` already
   renders an ordered list; add `dnd-kit` (or native HTML5 DnD)
   plus a `sort_order` column on `tasks` to persist.
5. **Tier-gate recurring templates** — V1 is unbounded; add a
   `canAddRecurringTemplate(workspaceId)` gate in
   `packages/billing/gates.ts` with per-tier limits before paid
   plans go live.
6. **Per-template UI: list + delete on `/clients/[id]/tasks` tab**
   — V1 only surfaces the workspace-wide `/tasks/recurring` route.
   Client-specific pages should show client-scoped templates
   inline.
7. **Playwright smoke test for the recurring-tasks happy path** —
   manual `recurring/process` event triggers a task; cleanup;
   asserts task row appears.

## Manual actions Ramtin still owes (tracked across sessions)

### Vercel marketing project

- The repo has both `apps/app/vercel.json` and `apps/web/vercel.json`
  but only one project exists today. `phloz.com` currently
  redirects to `/login` because DNS hits the app project.
- Add New Project → import `ramtinlahooti/phloz` → Root Directory =
  `apps/web`. Env vars: only `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_GTM_ID`. **Don't**
  copy DB / Stripe vars.
- In the existing `apps/app` project: remove `phloz.com` from
  Domains, ensure `app.phloz.com` is there.

### SQL migrations queued

All 4 Drizzle migration files now match Supabase state:

| File | Status |
|---|---|
| `0000_melted_supreme_intelligence.sql` | ✅ applied (initial) |
| `0001_loving_marauders.sql` | ✅ applied 2026-04-24 (this session) |
| `0002_glamorous_susan_delgado.sql` | ✅ applied (newsletter) |
| `0003_wet_lake.sql` | ✅ applied (audit_suppressions) |
| `0004_recurring_task_templates.sql` | ✅ applied 2026-04-24 (this session) |

Nothing queued. Future migrations just need `pnpm --filter @phloz/db
db:generate` → SQL editor paste / `db:migrate`.

### Env vars to light up dormant features

- **PostHog** — `NEXT_PUBLIC_POSTHOG_KEY` + `POSTHOG_API_KEY`.
  Without these, `track()` is a no-op.
- **GA4** — `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`.
- **Resend** — `RESEND_API_KEY`. Without this every transactional
  email + the daily digest is a logged no-op. Recurring tasks still
  fire, just silently.
- **Inngest** — `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY`. Cron
  doesn't fire without them. The new `process-recurring-tasks`
  cron is dormant until they're set + the app is registered at
  `app.phloz.com/api/inngest`.

## Deferred dep upgrades

Skipped this session because each one is a non-trivial migration
better done as its own focused task:

- **zod 3 → 4** — cross-codebase schema migration. Touches every
  `packages/*` Zod-using file plus all server actions. Plan a
  dedicated session.
- **vitest 2 → 4** — `vitest.config` breaking changes; some
  matchers renamed.
- **typescript 5 → 6** — major; flag-by-flag review of `tsconfig`
  options.
- **eslint 9 → 10** — flat-config tweaks.
- **@hookform/resolvers 3 → 5** — waits on zod 4.

`pnpm-lock.yaml` no longer has security advisories.

## Demo flow (60 seconds)

1. Sign up → workspace → `/` shows onboarding checklist.
2. "Add your first client" → fill form → land on client detail
   page with a stats strip + 7 tabs.
3. Tracking map tab → "Seed starter setup" → 6 nodes + 5 edges.
4. Audit tab → "All clear" (because Meta CAPI was seeded).
5. Delete the CAPI node on the map → return to Audit → see
   `meta-pixel-no-capi` warning surface immediately.
6. Click Snooze → reason "iOS-only client" → finding moves to
   "Suppressed rules" section.
7. Tasks → "Recurring" → New recurring task: "Weekly review",
   weekly, Monday → save. The cron will fire it at 6 AM Monday
   workspace-local time.
8. Press ⌘K from anywhere → command palette navigates to any
   client / task / page.

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
  enabled, 5 migrations applied), GTM (`GTM-W3MGZ8V7`), Stripe
  sandbox (`acct_1RXbVlPomvpsIeGO`, 4 products × 3 prices live,
  API pinned to `2026-04-22.dahlia`), Vercel app project (live).
- ⏳ Vercel marketing project, Resend domain verification, Inngest
  app registration, PostHog project, Sentry project, GA4 property.
