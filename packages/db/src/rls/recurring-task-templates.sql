-- RLS for recurring_task_templates. Mirrors tasks.sql:
-- workspace members read; owner/admin/member mutate;
-- owner/admin delete. Client-tied templates respect assignment.

ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_task_templates_select" ON public.recurring_task_templates
FOR SELECT USING (
  public.phloz_is_member_of(workspace_id)
  AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
);

CREATE POLICY "recurring_task_templates_insert" ON public.recurring_task_templates
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
);

CREATE POLICY "recurring_task_templates_update" ON public.recurring_task_templates
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
);

CREATE POLICY "recurring_task_templates_delete" ON public.recurring_task_templates
FOR DELETE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

CREATE TRIGGER recurring_task_templates_touch_updated_at
BEFORE UPDATE ON public.recurring_task_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
