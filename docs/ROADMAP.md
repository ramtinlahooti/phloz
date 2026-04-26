# Phloz Roadmap

The current phase is marked **←**. Items on the current phase may be crossed off as each ships.

---

## Phase 1 — Foundation **←**

Turborepo + core packages + doc system so every subsequent phase has a solid base.

- [x] Turborepo workspace (apps/web, apps/app, packages/*)
- [x] Shared tooling: TypeScript, ESLint flat config, Prettier, editorconfig, `.env.example`
- [x] `packages/config` — Zod env validation + shared constants
- [x] `packages/types` — Result<T,E> helpers
- [x] `packages/db` — Drizzle schema for all V1 tables (+ V2 stubs), RLS policies, pgTAP test, seed
- [x] `packages/auth` — Supabase SSR helpers, roles, portal magic links, workspace switch
- [x] `packages/billing` — TIERS config, gates, Stripe client, webhook ingestion, unit tests
- [x] Slash commands (`.claude/commands/session-*.md`, `add-decision`, `check-arch`)
- [x] Skill scaffolds (phloz-conventions, tenancy, billing, analytics, seo)
- [ ] `packages/email` — Resend outbound + inbound handler, React Email templates (Step 5)
- [ ] `packages/analytics` — Typed `track()`, GTM/GA4/PostHog wiring (Step 6)
- [ ] `packages/ui` — shadcn/ui primitives, Geist fonts, `PageHeader`/`EmptyState`/etc. (Step 7)
- [ ] `apps/web` — marketing site with 20+ indexable pages (Step 8)
- [ ] `apps/app` — auth flow + dashboard + portal + API (Step 9)
- [ ] Inngest app + `recomputeActiveClientCount` function (Step 10)
- [ ] Observability: Sentry init, PostHog init, GTM/GA4 verification (Step 11)
- [ ] CI: `.github/workflows/ci.yml` with typecheck/lint/test + RLS audit job (Step 12)
- [ ] Vercel deployment config + DNS docs (Step 13)
- [ ] Step 17 final verification (pnpm install, pnpm check, smoke tests)

## Phase 2 — Tracking Map

Full React Flow canvas with typed node library, drawer forms, keyboard shortcuts, auto-layout.

- [ ] `packages/tracking-map` — node-type registry + Zod schemas per type
- [ ] Custom React Flow node components for every V1 node type
- [ ] Node drawer with metadata form (React Hook Form + Zod resolver)
- [ ] Edge creation UX, edge-type picker
- [ ] Keyboard shortcuts (n, c, del, /)
- [ ] Mini-map, zoom controls, fit-to-view
- [ ] Auto-layout (`dagre`)
- [ ] 200-node soft cap + admin override

## Phase 3 — Tasks & Messages

- [x] Task CRUD (workspace + client scoped, with department filter)
- [x] Task comment threads
- [x] Message thread UI in the split-pane client view
- [x] Resend inbound handler fully wired
- [x] Email digest notification (Inngest) — timezone-aware
- [x] Recurring task templates (daily/weekly/monthly Inngest cron)
- [x] Saved filter views on `/tasks` (per-user + workspace-shared)
- [x] Subtask drag-to-reorder + Cmd/Ctrl-↑/↓ keyboard reorder
- [x] Per-member daily digest with opt-out + per-member preview
- [x] Month-grid calendar view at `/tasks/calendar`
- [x] Inbox keyboard nav (`j`/`k`/`Enter`)
- [x] Reply-draft auto-save (localStorage)
- [x] Weekly tracking-map audit cron + dashboard trend + sparkline
- [x] Bulk-archive dormant clients
- [x] Activity feed type filter on the dashboard
- [x] Keyboard shortcuts cheat sheet (`?`)

## Phase 4 — Client Portal Polish

- [ ] Portal dashboard (client brand, assigned contact, activity summary)
- [ ] Public task list + reply UX
- [ ] Contact-info self-edit
- [ ] Magic-link rotation + expiry UX

## Phase 5 — SEO Content

- [ ] 20+ production blog posts across categories in ARCHITECTURE.md §12.6
- [ ] All `/compare/[competitor]` pages filled
- [ ] All `/crm-for/[department]` pages filled
- [ ] All `/use-cases/[slug]` pages filled
- [ ] `/integrations/[tool]` marketing pages

## Phase 6 — V2 Integrations

- [ ] Google Ads API read-only mirror
- [ ] Meta Ads API read-only mirror
- [ ] GTM + GA4 Admin API
- [ ] Automated audit engine (rules-based)
- [ ] Tracking-node version history
- [ ] Cross-client templates
- [ ] Department modules (PPC, SEO, social, CRO, web design)
- [ ] Client-facing reports
- [ ] AI features
