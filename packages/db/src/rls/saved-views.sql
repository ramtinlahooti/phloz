-- RLS for saved_views. Personal preference, scoped to a single
-- workspace. The user only sees their own rows, even within a
-- workspace they share with teammates — saved views are private.

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_views_select" ON public.saved_views
FOR SELECT USING (
  user_id = auth.uid()
  AND public.phloz_is_member_of(workspace_id)
);

CREATE POLICY "saved_views_insert" ON public.saved_views
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND public.phloz_is_member_of(workspace_id)
);

CREATE POLICY "saved_views_update" ON public.saved_views
FOR UPDATE USING (
  user_id = auth.uid()
  AND public.phloz_is_member_of(workspace_id)
) WITH CHECK (
  user_id = auth.uid()
  AND public.phloz_is_member_of(workspace_id)
);

CREATE POLICY "saved_views_delete" ON public.saved_views
FOR DELETE USING (
  user_id = auth.uid()
  AND public.phloz_is_member_of(workspace_id)
);

CREATE TRIGGER saved_views_touch_updated_at
BEFORE UPDATE ON public.saved_views
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
