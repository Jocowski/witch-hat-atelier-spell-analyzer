-- Harden the SECURITY DEFINER functions. Addresses the Supabase database linter:
--   0011 function_search_path_mutable      — a definer function with a mutable search_path can be
--                                            hijacked via search_path injection.
--   0028/0029 *_security_definer_function_executable — the trigger helper is needlessly exposed
--                                            over PostgREST (/rest/v1/rpc/...).
-- Both functions already schema-qualify every reference (public.profiles, auth.uid()), so pinning
-- search_path to '' is safe.

alter function public.is_admin()        set search_path = '';
alter function public.handle_new_user() set search_path = '';

-- handle_new_user is a trigger function — never meant to be called directly via the API.
-- The on_auth_user_created trigger still fires (it runs as the table owner), so revoking EXECUTE
-- from the API roles does NOT break signup.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- is_admin() intentionally stays executable: RLS policies call it as the querying role, so revoking
-- EXECUTE would break those policies. Its RPC only reveals whether the *caller* is an admin.
