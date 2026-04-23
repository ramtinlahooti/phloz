# Architectural Decisions

Appended as they happen. Most recent first. See `.claude/commands/add-decision.md`
for the template.

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
