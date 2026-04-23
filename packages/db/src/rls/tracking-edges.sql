-- RLS for tracking_edges. Mirrors tracking_nodes.

ALTER TABLE public.tracking_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracking_edges_select" ON public.tracking_edges
FOR SELECT USING (public.phloz_is_assigned_to(client_id));

CREATE POLICY "tracking_edges_insert" ON public.tracking_edges
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
);

CREATE POLICY "tracking_edges_update" ON public.tracking_edges
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
);

CREATE POLICY "tracking_edges_delete" ON public.tracking_edges
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
  AND public.phloz_is_assigned_to(client_id)
);

CREATE TRIGGER tracking_edges_touch_updated_at
BEFORE UPDATE ON public.tracking_edges
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
