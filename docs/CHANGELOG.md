# Changelog

Append dated entries at the top. Style: what changed + where + why.

---

## 2026-04-23 — Phase 1 Steps 0–4

### Added

- Foundation docs committed: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `PROMPT_1.md`.
- Turborepo workspace: `pnpm-workspace.yaml`, `turbo.json`, flat ESLint
  config, Prettier, editorconfig, `.env.example` enumerating every env var.
- `packages/config` — Zod `envSchema` with `loadEnv`/`requireEnv`/`hasEnv`,
  a `tsconfig.base.json` every workspace extends, and centralised constants
  (tiers, roles, statuses, node/edge types, departments, task states).
- `packages/types` — `Result<T,E>` helpers.
- Package stubs: `packages/{db,auth,billing,email,analytics,ui,tracking-map}`
  and `apps/{web,app}` with minimal `package.json` so `pnpm install` can
  resolve the workspace graph.
- `packages/ui/src/tokens.ts` — design tokens with confirmed deep-blue
  accent (see DECISIONS.md).
- `packages/db`:
  - Full Drizzle schema for every V1 tenant table (ARCHITECTURE.md §5.1).
  - V2 stub tables (§5.4) with minimal shape + TODO markers.
  - Per-table RLS policy SQL files under `src/rls/`, plus
    `_functions.sql` with `phloz_is_member_of` / `phloz_has_role_in` /
    `phloz_is_assigned_to` SECURITY DEFINER helpers.
  - `src/rls/index.ts` exports `RLS_FILES` (apply order) and
    `TENANT_TABLES` (CI registry).
  - `src/rls/apply.ts` CLI applies every policy file against `DATABASE_URL`.
  - `tests/rls/workspace-isolation.test.sql` — pgTAP test covering the
    three RLS invariants from PROMPT_1 Step 2.
  - `src/seed/index.ts` — demo workspace + 2 clients + 3 tracking nodes +
    2 edges.
  - README with add-a-tenant-table checklist.
- `packages/auth`:
  - `server.ts` — `createServerSupabase` (cookie-bound) +
    `createServiceRoleSupabase` (RLS-bypass).
  - `client.ts` — `createBrowserSupabase`.
  - `middleware.ts` — `updateSession` for Next middleware.
  - `session.ts` — `getCurrentUser`, `requireUser`, `getActiveWorkspaceId`.
  - `roles.ts` — `getMembershipRole`, `requireRole`, `requireAdminOrOwner`,
    `requireOwner`.
  - `portal.ts` — `generatePortalMagicLink` (40-char nanoid, 7-day TTL) +
    `validatePortalMagicLink` + `revokePortalMagicLink`.
  - `workspace-switch.ts` — `switchWorkspace(id)` updates user_metadata
    and refreshes session.
  - `src/hooks/custom-access-token-hook.sql` — Supabase auth hook that
    copies `user_metadata.active_workspace_id` into JWT claims.
  - Typed `AuthError` with codes.
- `packages/billing`:
  - `tiers.ts` — `TIERS` config matching ARCHITECTURE.md §7.1 + helpers.
  - `active-clients.ts` — `getActiveClientCount` (60-day window, single
    query), plus unarchived / total / paid-seat counts.
  - `gates.ts` — `canAddClient`, `canInviteMember`, `canUnarchiveClient`,
    `canDowngrade` with pure `*Check` variants for unit tests.
  - `stripe.ts` — lazy client, `createCustomer`, `createCheckoutSession`,
    `createBillingPortalLink`.
  - `webhooks.ts` — `constructWebhookEvent`, `recordBillingEvent`
    (idempotent), `markBillingEventProcessed`, `HANDLED_EVENT_TYPES`.
  - 24 unit tests in `gates.test.ts` + `tiers.test.ts`.
  - README with add-a-tier and add-a-gate workflows.

### Deferred (see NEXT-STEPS.md + KNOWN-ISSUES.md)

- `pnpm install` — not yet run. First action next session.
- Steps 5–17 of PROMPT_1 — email, analytics, ui, marketing site, app,
  Inngest, observability, CI, deployment, final verification.
- Stripe price IDs are null in `TIERS`; wire when the Stripe account is
  created.
- Supabase project not provisioned; the custom JWT hook must be installed
  manually once it is.
- Drizzle migrations not generated (needs `DATABASE_URL`).

### Commits

- `5c57125` docs: add foundation architecture and Claude Code rules
- `169dba4` chore: scaffold turborepo workspace with packages/config
- `dc8b3e2` feat(db): schema, RLS policies, pgTAP tests, seed
- `(0cd6f8c)` feat(auth): Supabase SSR helpers, roles, portal magic links, workspace switch
- `(new)` feat(billing): tier config, gates, Stripe client, webhooks, unit tests
- `(this commit)` docs: session-wrap for Phase 1 Steps 0–4
