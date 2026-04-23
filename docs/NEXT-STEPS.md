# Next Steps (as of 2026-04-23, post-Prompt-2)

Phase 1 scaffold is done and **Prompt 2 — the tracking-map editor — has
shipped**. The canvas is wired end-to-end: 21 node types with Zod
metadata schemas, React Flow canvas, drawer-based editor, dagre
auto-layout, and five server actions with role gates.

`pnpm check` → 29/29 green. `apps/app` `next build` → 30 routes.

---

## Ramtin's actions (optional)

### Kick the tires

1. `pnpm --filter @phloz/app dev`
2. Visit `http://localhost:3001`, sign up, onboard, add a client.
3. Open the client detail page → Tracking map tab → "Open tracking map".
4. Add a few nodes (GA4 property, GTM container, Meta pixel), fill the
   metadata form, drag to position, connect with edges, click "Arrange".
5. Flag anything that feels wrong.

### Production wire-up (whenever you want to launch)

Follow `docs/DEPLOYMENT.md`:

1. Two Vercel projects (`phloz-web`, `phloz-app`).
2. Stripe webhook endpoint in the sandbox.
3. Resend domain verification (`docs/DNS-SETUP.md`).
4. Inngest app at `app.phloz.com/api/inngest`.
5. (Optional) Sentry, PostHog, GA4.

---

## Features worth building next (pick what matters)

**A. Map polish (continues from Prompt 2)**
- Edge-type picker (currently defaults to `custom`) in the connect
  interaction.
- Edge labels + inline delete.
- Import / export map JSON.
- Keyboard shortcuts (`n`, `c`, `del`, `/`) per ARCHITECTURE §8.1.
- 200-node soft cap warning.

**B. Tasks module**
- Per-client task board + list + timeline.
- Workspace-wide tasks page (currently a stub) with tier/department/
  status filters.
- Approvals (`task.visibility = client_visible`, client portal sees +
  can comment).

**C. Messages module**
- Unified inbox pulling from the `messages` table.
- Per-client thread UI (grouped by `thread_id`).
- Compose + reply UI (outbound via Resend).

**D. Portal fleshout**
- Portal dashboard (tasks, messages, assets) past the current
  landing placeholder.
- Per-contact `portalAccess` toggle in the CRM.

**E. File uploads**
- Supabase Storage bucket per workspace.
- `client_assets` upload + list UI.

**F. Tests and skills**
- pgTAP tests for tracking-nodes/edges RLS invariants.
- Vitest for tracking-map pure helpers (`autoLayout`,
  `formatLastVerified`, each Zod schema).
- Playwright smoke for signup → onboarding → add client → add map node.
- `skills/phloz-tracking-map/SKILL.md` explaining the registry +
  adding a new node type.

---

## Prompt 2 — what's intentionally deferred

Covered by **A** above. The canvas MVP is opinionated enough that
agencies can model their tracking stack today; the polish items make
it feel as crisp as the rest of the product.

---

## Accounts / provisioning

- ✅ GitHub, Supabase, GTM, Stripe sandbox.
- ⏳ Vercel, Resend, Inngest, PostHog, Sentry, GA4.

All ⏳ items are optional for local dev.
