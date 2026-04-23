# Known Issues

Append as they're discovered. Each entry has description, impact,
workaround (if any), and planned fix. Oldest first.

---

## 2026-04-23: `pnpm install` not yet run

**Description:** This session scaffolded every `package.json` but did not
execute `pnpm install`. Workspace resolution has not been verified.

**Impact:** Potentially cascading version conflicts that only surface at
install time — React 19 RC, Next 16, Tailwind v4 beta, Drizzle 0.36, and
Supabase SSR are all recent.

**Workaround:** Pinned versions match the latest known-good releases in
April 2026; conflicts likely but not certain.

**Planned fix:** First action of the next session — see
`docs/NEXT-STEPS.md` item 1. Fix resolution, commit the lockfile.

---

## 2026-04-23: Stripe price IDs are null in `TIERS`

**Description:** `packages/billing/src/tiers.ts` ships with
`monthlyStripePriceId`, `annualStripePriceId`, and `extraSeatStripePriceId`
set to `null` for every tier. Checkout will fail until they're filled.

**Impact:** No paid checkout works. Starter (free) flows still work.

**Workaround:** `isStripeConfigured()` in `packages/billing/src/stripe.ts`
lets UI gracefully hide upgrade buttons when Stripe isn't wired.

**Planned fix:** Once a Stripe account is provisioned and products +
prices are created, paste the IDs into `tiers.ts` and commit. `pnpm check`
will catch typos because the tier tests validate shape.

---

## 2026-04-23: Drizzle migrations not generated

**Description:** `drizzle-kit generate` hasn't been run. No SQL migration
files exist under `packages/db/migrations/`.

**Impact:** Can't apply schema to a live database yet.

**Workaround:** None. Schema + RLS policy SQL are all committed.

**Planned fix:** Once `DATABASE_URL` is available, run
`pnpm --filter @phloz/db db:generate`, review the emitted SQL, and commit.
Then `pnpm --filter @phloz/db db:migrate` and `tsx src/rls/apply.ts`.

---

## 2026-04-23: pgTAP tests require a live Postgres

**Description:** `packages/db/tests/rls/workspace-isolation.test.sql` can't
execute without a Supabase-style Postgres with pgTAP installed.

**Impact:** RLS invariants are not yet CI-verified.

**Workaround:** Code review covers the three invariants manually. pgTAP
tests document intended behaviour for the future CI runner.

**Planned fix:** CI job (Step 12) will spin up a Supabase container,
apply migrations + RLS, then `pg_prove` the tests.

---

## 2026-04-23: Custom Access Token hook requires manual Supabase config

**Description:** `packages/auth/src/hooks/custom-access-token-hook.sql`
creates the function but enabling it is a Supabase dashboard action
(Authentication → Hooks → Custom Access Token → select
`public.phloz_custom_access_token_hook`).

**Impact:** `active_workspace_id` won't appear in JWT claims until the
dashboard flag is flipped.

**Workaround:** Server code reads `user_metadata.active_workspace_id`
directly, which works without the hook.

**Planned fix:** Document the dashboard step in
`docs/DEPLOYMENT.md` (Step 13).

---

## 2026-04-23: GA4 / PostHog / Sentry keys absent

**Description:** `.env.example` enumerates them but no values are set.

**Impact:** `track()` calls (once Step 6 ships) will log-only in dev.

**Workaround:** Analytics package will treat missing keys as no-ops.

**Planned fix:** Provision the accounts and add to Vercel env vars as
part of Step 13.

---

## 2026-04-23: @supabase/supabase-js imported via require() in server.ts

**Description:** `packages/auth/src/server.ts` lazy-loads
`@supabase/supabase-js` via `require()` because the service-role client is
optional and we don't want to pull it into bundles that only use the
SSR client. ESM + `require()` works in Node 22 but ESLint will flag it.

**Impact:** Lint warning. No runtime issue.

**Workaround:** The line is annotated; revisit if lint gets stricter.

**Planned fix:** Refactor to a top-level dynamic `await import()` once
the app's module graph is finalised and we know the service-role client
is always worth including.
