-- RLS for tracking_nodes. Viewers can read; members+ can mutate within
-- assignment scope.

ALTER TABLE public.tracking_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracking_nodes_select" ON public.tracking_nodes
FOR SELECT USING (public.phloz_is_assigned_to(client_id));

CREATE POLICY "tracking_nodes_insert" ON public.tracking_nodes
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
);

CREATE POLICY "tracking_nodes_update" ON public.tracking_nodes
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
);

CREATE POLICY "tracking_nodes_delete" ON public.tracking_nodes
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
);

CREATE TRIGGER tracking_nodes_touch_updated_at
BEFORE UPDATE ON public.tracking_nodes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
