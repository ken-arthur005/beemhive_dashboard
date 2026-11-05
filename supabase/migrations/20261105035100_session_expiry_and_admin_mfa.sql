begin;

-- App inactivity is independent of Auth token refresh. An expired row can never be touched back to life.
create table public.app_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  last_activity_at timestamptz not null,
  revoked_at timestamptz,
  check (last_activity_at >= started_at)
);
create index app_sessions_user_idx on public.app_sessions(user_id);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.app_sessions to service_role;
-- Read only these Auth columns. No Auth-schema objects or session records are changed.
grant select(id,user_id,created_at) on auth.sessions to service_role;

create function public.check_app_session(p_user uuid,p_session uuid,p_touch boolean default false) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.app_sessions; started timestamptz; r text; idle interval; lifetime interval;
  t timestamptz; absolute_end timestamptz; idle_end timestamptz;
begin
  select created_at into started from auth.sessions where id=p_session and user_id=p_user;
  if started is null then return jsonb_build_object('valid',false); end if;
  select role into r from public.users_roles where user_id=p_user;
  -- Pending setup gets customer limits, never administrator privileges.
  idle := case when r='admin' then interval '30 minutes' else interval '24 hours' end;
  lifetime := case when r='admin' then interval '8 hours' else interval '7 days' end;
  insert into public.app_sessions(session_id,user_id,started_at,last_activity_at)
    values(p_session,p_user,started,started) on conflict(session_id) do nothing;
  select * into s from public.app_sessions where session_id=p_session for update;
  -- Evaluate the deadline after any lock wait, not when this request first arrived.
  t := clock_timestamp();
  if s.user_id is distinct from p_user then return jsonb_build_object('valid',false); end if;
  if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then
    return jsonb_build_object('valid',false); end if;
  absolute_end := s.started_at+lifetime;
  idle_end := least(s.last_activity_at+idle,absolute_end);
  if s.revoked_at is not null or t>=idle_end then
    update public.app_sessions set revoked_at=coalesce(revoked_at,t) where session_id=p_session;
    return jsonb_build_object('valid',false);
  end if;
  if p_touch then
    update public.app_sessions set last_activity_at=greatest(last_activity_at,t) where session_id=p_session;
    idle_end := least(t+idle,absolute_end);
  end if;
  return jsonb_build_object('valid',true,'expiresAt',absolute_end,'idleExpiresAt',idle_end,'serverNow',t);
end $$;
revoke all on function public.check_app_session(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.check_app_session(uuid,uuid,boolean) to service_role;

-- Necessary private definer: identity-bound lookup of Auth/session/role rows without RLS recursion.
-- No caller IDs, dynamic SQL, writes, or exposed-schema definer functions.
create function private.has_app_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_sessions s
    join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
    join public.users_roles r on r.user_id=s.user_id
    where s.user_id=(select auth.uid())
      and s.session_id=nullif((select auth.jwt()->>'session_id'),'')::uuid
      and s.revoked_at is null
      and now()<s.started_at+case when r.role='admin' then interval '8 hours' else interval '7 days' end
      and now()<s.last_activity_at+case when r.role='admin' then interval '30 minutes' else interval '24 hours' end
      and ((r.role='admin' and (select auth.jwt()->>'aal')='aal2')
        or (r.role='customer' and exists(select 1 from public.customer_accounts c where c.user_id=s.user_id and c.status='active')))
  );
$$;
revoke all on function private.has_app_access() from public, anon, authenticated, service_role;
grant execute on function private.has_app_access() to authenticated;

-- Restrictive policies also fence the existing direct, read-only Data API path.
do $$ declare t text;
begin
  foreach t in array array['users_roles','profiles','customer_accounts','profile_publications',
    'profile_media','nfc_items','nfc_assignments','tap_events','lifecycle_audit'] loop
    execute format('create policy app_session_required on public.%I as restrictive for select to authenticated using ((select private.has_app_access()))',t);
  end loop;
end $$;

commit;
