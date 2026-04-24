# Changelog

Append dated entries at the top. Style: what changed + where + why.

---

## 2026-04-23 — Proxy fix + reply-from-portal + client status

### Proxy runtime fix

Next 16's edge proxy rejects any non-`Response` return. The app's
`proxy.ts` was returning `updateSession`'s `{ response, user }`
object directly. Destructured `.response` before returning — the
ergonomic `{ response, user }` shape from `@phloz/auth/middleware`
stays intact for future middleware-layer auth checks.

### Reply-from-portal

- `sendPortalReplyAction` in `apps/app/app/portal/[token]/actions.ts`
  — authenticates via magic-link token, inserts a `messages` row
  with `direction=inbound`, `channel=portal`, `fromType=contact`,
  `fromId=link.clientContactId`. Threads on the supplied `threadId`
  when continuing a conversation.
- Portal UI — new `PortalMessages` + `ThreadCard` + `ReplyForm`.
  Groups messages by `threadId`, newest thread first, chronological
  within. Each thread has an inline Reply button; a "Start a new
  conversation" card at the bottom starts fresh threads.
- Portal page query now selects `channel` and filters via
  `inArray(['email','portal'])` so clients see both agency email
  and their own portal replies. Internal notes stay hidden.
- Agency-side is channel-aware via `MessageThread`'s `ChannelIcon`
  fallback — portal messages show with a MessageSquare icon and
  `inbound` badge in the client Messages tab without any extra work.

### Client status — at-risk / inactive badges

- Schema: new `clients.last_activity_at timestamptz` column with
  index. Migration `clients_last_activity_at` applied via MCP and
  seeded from `created_at`.
- Inngest `recomputeActiveClientCount` cron extended: after the
  existing tier-cap checks it runs one UPDATE per workspace that
  recomputes `last_activity_at` as the greatest of
  `created_at` + `max(updated_at)` across tasks / messages /
  tracking_nodes / tracking_edges / client_assets.
- UI: clients list renders amber **At risk · Nd** for 30 ≤ days <
  60, red **Inactive · Nd** for ≥ 60. Right column shows
  last-active date instead of updated-at when available.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Env-var fix + approvals + breadcrumbs

### `@phloz/config` env.ts fix

Wrapped the Zod schema in a top-level `z.preprocess` that rewrites
`''` to `undefined` for every key before validation. Fixes the
runtime crash where placeholder lines like `NEXT_PUBLIC_SENTRY_DSN=`
in `.env.local` tripped `.url().optional()` — empty string failed
URL validation because `optional()` only tolerates `undefined`, not
`''`. Two regression tests pin the behaviour.

### Approvals on client-visible tasks

- `APPROVAL_STATES` enum in `@phloz/config` (none / pending /
  approved / rejected / needs_changes).
- Supabase migration `tasks_approval_state` (applied via MCP) adds
  `approvalState`, `approvalComment`, `approvalUpdatedAt` columns
  with a check constraint + index.
- **Agency** — `setTaskApprovalAction` toggles between `none` ↔
  `pending` on client-visible tasks. Terminal states are reserved
  for the client.
- **Portal** — `setClientApprovalAction` in
  `apps/app/app/portal/[token]/actions.ts` authenticates via
  magic-link token (no Supabase user), scopes to the link's
  workspace + client, accepts only approved / rejected /
  needs_changes + optional comment.
- **UI** — `TaskRow` shows a colour-coded approval badge (amber /
  green / red / orange) and a dropdown toggle to Request / Reset.
  New `PortalTaskCard` on the portal renders Approve / Request
  changes / Reject buttons when state is `pending`. Reject and
  needs-changes open an inline textarea for an optional comment;
  comments render as an italic blockquote on both sides.

### Breadcrumbs

- New `Breadcrumbs` component in `@phloz/ui/components`. Terminal
  item renders as text with `aria-current="page"`; intermediate
  items are links with hover state.
- Applied on three deep pages: client detail, map (3-level chain),
  new-client. Replaces one-link "← back" navs.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Map edge polish + file uploads

### Tracking-map edge polish

- `EdgeEditDialog` — shared shadcn Dialog that opens in `create` mode
  when the user drags a connection between two nodes, and in `edit`
  mode when they click an existing edge. Picks `edgeType` via a Select
  of the 8 enum values (with human labels exported as
  `EDGE_TYPE_LABELS`) and an optional 120-char free-text label. Edit
  mode has a Remove button.
- `onConnect` no longer persists immediately — it stages source/target
  on the dialog state and waits for the user to click Save. The save
  path is optimistic + rollback-on-error, same as the rest of the map.
- `onEdgeClick` opens the dialog pre-filled.
- Canvas `CanvasAction` type grew two new kinds: `update-edge` and
  `import`.
- `ImportMapDialog` — shadcn Dialog with drop-file + paste-JSON
  support. Pairs with the existing Export button.

### File uploads (Supabase Storage)

- DB migration `client_assets_storage_bucket` (applied via MCP):
  * Private `client-assets` bucket, 50MB hard limit.
  * Path convention `{workspaceId}/{clientId}/{timestamp}-{safeName}`.
  * RLS on `storage.objects`: SELECT/INSERT/UPDATE for any workspace
    member, DELETE restricted to owner/admin/member (viewers read
    only). Uses the existing `phloz_is_member_of` +
    `phloz_has_role_in` helpers.
- `apps/app` — `/[workspace]/clients/[clientId]/files/`:
  * `uploadAssetAction` — FormData-based (works with `useActionState`),
    4MB cap (stays under Vercel's 4.5MB body limit), MIME allowlist
    (images, PDFs, office docs, common videos), uploads via
    `@phloz/auth/server` + inserts `client_assets` row.
  * `getAssetSignedUrlAction` — 5-minute signed download URL.
  * `deleteAssetAction` — removes the Storage object + row.
- `FilesPanel` client component — file-picker form, type-specific
  icon per row (image / video / document / other), download opens a
  signed URL in a new tab, delete with confirm.
- Client detail Files tab swaps the stub for `FilesPanel`.

### `apps/app/app/[workspace]/clients/[clientId]/map/actions.ts`

- `updateEdgeAction` — Zod-validated patch for `edgeType` + `label`.
- `importMapAction` — runs in `db.transaction<ImportResult>()`, Zod-
  validates each node's metadata against the registry schema, re-links
  edges by local→real id. Aborts the whole transaction on any per-node
  metadata failure.

### Verified

- `pnpm check` — 29/29 green.
- `next build` (`apps/app`) — compiles cleanly.

---

## 2026-04-23 — Messages module + portal dashboard

### Messages module

**`@phloz/email`:**
- New `sendPlainEmail({ to, subject, text, html, replyTo, inReplyTo,
  references })` — non-template outbound send. Agency replies default
  `replyTo` to the client's inbound address so responses thread back.

**`apps/app` — `/[workspace]/messages/` + per-client tab:**
- Server actions: `sendEmailReplyAction` (role-gated, resolves inbound
  address, calls Resend, inserts outbound `messages` row),
  `postInternalNoteAction` (internal_note channel, no Resend).
- `MessageThread` client component — groups by `threadId`, colour-
  coded bubbles per direction + channel, compose pane with Email /
  Internal note tabs, auto-prefilled `Re: …` subject.
- Client-detail **Messages** tab swaps the stub for `MessageThread`.
- `/[workspace]/messages` — unified inbox with direction + channel
  filter pills, compact list, click jumps to client page.

### Portal fleshout

`/portal/[token]` — swapped the "Recent updates" stub for a read-only
dashboard:
- Open **client-visible tasks** (visibility=client_visible + status
  in todo/in_progress/blocked).
- **Recent messages** on the email channel only (internal notes
  hidden), conversation-style timeline.
- Footer explains reply-by-email path (no compose button yet).

V1 stays read-only; reply/self-update await a portal-session-aware
action layer.

### Local-dev helpers

- `apps/app/.env.local` + `apps/web/.env.local` (gitignored) created
  with public values pre-filled. Only two secrets are TODO for the
  product app: `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`
  (transaction pooler, port 6543).

### Verified

- `pnpm check` — 29/29 green.
- `next build` (apps/app) — 31 routes compile.

---

## 2026-04-23 — Post-Prompt-2 (deps, map polish, tasks module)

### Dependency upgrade — local === Vercel

Vercel's install was resolving to newer majors than our caret ranges
allowed, so local tests ran against one version and prod got another.
Upgraded locally to match:

- `@sentry/nextjs` 8 → 10 — transparent.
- `drizzle-orm` 0.36 → 0.45 — transparent.
- `inngest` 3 → 4 — breaking. Ported: dropped `EventSchemas` /
  `fromRecord()` for a flat `INNGEST_EVENT_NAMES` tuple; moved
  triggers into `createFunction` options (v4 went 3-arg → 2-arg);
  dropped `signingKey` from `serve()` (v4 reads env vars automatically).

### Tracking-map polish

- Keyboard shortcuts: `n` opens add-node menu, `/` (or `⌘K`) opens
  node search, `Esc` closes the drawer. All ignored when focus is
  inside an input.
- `NodeSearchDialog` — shadcn Dialog that filters nodes by label or
  type. Selecting a node centers it in the viewport and opens the
  editor drawer.
- `AddNodeMenu` — controlled `open` / `onOpenChange` so the keyboard
  handler can drive it.
- **Export JSON** toolbar button downloads a timestamped snapshot.
- Soft 200-node cap indicator (warning colour + tooltip).
- Map-page header now shows the three keyboard shortcuts inline.

### Tasks module

Server actions (`apps/app/app/[workspace]/tasks/actions.ts`):
- `createTaskAction`, `updateTaskAction`, `deleteTaskAction` — each
  Zod-validated, role-gated (owner/admin/member), revalidates the
  affected paths.

UI:
- `NewTaskDialog` (reused from workspace + per-client) — shadcn Dialog
  + react-hook-form + Zod. Fields: title, description, priority,
  department, visibility, due date, optional client.
- `TaskRow` — status toggle dropdown with optimistic update +
  rollback, priority colour-coded, overdue + client-visible badges,
  delete inside the same dropdown.
- `/[workspace]/tasks` — grouped by status (todo / in_progress /
  blocked / done) with filter pills for departments + statuses.
- Per-client tasks tab (`/[workspace]/clients/[clientId]`) reuses
  TaskRow + NewTaskDialog.
- Workspace overview card shows **open** task count (todo +
  in_progress + blocked) instead of total.

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `next build` (`apps/app`) — 30 routes compile.

---

## 2026-04-23 — Prompt 2 — tracking-map editor

### `@phloz/tracking-map` — fleshed out from scaffold

- **21 node-type descriptors** across 8 categories (analytics,
  tag-management, server, paid-media, commerce, email, crm, other).
  Each pairs a Zod metadata schema with an icon + accent colour +
  `defaults()` factory.
- **React Flow canvas** (`"use client"`) — custom Phloz node with
  icon, label, health dot, last-verified-ago, left/right handles.
  MiniMap + Controls + dotted Background + Phloz dark theme.
- **Add-node dropdown** grouped by category.
- **"Arrange" button** runs dagre LR auto-layout.
- **Right drawer** (shadcn `Sheet`) edits label + Zod-driven metadata
  form (string / number / boolean / enum / string-array) + health
  state + "Save + mark verified".
- **Optimistic CRUD** with tempId → real-id swap on server confirm.
  Position autosave debounced at 500ms.
- `readOnly` mode gates all writes.

### `apps/app`

- Route `/[workspace]/clients/[clientId]/map/` loads nodes + edges
  and renders the canvas.
- `actions.ts` — five server actions (createNode / updateNode /
  deleteNode / createEdge / deleteEdge) gated via `requireRole(['owner','admin','member'])`
  and validated per-type against the registry's Zod schema.
- `map-client.tsx` binds actions to the canvas so the page stays a
  server component.
- Client detail page's "Tracking map" tab now links to the editor.
- `next.config.ts` adds `@xyflow/react` to `transpilePackages`.

### Deps added

- `@phloz/tracking-map` → `@dagrejs/dagre`, `@phloz/ui`, `clsx`,
  `lucide-react`. Subpath exports: `./canvas`, `./layout`, `./styles`.

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `next build` (`apps/app`) — 30 routes compile (29 + the new map).

---

## 2026-04-23 — Phase 1 Steps 10–13 (Inngest, observability, CI, deploy)

### Step 10 — Inngest

- `apps/app/inngest/client.ts` — typed EventSchemas catalog (5 events).
- 4 functions: `recomputeActiveClientCount` (cron nightly +
  event trigger), `sendTrialEndingReminder` (cron daily, reads
  Stripe `trial_end`), `onWorkspaceCreated` (V2 seed hook),
  `onClientAdded` (mints opaque inbound email address).
- `/api/inngest/route.ts` via `inngest/next` `serve()`.
- Event emission wired at 3 sites (onboarding action, client-create
  API route, Stripe webhook reconcile).
- `docs/INNGEST-SETUP.md`.

### Step 11 — Observability

- `@sentry/nextjs` in both apps (client/server/edge configs +
  `instrumentation.ts`). Product app enables session replay with
  masked text/inputs/media. Graceful no-op without DSN.
- PostHog provider in `apps/app` — captures `$pageview` on every
  client-side route change (Suspense-wrapped in root layout).
- `@phloz/config/logger` — pino singleton with redaction for
  password/token/cookie/apiKey/stripeSecretKey/serviceRoleKey.
  `requestLogger(ctx)` child for per-request context.
- `docs/OBSERVABILITY.md` consolidates all four pillars.

### Step 12 — CI

- `.github/workflows/ci.yml` with 4 jobs: `check` (pnpm check),
  `build` (matrix web + app), `rls-invariants` (postgres:16 +
  `check-rls-invariants.ts` asserting `rowsecurity=true` on every
  `TENANT_TABLES` entry), `pgtap` (pg_prove against
  `packages/db/tests/rls/*.test.sql`).
- `.github/dependabot.yml` — monthly updates grouped into
  next/react, ui/radix, infra.
- `packages/db/scripts/check-rls-invariants.ts` + script exposed as
  `pnpm --filter @phloz/db check:rls-invariants`.

### Step 13 — Deployment

- `apps/web/vercel.json` + `apps/app/vercel.json` — Next preset,
  pnpm frozen-lockfile install, turbo-scoped builds, iad1 region.
  App webhook routes get `maxDuration: 30`, Inngest route gets `300`.
- `docs/DEPLOYMENT.md` — end-to-end Vercel setup: project creation,
  env var matrix, domains, Stripe + Resend + Inngest webhooks,
  sanity-check URLs, rollback, quarterly secret-rotation schedule.

### Changed

- Root `package.json` — approved `@sentry/cli` postinstall.
- `packages/db/tsconfig.json` — include `scripts/` and `tests/`.
- `packages/config` — added `pino` dep + `./logger` subpath export.
- `apps/app` — added `@sentry/nextjs`, `posthog-js`, `inngest`.
- `apps/web` — added `@sentry/nextjs`.

### Verified

- `pnpm check` — 29/29 green.
- Both apps build cleanly.

### Next

Phase 1 scaffold is complete. Per PROMPT_1 final line: return to the
planning chat for **Prompt 2 — the tracking map editor** (canvas UI
built on `packages/tracking-map` + the node/edge schema already in
place).

---

## 2026-04-23 — Phase 1 Step 9 (apps/app product scaffold)

### Added — `@phloz/ui` primitives

- `Button` gained `asChild` support via `@radix-ui/react-slot`.
- Ten new Radix-backed primitives: `Dialog`, `DropdownMenu`, `Sheet`,
  `Tabs`, `Avatar`, `Tooltip`, `Popover`, `Select`, `Toaster` (sonner),
  `Form` (react-hook-form wrappers).
- `lucide-react` wired for icons.

### Added — `apps/app`

- **Config:** `next.config.ts` (security headers + transpilePackages),
  `tsconfig.json`, `postcss.config.mjs`, `globals.css`, Next-16 edge
  proxy (`proxy.ts`, formerly `middleware.ts`) that refreshes Supabase
  sessions.
- **Auth routes** in the `(auth)` group: `/login`, `/signup`,
  `/forgot-password`, `/reset-password`, plus `/auth/callback` PKCE
  handler with an open-redirect guard. Password + magic-link in the
  same login form; email-confirm supported in signup.
- **Onboarding** (`/onboarding`) — server action creates the
  workspace + workspace_members row, sets
  `user_metadata.active_workspace_id`, and redirects to `/[workspace]`.
- **Dashboard shell** (`/[workspace]/...`) with sidebar nav, workspace
  switcher, user menu, billing-only-for-admins gating.
- **Feature pages:** overview (live metrics via
  `getActiveClientCount`), clients list, `/clients/new` (with
  `canAddClient` tier gate), client split-pane detail (tabs:
  overview, tasks, messages, tracking map, files — last four are
  in-app stubs pointing at upcoming sessions / Prompt 2 for the map
  editor), tasks, messages, team (with invite card), billing, settings.
- **Portal** (`/portal/[token]`) — layout validates the magic link on
  every request, 404s on any failure, so existence vs expiry isn't
  leaked to guessing clients.
- **Accept-invite** (`/accept-invite?token=`) flow — validates the
  token, requires email match, creates membership, marks invitation
  accepted, switches active workspace.
- **API routes:**
  - `POST /api/workspaces/switch`
  - `PATCH /api/workspaces/[id]` (rename)
  - `POST /api/workspaces/[id]/clients` (tier-gated via `canAddClient`)
  - `POST /api/workspaces/[id]/invitations` (writes row + sends email)
  - `POST /api/workspaces/[id]/billing/checkout` (Stripe Checkout)
  - `POST /api/workspaces/[id]/billing/portal` (Stripe Billing Portal)
  - `POST /api/webhooks/stripe` — signature verify + idempotent record
    + reconcile tier/subscription on checkout/subscription/cancellation.
    `PRICE_TO_TIER` map uses the 12 sandbox price IDs wired today.
  - `POST /api/webhooks/resend/inbound` — svix signature verify +
    `parseResendInbound` + route via `inbound_email_addresses` into a
    `messages` row.
  - `GET /api/health` — db round-trip.

### Changed

- `@phloz/auth` package.json exports expanded to surface `./middleware`,
  `./session`, `./roles`, `./workspace-switch` subpaths.
- `apps/app/package.json` gained `drizzle-orm`, `@hookform/resolvers`,
  `lucide-react`, `nanoid`, `react-hook-form`, `sonner`, `stripe`,
  `@tailwindcss/postcss`.

### Stubbed for later sessions

These exist as navigable pages with copy explaining what's coming:

- Workspace-wide tasks board (boards + timelines).
- Unified messages inbox.
- Tracking infrastructure map (deferred to **Prompt 2**).
- Client split-pane sub-tabs (tasks per client, file uploads, message
  thread UI).
- Client-portal pages past `/portal/[token]` (tasks, approvals,
  deliverables).

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `next build` (apps/app) — 28 routes compile cleanly.

---

## 2026-04-23 — Phase 1 Step 8 (apps/web marketing site)

### Added — 49 static pages

Core scaffold:
- `apps/web/next.config.ts`, `tsconfig.json`, `postcss.config.mjs`,
  `next-env.d.ts` — Next 16 + Tailwind v4 + MDX pipeline wired.
- `app/layout.tsx` — root layout with Geist fonts (from
  `@phloz/ui/fonts`), GTM script (container `GTM-W3MGZ8V7` default),
  Organization JSON-LD, sticky header + footer.
- `app/globals.css` — imports shared `@phloz/ui/styles/globals.css`
  plus a lean `.phloz-prose` rule set for MDX blog content (avoids
  `@tailwindcss/typography` dep).
- `components/site-header.tsx`, `components/site-footer.tsx`,
  `components/gtm.tsx`.
- `lib/site-config.ts` — one source of truth for URLs, nav, footer,
  and programmatic-SEO registries (competitors, use cases,
  departments, integrations).
- `lib/metadata.ts` — `buildMetadata()` helper enforcing canonical
  URLs, OG, Twitter card, robots, and site-wide JSON-LD.

Static pages:
- `/` home (hero + 6 features grid + CTA, SoftwareApplication JSON-LD)
- `/features`, `/pricing` (reads `TIERS` from `@phloz/billing`),
  `/about`, `/contact`, `/help`
- `/legal/terms`, `/legal/privacy` — draft placeholders (flagged
  in-copy; counsel review scheduled before first customer).

Blog — MDX via `next-mdx-remote/rsc` + `gray-matter` + `remark-gfm` +
`rehype-slug` + `rehype-autolink-headings`:
- `lib/blog.ts` — frontmatter Zod-validated.
- `/blog` index + `/blog/[slug]` with Article JSON-LD + reading time.
- 3 seed posts: `why-we-built-phloz`, `tracking-infrastructure-map`,
  `per-active-client-pricing`.

Programmatic SEO (all use `generateStaticParams` from
`site-config.ts`):
- `/compare/[competitor]` × 10 (HubSpot, Monday, ClickUp, Asana,
  Notion, Teamwork, Productive, Rocketlane, Function Point, Accelo).
- `/use-cases/[slug]` × 4.
- `/crm-for/[slug]` × 8 departments (ppc, seo, social-media, cro,
  web-design, performance-marketing, ecommerce, b2b).
- `/integrations` index + `/integrations/[slug]` × 9 tools (with
  V1/V2 blurbs per integration).

SEO infrastructure:
- `app/robots.ts` via `MetadataRoute.Robots`.
- `app/sitemap.ts` — auto-includes every registry slug + every blog
  post slug. Add a slug to `site-config.ts` → sitemap updates.
- `app/llms.txt/route.ts` — categorized index per the llmstxt.org
  spec, 1-hour revalidate.

### Dependencies added (apps/web)

- `@phloz/billing`, `gray-matter`, `next-mdx-remote`, `reading-time`,
  `rehype-autolink-headings`, `rehype-slug`, `remark-gfm`.
- `@tailwindcss/postcss` (dev).

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- `pnpm --filter @phloz/web build` — 49 static pages generated in
  2.6s, 0 errors.

### Next

Step 9 — `apps/app` product (auth, dashboard, portal, API routes).
This is the biggest session on the roadmap (6-8h). Can be paused
after Step 8 for the user to QA the marketing site in dev / preview.

---

## 2026-04-23 — Stripe sandbox products + prices wired

### Added

- 4 Stripe Products in Phloz sandbox (`acct_1RXbVlPomvpsIeGO`):
  - `prod_UOFldR2CCkSDqS` — Phloz Pro (10 clients, 5 seats)
  - `prod_UOFlJvP0zTegxV` — Phloz Growth (30 clients, 8 seats)
  - `prod_UOFl7RRqfyEmce` — Phloz Business (100 clients, 15 seats)
  - `prod_UOFlG1UTSfSyGe` — Phloz Scale (250 clients, 30 seats)
- 12 recurring Prices (monthly + annual + extra-seat-monthly per tier,
  USD). Amounts match ARCHITECTURE.md §7.1.
- Price IDs wired into `packages/billing/src/tiers.ts` with inline
  product-ID comments for traceability.

### Verified

- `pnpm check` — 29/29 green. All 24 billing tests still pass against
  the real IDs.

### Notes

- Two orphan products from earlier experiments (`prod_SSWcZ5D3sAcqgx`
  "Premium", `prod_SSWb4vOPLGNW4K` "Pro", both with no prices) remain
  in the sandbox and should be archived via the Stripe dashboard.
- Live-mode prices will be created in Step 13 (deployment) and swapped
  in before launch.

---

## 2026-04-23 — Phase 1 Steps 5–7 (email, analytics, ui)

### Step 5 — `packages/email`

- Resend client with graceful `isResendConfigured()` gate for dev.
- React Email templates: `InvitationEmail`, `PortalMagicLinkEmail`,
  `PasswordResetEmail` — shared `EmailLayout` with Geist + Tailwind,
  consistent footer.
- `sendInvitation` / `sendPortalMagicLink` / `sendPasswordReset` helpers;
  each no-ops when `RESEND_API_KEY` is absent.
- `verifyResendSignature` — Standard Webhooks (svix) HMAC-SHA256 verifier
  with timestamp-tolerance window + timing-safe compare.
- `parseResendInbound` — Zod-validated envelope parser; drops attachments
  per ARCHITECTURE §10.3, HTML-to-text fallback, 5MB attachment limit.
- `generateInboundAddress` / `extractInboundId` — opaque 12-char nanoid
  addresses (`client-<id>@inbound.phloz.com`) per §10.1.
- 13 unit tests passing.
- `docs/DNS-SETUP.md` — SPF/DKIM/DMARC for `phloz.com`, MX for
  `inbound.phloz.com`, Resend webhook + routing config, verification
  checklist.

### Step 6 — `packages/analytics`

- `EventMap` — typed catalog mirroring ARCHITECTURE §11.2 (every event
  from marketing, auth, workspace, team, clients, tracking map, tasks,
  messages, billing, feature gates).
- `track(event, params, context?)` — dispatcher. Browser path: GTM
  dataLayer + PostHog. Server path: PostHog-node + GA4 Measurement
  Protocol when the event is in `SERVER_GA4_EVENTS` (sign_up,
  upgrade_tier).
- GTM bootstrap helpers (`gtmBootstrapScript`, `gtmNoscriptIframeSrc`)
  with container id GTM-W3MGZ8V7 as the single source of truth.
- PostHog init/identify/reset (client) + captureServer (server); both
  no-op gracefully without keys.
- `sendGa4ServerEvent` — server fetch-based emitter; strips undefined
  params; throws on non-2xx.
- `hashAuthUid{Server,Client}` — SHA-256 hex with cross-runtime parity.
- 8 unit tests passing.

### Step 7 — `packages/ui`

- `cn()` helper (clsx + tailwind-merge).
- `packages/ui/styles/globals.css` — Tailwind v4 CSS-first config via
  `@theme`. Dark-first palette + deep-blue accent (per DECISIONS
  2026-04-23) + tracking-map health colour vars (ARCHITECTURE §8.2).
  Light-mode opt-in via `.light` on `<html>`.
- Primitives (shadcn-style, no Radix deps yet): `Button` (6 variants, 4
  sizes), `Input`, `Label`, `Card` (+ Header/Title/Desc/Content/Footer),
  `Badge` (6 variants), `Skeleton`, `Separator`.
- Shared components: `PageHeader`, `EmptyState`, `LoadingSpinner`,
  `TierBadge`.
- `loadGeistFonts()` — lazy `next/font` Geist Sans + Mono loader returning
  CSS-variable class names; matches `--font-geist-sans` /
  `--font-geist-mono` in the shared stylesheet.

### Other

- Stripe SDK bumped to `^22.0.2` to support the `2026-03-25.dahlia` API
  version selected for the Phloz sandbox.
- `packages/auth/src/server.ts` — replaced `require('@supabase/supabase-js')`
  with dynamic `await import()`; `createServiceRoleSupabase()` is now
  async. Closes the long-standing KNOWN-ISSUES entry.
- `packages/auth/src/{server,middleware}.ts` — typed `setAll` params.
- Added `@types/node` to `@phloz/config` and `next` + `@types/node` to
  `@phloz/auth` peers/devDeps.
- `@phloz/types` — added `@phloz/config` workspace link so its
  `tsconfig.base.json` resolves.
- `db` + `auth` `test` scripts: `vitest run --passWithNoTests` (neither
  has vitest files yet).
- Next 16 removed `next lint`; swapped `apps/web` + `apps/app` lint to
  `eslint . --no-error-on-unmatched-pattern`.
- Root `package.json` — `"type": "module"` to silence ESM parse warning.
- `.env.example` — comprehensive rewrite with per-service sections,
  `[web]/[app]/[both]` tags, new `sb_publishable_*` / `sb_secret_*`
  key-format notes, DATABASE_URL pooler-vs-direct guidance.

### Verified

- `pnpm check` — 29/29 green across 11 packages.
- 21 unit tests across `@phloz/config` (4), `@phloz/billing` (24),
  `@phloz/email` (13), `@phloz/analytics` (8) — all passing.

---

## 2026-04-23 — Supabase wiring (post-session-1)

### Added

- `pnpm.onlyBuiltDependencies` in root `package.json` approving postinstalls
  for `core-js`, `esbuild`, `protobufjs`, `sharp`, `unrs-resolver`.
- `pnpm-lock.yaml` — lockfile committed after clean install (10.5s).
- `packages/db/migrations/0000_melted_supreme_intelligence.sql` — Drizzle-
  generated schema SQL for all 25 tables (17 V1 + 8 V2 stubs) with FKs +
  indexes.
- `packages/db/src/supabase-types.ts` — generated Supabase `Database` type
  for use with `@supabase/supabase-js` (the Drizzle types remain the
  default; these are for direct Supabase SDK calls).
- Two applied Supabase migrations (via MCP):
  - `initial_schema` — 25 tables, 41 foreign keys, 45 indexes, all idempotent.
  - `rls_policies` — `phloz_is_member_of` / `phloz_has_role_in` /
    `phloz_is_assigned_to` / `touch_updated_at` helpers + full V1 policies
    + V2 default-deny.
  - `custom_access_token_hook` — the JWT claim hook (requires dashboard
    activation).
  - `function_search_path_hardening` — fixed advisor WARN for two
    plpgsql functions missing `SET search_path`.

### Verified

- All 25 tables have `rowsecurity = true` (checked via `pg_tables` query).
- `get_advisors` → security: only INFO-level `rls_enabled_no_policy`
  warnings remain, all for V2 stubs and `portal_magic_links` (by design:
  no policy = default deny, service role bypasses).

### Changed

- `packages/db/src/rls/_functions.sql` — `touch_updated_at` now declares
  `SET search_path = public` (matches advisor fix).
- `packages/auth/src/hooks/custom-access-token-hook.sql` — function now
  declares `SET search_path = public, auth`.

### Deferred

- Stripe MCP is connected to `acct_1QFi6lBVrlan59Tv` (Exchange Rate
  Management), not the Phloz account `acct_1RXbVfLUfWiw9Veu`. Reconnect
  the MCP before creating products.
- Custom Access Token hook SQL function exists, but enabling it is a
  Supabase Dashboard step (Authentication → Hooks → Custom Access Token).
- Service role key + direct `DATABASE_URL` not yet in `.env.local`.

---

## 2026-04-23 — Phase 1 Steps 0–4

### Added

- Foundation docs committed: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `PROMPT_1.md`.
- Turborepo workspace: `pnpm-workspace.yaml`, `turbo.json`, flat ESLint
  config, Prettier, editorconfig, `.env.example` enumerating every env var.
- `packages/config` — Zod `envSchema` with `loadEnv`/`requireEnv`/`hasEnv`,
  a `tsconfig.base.json` every workspace extends, and centralised constants
  (tiers, roles, statuses, node/edge types, departments, task states).
- `packages/types` — `Result<T,E>` helpers.
- Package stubs: `packages/{db,auth,billing,email,analytics,ui,tracking-map}`
  and `apps/{web,app}` with minimal `package.json` so `pnpm install` can
  resolve the workspace graph.
- `packages/ui/src/tokens.ts` — design tokens with confirmed deep-blue
  accent (see DECISIONS.md).
- `packages/db`:
  - Full Drizzle schema for every V1 tenant table (ARCHITECTURE.md §5.1).
  - V2 stub tables (§5.4) with minimal shape + TODO markers.
  - Per-table RLS policy SQL files under `src/rls/`, plus
    `_functions.sql` with `phloz_is_member_of` / `phloz_has_role_in` /
    `phloz_is_assigned_to` SECURITY DEFINER helpers.
  - `src/rls/index.ts` exports `RLS_FILES` (apply order) and
    `TENANT_TABLES` (CI registry).
  - `src/rls/apply.ts` CLI applies every policy file against `DATABASE_URL`.
  - `tests/rls/workspace-isolation.test.sql` — pgTAP test covering the
    three RLS invariants from PROMPT_1 Step 2.
  - `src/seed/index.ts` — demo workspace + 2 clients + 3 tracking nodes +
    2 edges.
  - README with add-a-tenant-table checklist.
- `packages/auth`:
  - `server.ts` — `createServerSupabase` (cookie-bound) +
    `createServiceRoleSupabase` (RLS-bypass).
  - `client.ts` — `createBrowserSupabase`.
  - `middleware.ts` — `updateSession` for Next middleware.
  - `session.ts` — `getCurrentUser`, `requireUser`, `getActiveWorkspaceId`.
  - `roles.ts` — `getMembershipRole`, `requireRole`, `requireAdminOrOwner`,
    `requireOwner`.
  - `portal.ts` — `generatePortalMagicLink` (40-char nanoid, 7-day TTL) +
    `validatePortalMagicLink` + `revokePortalMagicLink`.
  - `workspace-switch.ts` — `switchWorkspace(id)` updates user_metadata
    and refreshes session.
  - `src/hooks/custom-access-token-hook.sql` — Supabase auth hook that
    copies `user_metadata.active_workspace_id` into JWT claims.
  - Typed `AuthError` with codes.
- `packages/billing`:
  - `tiers.ts` — `TIERS` config matching ARCHITECTURE.md §7.1 + helpers.
  - `active-clients.ts` — `getActiveClientCount` (60-day window, single
    query), plus unarchived / total / paid-seat counts.
  - `gates.ts` — `canAddClient`, `canInviteMember`, `canUnarchiveClient`,
    `canDowngrade` with pure `*Check` variants for unit tests.
  - `stripe.ts` — lazy client, `createCustomer`, `createCheckoutSession`,
    `createBillingPortalLink`.
  - `webhooks.ts` — `constructWebhookEvent`, `recordBillingEvent`
    (idempotent), `markBillingEventProcessed`, `HANDLED_EVENT_TYPES`.
  - 24 unit tests in `gates.test.ts` + `tiers.test.ts`.
  - README with add-a-tier and add-a-gate workflows.

### Deferred (see NEXT-STEPS.md + KNOWN-ISSUES.md)

- `pnpm install` — not yet run. First action next session.
- Steps 5–17 of PROMPT_1 — email, analytics, ui, marketing site, app,
  Inngest, observability, CI, deployment, final verification.
- Stripe price IDs are null in `TIERS`; wire when the Stripe account is
  created.
- Supabase project not provisioned; the custom JWT hook must be installed
  manually once it is.
- Drizzle migrations not generated (needs `DATABASE_URL`).

### Commits

- `5c57125` docs: add foundation architecture and Claude Code rules
- `169dba4` chore: scaffold turborepo workspace with packages/config
- `dc8b3e2` feat(db): schema, RLS policies, pgTAP tests, seed
- `(0cd6f8c)` feat(auth): Supabase SSR helpers, roles, portal magic links, workspace switch
- `(new)` feat(billing): tier config, gates, Stripe client, webhooks, unit tests
- `(this commit)` docs: session-wrap for Phase 1 Steps 0–4
