CREATE TABLE IF NOT EXISTS "audit_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_suppressions" ADD CONSTRAINT "audit_suppressions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_suppressions" ADD CONSTRAINT "audit_suppressions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "audit_suppressions_unique_per_rule" ON "audit_suppressions" USING btree ("workspace_id","client_id","rule_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_suppressions_workspace_id_idx" ON "audit_suppressions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_suppressions_client_id_idx" ON "audit_suppressions" USING btree ("client_id");--> statement-breakpoint

-- RLS: workspace-scoped read, server-only writes. Mirrors what
-- packages/db/src/rls/audit-suppressions.sql will apply via
-- `db:apply-rls` for fresh databases.
ALTER TABLE "audit_suppressions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "audit_suppressions_select" ON "audit_suppressions"
    FOR SELECT USING (public.phloz_is_member_of(workspace_id));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;