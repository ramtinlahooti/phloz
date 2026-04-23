# Next Steps (as of 2026-04-23, post-tasks-module)

Recent shipped:
- **Dep upgrade** — Sentry 10, Drizzle 0.45, Inngest 4 (breaking API
  migrated in-session).
- **Tracking-map polish** — keyboard shortcuts, node search, JSON
  export, 200-node soft cap.
- **Tasks module** — workspace-wide view with filter pills, per-client
  tab, optimistic status toggles, new-task dialog with department /
  priority / visibility / due date / client select.

`pnpm check` → 29/29 green. `apps/app` → 30 routes. All committed.

---

## Ramtin's actions (optional)

### Vercel re-deploy

The dep-upgrade commit should unblock the Vercel build. If it
re-surfaces the same drift, double-check that your project's install
command is `pnpm install --frozen-lockfile` (it is, per each app's
`vercel.json`).

### Kick the tires

1. `pnpm --filter @phloz/app dev`.
2. Open a client → Tasks tab → **New task** → create.
3. Toggle status via the row's status icon dropdown.
4. Set a due date in the past to see the Overdue badge.
5. On `/{workspace}/tasks`, try the filter pills (department + status).
6. Open the tracking map → press `n` → pick a type → press `/` to
   search → `Esc` to close the drawer → click Export.

---

## Feature sessions worth queueing

**A. Messages module**
- Unified inbox pulling from `messages` (inbound + outbound).
- Per-client thread UI grouped by `thread_id`.
- Compose + reply UI via Resend.

**B. Portal fleshout**
- Portal dashboard with tasks (`visibility = client_visible`),
  messages, assets — today `/portal/[token]` only shows a landing.
- `portalAccess` toggle per client contact.

**C. File uploads**
- Supabase Storage bucket per workspace.
- `client_assets` upload + list UI.

**D. Edge polish for the tracking map**
- Edge-type picker at connect time (currently defaults to `custom`).
- Editable edge labels.
- JSON import (pair with the export we just shipped).

**E. Tests + skills**
- pgTAP for tracking-nodes/edges RLS invariants.
- Vitest for tracking-map pure helpers (`autoLayout`,
  `formatLastVerified`, per-descriptor Zod).
- Vitest for tasks actions (mocked DB).
- Playwright smoke: signup → onboarding → add client → add task →
  add map node.
- `skills/phloz-tracking-map/SKILL.md` explaining the registry +
  adding a new node type.

**F. UX polish**
- Breadcrumb nav on deep client pages.
- Global ⌘K to switch workspaces / jump to client / find task.
- Empty-state copy across the app.

---

## Accounts / provisioning

- ✅ GitHub, Supabase, GTM, Stripe sandbox.
- ⏳ Vercel (follow `docs/DEPLOYMENT.md`), Resend domain, Inngest
  account, PostHog, Sentry, GA4.

All ⏳ items are optional for local dev.
