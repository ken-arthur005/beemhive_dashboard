begin;
create function private.lock_setup_grant(p_token_hash text,p_user_id uuid) returns public.setup_grants
language plpgsql security invoker set search_path='' as $$
declare g public.setup_grants; a public.customer_accounts; user_role text;
begin
  perform pg_advisory_xact_lock(hashtextextended('setup:'||p_user_id::text,10));
  select role into user_role from public.users_roles where user_id=p_user_id;
  if user_role is null or user_role not in ('admin','customer') then raise exception 'account_inactive' using errcode='42501'; end if;
  if user_role='customer' then
    select * into a from public.customer_accounts where user_id=p_user_id for update;
    if not found or a.status<>'active' then raise exception 'account_inactive' using errcode='42501'; end if;
  end if;
  select * into g from public.setup_grants where token_hash=p_token_hash and user_id=p_user_id for update;
  if not found or g.purpose not in ('invite','recovery') then raise exception 'invalid_grant' using errcode='42501'; end if;
  if user_role='admin' and g.purpose<>'recovery' then raise exception 'invalid_grant' using errcode='42501'; end if;
  if g.expires_at<=clock_timestamp() then raise exception 'grant_expired' using errcode='42501'; end if;
  return g;
end $$;

create function public.claim_setup_grant(p_token_hash text,p_user_id uuid,p_claim_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.setup_grants;
begin
  g:=private.lock_setup_grant(p_token_hash,p_user_id);
  if p_claim_id is null then raise exception 'invalid_grant' using errcode='42501'; end if;
  if g.consumed_at is not null then
    if exists(select 1 from public.users_roles where user_id=p_user_id and role='admin') or
      exists(select 1 from public.customer_accounts where user_id=p_user_id and setup_completed_at is not null) then
      return jsonb_build_object('state','completed'); end if;
    raise exception 'invalid_grant' using errcode='42501';
  end if;
  if g.password_updated_at is null and exists(select 1 from public.setup_grants where user_id=p_user_id
    and consumed_at is null and claim_id is not null and claim_id<>p_claim_id and claim_expires_at>clock_timestamp()
    and password_updated_at is null) then raise exception 'grant_busy' using errcode='40001'; end if;
  update public.setup_grants set claim_id=p_claim_id,claim_expires_at=clock_timestamp()+interval '2 minutes'
    where token_hash=p_token_hash;
  return jsonb_build_object('state',case when g.password_updated_at is null then 'ready' else 'password_updated' end);
end $$;

create function public.mark_setup_password_updated(p_token_hash text,p_user_id uuid,p_claim_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.setup_grants;
begin
  g:=private.lock_setup_grant(p_token_hash,p_user_id);
  if g.claim_id is distinct from p_claim_id or g.consumed_at is not null or g.claim_expires_at<=clock_timestamp() then
    raise exception 'invalid_grant' using errcode='42501'; end if;
  update public.setup_grants set password_updated_at=coalesce(password_updated_at,clock_timestamp()) where token_hash=p_token_hash;
  return jsonb_build_object('success',true);
end $$;

create function public.complete_setup_grant(p_token_hash text,p_user_id uuid,p_claim_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.setup_grants;
begin
  g:=private.lock_setup_grant(p_token_hash,p_user_id);
  if g.consumed_at is not null and (exists(select 1 from public.users_roles where user_id=p_user_id and role='admin') or
    exists(select 1 from public.customer_accounts where user_id=p_user_id and setup_completed_at is not null)) then
    return jsonb_build_object('success',true); end if;
  if g.claim_id is distinct from p_claim_id or g.password_updated_at is null or g.claim_expires_at<=clock_timestamp() then
    raise exception 'invalid_grant' using errcode='42501'; end if;
  update public.customer_accounts set setup_completed_at=coalesce(setup_completed_at,clock_timestamp()) where user_id=p_user_id
    and exists(select 1 from public.users_roles where user_id=p_user_id and role='customer');
  update public.setup_grants set consumed_at=coalesce(consumed_at,clock_timestamp()) where token_hash=p_token_hash;
  return jsonb_build_object('success',true);
end $$;

create function public.release_setup_grant(p_token_hash text,p_user_id uuid,p_claim_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.setup_grants;
begin
  g:=private.lock_setup_grant(p_token_hash,p_user_id);
  if g.claim_id is distinct from p_claim_id or g.consumed_at is not null or g.password_updated_at is not null then
    raise exception 'invalid_grant' using errcode='42501'; end if;
  update public.setup_grants set claim_id=null,claim_expires_at=null where token_hash=p_token_hash;
  return jsonb_build_object('success',true);
end $$;

alter table public.provisioning_operations add column lease_until timestamptz;
create function public.claim_provisioning(p_id uuid,p_email text,p_name text,p_product_type text,p_slug text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare op public.provisioning_operations;
begin
  insert into public.provisioning_operations(id,email,customer_name,product_type,slug)
    values(p_id,p_email,p_name,p_product_type,p_slug) on conflict(id) do nothing;
  select * into op from public.provisioning_operations where id=p_id for update;
  if op.email<>p_email or op.customer_name<>p_name or op.product_type<>p_product_type or op.slug<>p_slug then
    raise exception 'Operation key payload conflict' using errcode='23505'; end if;
  if op.status='completed' then return to_jsonb(op); end if;
  if op.lease_until>clock_timestamp() then raise exception 'Operation in progress' using errcode='40001'; end if;
  update public.provisioning_operations set lease_until=clock_timestamp()+interval '90 seconds',updated_at=clock_timestamp()
    where id=p_id returning * into op;
  return to_jsonb(op);
end $$;

-- Forgotten/replayed operation keys cannot bypass per-recipient email throttling.
create table public.setup_email_requests(user_id uuid primary key references auth.users(id) on delete cascade,requested_at timestamptz not null);
alter table public.setup_email_requests enable row level security;
revoke all on public.setup_email_requests from public,anon,authenticated;
grant select,insert,update,delete on public.setup_email_requests to service_role;
create function public.claim_setup_email(p_actor uuid,p_user uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare accepted uuid;
begin
  perform private.require_admin(p_actor);
  perform 1 from public.customer_accounts a join public.users_roles r on r.user_id=a.user_id
    where a.user_id=p_user and a.status='active' and r.role='customer' for update of a;
  if not found then raise exception 'Active customer required' using errcode='42501'; end if;
  insert into public.setup_email_requests(user_id,requested_at) values(p_user,clock_timestamp())
    on conflict(user_id) do update set requested_at=excluded.requested_at
    where setup_email_requests.requested_at<clock_timestamp()-interval '1 minute' returning user_id into accepted;
  if accepted is null then raise exception 'email_rate_limit' using errcode='22023'; end if;
end $$;

create function public.register_profile_media(p_user uuid,p_id uuid,p_path text,p_size bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare asset public.profile_media;
begin
  perform 1 from public.customer_accounts where user_id=p_user and status='active' for update;
  if not found or not exists(select 1 from public.users_roles where user_id=p_user and role='customer') then
    raise exception 'Active customer required' using errcode='42501'; end if;
  if not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=p_path) then
    raise exception 'Uploaded object not found' using errcode='22023'; end if;
  insert into public.profile_media(id,owner_id,bucket,object_path,content_type,byte_size)
    values(p_id,p_user,'profile-photos',p_path,'image/jpeg',p_size) returning * into asset;
  return to_jsonb(asset);
end $$;

create function public.refresh_deletion_inventory(p_actor uuid,p_job uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.customer_deletions;
begin
  perform private.require_admin(p_actor);
  select * into job from public.customer_deletions where id=p_job for update;
  if not found then raise exception 'Deletion job not found' using errcode='P0002'; end if;
  if job.status='completed' then return to_jsonb(job); end if;
  update public.customer_deletions set object_inventory=(select coalesce(jsonb_agg(
    jsonb_build_object('bucket',bucket_id,'object_path',name)),'[]') from storage.objects
    where bucket_id='profile-photos' and split_part(name,'/',1)=job.target_user_id::text)
    where id=p_job returning * into job;
  return to_jsonb(job);
end $$;

create function public.verify_customer_absent(p_user uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select not exists(select 1 from auth.users where id=p_user)
    and not exists(select 1 from public.profiles where user_id=p_user)
    and not exists(select 1 from public.nfc_items where owner_id=p_user)
    and not exists(select 1 from storage.objects where bucket_id='profile-photos' and split_part(name,'/',1)=p_user::text)
    and not exists(select 1 from public.customer_deletions where target_user_id=p_user and status<>'completed');
$$;

create function private.immutable_item_slug() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.slug is distinct from new.slug then raise exception 'Physical item URLs are immutable' using errcode='23514'; end if;
  return new;
end $$;
create trigger item_slug_immutable before update of slug on public.nfc_items
  for each row execute function private.immutable_item_slug();
revoke all on function private.immutable_item_slug() from public,anon,authenticated;
grant execute on function private.immutable_item_slug() to service_role;

-- Capture the exact publication under the same locks as event attribution.
-- This avoids logging a transfer recipient while returning the previous owner's contact.
create function public.fetch_public_profile(p_slug text,p_event_type text,p_ip_hash text,p_device_type text,p_referrer text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare recorded boolean;
begin
  recorded:=public.record_profile_event(p_slug,p_event_type,p_ip_hash,p_device_type,p_referrer);
  if p_event_type='contact_download' and not recorded then return null; end if;
  return public.resolve_public_profile(p_slug);
end $$;

revoke all on function private.lock_setup_grant(text,uuid) from public,anon,authenticated;
grant execute on function private.lock_setup_grant(text,uuid) to service_role;
do $$ declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('claim_setup_grant','mark_setup_password_updated','complete_setup_grant',
      'release_setup_grant','claim_provisioning','claim_setup_email','fetch_public_profile',
      'register_profile_media','refresh_deletion_inventory','verify_customer_absent')
  loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
