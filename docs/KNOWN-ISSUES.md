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

## 2026-04-23: Stripe price IDs are null in `TIERS` — RESOLVED (sandbox)

**Description:** `packages/billing/src/tiers.ts` shipped with
`monthlyStripePriceId`, `annualStripePriceId`, and `extraSeatStripePriceId`
set to `null` for every tier.

**Resolution (2026-04-23):** Created 4 Products + 12 Prices in Phloz
sandbox (`acct_1RXbVlPomvpsIeGO`) via Stripe MCP; IDs wired into
`tiers.ts` with inline product-ID comments. Starter stays free; the four
paid tiers (Pro / Growth / Business / Scale) are now checkout-ready in
test mode. `pnpm check` 29/29 green.

**Remaining:** Before launch, repeat the provisioning in live mode and
swap the IDs. The two orphan products from earlier experiments
(`prod_SSWcZ5D3sAcqgx` "Premium", `prod_SSWb4vOPLGNW4K` "Pro") should
be archived in the Stripe dashboard — they have no prices attached so
they're harmless, but they clutter the product list.

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

## 2026-04-23: @supabase/supabase-js require() in server.ts — RESOLVED

**Description:** `packages/auth/src/server.ts` lazy-loaded
`@supabase/supabase-js` via `require()`.

**Resolution (2026-04-23):** Refactored to `await import()` in Step 5
session; `createServiceRoleSupabase()` is now async. No callers
existed yet so the API change was free. ESLint + typecheck clean.

---

## 2026-04-23: Stripe MCP connected to wrong account — RESOLVED

**Description:** The Stripe MCP was pointing at
`acct_1QFi6lBVrlan59Tv` ("Exchange Rate Management") instead of Phloz.

**Resolution (2026-04-23):** User reconnected the MCP to the Phloz
sandbox account (`acct_1RXbVlPomvpsIeGO`). Product/price creation
still pending — deferred until the user confirms they want to proceed.

**Related:** Stripe API version bumped to `2026-03-25.dahlia` (the
version the user selected in the Stripe dashboard) + Stripe SDK
upgraded to `^22.0.2` to match.

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

## 2026-04-23: Supabase service role key + DATABASE_URL — RESOLVED

**Description:** Service role key + DATABASE_URL needed to be pasted
into `.env.local` from the Supabase dashboard.

**Resolution (2026-04-23):** User confirmed both are now in
`apps/app/.env.local` + Vercel env vars. They're using the new
`sb_secret_*` prefixed format (which supabase-js auto-detects) in
`SUPABASE_SERVICE_ROLE_KEY`. JWT signing migrated from legacy HS256
to ECC P-256 per the Supabase 2026 recommendation.

---

## 2026-04-23: shadcn primitives — partial library shipped

**Description:** Step 7 shipped a lean set of primitives (Button,
Input, Label, Card, Badge, Skeleton, Separator) without pulling in
Radix. The NEXT-STEPS list also mentioned dialog, dropdown-menu,
form, select, sheet, sonner, tabs, tooltip, avatar.

**Impact:** Routes that need a dialog / dropdown / etc. will hit a
missing primitive when Steps 8/9 build them.

**Workaround:** N/A — add per-route. Classic shadcn workflow: install
the Radix dep (`@radix-ui/react-dialog` etc.) + copy the primitive
source into `packages/ui/src/primitives/` + export from the barrel.

**Planned fix:** Add primitives on demand during Step 8 (marketing
site) and Step 9 (product app). Each one is ~50 LOC + 1 Radix dep and
takes 5 minutes.
