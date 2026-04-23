-- RLS for messages. Workspace members on assigned clients see the thread.

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages
FOR SELECT USING (public.phloz_is_assigned_to(client_id));

CREATE POLICY "messages_insert" ON public.messages
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
);

-- Messages are append-only from the UI. Service role handles inbound and
-- system-originated rows (Resend webhook, etc.).
-- No UPDATE / DELETE policies.
