-- RLS for notification_subscriptions.
-- Same shape as notification_preferences — only the owning member
-- can read / write their own subscription rows. UPDATE is omitted
-- intentionally: this table is append-and-delete (set a mute, drop a
-- mute). Mode changes are rare enough that "delete + insert" is
-- cleaner than carrying an UPDATE policy.

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_subscriptions_select" ON public.notification_subscriptions
FOR SELECT USING (
  public.phloz_is_member_of(workspace_id)
  AND workspace_member_id IN (
    SELECT id FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = notification_subscriptions.workspace_id
  )
);

CREATE POLICY "notification_subscriptions_insert" ON public.notification_subscriptions
FOR INSERT WITH CHECK (
  public.phloz_is_member_of(workspace_id)
  AND workspace_member_id IN (
    SELECT id FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = notification_subscriptions.workspace_id
  )
);

CREATE POLICY "notification_subscriptions_delete" ON public.notification_subscriptions
FOR DELETE USING (
  workspace_member_id IN (
    SELECT id FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = notification_subscriptions.workspace_id
  )
);
