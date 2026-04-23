# Phloz — Architecture Document

**Version:** 1.0
**Last updated:** 2026-04-23
**Status:** Source of truth. All code decisions must align with this document. When in conflict, this document wins unless explicitly superseded via DECISIONS.md.

---

## 1. Product Overview

**Phloz** is a CRM + work management + marketing tracking infrastructure platform built specifically for digital marketing agencies.

**Primary user:** Operations lead or owner at a 5–50 person performance/digital marketing agency managing 5–100 clients across PPC, SEO, social media, CRO, and web design.

**Core value proposition:** A single workspace where agencies manage clients, team tasks, client communication, and — uniquely — a living map of each client's tracking infrastructure (GTM, GA4, pixels, CAPI, ad platforms). No competitor unifies these.

**V1 product scope (what ships first):**

1. Workspaces, team members, clients, role-based access
2. Client profile dashboard with structured business data + asset links
3. Tracking infrastructure map (manual nodes + edges, React Flow canvas)
4. Unified task system with department tagging (PPC, SEO, social, CRO, web design, other)
5. Client communication (internal team + email-to-app inbound + client portal replies)
6. Client portal (magic link, read-only + message reply + public tasks)
7. Billing with tiered pricing (Stripe)
8. Marketing site with SEO-ready architecture + blog
9. Full instrumentation via GTM + GA4

**V2 scope (architecture must anticipate, not implement):**

- Google Ads / Meta Ads / TikTok Ads / Microsoft Ads API read-only mirrors
- GTM / GA4 Admin API integrations
- Automated audit engine (rules-based health detection)
- Version history on tracking nodes
- Templates (clone a tracking setup across clients)
- Per-department custom modules (PPC campaign planner, SEO keyword tracker, social content calendar, CRO experiment tracker, web design deliverable tracker)
- Shared-node references across clients
- Client-facing reports (Looker Studio-style)
- AI features (audit explanation, auto-documentation, chat-with-your-map)
- Microsoft OAuth
- Attachments in messages
- Multi-tenancy at database-per-tenant level (if scale demands it)

**Explicit non-goals (never building):**

- Being a generic CRM for non-marketing businesses
- Being a generic project management tool
- Serving agencies larger than 300 people (enterprise RFP territory)
- Building our own ad platform, analytics platform, or tag manager
- Email marketing automation (agencies already have Klaviyo, Mailchimp, etc.)
- Time tracking / billable hours (Harvest/Toggl integration later, not native)
- Invoicing (Xero/QuickBooks integration later, not native)

---

## 2. Tech Stack (Locked)

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | Best-in-class SSG/ISR for SEO; server components reduce bundle size |
| Language | **TypeScript (strict)** | Non-negotiable for a project this size |
| Monorepo | **Turborepo** | Marketing site + app can be optimized separately |
| Package manager | **pnpm** | Fast, disk-efficient, monorepo-native |
| Database | **Supabase Postgres** | Postgres + Auth + RLS + Storage + Edge Functions in one |
| ORM | **Drizzle** | SQL-close, works well with RLS, fast in serverless |
| Auth | **Supabase Auth** | Email/password + Google OAuth + magic link; Microsoft OAuth in V2 |
| Styling | **Tailwind CSS v4** | Industry standard; pairs with shadcn/ui |
| UI library | **shadcn/ui** | Copy-paste components, fully customizable |
| Canvas | **React Flow (@xyflow/react)** | Standard for node-edge graph UIs |
| Typography | **Geist Sans + Geist Mono** | SpaceX/Vercel aesthetic; free via Vercel |
| Hosting | **Vercel** | First-party Next.js support |
| Background jobs | **Inngest** | Reliable serverless jobs, great Next.js DX |
| Billing | **Stripe** | Standard for B2B SaaS; tier logic is config-driven |
| Email | **Resend** | Outbound + inbound (webhooks for email-to-app) |
| Error tracking | **Sentry** | Standard |
| Product analytics | **PostHog** | Events + feature flags + session replay (later) |
| Marketing analytics | **GTM + GA4** | Container: GTM-W3MGZ8V7 |
| Testing | **Vitest + Playwright** | Unit + E2E |
| Validation | **Zod** | Runtime + type-safe schemas; used heavily for node metadata |
| Forms | **React Hook Form + Zod resolver** | Standard |
| Repo | https://github.com/ramtinlahooti/phloz (private) |
| Domains | phloz.com (marketing + blog), app.phloz.com (product), inbound.phloz.com (email-to-app) |

---

## 3. Repository Structure (Turborepo)

```
phloz/
├── apps/
│   ├── web/                      # Marketing site (phloz.com) — SSG/ISR, ultra-fast
│   │   ├── app/
│   │   │   ├── (marketing)/      # Home, pricing, features, about
│   │   │   ├── blog/             # /blog, /blog/[category], /blog/[category]/[slug]
│   │   │   ├── compare/          # /compare/[competitor] — programmatic SEO
│   │   │   ├── use-cases/        # /use-cases/[slug] — programmatic SEO
│   │   │   ├── integrations/     # /integrations/[tool] — programmatic SEO
│   │   │   ├── crm-for/          # /crm-for-[department] — programmatic SEO
│   │   │   ├── help/             # User help (pre-docs.phloz.com)
│   │   │   ├── legal/            # /privacy, /terms, /dpa
│   │   │   ├── sitemap.ts        # Auto-generated
│   │   │   ├── robots.ts
│   │   │   └── llms.txt/         # route handler
│   │   └── content/              # MDX blog posts + structured SEO content
│   │
│   └── app/                      # The product (app.phloz.com)
│       ├── app/
│       │   ├── (auth)/           # Login, signup, magic link
│       │   ├── (dashboard)/      # Authed workspace routes
│       │   │   ├── [workspace]/
│       │   │   │   ├── clients/
│       │   │   │   │   └── [clientId]/     # Split-pane client view
│       │   │   │   ├── tasks/              # Workspace-wide task views
│       │   │   │   ├── team/
│       │   │   │   ├── billing/
│       │   │   │   └── settings/
│       │   ├── (portal)/         # Client-facing portal (magic link auth)
│       │   │   └── portal/[token]/...
│       │   └── api/
│       │       ├── webhooks/     # Stripe, Resend inbound, Inngest
│       │       └── trpc/         # (or route handlers; see 4.4)
│       └── components/
│
├── packages/
│   ├── db/                       # Drizzle schema, migrations, RLS policies
│   │   ├── schema/               # One file per domain
│   │   ├── migrations/
│   │   ├── rls/                  # RLS policy SQL (checked in)
│   │   └── seed/
│   ├── ui/                       # shadcn/ui components shared between apps
│   ├── email/                    # Resend templates, send helpers
│   ├── billing/                  # Tier config, Stripe helpers, gate checks
│   ├── analytics/                # GA4/GTM event layer, PostHog helpers
│   ├── tracking-map/             # React Flow components, node-type registry
│   ├── auth/                     # Supabase auth helpers, RLS context
│   ├── config/                   # Shared constants, env validation
│   └── types/                    # Shared TS types, Zod schemas
│
├── skills/                       # Claude Code project skills (see §14)
├── docs/
│   ├── ARCHITECTURE.md           # This file
│   ├── ROADMAP.md
│   ├── DECISIONS.md
│   ├── CHANGELOG.md
│   ├── KNOWN-ISSUES.md
│   └── NEXT-STEPS.md
├── .github/
│   └── workflows/
├── CLAUDE.md                     # Claude Code rules
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 4. Architectural Principles

### 4.1 Multi-tenancy: Shared Schema + Row-Level Security

Every tenant-owned table has a `workspace_id uuid not null` column. RLS policies enforce:

- `SELECT`: row visible if `workspace_id = auth.jwt() -> 'workspace_id'` OR user is member of that workspace
- `INSERT`: `workspace_id` must match user's active workspace
- `UPDATE/DELETE`: same rule, plus role check for sensitive tables

RLS context is set via Supabase Auth's JWT custom claims. On workspace switch, JWT is refreshed.

**Rule:** No table touching tenant data may exist without RLS enabled. CI check enforces this.

### 4.2 Module Boundaries

Each `packages/*` module has a clean public API (`index.ts`). Apps never reach into package internals.

Rules:
- `packages/db` is the only place that imports Drizzle schema
- `packages/billing` is the only place that imports the Stripe SDK
- `packages/email` is the only place that imports Resend
- `packages/analytics` is the only place that calls GTM/GA4/PostHog directly
- Apps import from package public APIs only

### 4.3 The Typed-Graph Tracking Map

The map is a graph: `nodes` + `edges` tables. Each node has a `node_type` (enum) and a `metadata` JSONB column. Each node type has a matching **Zod schema** in `packages/tracking-map/node-types/[type].ts`.

```typescript
// packages/tracking-map/node-types/ga4-property.ts
export const ga4PropertySchema = z.object({
  propertyId: z.string(),
  measurementIds: z.array(z.string()),
  owner: z.string().optional(),
  notes: z.string().optional(),
  lastVerifiedAt: z.string().datetime().optional(),
  healthStatus: z.enum(['working', 'broken', 'missing', 'unverified']),
});
export type GA4PropertyMetadata = z.infer<typeof ga4PropertySchema>;
```

Adding a new node type in V2 = add one Zod schema file + register it in the node-type registry. No schema migrations required.

### 4.4 API Style: Route Handlers + Server Actions (not tRPC)

Next.js App Router's Server Actions for mutations from UI; route handlers (`app/api/*/route.ts`) for webhooks and external APIs. This keeps bundle size small and is idiomatic for Next 16. tRPC is considered and rejected as unnecessary overhead for a single-client app.

### 4.5 Config-Driven Pricing

All tier definitions, limits, and prices live in `packages/billing/tiers.ts` as a typed config object. Changing pricing = change config + new Stripe product IDs. No code paths hardcode tier names or limits.

### 4.6 Event-Driven Analytics

Every meaningful user action calls `track(event, props)` from `packages/analytics`. The function dispatches to GTM dataLayer (→ GA4) and PostHog simultaneously. Events are typed (see §11). No raw `gtag()` or `dataLayer.push()` calls outside `packages/analytics`.

### 4.7 Self-Documenting Workflow

Every Claude Code session reads and updates the docs described in §13. This is enforced via `CLAUDE.md` and hooks.

---

## 5. Data Model

### 5.1 Core Tables (V1)

```
workspaces
  id uuid pk
  name text
  slug text unique
  owner_user_id uuid fk → auth.users
  stripe_customer_id text
  stripe_subscription_id text
  tier text default 'starter'  // starter | pro | growth | business | scale | enterprise
  subscription_status text      // active | past_due | canceled | trialing
  settings jsonb default '{}'   // all_members_see_all_clients, etc.
  created_at, updated_at

workspace_members
  id uuid pk
  workspace_id uuid fk
  user_id uuid fk → auth.users
  role text  // owner | admin | member | viewer
  invited_at, accepted_at, created_at
  unique(workspace_id, user_id)

workspace_member_client_access
  (assignment-based access for member/viewer roles)
  workspace_member_id uuid fk
  client_id uuid fk
  created_at
  unique(workspace_member_id, client_id)

clients
  id uuid pk
  workspace_id uuid fk
  name text           // display name
  business_name text
  business_phone text
  business_email text
  business_address jsonb
  company_size text   // 1-10, 11-50, etc.
  company_budget numeric
  target_cpa numeric  // break-even CPA
  geo_targeting jsonb  // { countries: [], regions: [], cities: [] }
  industry text
  website_url text
  notes text
  archived_at timestamptz  // null = active
  archived_reason text
  custom_fields jsonb default '{}'
  created_at, updated_at, created_by

client_contacts
  (people at the client; for portal access + message addressing)
  id uuid pk
  client_id uuid fk
  workspace_id uuid fk
  name text
  email text
  phone text
  role text
  portal_access boolean default false
  created_at, updated_at

client_assets
  (URL links only in V1; no file storage)
  id uuid pk
  client_id uuid fk
  workspace_id uuid fk
  name text
  url text
  asset_type text  // image | video | document | other
  notes text
  created_at, created_by

tracking_nodes
  id uuid pk
  client_id uuid fk
  workspace_id uuid fk
  node_type text not null  // see §5.2
  label text
  metadata jsonb not null default '{}'  // validated by Zod per node_type
  health_status text default 'unverified'  // working | broken | missing | unverified
  last_verified_at timestamptz
  position jsonb  // { x, y } for canvas
  created_at, updated_at, created_by

tracking_edges
  id uuid pk
  client_id uuid fk
  workspace_id uuid fk
  source_node_id uuid fk
  target_node_id uuid fk
  edge_type text  // see §5.3
  label text
  metadata jsonb default '{}'
  created_at, updated_at, created_by

tasks
  id uuid pk
  workspace_id uuid fk
  client_id uuid fk (nullable — workspace-level tasks allowed)
  parent_task_id uuid fk (nullable — one level of nesting only, enforced)
  title text
  description text
  status text  // todo | in_progress | blocked | done | archived
  priority text  // low | medium | high | urgent
  department text  // ppc | seo | social | cro | web_design | other
  visibility text  // internal | client_visible
  assignee_id uuid fk → workspace_members (nullable; single assignee)
  due_date timestamptz
  related_node_id uuid fk → tracking_nodes (nullable)
  related_message_id uuid fk → messages (nullable)
  completed_at, created_at, updated_at, created_by

task_watchers
  (users following a task, @mentioned etc.)
  task_id, user_id, created_at

comments
  id uuid pk
  workspace_id uuid fk
  author_id uuid  // either workspace_member or client_contact — polymorphic
  author_type text  // 'member' | 'contact'
  parent_type text  // 'task' | 'tracking_node' | 'message' | 'client'
  parent_id uuid
  body text
  mentions uuid[]  // mentioned user IDs
  visibility text  // internal | client_visible
  created_at, updated_at

messages
  (client communication — team ↔ client)
  id uuid pk
  workspace_id uuid fk
  client_id uuid fk
  thread_id uuid  // groups related messages
  direction text  // inbound | outbound
  channel text    // email | portal | internal_note
  from_type text  // member | contact | system
  from_id uuid
  subject text
  body text
  raw_email jsonb  // full payload for inbound email
  created_at

inbound_email_addresses
  (unique email per client for email-to-app)
  client_id uuid fk
  workspace_id uuid fk
  address text unique  // client-[nanoid]@inbound.phloz.com
  active boolean default true
  created_at

portal_magic_links
  (client contact portal sessions)
  token text pk
  client_contact_id uuid fk
  client_id uuid fk
  workspace_id uuid fk
  expires_at timestamptz
  last_used_at timestamptz
  created_at

invitations
  (team member invites)
  id uuid pk
  workspace_id uuid fk
  email text
  role text
  invited_by uuid
  token text unique
  expires_at timestamptz
  accepted_at timestamptz
  created_at

audit_log
  (who did what)
  id uuid pk
  workspace_id uuid fk
  actor_type text, actor_id uuid
  action text, entity_type text, entity_id uuid
  metadata jsonb, created_at

billing_events
  (Stripe webhook audit trail)
  id uuid pk
  workspace_id uuid fk
  stripe_event_id text unique
  type text
  payload jsonb
  processed_at, created_at
```

### 5.2 Node Types Enum (V1)

```
website
landing_page
gtm_container
gtm_server_container
ga4_property
ga4_data_stream
google_ads_account
google_ads_conversion_action
meta_ads_account
meta_pixel
meta_capi
tiktok_ads_account
tiktok_pixel
microsoft_ads_account
linkedin_ads_account
crm_system
email_platform
ecommerce_platform
server_endpoint
conversion_api_endpoint
custom
```

### 5.3 Edge Types Enum (V1)

```
sends_events_to
fires_pixel
reports_conversions_to
sends_server_events_to
uses_data_layer
pushes_audiences_to
syncs_leads_to
custom
```

### 5.4 V2 Tables (scaffolded, not built)

Empty migration files + type placeholders for:

```
ad_platform_accounts    (linked Google Ads MCC, Meta Business, etc.)
ad_campaigns            (mirror of live campaigns)
ad_groups
ad_keywords
ad_creatives
tracking_node_versions  (version history)
tracking_templates
audit_rules
ai_embeddings           (pgvector for future AI features)
department_ppc_data     (example of V2 per-department module)
```

---

## 6. Authentication & Tenancy Flow

### 6.1 Sign-up Flow

1. User visits `phloz.com`, clicks "Get started"
2. Redirected to `app.phloz.com/signup`
3. Email+password OR Google OAuth OR magic link
4. On first login, user creates workspace: `name`, `slug` (auto-suggested)
5. Workspace created, user assigned role `owner`
6. Stripe customer created (no subscription yet; on Starter free tier)
7. Redirect to onboarding flow: add first client, invite team (both skippable)

### 6.2 Workspace Switching

Users can belong to multiple workspaces. JWT contains `active_workspace_id`. Switching workspaces calls a route that updates JWT claim and refreshes the token.

### 6.3 Client Portal Auth

Client contacts do NOT have user accounts. Portal access via magic link:

1. Agency admin enables `portal_access` on a `client_contact`
2. System emails magic link to contact
3. Contact clicks link → route handler validates `portal_magic_links`, sets a portal-scoped cookie
4. Portal routes check the cookie and scope to that client only

Magic links expire in 7 days; new ones auto-sent on expiry.

### 6.4 Role Permissions Matrix

| Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| Edit billing | ✅ | ❌ | ❌ | ❌ |
| Change tier | ✅ | ❌ | ❌ | ❌ |
| Invite/remove members | ✅ | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ✅ | ❌ | ❌ |
| Add/archive clients | ✅ | ✅ | ❌ | ❌ |
| Assign clients to members | ✅ | ✅ | ❌ | ❌ |
| Edit workspace settings | ✅ | ✅ | ❌ | ❌ |
| View all clients | ✅ | ✅ | assigned only* | assigned only* |
| Edit tracking map | ✅ | ✅ | assigned | ❌ |
| Create/edit tasks | ✅ | ✅ | assigned | ❌ |
| Comment | ✅ | ✅ | assigned | assigned |
| Send client messages | ✅ | ✅ | assigned | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ | ❌ |

*assigned-only behavior toggleable via workspace setting `all_members_see_all_clients`.

---

## 7. Billing Configuration

### 7.1 Tier Definitions

Source of truth: `packages/billing/tiers.ts`

| Tier | Clients | Seats incl. | Extra seat | Monthly | Annual | Annual /mo equiv |
|---|---|---|---|---|---|---|
| Starter | 1 | 2 | — | Free | Free | — |
| Pro | 10 | 5 | $9.99 | $29.99 | $299.99 | $24.99 |
| Growth | 30 | 8 | $9.99 | $59.99 | $599.99 | $49.99 |
| Business | 100 | 15 | $7.99 | $149.99 | $1,499.99 | $124.99 |
| Scale | 250 | 30 | $5.99 | $299.99 | $2,999.99 | $249.99 |
| Enterprise | custom | custom | custom | custom | custom | custom |

Currency: USD only at launch.

### 7.2 Active Client Definition

A client counts against the tier limit if:
- `archived_at IS NULL`, AND
- Has had any activity (node, task, or message created/updated) within the last 60 days, OR
- Was created within the last 60 days

Archive-unarchive throttling: 1 unarchive per client per 30 days.

Hard workspace cap (archived + active): 3× tier client limit. Prevents abuse of archive-everything pattern.

### 7.3 Viewer Seats

Viewer-role members don't count toward the seat limit. This is by design — agencies want to give clients' internal stakeholders view access without paying per contact.

Admin+Owner+Member roles count as paid seats.

### 7.4 Downgrade Handling

Downgrade blocked if current active clients > new tier limit. UI shows: *"Your workspace has X active clients. The [new tier] plan supports up to Y. Archive X−Y clients to downgrade."*

Same logic for seats: must remove excess members first.

No overage charges, no grace period, no read-only lockout. Clean upgrade/downgrade UX. This is our commitment to not mugging customers.

### 7.5 Stripe Configuration

One Stripe Product per tier (Pro, Growth, Business, Scale). Each product has two Prices (monthly + annual). Extra seats are a separate metered Price. Stripe webhooks update `workspace.subscription_status` and `workspace.tier`.

Tier enforcement: server-side gate checks via `packages/billing/can()` helper. Example:

```typescript
// packages/billing/gates.ts
export async function canAddClient(workspaceId: string): Promise<CanResult> {
  const [ws, activeCount] = await Promise.all([...]);
  const tierConfig = TIERS[ws.tier];
  if (activeCount >= tierConfig.clientLimit) {
    return { allowed: false, reason: 'client_limit_reached', upgrade: nextTier(ws.tier) };
  }
  return { allowed: true };
}
```

All client/member mutation endpoints call the corresponding `can*()` gate first.

---

## 8. Tracking Map Details

### 8.1 Canvas

- React Flow with custom node components per node type
- Layout: user-draggable, auto-saved on drop (debounced 500ms)
- One canonical layout per client map (shared across all workspace members)
- Auto-layout button: "Arrange" (runs dagre layout)
- Mini-map, zoom controls, fit-to-view
- Keyboard shortcuts: `n` = new node, `c` = connect mode, `del` = delete selected, `/` = search
- Max 200 nodes per client (soft enforced, admin-raisable per workspace)

### 8.2 Node UI

Each node type has a custom React Flow node component showing:
- Icon (node-type specific)
- Label
- Health status indicator (color dot)
- `lastVerifiedAt` timestamp (relative: "3d ago")
- Click → opens right-side drawer with full metadata form (Zod-validated)

### 8.3 Views

- **System view** (default): all nodes + edges, filterable by node type
- **Event view** (V1 scaffolded, partial): highlight nodes involved in a specific event flow
- **Audit view** (V2): shows issues detected by rules engine

### 8.4 Health Status (V1)

Manual only: user sets status + timestamp. Fields enforce structure but don't verify.

V2 audit engine will read the Zod metadata + external API signals to set status automatically.

---

## 9. Client Portal

### 9.1 Entry

`app.phloz.com/portal/[magic-link-token]` → validates token, sets portal session cookie, redirects to portal dashboard.

### 9.2 What Clients See

- Dashboard: their name, assigned agency contact, recent activity summary
- Messages: email-style thread with their agency
- Public tasks: tasks marked `visibility = client_visible`, read-only status + comments
- Assets: links their agency has shared
- Nothing else. No pricing, no other clients, no internal notes, no tracking map, no team list.

### 9.3 What Clients Can Do

- Reply to messages
- Comment on public tasks
- Update their own contact info
- Nothing else

### 9.4 Infrastructure for Future Portal Auth

Schema allows:
- Password-based portal accounts (V2)
- SSO for enterprise clients (V2)
- Multi-factor auth (V2)

---

## 10. Email-to-App (Inbound)

### 10.1 Addressing

Each client has a unique inbound address: `client-[nanoid(12)]@inbound.phloz.com`

Format is opaque (not workspace-slug-client-slug) to prevent:
- Spam attacks by guessing addresses
- Information leakage about workspace size
- Client-name leaks

The address is displayed in the UI with a copy button on the client page.

### 10.2 Inbound Flow

1. `inbound.phloz.com` MX records point to Resend
2. Resend webhook hits `api/webhooks/resend-inbound`
3. Handler parses `to` address, looks up `inbound_email_addresses.address`
4. Creates a `messages` row with `direction = 'inbound'`, `channel = 'email'`
5. Notifies assigned team members via in-app + email
6. If sender matches a `client_contact.email`, attributes the message to that contact

### 10.3 Inbound Security

- Domain SPF/DKIM set up for `inbound.phloz.com` (separate from transactional `phloz.com` domain)
- Attachments in V1: dropped, message body stored only
- Size limit: 5MB per inbound message; larger = reject + bounce

---

## 11. Analytics Event Taxonomy

### 11.1 Standards

- GA4 recommended events used where applicable (`sign_up`, `login`, `purchase`, `begin_checkout`, etc.)
- Custom events use `snake_case`, verb-noun format
- Event parameters use `snake_case`
- All events fire via `packages/analytics/track()` which dispatches to dataLayer (GTM) + PostHog
- GTM container: **GTM-W3MGZ8V7**
- No PII in event params. User ID is hashed; email never sent. Workspace ID OK (not PII).

### 11.2 Event Catalog (V1)

**Marketing site (apps/web):**
- `page_view` (auto via GA4 config tag)
- `cta_click` (params: `cta_location`, `cta_label`, `destination`)
- `pricing_page_view_tier` (params: `tier`)
- `blog_post_view` (params: `post_slug`, `post_category`)
- `newsletter_signup` (params: `source`)
- `compare_page_view` (params: `competitor`)

**Authentication:**
- `sign_up` (params: `method`: email|google|magic_link)
- `login` (params: `method`)
- `logout`
- `password_reset_requested`

**Workspace lifecycle:**
- `workspace_created` (params: `workspace_id_hash`)
- `workspace_switched`
- `workspace_settings_updated` (params: `setting_key`)

**Team:**
- `member_invited` (params: `role`)
- `member_accepted_invite` (params: `role`)
- `member_role_changed` (params: `from_role`, `to_role`)
- `member_removed`

**Clients:**
- `client_created`
- `client_updated` (params: `field_changed`)
- `client_archived`
- `client_unarchived`
- `client_assigned` (params: `assignee_role`)

**Tracking map:**
- `node_created` (params: `node_type`)
- `node_updated` (params: `node_type`, `field_changed`)
- `node_deleted` (params: `node_type`)
- `node_health_changed` (params: `node_type`, `old_status`, `new_status`)
- `edge_created` (params: `edge_type`, `source_type`, `target_type`)
- `edge_deleted`
- `map_layout_arranged`

**Tasks:**
- `task_created` (params: `department`, `has_due_date`, `has_assignee`)
- `task_status_changed` (params: `from_status`, `to_status`, `department`)
- `task_assigned` (params: `department`)
- `task_completed` (params: `department`, `time_to_complete_hours`)
- `task_comment_added` (params: `has_mentions`)

**Messages:**
- `message_sent` (params: `channel`: email|portal|internal_note, `direction`)
- `message_received` (params: `channel`)
- `portal_link_sent`
- `portal_accessed`

**Billing:**
- `pricing_tier_viewed` (params: `tier`)
- `begin_checkout` (params: `tier`, `billing_period`: monthly|annual)
- `upgrade_tier` (params: `from_tier`, `to_tier`, `billing_period`, `value`)
- `downgrade_tier` (params: `from_tier`, `to_tier`)
- `subscription_canceled` (params: `from_tier`, `reason`)
- `payment_failed` (params: `tier`)
- `seat_added` (params: `tier`)

**Feature gates:**
- `gate_hit` (params: `gate`: client_limit|seat_limit|feature_locked, `current_tier`)

### 11.3 Implementation

`packages/analytics/track.ts`:

```typescript
export function track<T extends keyof EventMap>(
  event: T,
  params: EventMap[T]
): void {
  // Client-side: push to GTM dataLayer
  // Server-side: log structured event, send to GA4 Measurement Protocol if critical
  // Always: send to PostHog via its SDK
}
```

Typed `EventMap` makes typos impossible.

---

## 12. SEO Architecture

### 12.1 Rendering Strategy

- All marketing pages: **SSG with ISR** (revalidate daily for blog, weekly for evergreen)
- Blog posts: SSG from MDX files in `apps/web/content/blog/[category]/[slug].mdx`
- Programmatic pages: SSG from static data files (competitors, use cases, departments, integrations)
- App pages: SSR/dynamic, `noindex`

### 12.2 Metadata

Every page exports Next.js `generateMetadata()`. Mandatory fields:
- `title` (55-60 chars)
- `description` (150-160 chars)
- `openGraph` (image, title, description, url)
- `twitter` (card: summary_large_image)
- `alternates.canonical`
- `robots` (index/noindex per page type)

### 12.3 Structured Data (JSON-LD)

- `Organization` on homepage
- `WebSite` with `SearchAction` on homepage
- `SoftwareApplication` on homepage + pricing (name, description, offers, aggregateRating when available)
- `Article` + `BreadcrumbList` on blog posts
- `FAQPage` where applicable
- `BreadcrumbList` on deep pages

### 12.4 llms.txt

Route handler at `/llms.txt` outputs a clean, categorized index of all marketing pages for LLM crawlers. Updates automatically as pages are added.

### 12.5 Programmatic SEO Templates (V1 routes, content populated over time)

- `/crm-for-[department]` — ppc, seo, social-media, cro, web-design, performance-marketing, ecommerce, b2b
- `/compare/[competitor]` — hubspot, monday, clickup, asana, notion, teamwork, productive, rocketlane, functionpoint, accelo
- `/integrations/[tool]` — ga4, gtm, google-ads, meta-ads, tiktok-ads, microsoft-ads, shopify, klaviyo, hubspot (read-only in V1 marketing; product integrations are V2)
- `/use-cases/[slug]` — client-onboarding-audit, tracking-infrastructure-map, cross-client-reporting, agency-pm, etc.

### 12.6 Blog Categories (V1)

- `google-analytics` (GA4 setup, events, troubleshooting)
- `google-tag-manager`
- `meta-ads` (Pixel + CAPI)
- `google-ads`
- `tiktok-ads`
- `tracking-infrastructure`
- `agency-operations`
- `conversion-tracking`
- `server-side-tracking`
- `agency-growth`

URL: `/blog/[category]/[slug]`

Index pages at `/blog`, `/blog/[category]`, `/blog/tag/[tag]`.

### 12.7 Tier-1 Target Keywords (primary focus)

From keyword research (April 2026):
- digital marketing crm (1,600)
- digital marketing software (1,300)
- digital marketing agency software (390)
- performance marketing platform (390)
- digital marketing automation platform (320, +306% YoY)
- performance marketing software (320)
- best software for digital marketing (320)
- crm for digital marketing agency (210)
- digital marketing agency crm (210)
- best ppc management software (210)
- marketing asset management software (210)
- ppc management software (480)
- best crm for digital marketing agency (110)
- ppc software for agencies (110)

---

## 13. Documentation System (Self-Updating)

### 13.1 Files Claude Must Read at Session Start

1. `CLAUDE.md` — conventions (always)
2. `docs/ARCHITECTURE.md` — this file
3. `docs/ROADMAP.md` — current phase + upcoming work
4. `docs/NEXT-STEPS.md` — 3-10 bullets of immediate next actions
5. Any `skills/*/SKILL.md` that match the task

### 13.2 Files Claude Must Update at Session End

- `docs/CHANGELOG.md` — append dated entry with what changed
- `docs/ROADMAP.md` — check off completed items, flag blockers
- `docs/NEXT-STEPS.md` — rewrite with the next concrete actions
- `docs/DECISIONS.md` — append if any non-trivial decision was made
- `docs/KNOWN-ISSUES.md` — append any bugs found, deferrals, workarounds

### 13.3 Slash Commands (defined in CLAUDE.md)

- `/session-start` — loads context from doc files
- `/session-wrap` — runs checklist to update docs + commit + push
- `/add-decision` — log a new architectural decision
- `/check-arch` — verify a proposed change against ARCHITECTURE.md

### 13.4 Hooks

- `SessionEnd` hook reminds Claude to run `/session-wrap`
- `PreToolUse` hook on `write` to `.ts`/`.tsx` files logs the change for later CHANGELOG entry

---

## 14. Skills Strategy

Project-specific skills in `skills/phloz-*/SKILL.md`. Each is a markdown file with frontmatter describing when Claude should use it.

**Phase 1 (Foundation prompt) ships these skills:**
- `phloz-conventions` — naming, folder structure, code style, error handling
- `phloz-tenancy` — RLS patterns, how to write a tenant-isolated query, adding a new table
- `phloz-billing` — adding a feature gated by tier, config-driven pricing
- `phloz-analytics` — adding a tracked event, updating the event catalog
- `phloz-seo` — adding a programmatic SEO template, metadata patterns

**Added in later phases:**
- `phloz-tracking-node` (Phase 2) — adding a new node type to the map
- `phloz-department-module` (Phase 4) — adding a new department module in V2
- `phloz-integration` (Phase 6) — adding a new external API integration (Google Ads, etc.)

---

## 15. Performance & Cost Discipline

### 15.1 Cost drivers (ranked)

1. **Supabase egress** — minimize by avoiding unneeded selects, using RLS pushdown
2. **Vercel function invocations** — cache aggressively, use ISR
3. **Inngest executions** — don't fire events when not needed
4. **Resend** — email is cheap, but still, batch notification digests
5. **Postgres rows** — nearly free at scale

### 15.2 Discipline Rules

- No `SELECT *` in queries — always explicit columns
- All marketing pages SSG, not SSR
- App pages use React Server Components by default; `use client` only when needed
- Images via Next.js `<Image />` only
- No polling; use Supabase Realtime or Inngest webhooks
- Error tracking sampling: 100% in dev, 10% in prod until scale

### 15.3 Free-tier Targets for First Year

- Supabase Free (until paid users generate revenue)
- Vercel Hobby (until beyond limits; then Pro at $20/mo)
- Resend Free tier (3000 emails/mo) → scales with users
- Inngest Free tier (50k steps/mo)
- Sentry Free tier (5k errors/mo)
- PostHog Free tier (1M events/mo)

---

## 16. Security Posture (V1)

- All inputs validated with Zod at API boundaries
- RLS on all tenant tables (CI-enforced)
- Secrets in Vercel env vars only, never committed
- Stripe webhooks: signature verification mandatory
- Resend webhooks: signature verification mandatory
- Rate limiting on auth routes (via Supabase + custom middleware)
- CSP headers via `next.config.ts`
- No user-generated HTML rendered without sanitization
- Audit log on all destructive actions (delete client, remove member, change role)

V2 additions: SSO, MFA, DPA, SOC2-readiness.

---

## 17. Out-of-Scope for This Document

- Detailed UI mockups (Figma, separate)
- Marketing copy (lives in MDX content files)
- Customer interview notes (Claude.ai Project)
- Pricing experiments (config-driven, iterate post-launch)
- Specific blog post drafts (handled per post)

---

*End of ARCHITECTURE.md v1.0. Amendments logged in DECISIONS.md.*
