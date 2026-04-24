# Next Steps (as of 2026-04-23, end of the intense feature session)

## Where Phloz stands

Phase 1 scaffold shipped in full (PROMPT_1 Steps 0–13). Prompt 2
(tracking-map editor) shipped. Since then we've built the agency
product out substantially.

### Working end-to-end

- **Auth** — signup / login / magic link / password reset / OAuth
  callback. Supabase JWT hook enabled. Email uses Supabase's
  default sender until Resend SMTP is configured
  (`docs/DEPLOYMENT.md` Step 6).
- **Onboarding** — workspace creation, sets `active_workspace_id`,
  fires `workspace/created` to Inngest.
- **Dashboard shell** — sidebar nav, workspace switcher, user menu.
- **Workspace overview** — 3 live count cards + an activity feed
  merging tasks / messages / file uploads / approval outcomes with
  deep links.
- **Clients** — list with at-risk / inactive badges (driven by a
  cached `last_activity_at` the nightly Inngest cron populates).
  Create, archive / unarchive (tier-gated via `canUnarchiveClient`),
  editable details on Overview, editable notes.
- **Contacts** (on each client) — CRUD + grant portal access +
  "Email link" (via Resend template) + "Copy link". **This is how
  you create portal magic-links.**
- **Tasks** — per-client tab + workspace-wide `/tasks` page.
  Filters: department / status / client / assignee. Sort:
  priority / due soonest / due latest / recently
  updated / recently created. Optimistic status toggles. Detail
  dialog with comments + full edit form. 5 built-in templates
  (Apply template dropdown) instantiate N tasks at once with
  staggered due dates.
- **Comments** — polymorphic. Task comments thread in the detail
  dialog with a "Client-visible" checkbox.
- **Messages** — per-client thread UI + workspace unified inbox.
  Compose Email (via Resend) or Internal note tabs. Per-client
  inbound address surfaced at the top.
- **Files** — Supabase Storage with RLS scoped by workspace path.
  Upload (4 MB cap, MIME allowlist), signed-URL download (5 min),
  delete, per-file "Share with client" toggle.
- **Tracking map** — canvas, 21 node types with Zod metadata,
  edge-type picker, keyboard shortcuts (`n`, `/`, `Esc`), node
  search, JSON export + import, dagre auto-layout, 200-node soft
  cap. Creating a node no longer validates against the strict
  schema (filled in via the drawer).
- **Team** — invite (Resend email), change role, remove member,
  revoke pending invitation. Real-time refresh after invite send.
- **Billing** — Stripe sandbox with 4 tiers × 3 prices; Checkout
  + Customer Portal links, webhook reconciles tier + subscription.
  SDK pinned to `2026-03-25.dahlia`.
- **Portal** (magic-link authenticated):
  - Client-visible tasks with approve / reject / needs-changes
    buttons and optional comment. Emails the workspace owner on
    any state change.
  - Messages thread with inline reply + "start new conversation".
  - Shared files (only assets the agency toggled visible).
- **Settings** — user profile (name + read-only email) + agency
  details (name, description, website, timezone).
- **Inngest jobs** — `recomputeActiveClientCount` (nightly, also
  refreshes `clients.last_activity_at`),
  `sendTrialEndingReminder`, `onWorkspaceCreated`, `onClientAdded`.
- **Observability** — Sentry (graceful no-op without DSN),
  PostHog provider, pino logger in `@phloz/config/logger`.
- **CI** — GitHub Actions: lint/typecheck/test, build matrix,
  RLS-invariants on postgres:16, pgTAP.

### Remaining

- **Tests** — only the package-level ones ship. No Playwright
  smoke tests for the actual app flows. Add when there's a second
  developer.
- **Analytics tracking wiring** — `@phloz/analytics` `track()`
  exists but nothing in `apps/app` calls it yet. Hook into the
  key events (sign_up, add_client, upgrade_tier, etc.) once
  PostHog keys are set.
- **Ownership transfer** — promoting a member to `owner` is
  blocked today. Needs a confirmation flow because it demotes
  the current owner.
- **Name resolution for teammates** — the Team page and task
  assignee filter show short UUIDs for non-self members. Needs
  either a Supabase Admin-API lookup or a cached
  `workspace_members.display_name` column.
- **Task assignee picker** — column exists + filter works, but
  the NewTaskDialog + detail-dialog edit mode don't surface an
  assignee Select yet.

## What Ramtin needs to do to go live

1. **Supabase SMTP** — so auth emails come from `phloz.com`, not
   `noreply@mail.app.supabase.io`. Walkthrough in
   `docs/DEPLOYMENT.md` Step 6. Pre-req: domain verified in Resend.
2. **Set `NEXT_PUBLIC_APP_URL` in Vercel** to the real domain
   once DNS is pointed. Otherwise the request-host fallback takes
   over — still works, just less pretty in emails.
3. **Stripe live-mode products** — still sandbox. Recreate when
   ready to launch.
4. **Inngest app** — register at `app.phloz.com/api/inngest`,
   paste `INNGEST_SIGNING_KEY` into Vercel env.

## Local dev

```bash
# Start
pnpm --filter @phloz/app dev   # product app on :3001
pnpm --filter @phloz/web dev   # marketing on :3000

# Before committing
pnpm check                     # lint + typecheck + unit tests
```

`apps/app/.env.local` + `apps/web/.env.local` are gitignored +
pre-filled with public Supabase keys; only
`SUPABASE_SERVICE_ROLE_KEY` + `DATABASE_URL` need real values.

## Accounts / provisioning

- ✅ GitHub, Supabase (`tdvzhwhzxuskrsobdyrm`, 25 tables + RLS +
  hook enabled), GTM (`GTM-W3MGZ8V7`), Stripe sandbox
  (`acct_1RXbVlPomvpsIeGO`, 4 products + 12 prices wired).
- ⏳ Vercel deploy, Resend domain, Inngest app, PostHog, Sentry,
  GA4 — optional for local dev.
