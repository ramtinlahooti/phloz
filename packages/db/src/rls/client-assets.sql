-- RLS for client_assets. Same access pattern as the parent client.

ALTER TABLE public.client_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_assets_select" ON public.client_assets
FOR SELECT USING (public.phloz_is_assigned_to(client_id));

CREATE POLICY "client_assets_insert" ON public.client_assets
FOR INSERT WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY "client_assets_update" ON public.client_assets
FOR UPDATE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member']))
WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY "client_assets_delete" ON public.client_assets
FOR DELETE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member']));
