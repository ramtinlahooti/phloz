-- RLS for comments. Scoped to the workspace; members write; owners delete.

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.comments
FOR SELECT USING (public.phloz_is_member_of(workspace_id));

CREATE POLICY "comments_insert" ON public.comments
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member', 'viewer'])
  AND author_id = auth.uid()
  AND author_type = 'member'
);

CREATE POLICY "comments_update" ON public.comments
FOR UPDATE USING (author_id = auth.uid() AND author_type = 'member')
WITH CHECK (author_id = auth.uid() AND author_type = 'member');

CREATE POLICY "comments_delete" ON public.comments
FOR DELETE USING (
  (author_id = auth.uid() AND author_type = 'member')
  OR public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);

CREATE TRIGGER comments_touch_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
