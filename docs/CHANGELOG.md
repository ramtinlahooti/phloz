# Changelog

Append dated entries at the top. Style: what changed + where + why.

---

## 2026-04-23 — Phase 1 Step 8 (apps/web marketing site)

### Added — 49 static pages

Core scaffold:
- `apps/web/next.config.ts`, `tsconfig.json`, `postcss.config.mjs`,
  `next-env.d.ts` — Next 16 + Tailwind v4 + MDX pipeline wired.
- `app/layout.tsx` — root layout with Geist fonts (from
  `@phloz/ui/fonts`), GTM script (container `GTM-W3MGZ8V7` default),
  Organization JSON-LD, sticky header + footer.
- `app/globals.css` — imports shared `@phloz/ui/styles/globals.css`
  plus a lean `.phloz-prose` rule set for MDX blog content (avoids
  `@tailwindcss/typography` dep).
- `components/site-header.tsx`, `components/site-footer.tsx`,
  `components/gtm.tsx`.
- `lib/site-config.ts` — one source of truth for URLs, nav, footer,
  and programmatic-SEO registries (competitors, use cases,
  departments, integrations).
- `lib/metadata.ts` — `buildMetadata()` helper enforcing canonical
  URLs, OG, Twitter card, robots, and site-wide JSON-LD.

Static pages:
- `/` home (hero + 6 features grid + CTA, SoftwareApplication JSON-LD)
- `/features`, `/pricing` (reads `TIERS` from `@phloz/billing`),
  `/about`, `/contact`, `/help`
- `/legal/terms`, `/legal/privacy` — draft placeholders (flagged
  in-copy; counsel review scheduled before first customer).

Blog — MDX via `next-mdx-remote/rsc` + `gray-matter` + `remark-gfm` +
`rehype-slug` + `rehype-autolink-headings`:
- `lib/blog.ts` — frontmatter Zod-validated.
- `/blog` index + `/blog/[slug]` with Article JSON-LD + reading time.
- 3 seed posts: `why-we-built-phloz`, `tracking-infrastructure-map`,
  `per-active-client-pricing`.

Programmatic SEO (all use `generateStaticParams` from
`site-config.ts`):
- `/compare/[competitor]` × 10 (HubSpot, Monday, ClickUp, Asana,
  Notion, Teamwork, Productive, Rocketlane, Function Point, Accelo).
- `/use-cases/[slug]` × 4.
- `/crm-for/[slug]` × 8 departments (ppc, seo, social-media, cro,
  web-design, performance-marketing, ecommerce, b2b).
- `/integrations` index + `/integrations/[slug]` × 9 tools (with
  V1/V2 blurbs per integration).

SEO infrastructure:
- `app/robots.ts` via `MetadataRoute.Robots`.
- `app/sitemap.ts` — auto-includes every registry slug + every blog
  post slug. Add a slug to `site-config.ts` → sitemap updates.
- `app/llms.txt/route.ts` — categorized index per the llmstxt.org
  spec, 1-hour revalidate.

### Dependencies added (apps/web)

- `@phloz/billing`, `gray-matter`, `next-mdx-remote`, `reading-time`,
  `rehype-autolink-headings`, `rehype-slug`, `remark-gfm`.
- `@tailwindcss/postcss` (dev).

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `pnpm --filter @phloz/web build` — 49 static pages generated in
  2.6s, 0 errors.

### Next

Step 9 — `apps/app` product (auth, dashboard, portal, API routes).
This is the biggest session on the roadmap (6-8h). Can be paused
after Step 8 for the user to QA the marketing site in dev / preview.

---

## 2026-04-23 — Stripe sandbox products + prices wired

### Added

- 4 Stripe Products in Phloz sandbox (`acct_1RXbVlPomvpsIeGO`):
  - `prod_UOFldR2CCkSDqS` — Phloz Pro (10 clients, 5 seats)
  - `prod_UOFlJvP0zTegxV` — Phloz Growth (30 clients, 8 seats)
  - `prod_UOFl7RRqfyEmce` — Phloz Business (100 clients, 15 seats)
  - `prod_UOFlG1UTSfSyGe` — Phloz Scale (250 clients, 30 seats)
- 12 recurring Prices (monthly + annual + extra-seat-monthly per tier,
  USD). Amounts match ARCHITECTURE.md §7.1.
- Price IDs wired into `packages/billing/src/tiers.ts` with inline
  product-ID comments for traceability.

### Verified

- `pnpm check` — 29/29 green. All 24 billing tests still pass against
  the real IDs.

### Notes

- Two orphan products from earlier experiments (`prod_SSWcZ5D3sAcqgx`
  "Premium", `prod_SSWb4vOPLGNW4K` "Pro", both with no prices) remain
  in the sandbox and should be archived via the Stripe dashboard.
- Live-mode prices will be created in Step 13 (deployment) and swapped
  in before launch.

---

## 2026-04-23 — Phase 1 Steps 5–7 (email, analytics, ui)

### Step 5 — `packages/email`

- Resend client with graceful `isResendConfigured()` gate for dev.
- React Email templates: `InvitationEmail`, `PortalMagicLinkEmail`,
  `PasswordResetEmail` — shared `EmailLayout` with Geist + Tailwind,
  consistent footer.
- `sendInvitation` / `sendPortalMagicLink` / `sendPasswordReset` helpers;
  each no-ops when `RESEND_API_KEY` is absent.
- `verifyResendSignature` — Standard Webhooks (svix) HMAC-SHA256 verifier
  with timestamp-tolerance window + timing-safe compare.
- `parseResendInbound` — Zod-validated envelope parser; drops attachments
  per ARCHITECTURE §10.3, HTML-to-text fallback, 5MB attachment limit.
- `generateInboundAddress` / `extractInboundId` — opaque 12-char nanoid
  addresses (`client-<id>@inbound.phloz.com`) per §10.1.
- 13 unit tests passing.
- `docs/DNS-SETUP.md` — SPF/DKIM/DMARC for `phloz.com`, MX for
  `inbound.phloz.com`, Resend webhook + routing config, verification
  checklist.

### Step 6 — `packages/analytics`

- `EventMap` — typed catalog mirroring ARCHITECTURE §11.2 (every event
  from marketing, auth, workspace, team, clients, tracking map, tasks,
  messages, billing, feature gates).
- `track(event, params, context?)` — dispatcher. Browser path: GTM
  dataLayer + PostHog. Server path: PostHog-node + GA4 Measurement
  Protocol when the event is in `SERVER_GA4_EVENTS` (sign_up,
  upgrade_tier).
- GTM bootstrap helpers (`gtmBootstrapScript`, `gtmNoscriptIframeSrc`)
  with container id GTM-W3MGZ8V7 as the single source of truth.
- PostHog init/identify/reset (client) + captureServer (server); both
  no-op gracefully without keys.
- `sendGa4ServerEvent` — server fetch-based emitter; strips undefined
  params; throws on non-2xx.
- `hashAuthUid{Server,Client}` — SHA-256 hex with cross-runtime parity.
- 8 unit tests passing.

### Step 7 — `packages/ui`

- `cn()` helper (clsx + tailwind-merge).
- `packages/ui/styles/globals.css` — Tailwind v4 CSS-first config via
  `@theme`. Dark-first palette + deep-blue accent (per DECISIONS
  2026-04-23) + tracking-map health colour vars (ARCHITECTURE §8.2).
  Light-mode opt-in via `.light` on `<html>`.
- Primitives (shadcn-style, no Radix deps yet): `Button` (6 variants, 4
  sizes), `Input`, `Label`, `Card` (+ Header/Title/Desc/Content/Footer),
  `Badge` (6 variants), `Skeleton`, `Separator`.
- Shared components: `PageHeader`, `EmptyState`, `LoadingSpinner`,
  `TierBadge`.
- `loadGeistFonts()` — lazy `next/font` Geist Sans + Mono loader returning
  CSS-variable class names; matches `--font-geist-sans` /
  `--font-geist-mono` in the shared stylesheet.

### Other

- Stripe SDK bumped to `^22.0.2` to support the `2026-03-25.dahlia` API
  version selected for the Phloz sandbox.
- `packages/auth/src/server.ts` — replaced `require('@supabase/supabase-js')`
  with dynamic `await import()`; `createServiceRoleSupabase()` is now
  async. Closes the long-standing KNOWN-ISSUES entry.
- `packages/auth/src/{server,middleware}.ts` — typed `setAll` params.
- Added `@types/node` to `@phloz/config` and `next` + `@types/node` to
  `@phloz/auth` peers/devDeps.
- `@phloz/types` — added `@phloz/config` workspace link so its
  `tsconfig.base.json` resolves.
- `db` + `auth` `test` scripts: `vitest run --passWithNoTests` (neither
  has vitest files yet).
- Next 16 removed `next lint`; swapped `apps/web` + `apps/app` lint to
  `eslint . --no-error-on-unmatched-pattern`.
- Root `package.json` — `"type": "module"` to silence ESM parse warning.
- `.env.example` — comprehensive rewrite with per-service sections,
  `[web]/[app]/[both]` tags, new `sb_publishable_*` / `sb_secret_*`
  key-format notes, DATABASE_URL pooler-vs-direct guidance.

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- 21 unit tests across `@phloz/config` (4), `@phloz/billing` (24),
  `@phloz/email` (13), `@phloz/analytics` (8) — all passing.

---

## 2026-04-23 — Supabase wiring (post-session-1)

### Added

- `pnpm.onlyBuiltDependencies` in root `package.json` approving postinstalls
  for `core-js`, `esbuild`, `protobufjs`, `sharp`, `unrs-resolver`.
- `pnpm-lock.yaml` — lockfile committed after clean install (10.5s).
- `packages/db/migrations/0000_melted_supreme_intelligence.sql` — Drizzle-
  generated schema SQL for all 25 tables (17 V1 + 8 V2 stubs) with FKs +
  indexes.
- `packages/db/src/supabase-types.ts` — generated Supabase `Database` type
  for use with `@supabase/supabase-js` (the Drizzle types remain the
  default; these are for direct Supabase SDK calls).
- Two applied Supabase migrations (via MCP):
  - `initial_schema` — 25 tables, 41 foreign keys, 45 indexes, all idempotent.
  - `rls_policies` — `phloz_is_member_of` / `phloz_has_role_in` /
    `phloz_is_assigned_to` / `touch_updated_at` helpers + full V1 policies
    + V2 default-deny.
  - `custom_access_token_hook` — the JWT claim hook (requires dashboard
    activation).
  - `function_search_path_hardening` — fixed advisor WARN for two
    plpgsql functions missing `SET search_path`.

### Verified

- All 25 tables have `rowsecurity = true` (checked via `pg_tables` query).
- `get_advisors` → security: only INFO-level `rls_enabled_no_policy`
  warnings remain, all for V2 stubs and `portal_magic_links` (by design:
  no policy = default deny, service role bypasses).

### Changed

- `packages/db/src/rls/_functions.sql` — `touch_updated_at` now declares
  `SET search_path = public` (matches advisor fix).
- `packages/auth/src/hooks/custom-access-token-hook.sql` — function now
  declares `SET search_path = public, auth`.

### Deferred

- Stripe MCP is connected to `acct_1QFi6lBVrlan59Tv` (Exchange Rate
  Management), not the Phloz account `acct_1RXbVfLUfWiw9Veu`. Reconnect
  the MCP before creating products.
- Custom Access Token hook SQL function exists, but enabling it is a
  Supabase Dashboard step (Authentication → Hooks → Custom Access Token).
- Service role key + direct `DATABASE_URL` not yet in `.env.local`.

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
