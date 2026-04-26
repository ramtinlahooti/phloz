-- Resolved `@<token>` mentions on internal notes, mirroring the
-- existing `comments.mentions` shape. Populated by the
-- `postInternalNoteAction` mention-fan-out path; readers query
-- with `mentions @> ARRAY[<user_id>]` to surface "messages that
-- mention me". GIN index covers that lookup.
--
-- Email-channel + portal-channel messages stay empty — the parser
-- runs only on internal notes (mentions in agency↔client email
-- bodies don't make sense; the recipient is the client, not a
-- workspace member).

ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "mentions" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS "messages_mentions_gin_idx"
ON "messages" USING GIN ("mentions");
