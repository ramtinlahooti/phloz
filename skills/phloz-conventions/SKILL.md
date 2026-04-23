---
name: phloz-conventions
description: Use this skill whenever writing or reviewing Phloz code. Covers file and folder naming, TypeScript rules, React component patterns, import conventions, error handling, and testing standards. Apply on any task that involves creating new files, adding new code, or refactoring existing code in the Phloz monorepo. Do NOT use this skill for non-Phloz projects or when only reading existing code without modification.
---

# Phloz Conventions Skill

This skill encodes the conventions Claude must follow when writing any code in the Phloz repo. It complements `CLAUDE.md` §4 and is authoritative on style.

## When to apply this skill

Use whenever you:
- Create a new file or folder in `apps/*` or `packages/*`
- Write a new React component, Server Action, or API route
- Add or refactor TypeScript utilities
- Write tests
- Review a proposed change for style compliance

Do NOT use when only reading code without modifying it, or when working outside the Phloz monorepo.

## File and folder naming

| Kind | Convention | Example |
|---|---|---|
| Utility files | `kebab-case.ts` | `active-clients.ts` |
| React components | `PascalCase.tsx` | `ClientCard.tsx` |
| Folders | `kebab-case` | `tracking-map`, `client-contacts` |
| Next.js routes | App Router conventions | `page.tsx`, `layout.tsx`, `route.ts` |
| Types-only files | `types.ts` colocated, or `PascalCase.types.ts` | `Client.types.ts` |
| Zod schemas | colocated with types, file named `[entity]-schema.ts` | `client-schema.ts` |
| Tests | `*.test.ts` next to tested file | `tiers.ts` + `tiers.test.ts` |
| Constants | `UPPER_SNAKE_CASE` for true constants | `MAX_NODES_PER_CLIENT = 200` |
| Config objects | `camelCase` | `const tierConfig = {...}` |

## TypeScript rules

- `strict: true` in every tsconfig — no exceptions
- Forbidden without a comment explaining why: `any`, `as` type assertions, `@ts-ignore`, non-null assertion `!`
- Prefer `type` for unions/intersections, `interface` for extensible object shapes
- Zod pattern is always: `export const xSchema = z.object(...); export type X = z.infer<typeof xSchema>;`
- Never use `Omit` or `Pick` for more than 3 fields — create a dedicated type instead
- Generics: meaningful single-letter names (`T`, `E`, `K`, `V`) or full words (`TWorkspace`)

## React component rules

- Server components by default; add `"use client"` only when strictly needed (event handlers, hooks, browser APIs, React Flow, client forms)
- Props interface name: `[Component]Props`
- One component per file unless the components are private helpers under 20 lines
- Co-locate: `ComponentName/index.tsx` (exports default), `ComponentName/helpers.ts`, `ComponentName/types.ts`
- Never prop-drill past 2 levels — use context or colocation
- No inline styles; Tailwind classes only
- Accessibility: semantic HTML, `aria-*` attributes on custom interactive elements, keyboard support for anything clickable

## Imports

Order (separated by blank lines):

```typescript
// 1. External packages
import { useState } from 'react';
import { z } from 'zod';

// 2. Internal packages (@phloz/*)
import { db } from '@phloz/db';
import { track } from '@phloz/analytics';

// 3. Relative imports
import { helper } from './helpers';
import type { LocalType } from './types';
```

- Use workspace aliases (`@phloz/db`, `@phloz/ui`, etc.) for cross-package imports
- Relative imports only within the same package or app
- Never deep-import from another package (`@phloz/db/schema/clients` is forbidden; export from package index)

## Error handling

- Never swallow errors
- Use `Result<T, E>` pattern from `packages/types` for expected failure paths
- Throw only for truly exceptional cases (programmer error, system failure)
- All thrown errors must be captured by Sentry via framework instrumentation — never catch and silently log
- User-facing errors must have a clear message; never surface raw stack traces

Example:

```typescript
// Good
async function addClient(input: AddClientInput): Promise<Result<Client, AddClientError>> {
  const gate = await canAddClient(input.workspaceId);
  if (!gate.allowed) return err({ kind: 'gate_failed', reason: gate.reason });
  // ...
  return ok(client);
}

// Bad
async function addClient(input: AddClientInput): Promise<Client> {
  try {
    return await db.insert(...).returning();
  } catch (e) {
    console.log(e); // swallowed error
    return null as any;
  }
}
```

## Testing

- Unit tests (Vitest) are required for: `packages/billing` gates, `packages/analytics` event shapes, any pure utility in `packages/*`, RLS policies (pgTAP-style)
- E2E tests (Playwright) required for critical flows only: signup → workspace creation; add client → edit → archive; portal magic link flow; Stripe checkout flow
- Test file next to source: `foo.ts` → `foo.test.ts`
- Don't chase 100% coverage. Cover what breaks badly if wrong.
- Use `describe` for scope, `it` for single behavior — `it('allows adding a client when under tier limit')`
- Never skip a failing test without logging in `docs/KNOWN-ISSUES.md`

## Anti-patterns (forbidden)

- `SELECT *` in any Drizzle query
- Raw `gtag()` or `dataLayer.push()` outside `packages/analytics`
- Stripe SDK imported outside `packages/billing`
- Resend SDK imported outside `packages/email`
- Hardcoded tier names or limits outside `packages/billing/tiers.ts`
- String concatenation for SQL
- `console.log` in committed code (use `pino` logger in server, remove in clients)
- Fetching in React components (use server components or server actions)
- Global mutable state
- `setTimeout`/`setInterval` for polling (use Supabase Realtime or Inngest)
- Magic numbers (create named constants)
- Unhandled promise rejections

## Code review checklist before committing

- [ ] No `any`, `as`, `@ts-ignore` without comment
- [ ] Imports ordered correctly
- [ ] Zod schema exists for every API input and form
- [ ] Tests added or updated
- [ ] RLS policy exists if new tenant table added
- [ ] Event tracked via `packages/analytics` if user action
- [ ] Tier gate checked if tier-sensitive action
- [ ] No secrets committed
- [ ] `pnpm check` passes
