-- RLS for access_grants. Workspace-scoped read; owner/admin-only writes.
-- This table is consulted by phloz_is_assigned_to() under SECURITY
-- DEFINER, so that path bypasses these policies entirely. The policies
-- below only constrain direct queries from app code (e.g. rendering an
-- access matrix in the UI).

ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the workspace. Members see their own grants
-- (and everyone else's) so the UI can show "you're assigned to N
-- clients via the SEO department" etc. without leaking cross-workspace
-- data.
CREATE POLICY "access_grants_select" ON public.access_grants
FOR SELECT USING (public.phloz_is_member_of(workspace_id));

CREATE POLICY "access_grants_insert" ON public.access_grants
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE POLICY "access_grants_update" ON public.access_grants
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE POLICY "access_grants_delete" ON public.access_grants
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
