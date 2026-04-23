# Next Steps (as of 2026-04-23)

Ordered by priority. Each bullet is a concrete action for the next session.

1. **Run `pnpm install`** at repo root. Verify every workspace resolves. Fix
   any version conflicts (React 19 RC, Next 16, Tailwind v4 beta, Drizzle
   0.36, Supabase SSR) — lock versions in place before Step 5.

2. **Run `pnpm check`** (lint + typecheck + unit tests). The 24 billing
   tests + 4 env tests must pass. If typecheck fails, adjust
   `tsconfig.base.json` or workspace `package.json` exports. Commit the
   lockfile.

3. **Step 5 — `packages/email`** (PROMPT_1). Resend client, React Email
   templates for invitation / portal magic link / password reset,
   inbound webhook handler shell, SPF/DKIM notes in `docs/DNS-SETUP.md`.

4. **Step 6 — `packages/analytics`**. Typed `EventMap` covering every event
   in ARCHITECTURE.md §11.2, `track()` dispatching to GTM dataLayer +
   PostHog, server-side GA4 Measurement Protocol helper for `sign_up` and
   `upgrade_tier`.

5. **Step 7 — `packages/ui`**. Tailwind v4 shared preset, shadcn/ui primitives
   (button, input, label, card, dialog, dropdown-menu, form, select,
   separator, sheet, sonner, tabs, tooltip, avatar, badge, skeleton),
   `PageHeader` / `EmptyState` / `LoadingSpinner` / `ConfirmDialog` /
   `TierBadge`, Geist Sans + Geist Mono via `next/font`. Dark-first using
   tokens already defined in `packages/ui/src/tokens.ts`.

6. **Step 8 — `apps/web` marketing site**. All routes from PROMPT_1 Step 8
   (home, pricing, features, about, contact, blog, compare, use-cases,
   crm-for, integrations, help, legal, sitemap, robots, llms.txt) with
   proper `generateMetadata()` + JSON-LD. Seed 3 blog MDX posts.

7. **Step 9 — `apps/app` product**. Auth routes, onboarding flow, dashboard
   routes (clients list, client split-pane, team, billing, settings),
   portal routes, API routes (Stripe + Resend inbound webhooks,
   workspace switch, health). Middleware wired to `@phloz/auth`.

8. **Step 10 — Inngest setup**. `apps/app/inngest/` client + function
   registry + `recomputeActiveClientCount` nightly function.

9. **Step 11 — Observability**. Sentry + PostHog init, verify GTM fires on
   home page, pino structured logs in server contexts.

10. **Step 12 — CI**. `.github/workflows/ci.yml` running `pnpm check` on
    push/PR plus a job that queries `pg_tables.rowsecurity` against every
    `TENANT_TABLES` entry.

> After Step 9, come back to the planning chat (per PROMPT_1 final line)
> for Prompt 2: the tracking map editor.

## Blockers to surface up-front when services get provisioned

- Supabase project + URL + anon key + service role key + direct Postgres URL
- Stripe account + product/price IDs for each paid tier
- Resend domain verification for `phloz.com` + `inbound.phloz.com`
- PostHog project + key
- Sentry project + DSN
- GA4 Measurement ID + API secret
- Vercel: both projects linked to this repo, env vars uploaded
