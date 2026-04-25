CREATE TABLE IF NOT EXISTS "recurring_task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"department" text DEFAULT 'other' NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"assignee_id" uuid,
	"due_offset_days" integer DEFAULT 0 NOT NULL,
	"cadence" text NOT NULL,
	"weekday" smallint,
	"day_of_month" smallint,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_assignee_id_workspace_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_task_templates_workspace_id_idx" ON "recurring_task_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_task_templates_client_id_idx" ON "recurring_task_templates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_task_templates_enabled_idx" ON "recurring_task_templates" USING btree ("enabled");--> statement-breakpoint

-- RLS: workspace-scoped read, owner/admin/member mutate, owner/admin
-- delete. Mirrors what packages/db/src/rls/recurring-task-templates.sql
-- applies via db:apply-rls for fresh databases.
ALTER TABLE "recurring_task_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "recurring_task_templates_select" ON "recurring_task_templates"
    FOR SELECT USING (
      public.phloz_is_member_of(workspace_id)
      AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "recurring_task_templates_insert" ON "recurring_task_templates"
    FOR INSERT WITH CHECK (
      public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
      AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "recurring_task_templates_update" ON "recurring_task_templates"
    FOR UPDATE USING (
      public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
      AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
    ) WITH CHECK (
      public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin', 'member'])
      AND (client_id IS NULL OR public.phloz_is_assigned_to(client_id))
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "recurring_task_templates_delete" ON "recurring_task_templates"
    FOR DELETE USING (public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin']));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TRIGGER recurring_task_templates_touch_updated_at
  BEFORE UPDATE ON "recurring_task_templates"
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
