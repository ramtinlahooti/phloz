-- V2 tables (ARCHITECTURE.md §5.4) are scaffolded but unused in V1.
-- We enable RLS with a default-deny posture so nothing leaks if someone
-- writes to them before proper policies land.
--
-- When a V2 feature begins, add per-table policy files alongside the
-- V1 ones and remove the corresponding line here.

ALTER TABLE public.ad_platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_node_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_rules ENABLE ROW LEVEL SECURITY;

-- No policies = default deny. Service role bypasses.
