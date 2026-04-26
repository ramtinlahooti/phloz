-- RLS for notification_preferences.
-- Personal preference; only the owning member can read / write their
-- own rows. Owners and admins do NOT get to see/edit other members'
-- preferences — this is a personal triage tool, not a managerial one.

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_select" ON public.notification_preferences
FOR SELECT USING (
  public.phloz_is_member_of(workspace_id)
  AND workspace_member_id IN (
    SELECT id FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = notification_preferences.workspace_id
  )
);

CREATE POLICY "notification_preferences_insert" ON public.notification_preferences
FOR INSERT WITH CHECK (
  public.phloz_is_member_of(workspace_id)
  AND workspace_member_id IN (
    SELECT id FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = notification_preferences.workspace_id
  )
);

CREATE POLICY "notification_preferences_update" ON public.notification_preferences
FOR UPDATE USING (
  workspace_member_id IN (
    SELECT id FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = notification_preferences.workspace_id
  )
)
WITH CHECK (
  workspace_member_id IN (
    SELECT id FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = notification_preferences.workspace_id
  )
);

CREATE POLICY "notification_preferences_delete" ON public.notification_preferences
FOR DELETE USING (
  workspace_member_id IN (
    SELECT id FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = notification_preferences.workspace_id
  )
);
