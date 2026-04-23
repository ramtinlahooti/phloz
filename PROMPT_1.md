# Prompt 1 — Phloz Foundation Scaffold

**Paste this into Claude Code after you've set up the repo and dropped `ARCHITECTURE.md` + `CLAUDE.md` in place (see the end of this file for setup instructions).**

---

## Your Role

You are building the foundation scaffold for Phloz — a CRM + work management + marketing tracking infrastructure platform for digital marketing agencies. Before you do ANYTHING, read these files in order:

1. `CLAUDE.md` (repo root) — the project rules
2. `docs/ARCHITECTURE.md` — the complete architecture, data model, and decisions
3. `docs/ROADMAP.md` — current phase (should be "Phase 1: Foundation")
4. `docs/NEXT-STEPS.md` — any queued actions (should be empty at start)

Everything in ARCHITECTURE.md is decided. If you encounter something not covered, STOP and ask the user before inventing architecture. If you disagree with a decision in ARCHITECTURE.md, raise it for discussion — do not override silently.

---

## Scope of This Prompt (Phase 1: Foundation)

This prompt produces a **complete, deployable skeleton** of Phloz. After this phase:
- The marketing site at phloz.com is live, SEO-optimized, with placeholder content
- The app at app.phloz.com lets users sign up, create a workspace, invite members, add clients (CRUD only), and see an empty tracking map
- Billing infrastructure works end-to-end (Stripe checkout, webhooks, tier enforcement), but UI for tier management is minimal
- All observability is wired (Sentry, PostHog, GTM, GA4)
- All doc files exist and are updated
- The Turborepo monorepo is properly structured
- CI runs typecheck + lint + tests on push

**What this prompt does NOT build:**
- The full tracking map editor (nodes/edges UI beyond "create/read/delete" — deep node editing comes in Prompt 2)
- Tasks, messages, client portal (Prompt 3)
- Real blog content (structure only; content is added post-scaffold)
- AI features (V2)
- External API integrations (V2)
- Any V2 scope per ARCHITECTURE.md §1

---

## Build Plan

Execute in this order. After each major step, commit with a conventional commit message.

### Step 0 — Preflight

- Confirm Node.js ≥22 and pnpm ≥9 installed
- Confirm git configured with user identity
- Confirm the working directory is the `phloz` repo cloned from https://github.com/ramtinlahooti/phloz
- Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/NEXT-STEPS.md`

### Step 1 — Turborepo Scaffold

Create the monorepo structure per ARCHITECTURE.md §3.

- `pnpm-workspace.yaml` including `apps/*` and `packages/*`
- `turbo.json` with pipelines: `dev`, `build`, `lint`, `typecheck`, `test`
- Root `package.json` with scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `check` (runs lint + typecheck + unit tests)
- `.gitignore`, `.editorconfig`, `.nvmrc` (Node 22)
- `.prettierrc` and `.eslintrc` (or flat config) shared across workspaces
- TypeScript base config in `packages/config/tsconfig.base.json`
- A shared `packages/config` for env validation (Zod-based) and shared constants

### Step 2 — Database Package (`packages/db`)

Install Drizzle + Drizzle-Kit + Supabase client.

Scaffold the schema for every table in ARCHITECTURE.md §5.1 as separate files under `packages/db/schema/`:

- `workspaces.ts`, `workspace-members.ts`, `workspace-member-client-access.ts`
- `clients.ts`, `client-contacts.ts`, `client-assets.ts`
- `tracking-nodes.ts`, `tracking-edges.ts`
- `tasks.ts`, `task-watchers.ts`
- `comments.ts`, `messages.ts`, `inbound-email-addresses.ts`
- `portal-magic-links.ts`, `invitations.ts`
- `audit-log.ts`, `billing-events.ts`

Also scaffold V2 tables as **empty schema files with TODO comments** so migrations exist but are minimal:
- `ad-platform-accounts.ts`, `ad-campaigns.ts`, `ad-groups.ts`, `ad-keywords.ts`, `ad-creatives.ts`
- `tracking-node-versions.ts`, `tracking-templates.ts`, `audit-rules.ts`

Generate the initial Drizzle migration. Then write RLS policies as SQL in `packages/db/rls/` — one file per table — and include them in a follow-up migration. Policy logic per ARCHITECTURE.md §4.1.

Write pgTAP-style tests in `packages/db/tests/rls/` that verify:
- A user in workspace A cannot SELECT clients in workspace B
- A viewer cannot INSERT/UPDATE/DELETE
- A member without assignment cannot SELECT assigned-only clients when `all_members_see_all_clients = false`

Add `packages/db/seed/` with a minimal seed script (1 workspace, 1 owner, 2 clients, 3 tracking nodes, 2 edges).

### Step 3 — Auth Package (`packages/auth`)

- Supabase Auth client helpers (server + client)
- Session utilities
- JWT custom claims for `active_workspace_id` (via Supabase Auth Hook or custom session refresh)
- Workspace-switch route handler
- Magic link generation + validation for client portal (`portal_magic_links` table)
- Role-check helpers: `requireRole('admin' | 'owner')`

### Step 4 — Billing Package (`packages/billing`)

- `tiers.ts` — exports the full `TIERS` config object per ARCHITECTURE.md §7.1
- `gates.ts` — `canAddClient`, `canInviteMember`, `canUnarchiveClient`, etc.
- `stripe.ts` — Stripe SDK client + product/price helpers
- `webhooks.ts` — signature verification + event handling (customer.subscription.*, invoice.*)
- `active-clients.ts` — the 60-day activity-based active-client calculation per §7.2
- Unit tests for every gate function

A README in `packages/billing` documents how to add a new tier.

### Step 5 — Email Package (`packages/email`)

- Resend client
- Send helpers: `sendInvitation`, `sendPortalMagicLink`, `sendPasswordReset`, etc.
- React Email templates for each
- Inbound webhook handler in `apps/app/app/api/webhooks/resend-inbound/route.ts`
- Inbound address parser, linking to `inbound_email_addresses` + creating `messages` row
- SPF/DKIM documentation in `docs/DNS-SETUP.md`

### Step 6 — Analytics Package (`packages/analytics`)

- `event-map.ts` — typed union of all events + their params per ARCHITECTURE.md §11.2
- `track.ts` — dispatches to GTM dataLayer + PostHog
- GTM container `GTM-W3MGZ8V7` set up in both apps' root layouts
- PostHog client init
- GA4 debug mode toggle via env
- Server-side `track()` variant using GA4 Measurement Protocol for critical events (signup, upgrade_tier)
- Unit tests verifying event shape

### Step 7 — UI Package (`packages/ui`)

- Tailwind v4 setup shared across apps via a shared preset
- shadcn/ui init with these components installed: button, input, label, card, dialog, dropdown-menu, form, select, separator, sheet, sonner (toast), tabs, tooltip, avatar, badge, skeleton
- Custom components: `PageHeader`, `EmptyState`, `LoadingSpinner`, `ConfirmDialog`, `TierBadge`
- Geist Sans + Geist Mono fonts loaded via `next/font`
- Design tokens in `packages/ui/tokens.ts` — charcoal + near-black + accent color palette (SpaceX-inspired: `bg-zinc-950`, `bg-zinc-900`, high-contrast text, restrained accent like deep blue or muted orange — pick one and document in DECISIONS.md)
- Dark-first styling; light mode added in Prompt 2

### Step 8 — Marketing Site (`apps/web`)

Pages (MDX or TSX as noted):

- `/` — homepage (hero, 3 feature sections, social proof placeholder, pricing preview, CTA)
- `/pricing` — all 5 tiers + enterprise contact, monthly/annual toggle
- `/features` — feature list grouped by pillar (CRM, Work Management, Tracking Infrastructure, Client Portal)
- `/about` — placeholder
- `/contact` — contact form (posts to Resend)
- `/blog` — blog index, shows all posts grouped by category
- `/blog/[category]` — category archive
- `/blog/[category]/[slug]` — single post (MDX from `apps/web/content/blog/[category]/[slug].mdx`)
- `/compare/[competitor]` — programmatic template; seed with stubs for: hubspot, monday, clickup, asana, notion, teamwork, productive, rocketlane
- `/use-cases/[slug]` — programmatic template; seed stubs for: client-onboarding-audit, tracking-infrastructure-map, cross-client-reporting, agency-pm
- `/crm-for/[department]` — programmatic template; seed stubs for: ppc, seo, social-media, cro, web-design, performance-marketing, ecommerce, b2b
- `/integrations/[tool]` — programmatic template; seed stubs for: ga4, gtm, google-ads, meta-ads, tiktok-ads, microsoft-ads, shopify, klaviyo, hubspot
- `/help` — placeholder for future docs
- `/legal/privacy`, `/legal/terms`, `/legal/dpa` — placeholder content marked as DRAFT
- `/sitemap.xml` — auto-generated from page registry
- `/robots.txt` — production = allow, preview = disallow
- `/llms.txt` — indexed list of all marketing pages

Seed MDX blog posts (3 to prove the system works; outlines only, 300-500 words each):
- `apps/web/content/blog/google-analytics/ga4-events-for-agencies.mdx`
- `apps/web/content/blog/tracking-infrastructure/why-agencies-need-a-tracking-map.mdx`
- `apps/web/content/blog/agency-operations/best-crm-for-digital-marketing-agencies.mdx`

Every page exports proper `generateMetadata()` with OG + Twitter + canonical. Every page has JSON-LD where applicable per ARCHITECTURE.md §12.3. Mobile-responsive via Tailwind.

All pages ISR with appropriate `revalidate` values. All external links `rel="noopener noreferrer"`.

Install GTM + GA4 on every page via the analytics package. Consent mode defaults per EU requirement (cookie banner comes in a sub-step — use a simple accept/reject banner).

### Step 9 — The App (`apps/app`)

Auth routes (group `(auth)`):
- `/login`, `/signup`, `/magic-link`, `/reset-password`, `/verify-email`
- Methods: email/password, Google OAuth, magic link (per §6.1)

Onboarding flow after first signup:
- Create workspace (name, slug auto-suggested)
- Optional: invite first teammates
- Optional: add first client
- Land on empty workspace dashboard

Dashboard routes (group `(dashboard)`), path `/[workspace]/`:
- `/` — workspace home (shows active clients count, seats, tier, recent activity feed placeholder)
- `/clients` — client list table, search, filter, archive toggle, "New Client" button
- `/clients/[clientId]` — split-pane layout:
  - Top: 3 tabs (Profile, Visualization, Ad Platforms) — Profile fully built, Visualization renders React Flow with empty state + "Add node" button that opens a node-type picker (minimal: just website + ga4_property types with basic metadata; full node library comes in Prompt 2), Ad Platforms tab shows empty state with "Coming soon — V2"
  - Bottom: placeholder for messages/tasks panel (full build in Prompt 3). Must show the split with a resizable divider using `react-resizable-panels`. Collapsible.
- `/clients/new` — create client form
- `/clients/[clientId]/settings` — archive/unarchive, delete
- `/team` — member list + role management + invite flow
- `/team/invite` — invite form (role picker, email)
- `/billing` — current tier, upgrade/downgrade UI with proper gating per §7.4, invoice list (via Stripe portal link)
- `/settings` — workspace settings (name, slug, assignment-based-access toggle)
- `/profile` — user profile (name, avatar, timezone, email)

Portal routes (group `(portal)`), path `/portal/[token]/`:
- `/` — portal dashboard (client name, contact info, recent messages summary)
- `/messages` — message thread UI (minimal; receive + reply; full build in Prompt 3)
- Token validation middleware rejects expired/invalid tokens with a friendly page

API routes (`apps/app/app/api/`):
- `/webhooks/stripe/route.ts`
- `/webhooks/resend-inbound/route.ts`
- `/workspaces/switch/route.ts`
- `/health/route.ts` (liveness check)

Middleware:
- Session refresh (Supabase pattern)
- Workspace slug validation
- Role enforcement on protected routes
- Rate limiting on auth routes

All app pages use server components by default. `"use client"` only where needed (tracking map canvas, resizable panels, forms with client validation).

### Step 10 — Inngest Setup

- Inngest app init in `apps/app/inngest/`
- Client + function registry
- One scaffolded function: `recomputeActiveClientCount` that runs nightly per workspace
- Stripe webhook handler enqueues Inngest jobs for async processing (subscription changes → audit log entries, email notifications)
- Inngest dev server in dev script

### Step 11 — Observability

- Sentry: init in both apps, source maps uploaded on build, error boundary at root
- PostHog: init via analytics package
- GTM + GA4: verify tag fires on homepage (include a `page_view` test in E2E)
- Log shipping: structured logs via `pino` in server contexts, ingested by Vercel's observability

### Step 12 — CI

GitHub Actions workflow `.github/workflows/ci.yml`:
- On push/PR: checkout, setup Node 22, setup pnpm, install, `pnpm check`
- Matrix over Node 22 only (add later if needed)
- Separate job for E2E: runs Playwright against a preview deployment
- Separate job checking RLS is enabled on every tenant table (SQL introspection)

### Step 13 — Deployment

- Vercel project `phloz-web` (apps/web) → phloz.com
- Vercel project `phloz-app` (apps/app) → app.phloz.com
- Environment variables documented in `docs/DEPLOYMENT.md`
- DNS setup instructions for `inbound.phloz.com` (Resend MX records) in `docs/DNS-SETUP.md`

### Step 14 — Doc Files

Create (if not already there) and populate:
- `docs/ROADMAP.md` — list of phases (Phase 1: Foundation ✅, Phase 2: Tracking Map, Phase 3: Tasks & Messages, Phase 4: Client Portal Polish, Phase 5: SEO Content, Phase 6: V2 Integrations) with current phase clearly marked
- `docs/CHANGELOG.md` — initial entry for the foundation scaffold
- `docs/DECISIONS.md` — log every non-trivial decision made during this build (Geist font choice, accent color, pgTAP vs alternative, etc.)
- `docs/KNOWN-ISSUES.md` — note things deferred to later prompts with links to the corresponding ARCHITECTURE.md sections
- `docs/NEXT-STEPS.md` — rewrite at end with 5-10 concrete actions for Prompt 2 preparation

### Step 15 — Skills Scaffolding

Create these skill files with full content:
- `skills/phloz-conventions/SKILL.md`
- `skills/phloz-tenancy/SKILL.md`
- `skills/phloz-billing/SKILL.md`
- `skills/phloz-analytics/SKILL.md`
- `skills/phloz-seo/SKILL.md`

Each skill's frontmatter `description` clearly states when Claude should use it. Content references back to ARCHITECTURE.md sections rather than duplicating.

### Step 16 — Slash Commands

Set up Claude Code slash commands in `.claude/commands/`:
- `/session-start.md`
- `/session-wrap.md`
- `/add-decision.md`
- `/check-arch.md`

Each is a markdown file with the prompt for that workflow.

### Step 17 — Final Verification

- `pnpm install` works cleanly
- `pnpm dev` starts both apps
- `pnpm check` passes (typecheck + lint + unit tests)
- `pnpm test:e2e` runs Playwright and passes basic smoke tests (landing page loads, signup page loads, pricing page loads)
- GTM container fires on homepage (verify in network tab)
- Stripe checkout works in test mode
- Magic link email sends via Resend
- Inbound email webhook receives test payload
- RLS tests pass — a member in workspace A cannot see workspace B data

---

## Session Discipline

- Work in focused blocks. After every 2-3 steps, run `/session-wrap` and commit.
- If you hit a decision not covered in ARCHITECTURE.md, stop and ask.
- If context is getting long, finish the current step cleanly, run `/session-wrap`, and start a fresh session with `/session-start`.
- Use Opus 4.7 xhigh for architecture steps (1-3, 14-16). Drop to Sonnet 4.6 for implementation-heavy steps (4-11). Don't waste tokens running xhigh on boilerplate.
- Invoke subagents for parallel work: one on the marketing site, one on the app, when they're independent.
- Log every non-trivial decision in `docs/DECISIONS.md` as you go.

---

## Success Criteria

Phase 1 is complete when:

1. Both apps deploy to Vercel on push to `main`
2. A new user can: sign up → create workspace → invite a member → add a client → view the (empty) tracking map → archive the client → upgrade tier via Stripe checkout
3. All doc files in `docs/` exist and reflect current state
4. All skill files in `skills/` exist
5. CI is green
6. The marketing site has 20+ indexable pages (home, pricing, features, about, contact, blog index + 3 posts + 3 category pages, 3 compare stubs, 3 use-case stubs, 3 crm-for stubs, sitemap, robots, llms.txt)
7. Every event in ARCHITECTURE.md §11.2 has a typed entry in `event-map.ts` (firing on key flows verified)
8. RLS smoke tests pass
9. `docs/NEXT-STEPS.md` lists the exact first actions for Prompt 2

---

## Setup Instructions Before Running This Prompt

Before you paste this prompt into Claude Code, do the following locally:

1. **Clone the repo:**
   ```bash
   git clone https://github.com/ramtinlahooti/phloz.git
   cd phloz
   ```

2. **Add the three foundation files** (all attached to this conversation):
   - `CLAUDE.md` → repo root
   - `docs/ARCHITECTURE.md` → create `docs/` folder and drop it in
   - This file (`PROMPT_1.md`) → save anywhere, you'll paste its content into Claude Code

3. **Create empty placeholder docs** (Claude will populate them):
   ```bash
   mkdir -p docs skills .claude/commands
   touch docs/ROADMAP.md docs/CHANGELOG.md docs/DECISIONS.md docs/KNOWN-ISSUES.md docs/NEXT-STEPS.md
   ```

4. **Commit and push** so the starting state is clean:
   ```bash
   git add .
   git commit -m "docs: add foundation architecture and Claude Code rules"
   git push
   ```

5. **Launch Claude Code** in the repo directory:
   ```bash
   cd phloz
   claude
   ```

6. **In Claude Code, set the model:**
   ```
   /model opus-4.7
   /effort xhigh
   ```

7. **Paste the content of this file** (from "Your Role" at the top, down to "Success Criteria") as your first message.

8. When Claude asks clarifying questions, answer them. When it proposes changes to ARCHITECTURE.md, decide together.

9. Expect this prompt to take **4–8 Claude Code sessions** to complete fully. That's normal. Use `/session-wrap` every session.

---

*End of Prompt 1. After this phase ships, come back to me (the planning chat) for Prompt 2: the tracking map editor.*
