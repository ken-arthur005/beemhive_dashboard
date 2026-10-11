-- The hosted service role does not inherit Auth-table reads. Only the two
-- directory columns used by internal analytics/lifecycle functions are granted.
grant select(id,email) on auth.users to service_role;
