# Next Steps (as of 2026-04-23, post-Phase-1)

Phase 1 scaffold is **complete**. Steps 0–13 of PROMPT_1 have shipped.
The monorepo builds, the marketing site renders, the product app has
auth + onboarding + dashboard + portal + API routes + webhooks +
Inngest jobs + observability + CI + Vercel config.

Per PROMPT_1's final line, the next move is to return to the planning
chat for **Prompt 2 — the tracking map editor**.

---

## Ramtin's immediate actions (blocking Prompt 2)

None. Everything ships-to-Vercel-whenever.

## Ramtin's actions to go live (whenever)

1. **Deploy to Vercel.** Follow `docs/DEPLOYMENT.md`:
   - Two projects (`phloz-web`, `phloz-app`) linked to the repo.
   - Env vars from `.env.example` (already in Vercel per earlier
     setup; double-check `INNGEST_*`, `NEXT_PUBLIC_POSTHOG_KEY`, and
     the Sentry vars).
   - Domains: phloz.com, app.phloz.com.
2. **Stripe webhook** in production (copy secret → Vercel env).
3. **Resend domain verification** (`docs/DNS-SETUP.md`) + webhook
   endpoint.
4. **Inngest app** registered at `app.phloz.com/api/inngest`.
5. **Sentry** project + DSN (optional; graceful no-op without).
6. **PostHog** project + key (optional).

## What Prompt 2 covers

Per ARCHITECTURE §8 — the tracking-infrastructure-map canvas editor:

- **React Flow (`@xyflow/react`) canvas** at
  `/[workspace]/clients/[clientId]/map` (route slot already exists on
  the client detail page).
- **Node-type registry** — 9 typed Zod schemas live in
  `packages/tracking-map/node-types/*`. The editor will render each
  node type with its own fields, icons, and health status.
- **Create / edit / delete** nodes + edges (with optimistic UI).
- **Health state** mark-as-verified / broken / missing flows.
- **Graph traversal** queries (who depends on this node, what does
  this node depend on).
- **Import / export** JSON so agencies can seed from CSV or pipe to
  BigQuery.

Start Prompt 2 by re-reading `ARCHITECTURE.md §8` and the existing
types in `packages/tracking-map/`, then come back with the plan.

## Features intentionally stubbed (pick up after Prompt 2)

- Workspace-wide tasks board (boards + timelines + department filters).
- Unified messages inbox + email thread UI in-app.
- Client split-pane sub-tabs (per-client tasks, file uploads with
  Supabase Storage, message thread UI).
- Portal pages past the landing (tasks, approvals, deliverables).
- Dedicated "trial-ending" email template (placeholder currently uses
  `sendPasswordReset`).

---

## Phase 1 status recap

### Shipped

- ✅ Turborepo + pnpm workspace (11 packages).
- ✅ Supabase: 25 tables + RLS + JWT hook enabled + ECC P-256 signing.
- ✅ `@phloz/config` — Zod env, tsconfig base, constants, pino logger.
- ✅ `@phloz/types` — Result<T, E>.
- ✅ `@phloz/db` — Drizzle schema, migrations applied, RLS SQL, pgTAP
  test, seed script, RLS invariants script.
- ✅ `@phloz/auth` — SSR helpers, roles, portal magic links, workspace
  switch, custom access token hook SQL.
- ✅ `@phloz/billing` — tier config, gates, Stripe client, webhooks,
  24 unit tests. Sandbox products + prices with IDs wired.
- ✅ `@phloz/email` — Resend client, 3 templates, inbound webhook
  parser, signature verifier, address generator. 13 unit tests.
- ✅ `@phloz/analytics` — typed EventMap, GTM + PostHog + GA4 MP
  dispatcher. 8 unit tests.
- ✅ `@phloz/ui` — Tailwind v4 stylesheet, ~20 primitives (7 core +
  10 Radix-backed), Phloz components, Geist font loader.
- ✅ `@phloz/tracking-map` — base package exists, ready for Prompt 2.
- ✅ `apps/web` — 49-page marketing site.
- ✅ `apps/app` — 29-route product app (auth, dashboard, portal, API,
  webhooks, Inngest).
- ✅ CI — `.github/workflows/ci.yml` with lint/typecheck/test, build
  matrix, RLS invariants, pgTAP.
- ✅ Deployment — `vercel.json` per app, `DEPLOYMENT.md` walkthrough.
- ✅ Docs — ARCHITECTURE, DECISIONS, CHANGELOG, ROADMAP, NEXT-STEPS,
  KNOWN-ISSUES, DNS-SETUP, INNGEST-SETUP, OBSERVABILITY, DEPLOYMENT.

### Live accounts / provisioning

- ✅ GitHub — `ramtinlahooti/phloz`, main branch.
- ✅ Supabase project — `tdvzhwhzxuskrsobdyrm.supabase.co`.
- ✅ GTM — container `GTM-W3MGZ8V7`.
- ✅ Stripe sandbox — `acct_1RXbVlPomvpsIeGO`, 4 products + 12 prices.
- ⏳ Vercel — projects not yet created (doc-ready).
- ⏳ Resend — domains not verified.
- ⏳ Inngest — account not created.
- ⏳ PostHog — project not created (optional).
- ⏳ Sentry — project not created (optional).
- ⏳ GA4 — IDs not provisioned (optional).

All provisioning is optional for local dev. Nothing blocks Prompt 2.
