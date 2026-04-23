-- RLS for invitations. Owners/admins see + manage invitations for their
-- workspaces. Invitees accept via a tokenised route handler (service role).

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select" ON public.invitations
FOR SELECT USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

CREATE POLICY "invitations_mutate" ON public.invitations
FOR ALL USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']))
WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));
