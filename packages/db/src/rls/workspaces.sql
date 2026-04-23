-- RLS for workspaces. See ARCHITECTURE.md §4.1, §6.4.
-- The `workspaces` table is the anchor; other tenant tables reference it via
-- workspace_id.

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the workspace
CREATE POLICY "workspaces_select" ON public.workspaces
FOR SELECT USING (public.phloz_is_member_of(id));

-- INSERT: not exposed via authenticated role. Workspace creation goes through
-- a server action using the service role (see @phloz/auth onboarding).
-- (No INSERT policy = default deny for authenticated users.)

-- UPDATE: owner or admin only
CREATE POLICY "workspaces_update" ON public.workspaces
FOR UPDATE USING (public.phloz_has_role_in(id, ARRAY['owner', 'admin']))
WITH CHECK (public.phloz_has_role_in(id, ARRAY['owner', 'admin']));

-- DELETE: owner only
CREATE POLICY "workspaces_delete" ON public.workspaces
FOR DELETE USING (public.phloz_has_role_in(id, ARRAY['owner']));

CREATE TRIGGER workspaces_touch_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
