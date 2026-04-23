-- Supabase Custom Access Token Hook: copies user_metadata.active_workspace_id
-- into the JWT claims so RLS policies and app code can read the active
-- workspace without a DB round-trip.
--
-- To enable:
--   1. Apply this migration to your Supabase Postgres.
--   2. In Supabase dashboard, Authentication > Hooks > Custom Access Token.
--   3. Choose `public.phloz_custom_access_token_hook`.
--   4. Grant execute on the function to supabase_auth_admin.
--
-- See https://supabase.com/docs/guides/auth/auth-hooks.

CREATE OR REPLACE FUNCTION public.phloz_custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_id uuid;
  active_ws uuid;
  meta jsonb;
BEGIN
  user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';

  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = user_id;

  IF meta IS NOT NULL AND meta ? 'active_workspace_id' THEN
    active_ws := (meta ->> 'active_workspace_id')::uuid;
    claims := jsonb_set(claims, '{active_workspace_id}', to_jsonb(active_ws));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.phloz_custom_access_token_hook(jsonb)
  TO supabase_auth_admin;
