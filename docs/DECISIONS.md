# Architectural Decisions

Appended as they happen. Most recent first. See `.claude/commands/add-decision.md`
for the template.

---

## 2026-04-26: Per-member client access (now) + Teams + Client Groups (deferred)

**Status:** Phase 1 accepted; Phase 2 deferred until first agency requests it.

**Context:** A workspace owner asked: "what stops a Viewer from
seeing every client?" The architecture (§5.1, §6.4) already
distinguishes the per-member assignment table
(`workspace_member_client_access`) and a workspace-level toggle
`all_members_see_all_clients`, but no UI exposed either.
Separately, a large agency might want to bundle members into Teams
+ clients into Groups so access can be managed at a tier above
the member↔client edge.

**Decision (Phase 1, now):**

Wire the existing schema's UI:

  - Workspace setting toggle in Settings → Client access:
    "Everyone sees everything" (default) vs "Restricted by
    assignment". Stored as
    `workspaces.settings.all_members_see_all_clients`.
  - Per-member dialog in Team page → Manage client access… that
    edits `workspace_member_client_access` rows for one member.
  - Per-member badge on the team-row showing the assigned
    client count when the policy is enforced.

RLS already enforces the gate via `phloz_is_assigned_to(client_id)`;
no schema change needed.

**Decision (Phase 2, deferred):**

Add Teams + Client Groups *only when an agency asks for it*.
Schema plan when it ships:

```
teams                          team_memberships
  id, workspace_id,              team_id, workspace_member_id
  name (editable), slug,         role_in_team
  description, color             unique(team, member)

client_groups                  client_group_memberships
  id, workspace_id,              group_id, client_id
  name (editable), slug,         unique(group, client)
  color

team_client_group_access
  team_id, client_group_id
  unique(team, group)
```

Access resolution becomes: *member sees client iff* (workspace
toggle on) OR (role ∈ {owner, admin}) OR (direct row in
`workspace_member_client_access`) OR (member ∈ team that has access
to a group containing the client).

**Rationale:**

Phase 1 covers Phloz's stated user (5–50 person agencies, 5–100
clients) cleanly. Direct assignment is intuitive at that scale.
Adding Teams + Groups before they're requested is YAGNI — the
extra schema, RLS function complexity, and Settings UI surface
would be debt for the small-agency majority. Phase 2's plan
exists on paper so any agency that does ask gets a one-session
ramp-up rather than a re-architecture.

**Consequences:**

- "Viewer" and "Member" roles with the workspace policy off are
  now manageable in the UI; today the RLS was already correct
  but the UI didn't surface the toggle.
- The `workspace_member_client_access` table now has a real UI
  consumer — its RLS policy stays the canonical gate.
- Phase 2 can land additively: new tables, no changes to the
  existing functions/policies. Existing direct assignments
  continue to work.
- "Viewer" role naming stays — Linear / Notion / Asana use the
  same term for internal read-only seats. UI tooltips should
  disambiguate from external clients (who live in
  `client_contacts` + `portal_magic_links`, not
  `workspace_members`).

**Related:** ARCHITECTURE.md §5.1, §6.4;
`packages/db/src/rls/_functions.sql` (`phloz_is_assigned_to`);
`apps/app/app/[workspace]/team/actions.ts`
(`setMemberClientAccessAction`, `setAllMembersSeeAllClientsAction`).

---

## 2026-04-25: Recurring template tier limits — escalating, not flat

**Status:** Accepted

**Context:** Tier-gating recurring task templates needed numeric caps.
Options: (a) all paid tiers unlimited, (b) flat cap (e.g. 50 across
all paid tiers), (c) escalating per tier mirroring `clientLimit`.

**Decision:** Escalating per tier — starter=2, pro=25, growth=75,
business=250, scale=750, enterprise=∞. Roughly 2.5–3× per step.

**Rationale:** Flat caps would either gate Scale unfairly or over-
provide for Pro. Escalating mirrors the existing `clientLimit`
shape, which agencies already understand. Starter gets two so users
can taste the feature before paying. Disabled templates count
against the limit (verified with `getRecurringTemplateCount`) so a
disable-then-create cycle can't skirt the cap.

**Consequences:**
- Public pricing page should eventually surface the limit alongside
  client + seat counts.
- Inngest cost stays predictable: hard upper bound on the number of
  templates the cron iterates each hour is `Σ(workspaces × tier
  cap)`. Even a heavy Scale workspace tops out at 750 hourly checks.

---

## 2026-04-25: Saved views are personal-by-default, not workspace-shared

**Status:** Accepted

**Context:** Filter views could be (a) personal only, (b)
workspace-shared by default, (c) per-row choice. RLS shape and
"workspace-shared" UX have very different costs.

**Decision:** Personal only at V1 — RLS clause is
`user_id = auth.uid() AND public.phloz_is_member_of(workspace_id)`.
A future shared-views feature is queued in NEXT-STEPS as an
`is_shared` column flip.

**Rationale:** Personal saved combos are the high-frequency need:
"my overdue", "my PPC backlog". Shared views imply governance ("who
can edit?", "what if owner deletes a popular view?") that's not
worth the complexity at launch. Postpone until an agency asks.

**Consequences:**
- Owners can't preconfigure agency-wide views for their team in V1.
  Workaround: the URL is shareable, owners can paste it in Slack.
- Schema is forward-compatible: the unique key
  `(workspace_id, user_id, scope, name)` survives a later
  `is_shared` column without rewriting.

---

## 2026-04-25: Per-member daily digest, owner-only sees workspace overview

**Status:** Accepted

**Context:** Switching from owner-only to per-member digest, the
content shape becomes member-relative. Members might want the
workspace-wide unreplied messages + audit findings; or those might
be irrelevant noise.

**Decision:** Owner / admin still receive the workspace-wide picture
(every overdue task, unreplied client messages, audit rollup).
Member / viewer receive only their assigned task agenda
(`tasks.assignee_id = membership.id` filter). No workspace-wide
content for them.

**Rationale:** Members generally aren't accountable for client
relationships or audit health — that's owner/admin work. Including
those sections in their digest dilutes the personal agenda. The
`audit_log`, `messages`, and tracking-map UIs all stay one click
away in the dashboard if a member wants to see them.

**Consequences:**
- Members get smaller emails — usually 0–5 items vs. owner's 5–20.
  Fewer "skip empty" no-ops on the cron, fewer wasted Inngest
  steps.
- Future per-member preference work is straightforward (the
  `digest_enabled` boolean already exists — adding granular
  toggles is just more booleans).

---

## 2026-04-24: Recurring tasks fire at 6 AM workspace-local, no per-template hour

**Status:** Accepted

**Context:** Recurring task templates need a "fire at" time. Options:
(a) per-template hour-of-day, (b) workspace-wide hour, (c) hardcoded.

**Decision:** Hardcode 6 AM workspace-local. The hourly Inngest cron
gates each workspace on `localDateParts(now, ws.timezone).hour === 6`
before iterating templates.

**Rationale:** Per-template hour adds a column + UI control that users
will universally set to "early morning" anyway. The daily digest does
the same thing at 9 AM (one hour difference is intentional — recurring
tasks land before the digest reads them, so morning agendas already
include today's freshly-spawned tasks).

**Consequences:**
- One TZ-resolution call per workspace per cron run; cron runs hourly,
  so cost is workspace_count × 24/day. Fine at launch.
- Future: if a customer asks for per-template hour control, add a
  nullable `hour_of_day` column with a default null = workspace 6 AM.
  Backwards-compatible.

---

## 2026-04-24: Lucide v1's removal of branded icons → Share2 for Meta Pixel

**Status:** Accepted

**Context:** `lucide-react` 1.0 dropped the `Facebook` icon (and other
branded marks) for trademark/legal reasons. Our tracking-map registry
imported it for the Meta Pixel node type.

**Decision:** Replace `Facebook` with `Share2` everywhere it was used.
(Meta Ads accounts already used `Building2`; only the pixel node was
affected.)

**Rationale:** Generic "social/share" icon reads as "social-network
tracking" without leaning on a specific brand. Avoids re-adding the
brand via a separate icon library + extra dependency.

**Consequences:**
- Visual change for any user who has a `meta_pixel` node on their
  tracking map. Acceptable cosmetic shift.
- Establishes the pattern: when lucide drops branded marks, prefer
  generic substitutes over pulling a brand-icon package.

---

## 2026-04-23: Deep-blue accent color

**Status:** Accepted

**Context:** ARCHITECTURE.md picks Geist typography + SpaceX-inspired dark
shell but leaves accent unspecified. PROMPT_1 asked us to pick between
deep-blue and muted-orange and log the choice.

**Decision:** Deep blue, sourced from Tailwind's `blue-600`/`blue-500` range,
defined in `packages/ui/src/tokens.ts` as `accent.500`/`accent.600`/`accent.700`.

**Alternatives considered:**
- Muted orange — more distinctive but commits a lot of surface area to one
  hue in a B2B tool where trust signals matter.

**Rationale:** Deep blue is the safer "trust" signal for an agency CRM,
pairs cleanly with the zinc-950 dark shell, and matches the Vercel/Linear
aesthetic Phloz is leaning into via Geist. Orange can reappear later as
a warning/highlight color without committing to it as brand primary.

**Consequences:**
- Marketing site + app default to deep blue for CTAs, active states, links.
- Success = green, warning = orange/amber, danger = red stay semantic.
- If we want a more distinctive brand later, the accent lives in one
  file — changing it is a token swap.

**Related:** ARCHITECTURE.md §2 (Tech stack), PROMPT_1 Step 7.

---

## 2026-04-23: Defer end-to-end verification until services are provisioned

**Status:** Accepted

**Context:** PROMPT_1 Step 17 wants verified Stripe checkout, Supabase
signup, Resend email, etc. None of those services are provisioned yet.

**Decision:** Scaffold all code that *would* consume those services with a
thorough `.env.example`, typed env validation, and `isStripeConfigured()`-style
feature detection. Defer Step 17 (live verification) to the session where
services are provisioned.

**Rationale:** Writing code without live services is still valuable — it
forces the env contract to be explicit. Attempting verification against
missing services would either fail spuriously or require provisioning
accounts, which is out of scope for a code-scaffold session.

**Consequences:**
- `.env.example` is the canonical contract.
- `requireEnv()` throws at *call time*, not at boot, so the app can start
  locally without every service set.
- Stripe price IDs are null in `tiers.ts` until the Stripe account is
  created.

**Related:** PROMPT_1 Step 17, `packages/config/src/env.ts`.

---

## 2026-04-23: RLS via SECURITY DEFINER helper functions

**Status:** Accepted

**Context:** Writing RLS policies that query `workspace_members` from within
`workspace_members`' own policy creates recursive RLS evaluation.
Hand-inlining subqueries in every policy becomes repetitive and error-prone
across 20+ tables.

**Decision:** Three SECURITY DEFINER helper functions in
`packages/db/src/rls/_functions.sql`:
- `phloz_is_member_of(ws_id)` — basic membership check
- `phloz_has_role_in(ws_id, roles[])` — role-gated mutations
- `phloz_is_assigned_to(client_id)` — layered check for owner/admin,
  workspace-wide visibility setting, or explicit wmca row

Policies read like:

```sql
CREATE POLICY "clients_select" ON clients FOR SELECT
USING (phloz_is_assigned_to(id));
```

**Alternatives considered:**
- Inline subqueries in every policy — verbose, error-prone, recursion risk.
- Express assignment filter at the application query layer — splits
  security across two layers, easier to forget.

**Rationale:** This is the Supabase-recommended pattern. SECURITY DEFINER
bypasses RLS inside the helper (safe because the function has a fixed
`search_path` and reads one specific table). Policies stay one-liners.

**Consequences:**
- Every new RLS policy reuses these helpers; no new SECURITY DEFINER
  functions without a decision record.
- Assignment-based filtering is enforced by Postgres, not the app. No
  way for a buggy handler to leak a client.
- pgTAP tests cover the three invariants from PROMPT_1.

**Related:** ARCHITECTURE.md §4.1, §6.4, PROMPT_1 Step 2,
`packages/db/tests/rls/workspace-isolation.test.sql`.

---

## 2026-04-23: Custom JWT claim via Supabase Custom Access Token hook

**Status:** Accepted

**Context:** Multiple workspaces per user means `active_workspace_id` needs
to be available to RLS policies and server code without a DB round-trip.

**Decision:** Mirror `user_metadata.active_workspace_id` into the JWT claims
via a Supabase Custom Access Token hook
(`packages/auth/src/hooks/custom-access-token-hook.sql`). The
`switchWorkspace()` helper updates the metadata and force-refreshes the
session so a new JWT is issued.

**Alternatives considered:**
- Store active workspace in a separate cookie — less coupled to Supabase,
  but duplicates state and needs a second mechanism to sync with the JWT.
- Look up `workspace_members` on every request — works but adds a
  guaranteed DB round-trip for something that rarely changes.

**Rationale:** The hook is native Supabase, zero runtime cost, and the
claim is cryptographically bound to the session so clients can't spoof it.

**Consequences:**
- RLS policies that need the active workspace read
  `(auth.jwt() ->> 'active_workspace_id')::uuid`.
- The hook must be installed manually in the Supabase dashboard — documented
  in `packages/auth/README.md`.
- Switching workspaces triggers a session refresh (one extra request).

**Related:** ARCHITECTURE.md §4.1, §6.2, `packages/auth/src/workspace-switch.ts`.

---

## 2026-04-23: Pure-check + server-wrapper pattern for billing gates

**Status:** Accepted

**Context:** Gates need to be DB-backed in production but unit-testable
without spinning up Postgres.

**Decision:** Each gate ships as two functions:
- `canDoXCheck(input: {...})` — pure, takes already-resolved state
- `canDoX(workspaceId, ...)` — server wrapper, reads state + delegates

Tests exercise the `*Check` variants directly with plain inputs.

**Rationale:** The business rules (limits, hard caps, throttles) are where
bugs live. Decoupling them from DB access lets us test every branch in
milliseconds and mock nothing.

**Consequences:**
- Unit tests for `gates.ts` are fast and exhaustive.
- Callers outside the app (e.g. a future CLI or admin script) can reuse
  the pure checks if they have the data in hand.
- Two function names per gate — a small ergonomic cost.

**Related:** PROMPT_1 Step 4, `packages/billing/src/gates.ts`,
`packages/billing/src/gates.test.ts`.

---

## 2026-04-23: `text` + `$type<Enum>()` instead of Drizzle `pgEnum`

**Status:** Accepted

**Context:** Many columns are enums (role, tier, node_type, edge_type,
department, task_status, etc.). Drizzle supports `pgEnum` for type-safe
Postgres enums, but schema evolution (adding values) is painful — pgEnums
can't drop values and adding them requires a migration per value.

**Decision:** Use `text('column').$type<EnumName>().notNull()` everywhere.
The TypeScript type is enforced at the ORM layer; Zod schemas enforce at
the API boundary.

**Alternatives considered:**
- `pgEnum` — strict at the DB level but migration-heavy.
- `text` + CHECK constraint — DB-enforced but still migration-heavy.

**Rationale:** For a pre-launch product where enums will expand, the
app-layer guarantee is sufficient and migrations stay trivial. If a future
audit determines DB-level enforcement is required, we can add CHECK
constraints in a single migration.

**Consequences:**
- Adding a new node type = one Zod schema file + constant update. No
  Postgres migration.
- Bad data could be inserted via the service role if a caller bypasses
  Zod validation. Service-role code paths are small and reviewed.

**Related:** ARCHITECTURE.md §4.3, `packages/config/src/constants.ts`.

