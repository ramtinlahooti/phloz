CREATE TABLE IF NOT EXISTS "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"search_params" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_views_workspace_id_idx" ON "saved_views" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_views_user_id_idx" ON "saved_views" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saved_views_unique_name" ON "saved_views" USING btree ("workspace_id", "user_id", "scope", "name");--> statement-breakpoint

-- RLS: saved views are personal — even within the same workspace,
-- members only see their own rows. Mirrors
-- packages/db/src/rls/saved-views.sql.
ALTER TABLE "saved_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "saved_views_select" ON "saved_views"
    FOR SELECT USING (
      user_id = auth.uid()
      AND public.phloz_is_member_of(workspace_id)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "saved_views_insert" ON "saved_views"
    FOR INSERT WITH CHECK (
      user_id = auth.uid()
      AND public.phloz_is_member_of(workspace_id)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "saved_views_update" ON "saved_views"
    FOR UPDATE USING (
      user_id = auth.uid()
      AND public.phloz_is_member_of(workspace_id)
    ) WITH CHECK (
      user_id = auth.uid()
      AND public.phloz_is_member_of(workspace_id)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "saved_views_delete" ON "saved_views"
    FOR DELETE USING (
      user_id = auth.uid()
      AND public.phloz_is_member_of(workspace_id)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TRIGGER saved_views_touch_updated_at
  BEFORE UPDATE ON "saved_views"
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
