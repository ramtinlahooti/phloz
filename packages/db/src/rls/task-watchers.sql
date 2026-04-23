-- RLS for task_watchers. Anyone who can see a task can watch it.

ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_watchers_select" ON public.task_watchers
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND public.phloz_is_member_of(t.workspace_id)
  )
);

CREATE POLICY "task_watchers_mutate" ON public.task_watchers
FOR ALL USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND public.phloz_has_role_in(t.workspace_id, ARRAY['owner', 'admin'])
  )
) WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND public.phloz_has_role_in(t.workspace_id, ARRAY['owner', 'admin'])
  )
);
