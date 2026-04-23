# Next Steps (as of 2026-04-23, post-Step-9)

Ordered by priority. Each bullet is a concrete action for the next session.

## Ramtin's optional actions (non-blocking)

1. **QA the product app locally.** Run `pnpm --filter @phloz/app dev`
   and browse `http://localhost:3001`. Flow:
   - / → redirects to /login
   - /signup → create an account with a real email (confirmation flow
     needs Resend DNS or you can grab the confirmation link from
     Supabase dashboard)
   - /onboarding → name the workspace
   - /[workspace] → you should land on the dashboard
   - Try: add a client, invite a teammate, visit /billing
   Flag anything that feels wrong.

2. **Verify Resend domains** when you're ready to send real emails. See
   `docs/DNS-SETUP.md`. Until then, invitations + password resets
   log-only in dev.

3. **Provision PostHog + Sentry + GA4** if you want production analytics
   live. Without keys, `track()` calls no-op gracefully.

## Claude's next sessions

### Step 10 — Inngest (2-3h)

- `apps/app/inngest/` client + function registry.
- `recomputeActiveClientCount` nightly job (ARCHITECTURE §7.2).
- `sendTrialEndingReminder` (3-day-before trigger).
- Inngest webhook route at `/api/inngest` (serve + introspection).
- Local dev instructions in `docs/INNGEST-SETUP.md`.

### Step 11 — Observability (2h)

- `@sentry/nextjs` wired into both apps with source-map upload.
- PostHog client init in `apps/app` root layout.
- Verify GTM fires on home page (already wired in `apps/web`).
- Pino for structured server logs (`packages/config/logger.ts`).

### Step 12 — CI (1-2h)

- `.github/workflows/ci.yml`:
  - `pnpm install --frozen-lockfile`
  - `pnpm check` (typecheck + lint + unit tests across 11 packages)
  - RLS invariant job: `pg_tables.rowsecurity = true` for every
    `TENANT_TABLES` entry against an ephemeral Supabase container.
  - pgTAP run.
- Dependabot config for monthly security updates.

### Step 13 — Deployment (1-2h)

- Vercel projects for `@phloz/web` (phloz.com) and `@phloz/app`
  (app.phloz.com) linked to this repo.
- Env vars populated from `.env.example`.
- Custom domain + TLS.
- Preview deployments per PR.

### After Step 13 — come back to the planning chat

Per PROMPT_1 final line: "After Step 9, come back to the planning chat
for Prompt 2: the tracking map editor." That's the canvas UI on top of
the map primitives already in `packages/tracking-map` + the schema
already in place.

### Features intentionally stubbed (feature sessions, pick up later)

- Workspace-wide tasks board (boards + timelines + department filters).
- Unified messages inbox + email thread UI.
- Client split-pane tabs: tasks, files, messages, approvals.
- Portal pages past the landing (tasks, approvals, deliverables).

## Already provisioned / done

- ✅ Supabase — 25 tables + RLS + JWT hook enabled + ECC P-256 signing.
- ✅ GitHub — `ramtinlahooti/phloz`, main tracking origin.
- ✅ GTM container — `GTM-W3MGZ8V7` wired into `@phloz/analytics` and
  `apps/web` layout.
- ✅ Stripe — SDK `^22.0.2` for API `2026-03-25.dahlia`, 4 sandbox
  products + 12 prices, IDs in `TIERS`, webhook route with reconcile
  handlers in `apps/app`.
- ✅ All 11 packages (config, types, db, auth, billing, email,
  analytics, ui, tracking-map, web, app) — shipped and green.
- ✅ `apps/web` — 49-page marketing site (static).
- ✅ `apps/app` — 28-route product app scaffold (foundation spine).

## Still to provision (non-blocking for Steps 10-13)

- Resend — domain verification for `phloz.com` + `inbound.phloz.com`.
- PostHog project + key.
- Sentry project + DSN.
- GA4 Measurement ID + API secret.
- Stripe live-mode products + prices (swap before launch).
- Inngest account + signing keys (Step 10).
