-- RLS for audit_suppressions. Workspace-scoped read; writes go
-- through the server role via owner/admin/member-gated actions.

ALTER TABLE public.audit_suppressions ENABLE ROW LEVEL SECURITY;

-- Any member of the workspace can see what's suppressed — useful
-- for understanding why a finding stopped appearing on the audit
-- tab without forcing a scroll-back through the audit-log table.
CREATE POLICY "audit_suppressions_select" ON public.audit_suppressions
FOR SELECT USING (public.phloz_is_member_of(workspace_id));

-- Insert / update / delete go through server actions only (service
-- role bypasses RLS). Anon / authenticated roles cannot mutate.
