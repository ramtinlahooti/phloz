-- RLS for department_memberships. Workspace-scoped read; owner/admin-only writes.

ALTER TABLE public.department_memberships ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the workspace. Membership rows feed badges +
-- "who's in this department" lists for everyone.
CREATE POLICY "department_memberships_select" ON public.department_memberships
FOR SELECT USING (public.phloz_is_member_of(workspace_id));

CREATE POLICY "department_memberships_insert" ON public.department_memberships
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE POLICY "department_memberships_update" ON public.department_memberships
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE POLICY "department_memberships_delete" ON public.department_memberships
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
