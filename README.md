# Phloz

CRM + work management + marketing tracking infrastructure platform for digital marketing agencies.

## Stack

Next.js 16 · TypeScript · Turborepo · pnpm · Supabase · Drizzle · Tailwind v4 · shadcn/ui · React Flow · Stripe · Resend · Inngest · Sentry · PostHog · GTM + GA4

## Structure

```
apps/
  web/     Marketing site (phloz.com)
  app/     Product (app.phloz.com)
packages/
  config/        Shared env + constants
  db/            Drizzle schema + migrations + RLS
  auth/          Supabase auth helpers
  billing/       Stripe + tier gates
  email/         Resend outbound + inbound
  analytics/     GTM/GA4/PostHog event layer
  ui/            shadcn/ui shared components
  tracking-map/  React Flow node-type registry
  types/         Shared TS types + Zod schemas
docs/            Architecture, roadmap, decisions
skills/          Claude Code project skills
```

## Quick start

```bash
pnpm install
cp .env.example .env.local  # then fill in values
pnpm dev
```

## Scripts

- `pnpm dev` — run every app in parallel
- `pnpm build` — build every app + package
- `pnpm check` — lint + typecheck + unit tests
- `pnpm test:e2e` — Playwright E2E suite

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — source of truth
- [Roadmap](docs/ROADMAP.md) — phases
- [Next steps](docs/NEXT-STEPS.md) — current queue
- [Decisions](docs/DECISIONS.md) — architectural log
- [Changelog](docs/CHANGELOG.md)
- [Known issues](docs/KNOWN-ISSUES.md)

## For Claude Code sessions

Read `CLAUDE.md` at the repo root first. It lists the non-negotiable rules.
