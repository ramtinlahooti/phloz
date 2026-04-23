-- RLS for billing_events. Readable by owners only (billing is owner-scoped).

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_events_select" ON public.billing_events
FOR SELECT USING (
  workspace_id IS NOT NULL
  AND public.phloz_has_role_in(workspace_id, ARRAY['owner'])
);

-- No INSERT / UPDATE / DELETE — webhooks use the service role.
