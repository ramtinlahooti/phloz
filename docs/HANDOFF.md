# Chat handoff

Paste the block below into a fresh Claude Code chat to pick up
where we left off. The prompt tells Claude exactly what to read,
what's already done, what's queued, and what the ground rules are.

---

## Prompt to paste

> I'm continuing work on **Phloz** — a CRM + work management +
> tracking-infrastructure platform for digital marketing agencies.
> Solo project, owner is Ramtin Lahooti, repo is
> `ramtinlahooti/phloz` (private, GitHub). You're picking up from
> a previous session.
>
> **Before you do anything else, read these in order:**
>
> 1. `CLAUDE.md` — project rules (mandatory).
> 2. `docs/ARCHITECTURE.md` — source of truth for structural
>    decisions. Don't contradict this.
> 3. `docs/NEXT-STEPS.md` — what's shipped, what's pending, what
>    I need to do before going live.
> 4. `docs/CHANGELOG.md` — scroll the top 3-4 entries for a sense
>    of recent velocity + conventions.
> 5. `docs/DECISIONS.md` and `docs/KNOWN-ISSUES.md` if anything
>    below conflicts with your instincts.
>
> **The state as of now:**
>
> - Phase 1 scaffold (PROMPT_1 Steps 0-13) is complete.
> - Prompt 2 (tracking-map editor) is complete.
> - Agency product has real features end-to-end: clients,
>   contacts, tasks (with filters / sort / templates / comments /
>   approvals), messages, files (with client-visibility toggle),
>   team management (roles / remove / revoke invites), billing
>   (Stripe Checkout + Portal), portal (tasks with approvals,
>   messages with replies, shared files), activity feed on
>   workspace overview, editable settings (profile + agency).
> - Inngest jobs + Sentry + PostHog + CI all wired.
> - Supabase: project `tdvzhwhzxuskrsobdyrm`, 25 tables + RLS +
>   JWT custom access token hook enabled, ECC P-256 signing.
> - Stripe: sandbox `acct_1RXbVlPomvpsIeGO`, 4 tier products + 12
>   prices, IDs in `packages/billing/src/tiers.ts`.
> - GTM container `GTM-W3MGZ8V7` wired.
> - `pnpm check` → 29/29 green, both apps build cleanly.
>
> **Working directory:** `/Users/tarashamaei/Desktop/phloz`
> **Main branch:** `main`, pushed to `origin`.
>
> **Local env is already configured:**
> - `apps/app/.env.local` + `apps/web/.env.local` exist (both
>   gitignored). `NEXT_PUBLIC_SUPABASE_URL` + anon key pre-
>   filled; `SUPABASE_SERVICE_ROLE_KEY` + `DATABASE_URL` are
>   real values I supplied. Resend / Stripe / Sentry / Inngest /
>   PostHog keys may or may not be set — when they're missing,
>   the code no-ops gracefully.
>
> **Ground rules:**
>
> - TypeScript strict everywhere. Zod on every external input.
> - Server actions are role-gated via `@phloz/auth/roles`. Portal
>   flows use `validatePortalMagicLink` instead (they never have
>   a Supabase user). There's an established pattern — follow it.
> - URL construction for email links goes through
>   `apps/app/lib/app-url.ts` (`getAppUrl()` / `getAppUrlFromRequest`)
>   so links don't bake in `app.phloz.com` before DNS is pointed.
> - Tailwind v4 CSS-first via `@theme` in
>   `packages/ui/styles/globals.css`. Both apps add
>   `@source "../../../packages/ui/src/**/*.{ts,tsx}";` so workspace
>   classes make it into the bundle.
> - `packages/auth/src/client.ts` reads env vars as literal
>   `process.env.NEXT_PUBLIC_*` — don't refactor to `requireEnv()`
>   there, Next's bundler needs the literal.
> - Commit style: conventional commits (`feat(app):`, `fix:`, etc.)
>   + a meaningful body + the existing Co-Authored-By trailer.
> - Every session ends with a `pnpm check` run (all 29 tasks
>   green) and a commit+push before you stop.
>
> **What's pending:**
>
> See `docs/NEXT-STEPS.md` "Remaining" + "What Ramtin needs to
> do to go live". Headline items:
>
> - Playwright smoke tests for the critical flows (signup →
>   onboard → add client → add task → portal approval).
> - `@phloz/analytics` `track()` calls aren't wired from
>   `apps/app` yet.
> - Ownership transfer (blocked today with a clear error).
> - Task assignee picker in the NewTaskDialog + TaskDetailDialog
>   edit mode (filter works, but no way to assign from the UI).
> - Teammate name resolution — currently shows short UUIDs.
>
> **Where to start:**
>
> Ask me what I want to work on. If I don't have a specific thing,
> pick one from "What's pending" above, scope it in 1-2 sentences,
> confirm, then ship it. Small chunks with green builds and pushes,
> not big bang commits.
>
> **How I like to work:**
>
> Read `CLAUDE.md` §14 ("The User's Context") — that applies.
> Be direct, no verbose preambles, explain tradeoffs when picking
> a non-obvious approach, and don't waste tokens on recap unless
> I ask.
>
> Confirm you've read CLAUDE.md + ARCHITECTURE.md + NEXT-STEPS.md
> before writing any code.

---

## If you want the shorter version

> Continuing Phloz. Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, and
> `docs/NEXT-STEPS.md` first. Main branch is up to date, `pnpm
> check` is 29/29 green, env.local is configured. Ask what I want
> to build next; if I don't know, pick from the "Remaining" list
> in NEXT-STEPS and scope it before you start.
