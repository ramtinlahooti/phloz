-- Pre-assign clients on an invitation. When the invitee accepts,
-- the accept-invite flow inserts one workspace_member_client_access
-- row per id in this array. Empty array (the default) means "no
-- pre-assignment" — the existing behaviour. Only meaningful for
-- member + viewer invitations under the "Restricted by assignment"
-- workspace policy; admins and owners always see every client.

ALTER TABLE "invitations"
ADD COLUMN IF NOT EXISTS "pending_client_ids" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
