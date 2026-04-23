-- RLS for client_contacts. Same access pattern as the parent client.

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_contacts_select" ON public.client_contacts
FOR SELECT USING (public.phloz_is_assigned_to(client_id));

CREATE POLICY "client_contacts_insert" ON public.client_contacts
FOR INSERT WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY "client_contacts_update" ON public.client_contacts
FOR UPDATE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member']))
WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY "client_contacts_delete" ON public.client_contacts
FOR DELETE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

CREATE TRIGGER client_contacts_touch_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
