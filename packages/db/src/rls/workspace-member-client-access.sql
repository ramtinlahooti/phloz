-- RLS for per-member client assignment. Only owner/admin can manage these rows.

ALTER TABLE public.workspace_member_client_access ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the workspace the assignment belongs to (via the
-- member row). Useful so members can see which clients they're assigned to.
CREATE POLICY "workspace_member_client_access_select" ON public.workspace_member_client_access
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = workspace_member_id
      AND public.phloz_is_member_of(wm.workspace_id)
  )
);

CREATE POLICY "workspace_member_client_access_mutate" ON public.workspace_member_client_access
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = workspace_member_id
      AND public.phloz_has_role_in(wm.workspace_id, ARRAY['owner', 'admin'])
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = workspace_member_id
      AND public.phloz_has_role_in(wm.workspace_id, ARRAY['owner', 'admin'])
  )
);
