-- Comprehensive notification preferences. Three pieces:
--
--   1. notification_preferences — per-(member, event_type) opt-out
--      flag. Lets a user mute one kind of email (e.g. recurring-task
--      creation) without disabling everything.
--
--   2. notification_subscriptions — per-(member, entity) explicit
--      preference. Today: client-level mute and task-level mute.
--      Watch is its own mode (opt-in) so the table generalises if we
--      add explicit-watch UX later. Mute wins over default behaviour.
--
--   3. workspace_members.paused_until — vacation mode. While set in
--      the future, the digest cron skips this member entirely.
--
-- The cron filters in send-daily-digest.ts are what give these rows
-- meaning; the schema alone is inert.

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "workspace_member_id" uuid NOT NULL REFERENCES "workspace_members"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_member_event_key"
ON "notification_preferences" ("workspace_member_id", "event_type");

CREATE INDEX IF NOT EXISTS "notification_preferences_workspace_id_idx"
ON "notification_preferences" ("workspace_id");

CREATE TABLE IF NOT EXISTS "notification_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "workspace_member_id" uuid NOT NULL REFERENCES "workspace_members"("id") ON DELETE CASCADE,
  -- 'client' | 'task'. Application-level enum; CHECK constraint
  -- guards against typos at the DB.
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  -- 'mute' | 'watch'. Mute beats default. Watch is currently
  -- informational (no UI today) — adds future-proofing.
  "mode" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "notification_subscriptions"
  ADD CONSTRAINT "notification_subscriptions_entity_type_check"
  CHECK ("entity_type" IN ('client', 'task'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "notification_subscriptions"
  ADD CONSTRAINT "notification_subscriptions_mode_check"
  CHECK ("mode" IN ('mute', 'watch'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "notification_subscriptions_member_entity_key"
ON "notification_subscriptions" ("workspace_member_id", "entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "notification_subscriptions_workspace_id_idx"
ON "notification_subscriptions" ("workspace_id");

CREATE INDEX IF NOT EXISTS "notification_subscriptions_entity_idx"
ON "notification_subscriptions" ("entity_type", "entity_id");

ALTER TABLE "workspace_members"
ADD COLUMN IF NOT EXISTS "paused_until" timestamptz;

-- RLS: every member reads + writes only their own preferences.
-- Owners/admins do not get to see/edit other members' preferences —
-- this is a personal triage tool, not a managerial one.

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "notification_preferences_select" ON "notification_preferences"
  FOR SELECT USING (
    public.phloz_is_member_of(workspace_id)
    AND workspace_member_id IN (
      SELECT id FROM public.workspace_members
      WHERE user_id = auth.uid() AND workspace_id = notification_preferences.workspace_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "notification_preferences_insert" ON "notification_preferences"
  FOR INSERT WITH CHECK (
    public.phloz_is_member_of(workspace_id)
    AND workspace_member_id IN (
      SELECT id FROM public.workspace_members
      WHERE user_id = auth.uid() AND workspace_id = notification_preferences.workspace_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "notification_preferences_update" ON "notification_preferences"
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
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "notification_preferences_delete" ON "notification_preferences"
  FOR DELETE USING (
    workspace_member_id IN (
      SELECT id FROM public.workspace_members
      WHERE user_id = auth.uid() AND workspace_id = notification_preferences.workspace_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "notification_subscriptions" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "notification_subscriptions_select" ON "notification_subscriptions"
  FOR SELECT USING (
    public.phloz_is_member_of(workspace_id)
    AND workspace_member_id IN (
      SELECT id FROM public.workspace_members
      WHERE user_id = auth.uid() AND workspace_id = notification_subscriptions.workspace_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "notification_subscriptions_insert" ON "notification_subscriptions"
  FOR INSERT WITH CHECK (
    public.phloz_is_member_of(workspace_id)
    AND workspace_member_id IN (
      SELECT id FROM public.workspace_members
      WHERE user_id = auth.uid() AND workspace_id = notification_subscriptions.workspace_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "notification_subscriptions_delete" ON "notification_subscriptions"
  FOR DELETE USING (
    workspace_member_id IN (
      SELECT id FROM public.workspace_members
      WHERE user_id = auth.uid() AND workspace_id = notification_subscriptions.workspace_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
