-- Per-member daily digest opt-in. Defaults to true so existing
-- memberships keep getting the digest; users can opt out from
-- Settings → Notifications.

ALTER TABLE "workspace_members"
ADD COLUMN IF NOT EXISTS "digest_enabled" boolean DEFAULT true NOT NULL;
