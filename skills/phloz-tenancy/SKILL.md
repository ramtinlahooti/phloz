---
name: phloz-tenancy
description: Use this skill whenever working with database schemas, queries, RLS policies, or any code that reads or writes tenant-owned data in Phloz. Apply when creating a new table, writing a new query, adding a new API route that touches tenant data, or reviewing whether data isolation is correctly enforced. Critical for any change that could leak data between workspaces.
---

# Phloz Tenancy Skill

Phloz uses **shared schema multi-tenancy with Row-Level Security (RLS)**. Every tenant-owned table has a `workspace_id` column, and Postgres RLS policies enforce isolation at the database layer.

## When to apply this skill

Use whenever you:
- Create a new database table
- Write a new query (Drizzle or raw SQL)
- Add a new API route, Server Action, or webhook handler that touches tenant data
- Add a new join or relation
- Review code for data leak risk

## The golden rule

**Every tenant-owned table has RLS enabled. No exceptions. CI enforces this.**

If you're adding a table and can't articulate why it doesn't need RLS, it needs RLS.

## Tables that do NOT need RLS

Only a handful:
- `auth.users` (managed by Supabase)
- Global config tables (none currently exist)
- Stripe webhook audit log (`billing_events` — cross-tenant but contains no tenant data beyond IDs)

Everything else with `workspace_id`: RLS required.

## Adding a new tenant table — checklist

1. **Schema file** in `packages/db/schema/[table-name].ts`:
   ```typescript
   export const myTable = pgTable('my_table', {
     id: uuid('id').primaryKey().defaultRandom(),
     workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
     // ... other columns
     createdAt: timestamp('created_at').notNull().defaultNow(),
     updatedAt: timestamp('updated_at').notNull().defaultNow(),
   });
   ```

2. **Migration** generated via `pnpm db:generate`

3. **RLS policy file** in `packages/db/rls/my-table.sql`:
   ```sql
   ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

   -- SELECT: visible if user is a member of the workspace
   CREATE POLICY "my_table_select" ON my_table
     FOR SELECT
     USING (
       workspace_id IN (
         SELECT workspace_id FROM workspace_members
         WHERE user_id = auth.uid()
       )
     );

   -- INSERT: workspace_id must match one the user belongs to
   CREATE POLICY "my_table_insert" ON my_table
     FOR INSERT
     WITH CHECK (
       workspace_id IN (
         SELECT workspace_id FROM workspace_members
         WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
       )
     );

   -- UPDATE + DELETE: similar, with role restrictions as appropriate
   ```

4. **Migration** for RLS: `packages/db/migrations/*-enable-rls-my-table.sql` that `\i`s the policy file

5. **Test** in `packages/db/tests/rls/my-table.test.ts` that verifies:
   - User in workspace A cannot SELECT from workspace B
   - Viewer cannot INSERT/UPDATE/DELETE
   - Member without assignment cannot SELECT if `all_members_see_all_clients = false`
   - Admin can do everything

6. **Verify CI passes** — the RLS-enabled check must be green

## Writing tenant-isolated queries

Even though RLS will enforce isolation, always include `workspace_id` in queries as defense-in-depth:

```typescript
// Good
const clients = await db
  .select({ id: clients.id, name: clients.name })
  .from(clients)
  .where(and(
    eq(clients.workspaceId, ctx.activeWorkspaceId),
    isNull(clients.archivedAt),
  ));

// Bad — relies on RLS alone; harder to reason about
const clients = await db
  .select({ id: clients.id, name: clients.name })
  .from(clients)
  .where(isNull(clients.archivedAt));
```

## Querying from a service context (server actions, webhooks)

Supabase Auth provides a JWT with `active_workspace_id`. Your Drizzle client wraps this into a context object:

```typescript
// Server action
export async function addClient(input: AddClientInput) {
  'use server';
  const ctx = await getAuthContext(); // throws if unauthenticated
  const gate = await canAddClient(ctx.activeWorkspaceId);
  if (!gate.allowed) return err(gate.reason);

  const [client] = await db.insert(clients).values({
    workspaceId: ctx.activeWorkspaceId,
    ...input,
  }).returning();

  await track('client_created', { workspace_id_hash: hash(ctx.activeWorkspaceId) });
  return ok(client);
}
```

## Workspace switching

Users can belong to multiple workspaces. Switching workspaces:

1. Calls `/api/workspaces/switch` route
2. Route validates membership
3. Route updates JWT custom claim `active_workspace_id` via Supabase Auth Hook
4. Client refreshes session to pick up new claim
5. All subsequent queries use the new workspace context

## Client-contact access (portal)

Client contacts do NOT have rows in `auth.users`. They access the portal via magic links (`portal_magic_links` table).

- Portal routes check the magic link cookie, NOT `auth.uid()`
- Portal routes scope queries by `client_id`, not by `workspace_id` alone — they must never see other clients in the same workspace
- Portal-scoped queries use a separate set of RLS policies keyed on the portal session context

## Workspace-member client access (assignment-based)

When the workspace setting `all_members_see_all_clients = false`:
- Members and Viewers can only SELECT clients they are assigned to via `workspace_member_client_access`
- Admins and Owners always see everything

The RLS policy handles this:

```sql
CREATE POLICY "clients_select_with_assignment" ON clients
  FOR SELECT
  USING (
    -- Admin/Owner always
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
    OR
    -- Member/Viewer: workspace-wide access enabled
    (
      EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = clients.workspace_id
          AND (w.settings->>'all_members_see_all_clients')::boolean = true
      )
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = clients.workspace_id
          AND wm.user_id = auth.uid()
      )
    )
    OR
    -- Member/Viewer: assignment-based
    EXISTS (
      SELECT 1 FROM workspace_member_client_access wmca
      JOIN workspace_members wm ON wm.id = wmca.workspace_member_id
      WHERE wmca.client_id = clients.id
        AND wm.user_id = auth.uid()
    )
  );
```

## Common mistakes

- ❌ Forgetting `workspace_id` in new table — breaks RLS + queries
- ❌ Writing a policy that allows `SELECT` but forgets `INSERT/UPDATE/DELETE`
- ❌ Using `auth.jwt()` directly in policies instead of `auth.uid()` and lookups
- ❌ Testing RLS only with the service role (which bypasses RLS)
- ❌ Joining tables across workspaces in a single query
- ❌ Returning data from a query without checking the caller has access

## Quick reference: the decision tree

When adding a new feature touching data:

1. Is this data tenant-owned? → Yes → needs `workspace_id` + RLS
2. Can multiple roles see it? → Define per-role policies
3. Is it assignment-gated? → Join `workspace_member_client_access` in policy
4. Is it accessed by portal users? → Separate portal-scoped policies
5. Is there a background job touching it? → Use service-role client; enforce tenancy in code
