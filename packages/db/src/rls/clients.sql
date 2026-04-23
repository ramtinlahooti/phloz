-- RLS for clients. Layered: workspace isolation + assignment-based filter
-- (controlled by workspace.settings.all_members_see_all_clients).

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- SELECT: assignment-aware. phloz_is_assigned_to() handles all three cases
-- (owner/admin, workspace-wide visibility, explicit assignment).
CREATE POLICY "clients_select" ON public.clients
FOR SELECT USING (public.phloz_is_assigned_to(id));

-- INSERT: owner/admin only (ARCHITECTURE.md §6.4).
CREATE POLICY "clients_insert" ON public.clients
FOR INSERT WITH CHECK (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

-- UPDATE: owner/admin, plus assigned member (e.g. edit notes/profile).
CREATE POLICY "clients_update" ON public.clients
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
  OR public.phloz_is_assigned_to(id)
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
  OR public.phloz_is_assigned_to(id)
);

-- DELETE: owner/admin only.
CREATE POLICY "clients_delete" ON public.clients
FOR DELETE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));

CREATE TRIGGER clients_touch_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
