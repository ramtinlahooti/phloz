-- RLS for inbound_email_addresses. Readable by members; rotated by admin+.

ALTER TABLE public.inbound_email_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbound_email_addresses_select" ON public.inbound_email_addresses
FOR SELECT USING (public.phloz_is_member_of(workspace_id));

CREATE POLICY "inbound_email_addresses_mutate" ON public.inbound_email_addresses
FOR ALL USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']))
WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));
