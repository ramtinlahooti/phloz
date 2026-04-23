# Next Steps (as of 2026-04-23, post-Supabase wiring)

Ordered by priority. Each bullet is a concrete action for the next session.

## Ramtin's immediate actions (blocking, 5 minutes)

1. **Reconnect the Stripe MCP** to the Phloz account
   (`acct_1RXbVfLUfWiw9Veu`). Currently it's pointing at
   `acct_1QFi6lBVrlan59Tv` (Exchange Rate Management). Once fixed, Claude
   can auto-create the 4 paid tier products + their monthly/annual/extra-seat
   prices and wire the IDs into `packages/billing/src/tiers.ts`.

2. **Paste two values into `apps/app/.env.local` and `apps/web/.env.local`**
   (create them from `.env.example`):
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard → Project
     Settings → API → `service_role` key (secret).
   - `DATABASE_URL` — from Supabase dashboard → Project Settings →
     Database → Connection string → **Transaction pooler** (port 6543).
   The public keys can use either:
   - `NEXT_PUBLIC_SUPABASE_URL=https://tdvzhwhzxuskrsobdyrm.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_qedtqtQWYpoc8eKQFAXWBw_lTRgO5LG`

3. **Enable the Custom Access Token hook** in the Supabase dashboard:
   Authentication → Hooks → Custom Access Token → select
   `public.phloz_custom_access_token_hook`. One-time click.

## Claude's next session

4. **Step 5 — `packages/email`**. Resend client, React Email templates for
   invitation / portal magic link / password reset, inbound webhook
   handler shell, SPF/DKIM notes in `docs/DNS-SETUP.md`.

5. **Step 6 — `packages/analytics`**. Typed `EventMap` covering every
   event in ARCHITECTURE.md §11.2, `track()` dispatching to GTM dataLayer
   + PostHog, server-side GA4 Measurement Protocol helper for `sign_up`
   and `upgrade_tier`.

6. **Step 7 — `packages/ui`**. Tailwind v4 shared preset, shadcn/ui
   primitives (button, input, label, card, dialog, dropdown-menu, form,
   select, separator, sheet, sonner, tabs, tooltip, avatar, badge,
   skeleton), `PageHeader` / `EmptyState` / `LoadingSpinner` /
   `ConfirmDialog` / `TierBadge`, Geist Sans + Geist Mono via
   `next/font`. Dark-first using tokens already defined in
   `packages/ui/src/tokens.ts`.

7. **Step 8 — `apps/web` marketing site**. All routes from PROMPT_1 Step 8
   (home, pricing, features, about, contact, blog, compare, use-cases,
   crm-for, integrations, help, legal, sitemap, robots, llms.txt) with
   proper `generateMetadata()` + JSON-LD. Seed 3 blog MDX posts.

8. **Step 9 — `apps/app` product**. Auth routes, onboarding flow,
   dashboard routes (clients list, client split-pane, team, billing,
   settings), portal routes, API routes (Stripe + Resend inbound
   webhooks, workspace switch, health). Middleware wired to
   `@phloz/auth`.

9. **Step 10 — Inngest setup**. `apps/app/inngest/` client + function
   registry + `recomputeActiveClientCount` nightly function.

10. **Step 11 — Observability**. Sentry + PostHog init, verify GTM fires
    on home page, pino structured logs in server contexts.

11. **Step 12 — CI**. `.github/workflows/ci.yml` running `pnpm check` on
    push/PR plus a job that queries `pg_tables.rowsecurity` against
    every `TENANT_TABLES` entry and runs pgTAP against an ephemeral
    Supabase container.

> After Step 9, come back to the planning chat (per PROMPT_1 final line)
> for Prompt 2: the tracking map editor.

## Already provisioned

- ✅ Supabase — project `tdvzhwhzxuskrsobdyrm`, 25 tables + RLS applied,
  TS types generated, JWT hook installed (function + dashboard
  activation pending).
- ✅ GitHub — `ramtinlahooti/phloz`, `main` tracking `origin/main`.
- ✅ GTM container ID — `GTM-W3MGZ8V7` (from CLAUDE.md).

## Still to provision

- Stripe — connected to wrong account in MCP; see action 1 above.
- Resend — domain verification for `phloz.com` + `inbound.phloz.com`.
- PostHog project + key.
- Sentry project + DSN.
- GA4 Measurement ID + API secret.
- Vercel — both projects linked to this repo, env vars uploaded.
