-- Client groups + departments + flexible access grants.
-- See docs/DECISIONS.md "2026-04-26: Client groups + departments +
-- flexible access grants" for rationale.
--
-- This migration:
--   1. DROPS the legacy workspace_member_client_access table (its RLS
--      policies + indexes go with it). Existing assignment rows are
--      lost — confirmed test-data only by the user.
--   2. CREATES client_groups, departments, department_memberships,
--      access_grants.
--   3. ADDS clients.client_group_id (nullable, ON DELETE SET NULL).
--   4. REPLACES phloz_is_assigned_to() with the four-path version.
--   5. ENABLES RLS + policies on all four new tables.
--
-- Idempotent throughout: every CREATE uses IF NOT EXISTS and every
-- DROP uses IF EXISTS so re-applying is safe.

-- ---------------------------------------------------------------------------
-- 1. Drop the legacy table.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "workspace_member_client_access" CASCADE;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2a. client_groups — agency-defined client portfolios.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "client_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "color" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "client_groups"
  ADD CONSTRAINT "client_groups_workspace_id_fk"
  FOREIGN KEY ("workspace_id")
  REFERENCES "public"."workspaces"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "client_groups_workspace_id_idx"
  ON "client_groups" ("workspace_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "client_groups_workspace_name_key"
  ON "client_groups" ("workspace_id", "name");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2b. departments — agency-defined member groupings.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "color" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "departments"
  ADD CONSTRAINT "departments_workspace_id_fk"
  FOREIGN KEY ("workspace_id")
  REFERENCES "public"."workspaces"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "departments_workspace_id_idx"
  ON "departments" ("workspace_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "departments_workspace_name_key"
  ON "departments" ("workspace_id", "name");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2c. department_memberships — M:N member ↔ department.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "department_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "workspace_member_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "department_memberships"
  ADD CONSTRAINT "department_memberships_workspace_id_fk"
  FOREIGN KEY ("workspace_id")
  REFERENCES "public"."workspaces"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "department_memberships"
  ADD CONSTRAINT "department_memberships_department_id_fk"
  FOREIGN KEY ("department_id")
  REFERENCES "public"."departments"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "department_memberships"
  ADD CONSTRAINT "department_memberships_workspace_member_id_fk"
  FOREIGN KEY ("workspace_member_id")
  REFERENCES "public"."workspace_members"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "department_memberships_dept_member_key"
  ON "department_memberships" ("department_id", "workspace_member_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "department_memberships_department_idx"
  ON "department_memberships" ("department_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "department_memberships_member_idx"
  ON "department_memberships" ("workspace_member_id");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2d. access_grants — flexible (member|department) → (client|client_group).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "access_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "granted_to_member_id" uuid,
  "granted_to_department_id" uuid,
  "client_id" uuid,
  "client_group_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "access_grants_subject_exclusive"
    CHECK (("granted_to_member_id" IS NOT NULL) <> ("granted_to_department_id" IS NOT NULL)),
  CONSTRAINT "access_grants_object_exclusive"
    CHECK (("client_id" IS NOT NULL) <> ("client_group_id" IS NOT NULL))
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "access_grants"
  ADD CONSTRAINT "access_grants_workspace_id_fk"
  FOREIGN KEY ("workspace_id")
  REFERENCES "public"."workspaces"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "access_grants"
  ADD CONSTRAINT "access_grants_granted_to_member_id_fk"
  FOREIGN KEY ("granted_to_member_id")
  REFERENCES "public"."workspace_members"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "access_grants"
  ADD CONSTRAINT "access_grants_granted_to_department_id_fk"
  FOREIGN KEY ("granted_to_department_id")
  REFERENCES "public"."departments"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "access_grants"
  ADD CONSTRAINT "access_grants_client_id_fk"
  FOREIGN KEY ("client_id")
  REFERENCES "public"."clients"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "access_grants"
  ADD CONSTRAINT "access_grants_client_group_id_fk"
  FOREIGN KEY ("client_group_id")
  REFERENCES "public"."client_groups"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- COALESCE-on-NULL trick so the (subject, object) tuple is compared as
-- one key. Postgres treats NULLs as distinct in unique indexes by default.
CREATE UNIQUE INDEX IF NOT EXISTS "access_grants_unique_edge_key"
  ON "access_grants" (
    "workspace_id",
    coalesce("granted_to_member_id", '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce("granted_to_department_id", '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce("client_id", '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce("client_group_id", '00000000-0000-0000-0000-000000000000'::uuid)
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "access_grants_workspace_id_idx"
  ON "access_grants" ("workspace_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "access_grants_granted_to_member_idx"
  ON "access_grants" ("granted_to_member_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "access_grants_granted_to_department_idx"
  ON "access_grants" ("granted_to_department_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "access_grants_client_idx"
  ON "access_grants" ("client_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "access_grants_client_group_idx"
  ON "access_grants" ("client_group_id");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Add clients.client_group_id (nullable; ON DELETE SET NULL so deleting
--    a group leaves its clients ungrouped, never deletes business data).
-- ---------------------------------------------------------------------------

ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "client_group_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "clients"
  ADD CONSTRAINT "clients_client_group_id_fk"
  FOREIGN KEY ("client_group_id")
  REFERENCES "public"."client_groups"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "clients_client_group_id_idx"
  ON "clients" ("client_group_id");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Replace phloz_is_assigned_to() with the four-path version that
--    consults access_grants + department_memberships + clients.client_group_id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.phloz_is_assigned_to(c_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.workspace_members wm
      ON wm.workspace_id = c.workspace_id
     AND wm.user_id = auth.uid()
    LEFT JOIN public.workspaces w ON w.id = c.workspace_id
    WHERE c.id = c_id
      AND (
        wm.role IN ('owner', 'admin')
        OR
        (w.settings ->> 'all_members_see_all_clients')::boolean IS NOT DISTINCT FROM true
        OR
        EXISTS (
          SELECT 1 FROM public.access_grants ag
          WHERE ag.workspace_id = c.workspace_id
            AND (
              ag.granted_to_member_id = wm.id
              OR EXISTS (
                SELECT 1 FROM public.department_memberships dm
                WHERE dm.department_id = ag.granted_to_department_id
                  AND dm.workspace_member_id = wm.id
              )
            )
            AND (
              ag.client_id = c.id
              OR (
                ag.client_group_id IS NOT NULL
                AND ag.client_group_id = c.client_group_id
              )
            )
        )
      )
  );
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. Enable RLS + policies on the four new tables.
-- ---------------------------------------------------------------------------

ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "client_groups_select" ON public.client_groups;
--> statement-breakpoint
CREATE POLICY "client_groups_select" ON public.client_groups
FOR SELECT USING (public.phloz_is_member_of(workspace_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "client_groups_insert" ON public.client_groups;
--> statement-breakpoint
CREATE POLICY "client_groups_insert" ON public.client_groups
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP POLICY IF EXISTS "client_groups_update" ON public.client_groups;
--> statement-breakpoint
CREATE POLICY "client_groups_update" ON public.client_groups
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP POLICY IF EXISTS "client_groups_delete" ON public.client_groups;
--> statement-breakpoint
CREATE POLICY "client_groups_delete" ON public.client_groups
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP TRIGGER IF EXISTS client_groups_touch_updated_at ON public.client_groups;
--> statement-breakpoint
CREATE TRIGGER client_groups_touch_updated_at
BEFORE UPDATE ON public.client_groups
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
--> statement-breakpoint

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "departments_select" ON public.departments;
--> statement-breakpoint
CREATE POLICY "departments_select" ON public.departments
FOR SELECT USING (public.phloz_is_member_of(workspace_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "departments_insert" ON public.departments;
--> statement-breakpoint
CREATE POLICY "departments_insert" ON public.departments
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP POLICY IF EXISTS "departments_update" ON public.departments;
--> statement-breakpoint
CREATE POLICY "departments_update" ON public.departments
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP POLICY IF EXISTS "departments_delete" ON public.departments;
--> statement-breakpoint
CREATE POLICY "departments_delete" ON public.departments
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP TRIGGER IF EXISTS departments_touch_updated_at ON public.departments;
--> statement-breakpoint
CREATE TRIGGER departments_touch_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
--> statement-breakpoint

ALTER TABLE public.department_memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "department_memberships_select" ON public.department_memberships;
--> statement-breakpoint
CREATE POLICY "department_memberships_select" ON public.department_memberships
FOR SELECT USING (public.phloz_is_member_of(workspace_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "department_memberships_insert" ON public.department_memberships;
--> statement-breakpoint
CREATE POLICY "department_memberships_insert" ON public.department_memberships
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP POLICY IF EXISTS "department_memberships_update" ON public.department_memberships;
--> statement-breakpoint
CREATE POLICY "department_memberships_update" ON public.department_memberships
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP POLICY IF EXISTS "department_memberships_delete" ON public.department_memberships;
--> statement-breakpoint
CREATE POLICY "department_memberships_delete" ON public.department_memberships
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "access_grants_select" ON public.access_grants;
--> statement-breakpoint
CREATE POLICY "access_grants_select" ON public.access_grants
FOR SELECT USING (public.phloz_is_member_of(workspace_id));
--> statement-breakpoint

DROP POLICY IF EXISTS "access_grants_insert" ON public.access_grants;
--> statement-breakpoint
CREATE POLICY "access_grants_insert" ON public.access_grants
FOR INSERT WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP POLICY IF EXISTS "access_grants_update" ON public.access_grants;
--> statement-breakpoint
CREATE POLICY "access_grants_update" ON public.access_grants
FOR UPDATE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
) WITH CHECK (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
--> statement-breakpoint

DROP POLICY IF EXISTS "access_grants_delete" ON public.access_grants;
--> statement-breakpoint
CREATE POLICY "access_grants_delete" ON public.access_grants
FOR DELETE USING (
  public.phloz_has_role_in(workspace_id, ARRAY['owner', 'admin'])
);
