-- SECURITY DEFINER helpers used by every RLS policy in this directory.
-- These bypass RLS themselves so that policies that reference them do not
-- trigger recursive evaluation (the Supabase-recommended pattern).
--
-- See ARCHITECTURE.md §4.1 for the multi-tenancy rules these encode.

-- ---------------------------------------------------------------------------
-- phloz_is_member_of(workspace_id)
-- True when the current auth.uid() is a member of the workspace.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.phloz_is_member_of(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = ws_id
  );
$$;

-- ---------------------------------------------------------------------------
-- phloz_has_role_in(workspace_id, roles[])
-- True when the current auth.uid()'s role in the workspace is in the array.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.phloz_has_role_in(ws_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid()
      AND workspace_id = ws_id
      AND role = ANY(allowed_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- phloz_is_assigned_to(client_id)
-- True when the current auth.uid() can see the given client, via any of:
--   1. Owner or admin role in the client's workspace
--   2. Workspace setting `all_members_see_all_clients` is true
--   3. A direct grant in `access_grants`:
--        - granted_to_member_id = me AND client_id = c_id
--        - granted_to_member_id = me AND client_group_id = client.client_group_id
--        - granted_to_department_id = D AND client_id = c_id (where I'm in D)
--        - granted_to_department_id = D AND client_group_id = client.client_group_id (where I'm in D)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.phloz_is_assigned_to(c_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.workspace_members wm
      ON wm.workspace_id = c.workspace_id
     AND wm.user_id = auth.uid()
    LEFT JOIN public.workspaces w ON w.id = c.workspace_id
    WHERE c.id = c_id
      AND (
        -- owners / admins always see every client
        wm.role IN ('owner', 'admin')
        OR
        -- workspace opts all members in
        (w.settings ->> 'all_members_see_all_clients')::boolean IS NOT DISTINCT FROM true
        OR
        -- member/viewer with any matching access grant
        EXISTS (
          SELECT 1 FROM public.access_grants ag
          WHERE ag.workspace_id = c.workspace_id
            AND (
              -- subject side: direct member grant OR via department membership
              ag.granted_to_member_id = wm.id
              OR EXISTS (
                SELECT 1 FROM public.department_memberships dm
                WHERE dm.department_id = ag.granted_to_department_id
                  AND dm.workspace_member_id = wm.id
              )
            )
            AND (
              -- object side: direct client grant OR via client's group
              ag.client_id = c.id
              OR (
                ag.client_group_id IS NOT NULL
                AND ag.client_group_id = c.client_group_id
              )
            )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- touch_updated_at() trigger function
-- Applied to every tenant table with an updated_at column.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
