# Next Steps (as of 2026-04-23, post-file-uploads)

Recent shipped (this session):
- **env.local** created for both apps (gitignored).
- **Dep upgrade** — Sentry 10, Drizzle 0.45, Inngest 4 (breaking API
  migrated in-session).
- **Map polish** — keyboard shortcuts, node search, JSON export,
  200-node soft cap.
- **Tasks module** — workspace view, per-client tab, filter pills.
- **Messages module** — unified inbox, per-client thread UI, compose
  pane with Email + Internal note tabs, `sendPlainEmail` helper.
- **Portal dashboard** — client-visible tasks + email messages.
- **Map edge polish** — edge-type picker, labels, JSON import.
- **File uploads** — Supabase Storage bucket + RLS + Files tab.

`pnpm check` → 29/29 green. Everything committed.

---

## Ramtin's actions (optional)

### Ship to Vercel

Deps are now aligned with what Vercel resolves. Push should build
cleanly. Keep `installCommand: pnpm install --frozen-lockfile` in the
project settings (already set via `vercel.json`).

### Kick the tires

1. `pnpm --filter @phloz/app dev` (env.local has public Supabase keys;
   you supplied the two secrets).
2. Open a client → **Tasks** tab → add a task → mark it client-visible.
3. Open **Messages** tab → forward a client email to the inbound
   address shown, or compose a reply. Internal note for team-only
   thoughts.
4. Open **Files** tab → drop a PDF / image / doc (<4MB). Download
   opens a 5-minute signed URL.
5. Open **Tracking map** → `n` to add, drag between nodes to connect,
   pick edge type + label, click Save. Click an edge to edit. Export +
   Import round-trip a snapshot.
6. Open `/portal/<token>` — should show the client-visible task +
   email messages, no internal notes.

---

## Features worth queueing

**G. Breadcrumbs + global ⌘K**
- Breadcrumb chain (Workspace / Clients / Acme Corp / Tracking map)
  in the dashboard shell.
- Global ⌘K palette: switch workspace, jump to client, open a task,
  add a node.

**H. Approvals**
- Extend `task.visibility = client_visible` with a Done / Rejected /
  Needs-changes state so agencies can run creative review through
  the portal. Email notifications on state changes.

**I. Tests**
- pgTAP for tracking-nodes / edges / client_assets / storage.objects
  RLS.
- Vitest for pure helpers (`autoLayout`, `formatLastVerified`,
  per-descriptor Zod) and server actions (mocked DB).
- Playwright smoke: signup → onboarding → add client → add task →
  upload file → add map node → view in portal.

**J. Reply-from-portal**
- Portal is read-only today. Add a portal-session-aware action so
  clients can reply, threading into `channel=portal, direction=inbound`
  messages that show up alongside email in the client thread.

**K. Task / map templates**
- "New campaign launch" template → 8 tasks + 5 map nodes + 6 edges.
  "Monthly report" template → 4 tasks. Per-agency customization.

**L. Client status automations**
- Client inactive for 30 days → `status = at_risk`, notify owner.
  Plugs into the existing Inngest `recomputeActiveClientCount` cron.

---

## Accounts / provisioning

- ✅ GitHub, Supabase (including Storage bucket now), GTM, Stripe
  sandbox.
- ⏳ Vercel (follow `docs/DEPLOYMENT.md`), Resend domain, Inngest
  account, PostHog, Sentry, GA4.

All ⏳ items are optional for local dev.
