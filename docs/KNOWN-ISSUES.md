# Known Issues

Append as they're discovered. Each entry has description, impact,
workaround (if any), and planned fix. Oldest first.

---

## 2026-04-23: `pnpm install` not yet run — RESOLVED

**Description:** This session scaffolded every `package.json` but did not
execute `pnpm install`. Workspace resolution had not been verified.

**Resolution (2026-04-23):** Install runs clean in 10.5s. Build-script
warnings resolved via `pnpm.onlyBuiltDependencies` in root `package.json`.
Lockfile committed.

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

## 2026-04-23: Drizzle migrations not generated — RESOLVED

**Description:** `drizzle-kit generate` hadn't been run. No SQL migration
files existed under `packages/db/migrations/`.

**Resolution (2026-04-23):** Migration `0000_melted_supreme_intelligence.sql`
generated (25 tables, 41 FKs, 45 indexes) and applied to the
`tdvzhwhzxuskrsobdyrm` Supabase project via the Supabase MCP. RLS
policies applied in a follow-up migration. Advisor run confirmed zero
WARN-level security findings after the `search_path` hardening.

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

## 2026-04-23: Custom Access Token hook — PARTIAL

**Description:** The SQL function `public.phloz_custom_access_token_hook`
is installed in Supabase (confirmed via MCP migration), but enabling it
is still a Supabase dashboard action (Authentication → Hooks → Custom
Access Token → select `public.phloz_custom_access_token_hook`).

**Impact:** `active_workspace_id` won't appear in JWT claims until the
dashboard toggle is flipped.

**Workaround:** Server code reads `user_metadata.active_workspace_id`
directly, which works without the hook.

**Planned fix:** One-time dashboard click. `function_search_path_mutable`
advisor warning has been resolved (`SET search_path = public, auth`
applied 2026-04-23).

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

---

## 2026-04-23: Stripe MCP connected to wrong account

**Description:** The Stripe MCP reports account
`acct_1QFi6lBVrlan59Tv` ("Exchange Rate Management"). The Phloz Stripe
dashboard URL is `acct_1RXbVfLUfWiw9Veu`. Different accounts.

**Impact:** Any product/price/customer created via the MCP would land in
the wrong Stripe account. Blocks wiring `TIERS` Stripe IDs.

**Workaround:** None — paused until reconnected.

**Planned fix:** Reconnect the Stripe MCP to the Phloz account via
Claude Code settings. Then re-run the tier-product provisioning flow
(create Products + monthly/annual/extra-seat Prices for Pro/Growth/
Business/Scale → paste IDs into `packages/billing/src/tiers.ts`).

---

## 2026-04-23: V2 stub tables have RLS with no policies (by design)

**Description:** Supabase advisor reports 9 INFO-level
`rls_enabled_no_policy` findings for `ad_*`, `audit_rules`,
`tracking_node_versions`, `tracking_templates`, and
`portal_magic_links`.

**Impact:** None — this is the intentional default-deny posture for V2
stubs (see `packages/db/src/rls/_v2-tables.sql`) and for the
service-role-only `portal_magic_links` table. All access goes through
the service role which bypasses RLS.

**Workaround:** N/A.

**Planned fix:** N/A. When V2 features begin, each table adds its own
policy file and the INFO finding will clear naturally.

---

## 2026-04-23: Supabase service role key + DATABASE_URL not in `.env.local`

**Description:** Public keys are captured (anon JWT + `sb_publishable_*`
from MCP), but the service role key and the direct Postgres connection
string still need to be pasted by the user from the Supabase dashboard.

**Impact:** Can't run server-side code that needs RLS bypass (seed
script, webhook handlers, Inngest jobs) until the values are present.

**Workaround:** All code uses `requireEnv()` at call time, so the app
boots without them. Anything requiring RLS bypass will throw
`Required env var SUPABASE_SERVICE_ROLE_KEY is not set` when invoked.

**Planned fix:** User pastes into `.env.local`:
- `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings → API
- `DATABASE_URL` — from Project Settings → Database → Connection string
  → URI (prefer the transaction pooler port 6543 for serverless)
