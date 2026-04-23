-- RLS for workspace_members.
-- Users read the full member list of any workspace they belong to; only
-- owners/admins mutate.

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select" ON public.workspace_members
FOR SELECT USING (public.phloz_is_member_of(workspace_id));

CREATE POLICY "workspace_members_insert" ON public.workspace_members
FOR INSERT WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

CREATE POLICY "workspace_members_update" ON public.workspace_members
FOR UPDATE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']))
WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

CREATE POLICY "workspace_members_delete" ON public.workspace_members
FOR DELETE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));
