-- RLS for tasks. Client-tied tasks respect assignment; workspace-level tasks
-- (client_id IS NULL) visible to all workspace members.

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT USING (
  public.phloz_is_member_of(workspace_id)
  AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
);

CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
);

CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
);

CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

CREATE TRIGGER tasks_touch_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
