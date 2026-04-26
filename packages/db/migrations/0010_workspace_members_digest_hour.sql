-- Per-member preferred hour-of-day for the daily digest. Workspace
-- timezone is the reference frame (same as the existing 9 AM default).
-- NULL means "use the workspace default" (still 9 AM today). Range
-- enforced 0–23 so a stray value can't put the cron in an unreachable
-- bucket.

ALTER TABLE "workspace_members"
ADD COLUMN IF NOT EXISTS "digest_hour" smallint;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "workspace_members"
  ADD CONSTRAINT "workspace_members_digest_hour_range"
  CHECK ("digest_hour" IS NULL OR ("digest_hour" >= 0 AND "digest_hour" <= 23));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
