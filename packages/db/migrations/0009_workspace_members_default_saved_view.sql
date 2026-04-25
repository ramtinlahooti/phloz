-- Per-member auto-applied saved view on /tasks. Bare /tasks redirects
-- to the default's search-params; explicit /tasks?view=all bypasses
-- the redirect. ON DELETE SET NULL on the FK so removing a saved
-- view doesn't leave members with a dangling default.

ALTER TABLE "workspace_members"
ADD COLUMN IF NOT EXISTS "default_saved_view_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "workspace_members"
  ADD CONSTRAINT "workspace_members_default_saved_view_id_fk"
  FOREIGN KEY ("default_saved_view_id")
  REFERENCES "public"."saved_views"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
