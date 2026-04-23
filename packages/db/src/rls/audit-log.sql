-- RLS for audit_log. Append-only. Readable by owners/admins only.

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON public.audit_log
FOR SELECT USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

-- No INSERT policy — writes come through server code using the service role.
-- No UPDATE or DELETE — audit log is immutable by design.
