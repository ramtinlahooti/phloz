-- Catch-up migration: formalises schema drift that accumulated on top of
-- 0000 via `db:push` / Supabase dashboard edits, plus adds cached identity
-- columns on workspace_members so the Team page + task assignee picker
-- can show names and emails instead of UUID prefixes.
--
-- Every ADD COLUMN is guarded with IF NOT EXISTS so this file is safe to
-- re-run against a database that has already received the earlier changes
-- out-of-band.

-- Workspace identity (agency details: settings page)
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "website_url" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "timezone" text;--> statement-breakpoint

-- Member identity cache (this migration's primary payload)
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "display_name" text;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint

-- Client activity signal (nightly cron + write-path populates)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone;--> statement-breakpoint

-- Asset portal-visibility toggle
ALTER TABLE "client_assets" ADD COLUMN IF NOT EXISTS "client_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Task approval flow (portal approve / reject / needs-changes)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "approval_state" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "approval_comment" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "approval_updated_at" timestamp with time zone;--> statement-breakpoint

-- Supporting indexes
CREATE INDEX IF NOT EXISTS "clients_last_activity_at_idx" ON "clients" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_assets_client_visible_idx" ON "client_assets" USING btree ("client_visible");--> statement-breakpoint

-- Backfill display_name + email from auth.users for any rows created
-- before this migration (the solo-owner seed row + any members who
-- accepted invites prior to the write-path update shipping alongside
-- this SQL). Uses COALESCE so already-populated values aren't clobbered
-- if this file gets re-run.
UPDATE "workspace_members" wm
SET
  "display_name" = COALESCE(wm."display_name", u.raw_user_meta_data->>'full_name'),
  "email" = COALESCE(wm."email", u.email)
FROM auth.users u
WHERE wm.user_id = u.id
  AND (wm."display_name" IS NULL OR wm."email" IS NULL);
