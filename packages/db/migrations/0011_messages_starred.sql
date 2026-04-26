-- Per-message "needs follow-up" flag. Lets users pin a thread to the
-- top of the inbox so it isn't pushed off the first page by newer
-- traffic. Defaults to false; existing rows backfill cleanly.
-- Indexed for the inbox sort (starred DESC, created_at DESC).

ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "starred" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "messages_starred_created_at_idx"
ON "messages" ("workspace_id", "starred", "created_at" DESC);
