# Next Steps (as of 2026-04-23, post-Step-8)

Ordered by priority. Each bullet is a concrete action for the next session.

## Ramtin's optional actions (all non-blocking)

1. **QA the marketing site locally.** Run `pnpm --filter @phloz/web dev`
   and browse `http://localhost:3000`. Check: home, pricing, blog, one
   `/compare/*`, one `/use-cases/*`, one `/crm-for/*`, sitemap.xml,
   robots.txt, llms.txt. If anything feels wrong, flag it before Step 9
   and I'll fix it there.

2. **Archive the two orphan Stripe products** (`Phloz - Premium`,
   old `Phloz - Pro`). You said you already deleted them — if so, skip.

3. **Verify the phloz.com DNS + Resend domain** when you're ready for
   emails to actually send. See `docs/DNS-SETUP.md` for the exact
   records. Can wait until Step 9 ships the inbound webhook route.

4. **Provision PostHog + Sentry + GA4 accounts** when you want those
   live. Until then, `track()` calls no-op gracefully and the product
   works fine.

## Claude's next session

**Step 9 — `apps/app` product.** The biggest piece on the roadmap.
6-8 hours of focused work. Includes:

- **Auth routes:** `/login`, `/signup`, `/forgot-password`,
  `/magic-link`, `/auth/callback`. Email + password + magic link.
- **Onboarding:** create first workspace, invite teammates,
  add first client.
- **Dashboard shell:** `/[workspace]/...` with sidebar, header,
  workspace switcher (calls `@phloz/auth` `switchWorkspace`).
- **Clients list + split-pane detail:** `/[workspace]/clients`,
  `/[workspace]/clients/[id]`. Notes, tasks, files, messages, map.
- **Team + billing + settings:** standard workspace admin pages.
- **Portal routes:** `/portal/[token]/...` (magic-link auth for
  external client users).
- **API routes:** Stripe webhook, Resend inbound webhook, workspace
  switch endpoint, health check.
- **Middleware:** `@phloz/auth` `updateSession` wired into
  `apps/app/middleware.ts`.
- **Shared shadcn primitives** added on-demand (dialog, dropdown,
  sheet, sonner, tabs, tooltip, avatar, select, popover, form) —
  install Radix deps per primitive as routes need them.

Dependencies required for Step 9:
- `apps/app` needs: `@phloz/analytics`, `@phloz/auth`, `@phloz/billing`,
  `@phloz/config`, `@phloz/db`, `@phloz/email`, `@phloz/ui`, `zod`,
  `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`
  (if we want client-side caching), `sonner`, `cmdk`, plus the Radix
  primitives we use.

## Remaining roadmap after Step 9

- **Step 10 — Inngest setup.** `apps/app/inngest/` client + function
  registry + `recomputeActiveClientCount` nightly function.
- **Step 11 — Observability.** Sentry + PostHog init, verify GTM fires
  on home page, pino structured logs in server contexts.
- **Step 12 — CI.** `.github/workflows/ci.yml` running `pnpm check` on
  push/PR plus a job that queries `pg_tables.rowsecurity` against
  every `TENANT_TABLES` entry and runs pgTAP against an ephemeral
  Supabase container.
- **Step 13 — Deployment.** Vercel projects for web + app, env vars,
  preview deployments wired, custom domains.
- **Steps 14-17 — Final verification + docs polish.**

> After Step 9, come back to the planning chat (per PROMPT_1 final line)
> for Prompt 2: the tracking map editor.

## Already provisioned / done

- ✅ Supabase — 25 tables + RLS + JWT hook (enabled in dashboard ✅),
  ECC P-256 JWT signing.
- ✅ GitHub — `ramtinlahooti/phloz`, main tracking origin.
- ✅ GTM container — `GTM-W3MGZ8V7` wired into `@phloz/analytics` and
  `apps/web` layout.
- ✅ Stripe — SDK pinned to `^22.0.2` for API `2026-03-25.dahlia`,
  sandbox products + prices created, IDs wired into `TIERS`.
- ✅ `packages/config`, `packages/db`, `packages/auth`,
  `packages/billing`, `packages/email`, `packages/analytics`,
  `packages/ui` — all shipped and green.
- ✅ `apps/web` — 49-page marketing site with blog, programmatic SEO,
  sitemap, robots, llms.txt. Builds cleanly.
- ✅ Vercel env vars uploaded.

## Still to provision (non-blocking for Step 9)

- Resend — domain verification for `phloz.com` + `inbound.phloz.com`.
- PostHog project + key.
- Sentry project + DSN.
- GA4 Measurement ID + API secret.
- Stripe live-mode products + prices (before launch, not needed now).
- shadcn Radix-backed primitives — install per-route during Step 9.
