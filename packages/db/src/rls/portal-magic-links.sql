-- RLS for portal_magic_links.
-- Default deny for authenticated users — this table is accessed exclusively
-- via the service role in server code (magic link issuance + validation).

ALTER TABLE public.portal_magic_links ENABLE ROW LEVEL SECURITY;

-- No policies. Service role bypasses RLS. No authenticated role may read or
-- write magic-link tokens.
