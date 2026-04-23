# CLAUDE.md — Phloz Project Rules

**This file is read by Claude Code at the start of every session. These rules are mandatory.**

---

## 0. Before You Do Anything

1. Read `docs/ARCHITECTURE.md` — **non-negotiable source of truth** for structural decisions
2. Read `docs/ROADMAP.md` — know what phase we're in
3. Read `docs/NEXT-STEPS.md` — the immediate 3–10 actions queued up
4. Read any `skills/phloz-*/SKILL.md` matching the current task (tenancy, billing, analytics, etc.)
5. If the user's request conflicts with ARCHITECTURE.md, **stop and ask** before proceeding — never silently override architecture

---

## 1. Project at a Glance

**Phloz** — CRM + work management + marketing tracking infrastructure platform for digital marketing agencies.
**Owner:** Ramtin Lahooti (@ramtinlahooti)
**Repo:** https://github.com/ramtinlahooti/phloz (private)
**Domains:** phloz.com (marketing), app.phloz.com (product), inbound.phloz.com (email-to-app)
**GTM Container:** GTM-W3MGZ8V7
**Stage:** Pre-launch. No paying customers yet. Foundation being built.

---

## 2. The Golden Rules

1. **No silent architectural changes.** If a decision touches ARCHITECTURE.md, propose the change, get confirmation, then log it in `docs/DECISIONS.md`.
2. **RLS on every tenant table, always.** Every new table with `workspace_id` must have RLS enabled before the migration is considered complete.
3. **Never bypass `packages/*` public APIs.** If you need something from a package, export it properly. Don't deep-import.
4. **Every tracked user action goes through `packages/analytics/track()`.** No raw `gtag()`, no raw `dataLayer.push()`, no raw PostHog SDK calls outside that package.
5. **Every tier-gated action calls a `can*()` gate from `packages/billing`.** No tier logic scattered through the codebase.
6. **Zod validates every external input.** API route bodies, form submissions, webhook payloads — all go through Zod schemas.
7. **No secrets in the repo, ever.** Even commented out. Use env vars + the `.env.example` pattern.
8. **Update docs before ending the session.** See §6.

---

## 3. Stack Reference

| Layer | Technology | Package location |
|---|---|---|
| Framework | Next.js 16 (App Router) | `apps/web`, `apps/app` |
| Language | TypeScript (strict) | everywhere |
| Monorepo | Turborepo + pnpm | root `turbo.json` |
| DB | Supabase Postgres + RLS | `packages/db` |
| ORM | Drizzle | `packages/db/schema` |
| Auth | Supabase Auth | `packages/auth` |
| UI | Tailwind v4 + shadcn/ui | `packages/ui` |
| Canvas | React Flow (`@xyflow/react`) | `packages/tracking-map` |
| Font | Geist Sans + Geist Mono | `packages/ui/fonts` |
| Billing | Stripe | `packages/billing` |
| Email | Resend (outbound + inbound) | `packages/email` |
| Jobs | Inngest | `apps/app/inngest` |
| Errors | Sentry | `packages/config/sentry` |
| Analytics | GTM + GA4 + PostHog | `packages/analytics` |
| Validation | Zod | everywhere |
| Tests | Vitest + Playwright | `*/__tests__`, `e2e/` |

---

## 4. Code Conventions

### File & folder naming
- **Files:** `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
- **Folders:** `kebab-case`
- **Routes:** Next.js App Router conventions (`page.tsx`, `layout.tsx`, `route.ts`)
- **Types:** `PascalCase`, in `types.ts` or co-located with usage
- **Constants:** `UPPER_SNAKE_CASE` for true constants; `camelCase` for config objects

### TypeScript
- `strict: true` always
- No `any` without a `// eslint-disable-next-line` + reason
- No `as` type assertions without a comment explaining why a guard isn't used
- Prefer `type` for unions and intersections; `interface` for object shapes that may be extended
- Co-locate Zod schemas with their types: `export const xSchema = z.object(...); export type X = z.infer<typeof xSchema>;`

### Components
- Server components by default; add `"use client"` only when required
- Props interfaces named `[Component]Props`
- One component per file for non-trivial components
- Colocate: `ComponentName/index.tsx`, `ComponentName/helpers.ts`, `ComponentName/types.ts`

### Imports
- Absolute imports via workspace aliases: `@phloz/db`, `@phloz/ui`, `@phloz/billing`
- Relative imports only within a single package/app
- External → internal → relative, separated by blank lines

### Errors
- Never swallow errors
- Use `Result<T, E>` pattern (`packages/types`) for expected failure cases
- Throw for truly exceptional cases only
- All thrown errors reported to Sentry via instrumentation

### Testing
- Unit tests for: all `packages/*` utilities, billing gates, analytics helpers, RLS policies (SQL-level)
- E2E tests (Playwright) for: critical user journeys (signup → create workspace → add client; client portal magic link; billing checkout; map node CRUD)
- Test file lives next to the tested file: `tiers.ts` + `tiers.test.ts`
- Don't chase 100% coverage. Cover critical paths.

---

## 5. Database Rules

### Migrations
- One migration per logical change
- Always reversible (include `down` SQL)
- RLS policies live in SQL files under `packages/db/rls/[table_name].sql`, imported in migrations
- Never write destructive migrations without explicit user approval

### Queries
- Use Drizzle, not raw SQL (except for RLS policies and complex reports)
- Never `SELECT *` — always explicit columns
- All tenant queries assume RLS is doing its job; **also** include `workspace_id` filters (defense-in-depth)
- Paginate any query that could return >100 rows

### RLS Policies
- Every tenant table has at minimum: SELECT, INSERT, UPDATE, DELETE policies
- Policies check `workspace_id` against the JWT claim
- Additional role checks on admin-only mutations
- RLS policies are tested via pgTAP or SQL-level tests in `packages/db/tests/`

---

## 6. Self-Documenting Workflow (Mandatory)

### At session start, run `/session-start`:
Reads ROADMAP.md and NEXT-STEPS.md. Summarizes where we are. Confirms the planned work.

### At session end, run `/session-wrap`:
Runs this checklist:
1. All new code committed with conventional commit messages
2. `docs/CHANGELOG.md` — append entry with today's date + summary + files touched
3. `docs/ROADMAP.md` — check off completed items, flag blockers
4. `docs/NEXT-STEPS.md` — rewrite with the 3–10 next concrete actions
5. `docs/DECISIONS.md` — append any non-trivial architectural decision
6. `docs/KNOWN-ISSUES.md` — append bugs found, workarounds, deferrals
7. Push to GitHub
8. Summarize session outcome in chat

### Session hygiene
- Don't leave the session with failing tests
- Don't leave the session with uncommitted changes
- If running out of context, stop early and run `/session-wrap`

### When unsure, ask — but only once
- Ask the user for clarification when a decision is ambiguous
- If they've already answered, don't ask again in a later session — check DECISIONS.md first
- When a user says "your call," make a decision and log it in DECISIONS.md

---

## 7. Commit Message Format

Conventional Commits:
```
feat(billing): add can_add_client gate
fix(tracking-map): edge deletion no longer crashes on missing node
docs(architecture): add note on viewer seats
chore(deps): bump drizzle to 0.32.0
refactor(analytics): extract track() to packages/analytics
test(rls): add pgTAP tests for clients table
```

One logical change per commit. If you fix a bug while adding a feature, commit them separately.

---

## 8. PR / Review Discipline

Solo project, so no formal PRs required, but when working on a branch:
- Branch name: `feat/[short-description]` or `fix/[short-description]`
- Squash merge to main
- Run `pnpm check` (typecheck + lint + unit tests) before merge

---

## 9. Environment Variables

- `.env.example` at repo root — commit this, keep in sync with reality
- `.env.local` — actual values, gitignored
- Zod validation of env at startup (`packages/config/env.ts`)
- Vercel env vars for production/preview
- Never `console.log` env values

---

## 10. Anti-Patterns (Forbidden)

- **Time-based logic without timezone handling.** Always store UTC, render in user's TZ.
- **Prop drilling past 2 levels.** Use context or colocate.
- **Global state without a clear reason.** React state > Context > Zustand (only if needed).
- **Fetching in components.** Use server components, route handlers, or server actions.
- **String concatenation for SQL.** Drizzle only; if raw SQL is truly needed, parameterize.
- **Fetching sensitive data client-side.** Server-only.
- **Tight coupling between packages.** If `packages/billing` needs to know about tracking nodes, something is wrong.
- **Magic numbers.** Named constants in `packages/config/constants.ts`.
- **Hardcoded tier names or limits anywhere except `packages/billing/tiers.ts`.**
- **Firing analytics events from deeply nested components without a typed event name.**
- **Adding a node type without a Zod schema.**
- **`any` in public APIs.** Internal `any` sometimes OK with comment.

---

## 11. When Things Go Wrong

### Tests failing after your change
1. Don't skip or delete tests to make them pass
2. Fix the code or the test (if the test was wrong)
3. If the test reveals a deeper issue, log it in KNOWN-ISSUES.md before deferring

### Uncertain about architecture
1. Check DECISIONS.md
2. Check ARCHITECTURE.md
3. If still unclear, ask the user — do not guess

### Running out of context
1. Stop the current task at a clean checkpoint
2. Run `/session-wrap`
3. Note in NEXT-STEPS.md exactly where to pick up

### Found a bug outside your task
1. Log in KNOWN-ISSUES.md
2. Don't fix it in this session unless it blocks current work
3. Surface in session summary

---

## 12. Model Selection

- **Opus 4.7 xhigh / max** — architecture work, complex refactors, debugging hard issues
- **Opus 4.7 high** — feature implementation with ambiguity
- **Sonnet 4.6 / high** — well-specified feature implementation, file-by-file work
- **Haiku 4.5** — trivial edits, formatting, single-file changes

Switch with `/model`. Save tokens by using the smallest model that can do the job.

---

## 13. Getting Unstuck

When a task feels unclear, don't spiral. Pause and answer these:
1. What does the user actually want? (re-read their message)
2. Does ARCHITECTURE.md cover this?
3. Is there a relevant skill in `skills/`?
4. Is there a precedent in the codebase?
5. If still unclear: ask one focused question. Don't ask three at once.

---

## 14. The User's Context

- Ramtin is solo, building after work in Vancouver (timezone: America/Vancouver)
- He is not a senior engineer. Explain tradeoffs when proposing non-obvious choices.
- He is paying for Claude. Don't waste tokens on verbose preambles — be direct.
- He cares about: (a) not burning money on infrastructure, (b) not having to rewrite code later, (c) SEO, (d) shipping something real.
- He does not have design partners yet. Ship opinionated defaults.

---

**End of CLAUDE.md. Last updated: 2026-04-23.**
