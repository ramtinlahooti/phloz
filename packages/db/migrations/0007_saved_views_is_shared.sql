-- Workspace-shared variant of saved views. When `is_shared = true`
-- the row appears in every workspace member's picker (still
-- owned/edited by `user_id`; only the creator can rename/delete).
-- The decision to gate creation to owner/admin lives in the
-- `createSavedViewAction` role check, not in RLS.

ALTER TABLE "saved_views"
ADD COLUMN IF NOT EXISTS "is_shared" boolean DEFAULT false NOT NULL;

-- Replace the SELECT policy so members also see workspace-shared
-- rows. INSERT / UPDATE / DELETE policies stay creator-only.
DROP POLICY IF EXISTS "saved_views_select" ON "saved_views";

CREATE POLICY "saved_views_select" ON "saved_views"
FOR SELECT USING (
  public.phloz_is_member_of(workspace_id)
  AND (user_id = auth.uid() OR is_shared = true)
);
