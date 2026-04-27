-- RLS for departments. Workspace-scoped read; owner/admin-only writes.

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the workspace. Department names + colours feed
-- chips on member rows; everyone sees them.
CREATE POLICY "departments_select" ON public.departments
FOR SELECT USING (public.phloz_is_member_of(workspace_id));

CREATE POLICY "departments_insert" ON public.departments
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE POLICY "departments_update" ON public.departments
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE POLICY "departments_delete" ON public.departments
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE TRIGGER departments_touch_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
