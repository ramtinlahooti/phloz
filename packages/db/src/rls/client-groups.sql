-- RLS for client_groups. Workspace-scoped read; owner/admin-only writes.

ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the workspace. Members + viewers see groups so
-- the UI can render filter chips even if they can't manage them.
CREATE POLICY "client_groups_select" ON public.client_groups
FOR SELECT USING (public.phloz_is_member_of(workspace_id));

-- INSERT / UPDATE / DELETE: owner/admin only.
CREATE POLICY "client_groups_insert" ON public.client_groups
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE POLICY "client_groups_update" ON public.client_groups
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE POLICY "client_groups_delete" ON public.client_groups
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE TRIGGER client_groups_touch_updated_at
BEFORE UPDATE ON public.client_groups
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
