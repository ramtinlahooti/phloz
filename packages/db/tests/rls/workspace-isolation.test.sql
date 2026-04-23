-- pgTAP test: verifies the three RLS invariants called out in
-- PROMPT_1.md Step 2 and ARCHITECTURE.md §4.1 / §6.4.
--
-- Runs against a Supabase-style Postgres where:
--   - pgTAP extension is installed
--   - the `auth` schema exists (auth.uid() reads the JWT)
--   - our schema migrations + RLS files have been applied
--
-- Execute via `supabase test db` or `pg_prove -d phloz_test tests/rls/*.sql`.

BEGIN;

SELECT plan(7);

-- ----------------------------------------------------------------------------
-- Fixtures: two workspaces, two users, two clients (one per workspace), one
-- assigned-only workspace, one viewer.
-- ----------------------------------------------------------------------------

-- pretend these users exist in auth.users (Supabase schema)
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'viewer-a@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'member-a@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug, owner_user_id, settings) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Workspace A',
    'ws-a',
    '11111111-1111-1111-1111-111111111111',
    '{"all_members_see_all_clients": false}'::jsonb
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Workspace B',
    'ws-b',
    '22222222-2222-2222-2222-222222222222',
    '{}'::jsonb
  );

INSERT INTO workspace_members (id, workspace_id, user_id, role, accepted_at) VALUES
  ('11111111-aaaa-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', now()),
  ('22222222-bbbb-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner', now()),
  ('33333333-aaaa-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer', now()),
  ('44444444-aaaa-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'member', now());

INSERT INTO clients (id, workspace_id, name) VALUES
  ('ccccaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client A'),
  ('ccccbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Client B');

-- ----------------------------------------------------------------------------
-- Test 1 — workspace isolation
-- User A (owner of WS A) cannot SELECT any client in WS B.
-- ----------------------------------------------------------------------------

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111"}';

SELECT is(
  (SELECT count(*)::int FROM clients WHERE workspace_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0,
  'Owner of WS A sees zero clients in WS B (workspace isolation)'
);

SELECT is(
  (SELECT count(*)::int FROM clients),
  1,
  'Owner of WS A sees exactly one client (their own)'
);

-- ----------------------------------------------------------------------------
-- Test 2 — viewer cannot write
-- Viewer in WS A cannot INSERT a client.
-- ----------------------------------------------------------------------------

SET LOCAL request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333"}';

SELECT throws_ok(
  $$INSERT INTO clients (workspace_id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Viewer Attempt')$$,
  '42501',
  NULL,
  'Viewer in WS A is blocked from INSERT on clients'
);

SELECT throws_ok(
  $$DELETE FROM clients WHERE id = 'ccccaaaa-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'Viewer in WS A is blocked from DELETE on clients'
);

-- ----------------------------------------------------------------------------
-- Test 3 — assignment-based access
-- Member in WS A (no explicit assignment) cannot SELECT client when
-- all_members_see_all_clients = false.
-- ----------------------------------------------------------------------------

SET LOCAL request.jwt.claims TO '{"sub": "44444444-4444-4444-4444-444444444444"}';

SELECT is(
  (SELECT count(*)::int FROM clients WHERE id = 'ccccaaaa-0000-0000-0000-000000000001'),
  0,
  'Unassigned member sees zero when all_members_see_all_clients is false'
);

-- Assign the member, then they should see it
INSERT INTO workspace_member_client_access (workspace_member_id, client_id) VALUES
  ('44444444-aaaa-0000-0000-000000000001', 'ccccaaaa-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM clients WHERE id = 'ccccaaaa-0000-0000-0000-000000000001'),
  1,
  'Assigned member sees the client after wmca row exists'
);

-- ----------------------------------------------------------------------------
-- Test 4 — opt-in workspace setting lifts the assignment filter
-- ----------------------------------------------------------------------------

RESET role;
UPDATE workspaces
SET settings = jsonb_set(settings, '{all_members_see_all_clients}', 'true'::jsonb)
WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "44444444-4444-4444-4444-444444444444"}';

DELETE FROM workspace_member_client_access
WHERE workspace_member_id = '44444444-aaaa-0000-0000-000000000001';

SELECT is(
  (SELECT count(*)::int FROM clients WHERE workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'Member sees all clients when workspace opts in, even without assignment'
);

SELECT * FROM finish();
ROLLBACK;
