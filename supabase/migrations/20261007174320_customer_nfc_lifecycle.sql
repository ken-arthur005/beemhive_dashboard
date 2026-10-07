-- Additive lifecycle migration. The public bucket cutover is deliberately separate.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.customer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended','deleting')),
  setup_completed_at timestamptz,
  published_revision bigint,
  created_at timestamptz not null default now(),
  check (published_revision is null or published_revision >= 0)
);
create table public.profile_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null default 'profile-photos' check (bucket = 'profile-photos'),
  object_path text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  is_legacy boolean not null default false,
  created_at timestamptz not null default now(),
  -- The old bucket had no size/MIME limits. Preserve referenced legacy objects
  -- while new registry rows must meet the server upload contract.
  check (is_legacy or (content_type in ('image/jpeg','image/png','image/webp') and byte_size <= 5242880)),
  unique (bucket, object_path),
  check (split_part(object_path, '/', 1) = owner_id::text),
  check (object_path !~ '(^|/)\.\.(/|$)' and length(object_path) <= 1024)
);
alter table public.profiles add column revision bigint not null default 0 check (revision >= 0);
alter table public.profiles add column photo_asset_id uuid references public.profile_media(id) on delete set null;

create table public.profile_publications (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision >= 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published_at timestamptz not null default now(),
  primary key (user_id, revision)
);
alter table public.customer_accounts add constraint customer_publication_fk
  foreign key (user_id, published_revision) references public.profile_publications(user_id, revision)
  deferrable initially deferred;

create table public.nfc_assignments (
  id uuid primary key default gen_random_uuid(),
  nfc_item_id uuid not null references public.nfc_items(id),
  owner_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at),
  unique (nfc_item_id, id)
);
create unique index assignments_one_open_idx on public.nfc_assignments(nfc_item_id) where ended_at is null;
create index assignments_owner_history_idx on public.nfc_assignments(owner_id, nfc_item_id, started_at);

-- Discover old FK names, rather than assuming dashboard-generated constraint names.
do $$ declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid='public.nfc_items'::regclass and contype='f'
      and conkey = array[(select attnum from pg_attribute where attrelid='public.nfc_items'::regclass and attname='owner_id')]::smallint[]
  loop execute format('alter table public.nfc_items drop constraint %I', c.conname); end loop;
end $$;
alter table public.nfc_items alter column owner_id drop not null;
alter table public.nfc_items add constraint nfc_items_owner_fk foreign key(owner_id) references auth.users(id) on delete set null;
alter table public.nfc_items add column current_assignment_id uuid;
alter table public.nfc_items add column version bigint not null default 0 check (version >= 0);
alter table public.nfc_items add column retired_at timestamptz;
alter table public.nfc_items add column operation_key uuid unique;
alter table public.nfc_items add constraint item_current_assignment_fk foreign key(id, current_assignment_id)
  references public.nfc_assignments(nfc_item_id, id) deferrable initially deferred;
alter table public.nfc_items add constraint retired_items_paused check (retired_at is null or not is_active);
create index items_owner_idx on public.nfc_items(owner_id);
create index items_current_assignment_idx on public.nfc_items(current_assignment_id);
create index items_created_idx on public.nfc_items(created_at desc, id);

alter table public.tap_events alter column nfc_item_id drop not null;
alter table public.tap_events add column assignment_id uuid references public.nfc_assignments(id) on delete set null;
alter table public.tap_events add column event_type text not null default 'profile_view'
  check (event_type in ('profile_view','contact_download'));
alter table public.tap_events add constraint event_assignment_item_fk
  foreign key(nfc_item_id, assignment_id) references public.nfc_assignments(nfc_item_id,id);
alter table public.tap_events add constraint event_device_type_check
  check (device_type in ('mobile','desktop','tablet','unknown')) not valid;
alter table public.tap_events add constraint event_pii_bounds
  check (coalesce(length(ip_hash),0)<=128 and coalesce(length(referrer),0)<=2048) not valid;
create index events_assignment_time_idx on public.tap_events(assignment_id, created_at desc);
create index events_item_time_idx on public.tap_events(nfc_item_id, created_at desc);
create index events_time_idx on public.tap_events(created_at desc);
create index events_view_dedup_idx on public.tap_events(nfc_item_id, assignment_id, ip_hash, created_at desc)
  where event_type='profile_view' and ip_hash is not null;
create index profiles_photo_asset_idx on public.profiles(photo_asset_id);
create index media_owner_idx on public.profile_media(owner_id);

create table public.provisioning_operations (
  id uuid primary key,
  email text not null check (length(email) between 3 and 254),
  customer_name text not null check (length(customer_name) between 1 and 120),
  product_type text not null check (product_type in ('card','stand','round_tag')),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','invited','completed','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index provisioning_user_idx on public.provisioning_operations(user_id);
create table public.setup_grants (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  claim_id uuid,
  claim_expires_at timestamptz,
  password_updated_at timestamptz,
  purpose text not null check (purpose in ('invite','recovery')),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index setup_grants_user_idx on public.setup_grants(user_id);
create table public.customer_deletions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid, -- Intentionally survives Auth deletion; redacted on completion.
  actor_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','failed','completed')),
  object_inventory jsonb not null default '[]'::jsonb check (jsonb_typeof(object_inventory)='array'),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status='completed') = (completed_at is not null)),
  check (status <> 'completed' or (target_user_id is null and object_inventory='[]'::jsonb))
);
create unique index deletions_pending_target_idx on public.customer_deletions(target_user_id) where status <> 'completed';
create index deletions_actor_idx on public.customer_deletions(actor_id);
create table public.lifecycle_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  customer_id uuid references auth.users(id) on delete set null,
  nfc_item_id uuid references public.nfc_items(id) on delete set null,
  action text not null,
  reason text not null default '' check (length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index audit_actor_idx on public.lifecycle_audit(actor_id);
create index audit_customer_idx on public.lifecycle_audit(customer_id, created_at desc);
create index audit_item_idx on public.lifecycle_audit(nfc_item_id, created_at desc);

-- Preserve all existing content. Only customers get accounts; no publication is created.
insert into public.customer_accounts(user_id)
select user_id from public.users_roles where role='customer';
insert into public.nfc_assignments(nfc_item_id, owner_id, started_at)
select id, owner_id, coalesce(created_at, now()) from public.nfc_items;
update public.nfc_items i set current_assignment_id=a.id
from public.nfc_assignments a where a.nfc_item_id=i.id and a.ended_at is null;
-- The inspected baseline had zero events. If this changes before rollout, fail
-- rather than guessing historical ownership and silently misattributing analytics.
do $$ begin
  if exists (select 1 from public.tap_events) then
    raise exception 'Baseline tap history changed: explicit assignment backfill required';
  end if;
end $$;

-- Match by the complete URL suffix and owner prefix, never by basename alone.
-- Unknown references and the unmatched existing object are left untouched.
insert into public.profile_media(owner_id, bucket, object_path, content_type, byte_size, is_legacy)
select p.user_id, o.bucket_id, o.name, coalesce(nullif(o.metadata->>'mimetype',''),'application/octet-stream'),
  case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end, true
from public.profiles p join storage.objects o on o.bucket_id='profile-photos'
  and split_part(o.name,'/',1)=p.user_id::text
  and (p.photo_url = o.name or right(split_part(p.photo_url, '?', 1),length('/storage/v1/object/public/profile-photos/' || o.name))
    = '/storage/v1/object/public/profile-photos/' || o.name)
where true
on conflict(bucket, object_path) do nothing;
update public.profiles p set photo_asset_id=m.id from public.profile_media m
where m.owner_id=p.user_id and (p.photo_url=m.object_path
  or right(split_part(p.photo_url,'?',1),length('/storage/v1/object/public/profile-photos/' || m.object_path))
    = '/storage/v1/object/public/profile-photos/' || m.object_path);

-- Drain deferred FK checks produced by backfill before further ALTER TABLE.
set constraints all immediate;

-- RLS helper is the sole SECURITY DEFINER. Its identity comes from auth.uid(),
-- never caller-supplied UUIDs or editable user metadata.
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users_roles
    where user_id=(select auth.uid()) and role='admin');
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;
create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.is_admin(); $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- Remove legacy permissive policies regardless of their deployment-specific names.
do $$ declare r record; t text;
begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public'
    and tablename in ('users_roles','profiles','nfc_items','tap_events')
  loop execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop;
  foreach t in array array['users_roles','profiles','nfc_items','tap_events','customer_accounts',
    'profile_publications','profile_media','nfc_assignments','provisioning_operations','setup_grants','customer_deletions','lifecycle_audit']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
grant select on public.users_roles, public.profiles, public.customer_accounts, public.profile_publications,
  public.profile_media, public.nfc_items, public.nfc_assignments, public.tap_events, public.lifecycle_audit to authenticated;
grant usage, select on sequence public.tap_events_id_seq, public.lifecycle_audit_id_seq to service_role;
create policy roles_read on public.users_roles for select to authenticated
  using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy profiles_read on public.profiles for select to authenticated
  using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy accounts_read on public.customer_accounts for select to authenticated
  using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy publications_read on public.profile_publications for select to authenticated
  using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy media_read on public.profile_media for select to authenticated
  using(owner_id=(select auth.uid()) or (select private.is_admin()));
create policy items_read on public.nfc_items for select to authenticated
  using(owner_id=(select auth.uid()) or (select private.is_admin()));
create policy assignments_read on public.nfc_assignments for select to authenticated
  using(owner_id=(select auth.uid()) or (select private.is_admin()));
create policy events_read on public.tap_events for select to authenticated
  using((select private.is_admin()) or exists(select 1 from public.nfc_assignments a
    where a.id=assignment_id and a.owner_id=(select auth.uid())));
create policy audit_read on public.lifecycle_audit for select to authenticated
  using((select private.is_admin()));

create function private.require_admin(p_actor uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_actor is null or not exists(select 1 from public.users_roles where user_id=p_actor and role='admin') then
    raise exception 'Admin required' using errcode='42501';
  end if;
end $$;
create function private.immutable_publication() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='DELETE' and not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
  raise exception 'Publication snapshots are immutable' using errcode='23514';
end $$;
create trigger publications_immutable before update or delete on public.profile_publications
for each row execute function private.immutable_publication();

create function private.immutable_media() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='DELETE' and not exists(select 1 from auth.users where id=old.owner_id) then return old; end if;
  raise exception 'Media versions are immutable' using errcode='23514';
end $$;
create trigger media_immutable before update or delete on public.profile_media
for each row execute function private.immutable_media();

create function public.ensure_customer(p_user_id uuid,p_name text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  if exists(select 1 from public.users_roles where user_id=p_user_id and role <> 'customer') then
    raise exception 'Customer role conflict' using errcode='23505';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then
    raise exception 'Invalid customer name' using errcode='22023';
  end if;
  insert into public.users_roles(user_id,role) values(p_user_id,'customer') on conflict(user_id) do nothing;
  insert into public.customer_accounts(user_id) values(p_user_id) on conflict(user_id) do nothing;
  insert into public.profiles(user_id,name,links,show_save_contact)
    values(p_user_id,trim(p_name),'[]',true) on conflict(user_id) do nothing;
end $$;

create function private.validate_draft(p_draft jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare l jsonb; k text;
begin
  if p_draft is null or jsonb_typeof(p_draft)<>'object' or octet_length(p_draft::text)>32768 then
    raise exception 'Invalid draft' using errcode='22023';
  end if;
  for k in select jsonb_object_keys(p_draft) loop
    if k not in ('name','title','bio','links','show_save_contact','background','photo_asset_id') then
      raise exception 'Unknown draft field: %',k using errcode='22023';
    end if;
  end loop;
  if jsonb_typeof(p_draft->'name') is distinct from 'string'
    or length(trim(p_draft->>'name')) not between 1 and 120
    or coalesce(length(p_draft->>'title'),0)>160 or coalesce(length(p_draft->>'bio'),0)>2000
    or jsonb_typeof(p_draft->'links') is distinct from 'array'
    or jsonb_typeof(p_draft->'show_save_contact') is distinct from 'boolean' then
    raise exception 'Invalid profile content' using errcode='22023';
  end if;
  foreach k in array array['title','bio','background','photo_asset_id'] loop
    if p_draft ? k and jsonb_typeof(p_draft->k) not in ('null','string') then
      raise exception 'Invalid field type: %',k using errcode='22023';
    end if;
  end loop;
  if p_draft->>'background' is not null and p_draft->>'background' !~
    '^(#[A-Fa-f0-9]{6}|linear-gradient\([0-9]{1,3}deg, #[A-Fa-f0-9]{6}, #[A-Fa-f0-9]{6}\))$' then
    raise exception 'Invalid background' using errcode='22023';
  end if;
  if jsonb_array_length(p_draft->'links')>8 then raise exception 'Maximum 8 links' using errcode='22023'; end if;
  for l in select value from jsonb_array_elements(p_draft->'links') loop
    if jsonb_typeof(l)<>'object' or jsonb_typeof(l->'type') is distinct from 'string'
      or jsonb_typeof(l->'url') is distinct from 'string' or length(l->>'url')>2048
      or coalesce(length(l->>'label'),0)>120 or l->>'url' ~ '[[:cntrl:]]'
      or (l ? 'label' and jsonb_typeof(l->'label') not in ('null','string'))
      or (l ? 'id' and (jsonb_typeof(l->'id')<>'string' or length(l->>'id')>100))
      or l->>'type' not in ('website','instagram','twitter','linkedin','whatsapp','phone','email','custom') then
      raise exception 'Invalid link' using errcode='22023';
    end if;
    -- Empty links are allowed in drafts; publishing validates completeness.
    if l->>'url' <> '' and not (
      (l->>'type'='phone' and l->>'url' ~ '^(tel:)?[+0-9][+0-9 ()-]{2,30}$') or
      (l->>'type'='email' and l->>'url' ~ '^(mailto:)?[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
      (l->>'type' not in ('phone','email') and l->>'url' ~ '^https?://[^[:space:]]+$')) then
      raise exception 'Unsafe link URL' using errcode='22023';
    end if;
  end loop;
end $$;

create function public.save_profile_draft(p_user_id uuid,p_expected_revision bigint,p_draft jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.customer_accounts; p public.profiles; asset uuid;
begin
  select * into a from public.customer_accounts where user_id=p_user_id for update;
  if not found or a.status<>'active' or not exists(select 1 from public.users_roles where user_id=p_user_id and role='customer') then
    raise exception 'Active customer required' using errcode='42501'; end if;
  perform private.validate_draft(p_draft);
  asset := nullif(p_draft->>'photo_asset_id','')::uuid;
  if asset is not null and not exists(select 1 from public.profile_media m join storage.objects o
    on o.bucket_id=m.bucket and o.name=m.object_path where m.id=asset and m.owner_id=p_user_id) then
    raise exception 'Photo ownership mismatch' using errcode='42501';
  end if;
  update public.profiles set name=trim(p_draft->>'name'),title=p_draft->>'title',bio=p_draft->>'bio',
    links=p_draft->'links',show_save_contact=(p_draft->>'show_save_contact')::boolean,
    background=p_draft->>'background',photo_asset_id=asset,revision=revision+1,updated_at=now()
    where user_id=p_user_id and revision=p_expected_revision returning * into p;
  if not found then raise exception 'Profile revision conflict' using errcode='40001'; end if;
  return to_jsonb(p);
end $$;

create function public.publish_profile(p_user_id uuid,p_revision bigint) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.customer_accounts; p public.profiles; snapshot public.profile_publications; content jsonb;
begin
  select * into a from public.customer_accounts where user_id=p_user_id for update;
  if not found or a.status<>'active' or a.setup_completed_at is null
    or not exists(select 1 from public.users_roles where user_id=p_user_id and role='customer') then
    raise exception 'Active, setup-complete customer required' using errcode='42501'; end if;
  select * into p from public.profiles where user_id=p_user_id for update;
  if not found or p.revision is distinct from p_revision then
    raise exception 'Profile revision conflict' using errcode='40001'; end if;
  content := jsonb_build_object('name',p.name,'title',p.title,'bio',p.bio,'links',coalesce(p.links,'[]'),
    'show_save_contact',coalesce(p.show_save_contact,false),'background',p.background,'photo_asset_id',p.photo_asset_id);
  perform private.validate_draft(content);
  if exists(select 1 from jsonb_array_elements(content->'links') l where l->>'url'='') then
    raise exception 'Complete links before publishing' using errcode='22023'; end if;
  if p.photo_asset_id is not null and not exists(select 1 from public.profile_media m join storage.objects o
    on o.bucket_id=m.bucket and o.name=m.object_path where m.id=p.photo_asset_id and m.owner_id=p_user_id) then
    raise exception 'Photo ownership mismatch' using errcode='42501'; end if;
  insert into public.profile_publications(user_id,revision,content) values(p_user_id,p_revision,content)
    on conflict(user_id,revision) do nothing;
  select * into snapshot from public.profile_publications where user_id=p_user_id and revision=p_revision;
  update public.customer_accounts set published_revision=p_revision where user_id=p_user_id;
  return to_jsonb(snapshot);
end $$;

create function public.unpublish_profile(p_user_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin update public.customer_accounts set published_revision=null where user_id=p_user_id; end $$;

create function public.create_nfc_item(p_actor uuid,p_owner uuid,p_slug text,p_product_type text,p_operation_key uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare i public.nfc_items; assignment uuid;
begin
  perform private.require_admin(p_actor);
  if p_operation_key is null or p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,63}$'
    or p_product_type is null or p_product_type not in ('card','stand','round_tag') then
    raise exception 'Invalid item input' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key::text,2));
  select * into i from public.nfc_items where operation_key=p_operation_key;
  if found then
    -- Retries are tied to their original creation assignment, even after transfer.
    if i.slug<>p_slug or i.product_type<>p_product_type or p_owner is distinct from
      (select owner_id from public.nfc_assignments where nfc_item_id=i.id order by started_at,id limit 1) then
      raise exception 'Operation key payload conflict' using errcode='23505'; end if;
    return to_jsonb(i);
  end if;
  perform 1 from public.customer_accounts where user_id=p_owner and status='active' for update;
  if not found or not exists(select 1 from public.users_roles where user_id=p_owner and role='customer') then
    raise exception 'Active customer required' using errcode='42501'; end if;
  insert into public.nfc_items(slug,product_type,owner_id,operation_key)
    values(p_slug,p_product_type,p_owner,p_operation_key) returning * into i;
  insert into public.nfc_assignments(nfc_item_id,owner_id) values(i.id,p_owner) returning id into assignment;
  update public.nfc_items set current_assignment_id=assignment where id=i.id returning * into i;
  insert into public.lifecycle_audit(actor_id,customer_id,nfc_item_id,action) values(p_actor,p_owner,i.id,'create');
  return to_jsonb(i);
end $$;

create function public.manage_nfc_item(p_actor uuid,p_item uuid,p_action text,p_expected_version bigint,p_target uuid default null,p_reason text default '') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare i public.nfc_items; initial_owner uuid; assignment uuid; stamp timestamptz;
begin
  perform private.require_admin(p_actor);
  if p_action is null or p_action not in ('activate','deactivate','retire','transfer') or length(coalesce(p_reason,''))>1000 then
    raise exception 'Invalid item action' using errcode='22023'; end if;
  select owner_id into initial_owner from public.nfc_items where id=p_item;
  -- Global ordering: account UUIDs, then item UUIDs, then assignment/event rows.
  perform 1 from public.customer_accounts where user_id in (initial_owner,p_target) order by user_id for update;
  select * into i from public.nfc_items where id=p_item for update;
  if not found then raise exception 'Item not found' using errcode='P0002'; end if;
  if i.version is distinct from p_expected_version or i.owner_id is distinct from initial_owner then
    raise exception 'Item version conflict' using errcode='40001'; end if;
  if i.retired_at is not null then raise exception 'Retired item' using errcode='23514'; end if;
  stamp := clock_timestamp();
  if p_action='activate' then
    if not exists(select 1 from public.customer_accounts a join public.profile_publications p
      on p.user_id=a.user_id and p.revision=a.published_revision
      where a.user_id=i.owner_id and a.status='active' and a.setup_completed_at is not null
        and exists(select 1 from public.users_roles r where r.user_id=a.user_id and r.role='customer')) then
      raise exception 'Owner not eligible for activation' using errcode='42501'; end if;
    update public.nfc_items set is_active=true,version=version+1 where id=p_item;
  elsif p_action='deactivate' then
    update public.nfc_items set is_active=false,version=version+1 where id=p_item;
  elsif p_action='retire' then
    update public.nfc_assignments set ended_at=stamp where id=i.current_assignment_id and ended_at is null;
    update public.nfc_items set is_active=false,retired_at=stamp,current_assignment_id=null,version=version+1 where id=p_item;
  else
    if p_target is null or p_target=i.owner_id or not exists(select 1 from public.customer_accounts
      where user_id=p_target and status='active') or not exists(select 1 from public.users_roles
      where user_id=p_target and role='customer') then raise exception 'Invalid transfer target' using errcode='22023'; end if;
    update public.nfc_assignments set ended_at=stamp where id=i.current_assignment_id and ended_at is null;
    insert into public.nfc_assignments(nfc_item_id,owner_id,started_at) values(p_item,p_target,stamp) returning id into assignment;
    update public.nfc_items set owner_id=p_target,current_assignment_id=assignment,is_active=false,version=version+1 where id=p_item;
  end if;
  insert into public.lifecycle_audit(actor_id,customer_id,nfc_item_id,action,reason)
    values(p_actor,coalesce(p_target,i.owner_id),p_item,p_action,coalesce(p_reason,''));
  select * into i from public.nfc_items where id=p_item;
  return to_jsonb(i);
end $$;

create function public.set_customer_status(p_actor uuid,p_user uuid,p_status text,p_reason text default '') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.customer_accounts;
begin
  perform private.require_admin(p_actor);
  if p_status is null or p_status not in ('active','suspended') or length(coalesce(p_reason,''))>1000 then
    raise exception 'Invalid customer status' using errcode='22023'; end if;
  if not exists(select 1 from public.users_roles where user_id=p_user and role='customer') then
    raise exception 'Customer target required' using errcode='42501'; end if;
  select * into a from public.customer_accounts where user_id=p_user for update;
  if not found or a.status='deleting' then raise exception 'Customer unavailable' using errcode='42501'; end if;
  update public.customer_accounts set status=p_status where user_id=p_user returning * into a;
  insert into public.lifecycle_audit(actor_id,customer_id,action,reason) values(p_actor,p_user,p_status,coalesce(p_reason,''));
  return to_jsonb(a);
end $$;

create function public.begin_customer_deletion(p_actor uuid,p_user uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare job public.customer_deletions; inventory jsonb; stamp timestamptz;
begin
  perform private.require_admin(p_actor);
  -- Serialize retries even after Auth/account removal during external cleanup.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,3));
  select * into job from public.customer_deletions where target_user_id=p_user and status<>'completed' for update;
  if found then return to_jsonb(job); end if;
  if not exists(select 1 from public.users_roles where user_id=p_user and role='customer') then
    raise exception 'Customer target required' using errcode='42501'; end if;
  perform 1 from public.customer_accounts where user_id=p_user for update;
  if not found then raise exception 'Customer not found' using errcode='P0002'; end if;
  update public.customer_accounts set status='deleting',published_revision=null where user_id=p_user;
  perform 1 from public.nfc_items where owner_id=p_user order by id for update;
  stamp := clock_timestamp();
  update public.nfc_assignments set ended_at=stamp where owner_id=p_user and ended_at is null;
  update public.nfc_items set owner_id=null,current_assignment_id=null,is_active=false,
    retired_at=coalesce(retired_at,stamp),version=version+1 where owner_id=p_user;
  update public.tap_events e set ip_hash=null,referrer=null from public.nfc_assignments a
    where e.assignment_id=a.id and a.owner_id=p_user;
  update public.provisioning_operations set email='deleted@example.invalid',customer_name='Deleted customer',
    last_error=null where user_id=p_user;
  update public.lifecycle_audit set reason='' where customer_id=p_user;
  -- Include all owner-prefixed objects (including unregistered uploads), but
  -- leave the known unmatched object and other customers' objects untouched.
  select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'object_path',name)),'[]') into inventory
    from storage.objects where bucket_id='profile-photos' and split_part(name,'/',1)=p_user::text;
  insert into public.customer_deletions(target_user_id,actor_id,object_inventory)
    values(p_user,p_actor,inventory) returning * into job;
  insert into public.lifecycle_audit(actor_id,customer_id,action) values(p_actor,p_user,'begin_deletion');
  return to_jsonb(job);
end $$;

create function public.finish_customer_deletion(p_actor uuid,p_job uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare job public.customer_deletions;
begin
  perform private.require_admin(p_actor);
  select * into job from public.customer_deletions where id=p_job for update;
  if not found then raise exception 'Deletion job not found' using errcode='P0002'; end if;
  if job.status='completed' then return; end if;
  if exists(select 1 from auth.users where id=job.target_user_id) or exists(select 1 from storage.objects
    where bucket_id='profile-photos' and split_part(name,'/',1)=job.target_user_id::text) then
    raise exception 'Auth and Storage cleanup incomplete' using errcode='23514'; end if;
  update public.customer_deletions set target_user_id=null,object_inventory='[]',last_error=null,
    status='completed',completed_at=now() where id=p_job;
  insert into public.lifecycle_audit(actor_id,action) values(p_actor,'finish_deletion');
end $$;

create function public.resolve_public_profile(p_slug text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('item_id',i.id,'assignment_id',a.id,'owner_id',i.owner_id,
    'revision',p.revision,'content',p.content)
  from public.nfc_items i join public.nfc_assignments a on a.id=i.current_assignment_id
    and a.nfc_item_id=i.id and a.owner_id=i.owner_id and a.ended_at is null
  join public.customer_accounts c on c.user_id=i.owner_id
  join public.users_roles r on r.user_id=c.user_id and r.role='customer'
  join public.profile_publications p on p.user_id=c.user_id and p.revision=c.published_revision
  where i.slug=p_slug and i.is_active and i.retired_at is null
    and c.status='active' and c.setup_completed_at is not null;
$$;

create function public.record_profile_event(p_slug text,p_event_type text,p_ip_hash text,p_device_type text,p_referrer text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare i public.nfc_items; owner uuid; resolved jsonb; stamp timestamptz;
begin
  if p_event_type is null or p_event_type not in ('profile_view','contact_download')
    or p_device_type is null or p_device_type not in ('mobile','desktop','tablet','unknown')
    or coalesce(length(p_ip_hash),0)>128 or coalesce(length(p_referrer),0)>2048 then
    raise exception 'Invalid event input' using errcode='22023'; end if;
  select owner_id into owner from public.nfc_items where slug=p_slug;
  if owner is null then return false; end if;
  perform 1 from public.customer_accounts where user_id=owner for share;
  select * into i from public.nfc_items where slug=p_slug for update;
  if not found or i.owner_id is distinct from owner then return false; end if;
  resolved := public.resolve_public_profile(p_slug);
  if resolved is null then return false; end if;
  if p_event_type='contact_download' and not coalesce((resolved->'content'->>'show_save_contact')::boolean,false) then return false; end if;
  stamp := clock_timestamp(); -- after lock wait: the dedup window is truly sliding.
  if p_event_type='profile_view' and nullif(p_ip_hash,'') is not null and exists(
    select 1 from public.tap_events where nfc_item_id=i.id and assignment_id=i.current_assignment_id
      and event_type='profile_view' and ip_hash=p_ip_hash and created_at > stamp - interval '5 minutes') then return false; end if;
  insert into public.tap_events(nfc_item_id,assignment_id,event_type,ip_hash,device_type,referrer,created_at)
    values(i.id,i.current_assignment_id,p_event_type,nullif(p_ip_hash,''),p_device_type,p_referrer,stamp);
  return true;
end $$;

create function public.analytics_summary(p_customer uuid default null,p_days integer default 7,p_item uuid default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare today timestamptz; range_start timestamptz; range_end timestamptz; previous_start timestamptz; result jsonb;
begin
  if p_days is not null and p_days not in (7,30,90) then raise exception 'Invalid analytics range' using errcode='22023'; end if;
  today := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  range_end := today + interval '1 day';
  if p_days is null then
    select coalesce(date_trunc('day',min(e.created_at) at time zone 'UTC') at time zone 'UTC',today)
      into range_start from public.tap_events e left join public.nfc_assignments a on a.id=e.assignment_id
      where (p_customer is null or a.owner_id=p_customer) and (p_item is null or e.nfc_item_id=p_item);
    previous_start := range_start;
  else
    range_start := today - (p_days-1)*interval '1 day';
    previous_start := range_start - p_days*interval '1 day';
  end if;
  with scoped as materialized (
    select e.*, a.owner_id as event_owner from public.tap_events e
    left join public.nfc_assignments a on a.id=e.assignment_id
    where (p_customer is null or a.owner_id=p_customer) and (p_item is null or e.nfc_item_id=p_item)
      and e.created_at < range_end
  ), current_events as materialized (
    select * from scoped where created_at>=range_start
  ), totals as (
    select count(*) filter(where event_type='profile_view') as views,
      count(*) filter(where event_type='contact_download') as downloads,
      count(*) filter(where event_type='profile_view' and created_at>=today) as today_views,
      count(*) filter(where event_type='contact_download' and created_at>=today) as today_downloads,
      count(*) filter(where event_type='profile_view' and device_type='mobile') as mobile,
      count(*) filter(where event_type='profile_view' and device_type='desktop') as desktop,
      count(*) filter(where event_type='profile_view' and device_type='tablet') as tablet,
      count(*) filter(where event_type='profile_view' and device_type not in ('mobile','desktop','tablet')) as unknown
    from current_events
  ), previous as (
    select count(*) filter(where event_type='profile_view') as views,
      count(*) filter(where event_type='contact_download') as downloads
    from scoped where created_at>=previous_start and created_at<range_start
  ), daily_counts as (
    select (created_at at time zone 'UTC')::date as day,
      count(*) filter(where event_type='profile_view') as taps,
      count(*) filter(where event_type='contact_download') as downloads from current_events group by 1
  ), daily_rows as (
    select d::date as day,coalesce(c.taps,0) as taps,coalesce(c.downloads,0) as downloads
    from generate_series(range_start at time zone 'UTC',today at time zone 'UTC',interval '1 day') d
    left join daily_counts c on c.day=d::date
  ), hourly_counts as (
    select extract(hour from created_at at time zone 'UTC')::integer as hour,
      count(*) filter(where event_type='profile_view') as taps,
      count(*) filter(where event_type='contact_download') as downloads from current_events group by 1
  ), hourly_rows as (
    select h as hour,coalesce(c.taps,0) as taps,coalesce(c.downloads,0) as downloads
    from generate_series(0,23) h left join hourly_counts c on c.hour=h
  ), per_item as (
    select nfc_item_id,
      count(*) filter(where event_type='profile_view') as all_views,
      count(*) filter(where event_type='profile_view' and created_at>=range_start) as period_views,
      count(*) filter(where event_type='profile_view' and created_at>=today) as today_views,
      count(*) filter(where event_type='contact_download') as all_downloads,
      count(*) filter(where event_type='contact_download' and created_at>=range_start) as period_downloads,
      max(created_at) filter(where event_type='profile_view') as last_tap
    from scoped group by nfc_item_id
  ), card_rows as (
    select i.id,i.slug,i.product_type,i.is_active,i.retired_at,i.version,
      case when p_customer is null then i.owner_id else null end as owner_id,
      coalesce(c.all_views,0) as tap_count,coalesce(c.period_views,0) as period_taps,
      coalesce(c.today_views,0) as today_taps,coalesce(c.all_downloads,0) as downloads,
      coalesce(c.period_downloads,0) as period_downloads,c.last_tap,
      case when p_customer is null then u.email else null end as owner_email
    from public.nfc_items i left join per_item c on c.nfc_item_id=i.id
    left join auth.users u on u.id=i.owner_id and p_customer is null
    where (p_item is null or i.id=p_item) and (p_customer is null or i.owner_id=p_customer
      or exists(select 1 from public.nfc_assignments a where a.nfc_item_id=i.id and a.owner_id=p_customer))
  ), recent as (
    select e.id,e.created_at,e.device_type,e.event_type,e.nfc_item_id,e.assignment_id,
      i.slug,e.event_owner as owner_id,u.email as owner_email
    from current_events e left join public.nfc_items i on i.id=e.nfc_item_id
    left join auth.users u on u.id=e.event_owner
    order by e.created_at desc,e.id desc limit 20
  )
  select jsonb_build_object(
    'days',p_days,'rangeStart',range_start,'rangeEnd',range_end,'previousRangeStart',previous_start,
    'totalTaps',t.views,'previousTaps',p.views,'todayTaps',t.today_views,
    'contactDownloads',t.downloads,'previousContactDownloads',p.downloads,'todayContactDownloads',t.today_downloads,
    'allTimeTaps',(select count(*) from scoped where event_type='profile_view'),
    'lastTap',(select max(created_at) from scoped where event_type='profile_view'),
    'latestEvent',(select jsonb_build_object('id',id,'created_at',created_at,'event_type',event_type,
      'device_type',device_type,'nfc_item_id',nfc_item_id,'assignment_id',assignment_id)
      from current_events order by created_at desc,id desc limit 1),
    'deviceTotals',jsonb_build_object('mobile',t.mobile,'desktop',t.desktop,'tablet',t.tablet,'unknown',t.unknown),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('date',day,'taps',taps,'contactDownloads',downloads) order by day),'[]') from daily_rows),
    'hourly',(select jsonb_agg(jsonb_build_object('hour',hour,'taps',taps,'contactDownloads',downloads) order by hour) from hourly_rows),
    'cards',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'product_type',product_type,
      'is_active',is_active,'retired_at',retired_at,'version',version,'tapCount',tap_count,
      'periodTapCount',period_taps,'today',today_taps,'contactDownloads',downloads,
      'periodContactDownloads',period_downloads,'lastTap',last_tap) order by id),'[]') from card_rows),
    'leaderboard',case when p_customer is null then (select coalesce(jsonb_agg(to_jsonb(l) order by l.period_taps desc,l.id),'[]')
      from (select id,slug,product_type,tap_count,period_taps,owner_id,owner_email from card_rows order by period_taps desc,id limit 10) l) else '[]'::jsonb end,
    'recentActivity',case when p_customer is null then (select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc,id desc),'[]') from recent r) else '[]'::jsonb end
  ) into result from totals t cross join previous p;
  return result;
end $$;

-- Supabase defaults have varied over time. Neither PUBLIC nor inherited browser
-- grants may expose lifecycle functions, including read-only public resolution.
do $$ declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('ensure_customer','save_profile_draft','publish_profile',
      'unpublish_profile','create_nfc_item','manage_nfc_item','set_customer_status',
      'begin_customer_deletion','finish_customer_deletion','resolve_public_profile','record_profile_event','analytics_summary')
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
revoke all on function private.require_admin(uuid), private.validate_draft(jsonb), private.immutable_publication(), private.immutable_media()
  from public, anon, authenticated;
grant execute on function private.require_admin(uuid), private.validate_draft(jsonb), private.immutable_publication(), private.immutable_media() to service_role;
-- Snapshots cannot be mutated by the service client, either. Auth cascades still
-- clean them up and the trigger permits only deletion after the Auth row is gone.
revoke update, delete on public.profile_publications from service_role;
revoke update, delete on public.profile_media from service_role;
commit;
