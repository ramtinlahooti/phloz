# Next Steps (as of 2026-04-23, post-Steps-5–7)

Ordered by priority. Each bullet is a concrete action for the next session.

## Ramtin's immediate actions (blocking, ~5 minutes total)

1. **Enable the Custom Access Token hook** in the Supabase dashboard:
   Authentication → Hooks → Custom Access Token → select
   `public.phloz_custom_access_token_hook`. One-time click. Until this is
   flipped, `active_workspace_id` won't appear in JWT claims — server code
   falls back to `user_metadata.active_workspace_id`, so nothing breaks,
   but RLS policies will be slightly slower.

2. **Decide whether to create Stripe products now.** The Stripe MCP is
   now connected to the Phloz sandbox (`acct_1RXbVlPomvpsIeGO`). If you
   say go, I can auto-create the 4 paid tier products + their
   monthly / annual / extra-seat prices and paste the IDs into
   `packages/billing/src/tiers.ts`. Safe to do now — it only writes to
   the sandbox.

3. **(Optional, for when you're ready to test emails end-to-end)**
   Verify the `phloz.com` + `inbound.phloz.com` domains in Resend. See
   `docs/DNS-SETUP.md` for the exact DNS records and Resend webhook URL.
   Can wait until Step 9 ships the actual inbound route handler.

## Claude's next session (pick one)

**Option A — Step 8: `apps/web` marketing site.** All routes from PROMPT_1
Step 8 (home, pricing, features, about, contact, blog, compare,
use-cases, crm-for, integrations, help, legal, sitemap, robots,
llms.txt) with proper `generateMetadata()` + JSON-LD. Seed 3 blog MDX
posts. Uses `@phloz/ui` primitives + components already shipped. Big
session — 4-6 hours of focused work.

**Option B — Step 9: `apps/app` product.** Auth routes, onboarding
flow, dashboard routes (clients list, client split-pane, team, billing,
settings), portal routes, API routes (Stripe + Resend inbound webhooks,
workspace switch, health). Middleware wired to `@phloz/auth`. This is
the biggest session on the roadmap — probably 6-8 hours.

**Option C — Create Stripe products + finalize billing wiring.** ~30 min.
Run the 4×3 product/price matrix through the Stripe MCP, paste IDs into
`tiers.ts`, commit. Smallest next session, unblocks paid checkout flows
in Steps 8/9.

**Option D — Add remaining shadcn primitives now instead of lazily.**
~1 hour. Add Radix-backed dialog, dropdown-menu, sheet, sonner, tabs,
tooltip, avatar, select, popover, form to `packages/ui/src/primitives/`.
Safer than doing them mid-Step-8, but adds latency to the "real" work.

Recommended order: **C → A → B → then circle back for Steps 10-12.**
(Fast win, then the visible marketing site, then the heavy product app.)

## Remaining roadmap after Steps 8-9

- **Step 10 — Inngest setup.** `apps/app/inngest/` client + function
  registry + `recomputeActiveClientCount` nightly function.
- **Step 11 — Observability.** Sentry + PostHog init, verify GTM fires
  on home page, pino structured logs in server contexts.
- **Step 12 — CI.** `.github/workflows/ci.yml` running `pnpm check` on
  push/PR plus a job that queries `pg_tables.rowsecurity` against every
  `TENANT_TABLES` entry and runs pgTAP against an ephemeral Supabase
  container.
- **Step 13 — Deployment.** Vercel projects for web + app, env vars,
  preview deployments wired.
- **Steps 14-17 — Final verification + docs polish.**

> After Step 9, come back to the planning chat (per PROMPT_1 final line)
> for Prompt 2: the tracking map editor.

## Already provisioned / done

- ✅ Supabase — project `tdvzhwhzxuskrsobdyrm`, 25 tables + RLS applied,
  TS types generated, JWT hook installed (dashboard activation pending),
  JWT signing migrated to ECC P-256.
- ✅ GitHub — `ramtinlahooti/phloz`, `main` tracking `origin/main`.
- ✅ GTM container ID — `GTM-W3MGZ8V7` wired into `packages/analytics`.
- ✅ Stripe — SDK pinned to `^22.0.2` for API `2026-03-25.dahlia`, MCP
  connected to sandbox.
- ✅ `packages/config` — Zod env + tsconfig base + constants.
- ✅ `packages/db` — schema + RLS + migrations applied to Supabase.
- ✅ `packages/auth` — SSR helpers + roles + portal magic links.
- ✅ `packages/billing` — tiers + gates + Stripe client + webhooks
  (price IDs still null — see Option C above).
- ✅ `packages/email` — Resend client + 3 templates + inbound parser +
  webhook verifier.
- ✅ `packages/analytics` — typed EventMap + GTM + PostHog + GA4
  Measurement Protocol.
- ✅ `packages/ui` — Tailwind v4 stylesheet + 7 primitives + 4 Phloz
  components + Geist font loader.
- ✅ Vercel env vars uploaded (per Ramtin 2026-04-23).

## Still to provision (non-blocking for Steps 8-9)

- Resend — domain verification for `phloz.com` + `inbound.phloz.com`.
  See `docs/DNS-SETUP.md`.
- PostHog project + key (or decide to defer until after launch).
- Sentry project + DSN.
- GA4 Measurement ID + API secret.
- Stripe price IDs (see Option C).
- shadcn Radix-backed primitives (dialog/dropdown/etc. — add per-route
  during Step 8/9 unless Option D).
