-- Last time the member visited /[workspace]/mentions. Used to
-- compute the "new since you last looked" badge in the sidebar.
-- NULL = never visited (everything counts as unread until they
-- open the inbox).

ALTER TABLE "workspace_members"
ADD COLUMN IF NOT EXISTS "mentions_seen_at" timestamptz;
