-- Additive: immutable publications and historical event totals are preserved.
begin;

alter table public.profiles add column photo_shape text not null default 'arch'
  check (photo_shape in ('arch','square','circle','rounded'));

alter function private.validate_draft(jsonb) rename to validate_draft_v1;
create function private.validate_draft(p_draft jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare sanitized jsonb; l jsonb;
begin
  if jsonb_typeof(p_draft) is distinct from 'object' then
    raise exception 'Invalid draft' using errcode='22023'; end if;
  if p_draft ? 'photo_shape' and (jsonb_typeof(p_draft->'photo_shape') is distinct from 'string'
    or p_draft->>'photo_shape' not in ('arch','square','circle','rounded')) then
    raise exception 'Invalid photo style' using errcode='22023'; end if;
  sanitized := p_draft - 'photo_shape';
  if jsonb_typeof(p_draft->'links')='array' then
    for l in select value from jsonb_array_elements(p_draft->'links') loop
      if l->>'type'='phone' and (jsonb_typeof(l->'url') is distinct from 'string'
        or length(l->>'url')>40 or l->>'url' !~ '^(tel:)?[+0-9 ()-]*$') then
        raise exception 'Invalid phone number' using errcode='22023'; end if;
      if l ? 'phone_country' and (jsonb_typeof(l->'phone_country') is distinct from 'string'
        or l->>'phone_country' !~ '^[A-Z]{2}$') then
        raise exception 'Invalid phone country' using errcode='22023'; end if;
    end loop;
    -- Reuse the original content/URL bounds, without changing stored link types.
    select coalesce(jsonb_agg(case when value->>'type'='snapchat' then jsonb_set(value,'{type}','"custom"')
      when value->>'type'='phone' then jsonb_set(value,'{url}','""') else value end),'[]')
      into sanitized from jsonb_array_elements(p_draft->'links');
    sanitized := jsonb_set(p_draft - 'photo_shape','{links}',sanitized);
  end if;
  perform private.validate_draft_v1(sanitized);
end $$;

alter function public.save_profile_draft(uuid,bigint,jsonb) rename to save_profile_draft_v1;
create function public.save_profile_draft(p_user_id uuid,p_expected_revision bigint,p_draft jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb; shape text;
begin
  perform private.validate_draft(p_draft);
  result := public.save_profile_draft_v1(p_user_id,p_expected_revision,p_draft - 'photo_shape');
  update public.profiles set photo_shape=coalesce(p_draft->>'photo_shape',photo_shape)
    where user_id=p_user_id returning photo_shape into shape;
  return result || jsonb_build_object('photo_shape',shape);
end $$;

create or replace function public.publish_profile(p_user_id uuid,p_revision bigint) returns jsonb
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
    'show_save_contact',coalesce(p.show_save_contact,false),'background',p.background,
    'photo_asset_id',p.photo_asset_id,'photo_shape',p.photo_shape);
  perform private.validate_draft(content);
  if exists(select 1 from jsonb_array_elements(content->'links') l where l->>'url'=''
    or (l->>'type'='phone' and l->>'url' !~ '^\+[1-9][0-9]{6,14}$')) then
    raise exception 'Complete links and use international phone numbers before publishing' using errcode='22023'; end if;
  if p.photo_asset_id is not null and not exists(select 1 from public.profile_media m join storage.objects o
    on o.bucket_id=m.bucket and o.name=m.object_path where m.id=p.photo_asset_id and m.owner_id=p_user_id) then
    raise exception 'Photo ownership mismatch' using errcode='42501'; end if;
  insert into public.profile_publications(user_id,revision,content) values(p_user_id,p_revision,content)
    on conflict(user_id,revision) do nothing;
  select * into snapshot from public.profile_publications where user_id=p_user_id and revision=p_revision;
  update public.customer_accounts set published_revision=p_revision where user_id=p_user_id;
  return to_jsonb(snapshot);
end $$;

-- Cookie-derived, owner-scoped HMACs use the existing identity-hash column.
-- Legacy IP hashes are never interpreted as browser identities. Existing
-- deletion anonymization already clears this column and the referrer.
alter table public.tap_events drop constraint tap_events_event_type_check;
alter table public.tap_events add constraint tap_events_event_type_check
  check (event_type in ('profile_view','contact_download','link_click'));
alter table public.tap_events add column event_id uuid;
alter table public.tap_events add column visit_id uuid;
alter table public.tap_events add column profile_revision bigint;
alter table public.tap_events add column link_index integer check (link_index between 0 and 7);
create unique index events_idempotency_idx on public.tap_events(event_id) where event_id is not null;
create index events_visit_idx on public.tap_events(visit_id) where visit_id is not null;
create index events_browser_identity_idx on public.tap_events(assignment_id,ip_hash,created_at)
  where visit_id is not null and ip_hash is not null;

create function public.record_profile_interaction(p_slug text,p_event_type text,p_visitor_hash text,
  p_device_type text,p_referrer text,p_event_id uuid,p_visit_id uuid,p_revision bigint,p_link_index integer default null) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare i public.nfc_items; owner uuid; resolved jsonb; identity_hash text;
begin
  if p_event_id is null or p_visit_id is null or p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$'
    or p_event_type is null or p_event_type not in ('profile_view','link_click','contact_download')
    or p_device_type is null or p_device_type not in ('mobile','desktop','tablet','unknown')
    or coalesce(length(p_referrer),0)>2048 then
    raise exception 'Invalid interaction' using errcode='22023'; end if;
  select owner_id into owner from public.nfc_items where slug=p_slug;
  if owner is null then return false; end if;
  perform 1 from public.customer_accounts where user_id=owner for share;
  select * into i from public.nfc_items where slug=p_slug for update;
  if not found or i.owner_id is distinct from owner then return false; end if;
  resolved := public.resolve_public_profile(p_slug);
  if resolved is null or (p_revision is null and p_event_type<>'contact_download')
    or (p_revision is not null and (resolved->>'revision')::bigint is distinct from p_revision) then return false; end if;
  identity_hash := encode(sha256(convert_to(owner::text || ':' || p_visitor_hash,'UTF8')),'hex');
  if p_event_type='link_click' then
    if p_link_index is null or p_link_index<0 or p_link_index>=jsonb_array_length(resolved->'content'->'links') then return false; end if;
    if not exists(select 1 from public.tap_events where visit_id=p_visit_id and assignment_id=i.current_assignment_id
      and ip_hash=identity_hash and event_type='profile_view' and profile_revision=p_revision) then return false; end if;
  end if;
  if p_event_type='contact_download' and not coalesce((resolved->'content'->>'show_save_contact')::boolean,false) then return false; end if;
  -- Bound repeated automated submissions per browser/item without discarding
  -- genuine return visits. Replays of an event UUID are atomically idempotent.
  if (select count(*) from public.tap_events where assignment_id=i.current_assignment_id and ip_hash=identity_hash
    and event_id is not null and created_at>clock_timestamp()-interval '1 minute')>=120 then return false; end if;
  insert into public.tap_events(nfc_item_id,assignment_id,event_type,ip_hash,device_type,referrer,event_id,visit_id,profile_revision,link_index)
    values(i.id,i.current_assignment_id,p_event_type,identity_hash,p_device_type,p_referrer,p_event_id,p_visit_id,(resolved->>'revision')::bigint,
      case when p_event_type='link_click' then p_link_index else null end)
    on conflict(event_id) where event_id is not null do nothing;
  return found;
end $$;

create function public.fetch_tracked_contact(p_slug text,p_visitor_hash text,p_device_type text,p_referrer text,p_event_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.record_profile_interaction(p_slug,'contact_download',p_visitor_hash,p_device_type,p_referrer,p_event_id,p_event_id,null,null);
  return public.resolve_public_profile(p_slug);
end $$;

-- Preserve the established UTC buckets, assignment ownership, admin totals,
-- and historical data. Add browser metrics over the same server-side scope.
alter function public.analytics_summary(uuid,integer,uuid) rename to analytics_totals_v1;
create function public.analytics_summary(p_customer uuid default null,p_days integer default 7,p_item uuid default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare base jsonb; extra jsonb;
begin
  base := public.analytics_totals_v1(p_customer,p_days,p_item);
  with scoped as materialized (
    select e.* from public.tap_events e left join public.nfc_assignments a on a.id=e.assignment_id
    where (p_customer is null or a.owner_id=p_customer) and (p_item is null or e.nfc_item_id=p_item)
      and e.created_at>=(base->>'rangeStart')::timestamptz and e.created_at<(base->>'rangeEnd')::timestamptz
  ), views as materialized (
    select * from scoped where event_type='profile_view' and visit_id is not null and ip_hash is not null
  ), visitors as (
    select ip_hash,count(*) as visits from views group by ip_hash
  ), conversions as (
    select count(distinct e.ip_hash) filter(where e.event_type='link_click') as clickers,
      count(distinct e.ip_hash) filter(where e.event_type='contact_download') as savers
    from scoped e where e.visit_id is not null and exists(select 1 from visitors v where v.ip_hash=e.ip_hash)
  ), daily as (
    select jsonb_agg(d || jsonb_build_object('uniqueVisitors',
      (select count(distinct ip_hash) from views where (created_at at time zone 'UTC')::date=(d->>'date')::date)) order by d->>'date') as rows
    from jsonb_array_elements(base->'daily') d
  ), cards as (
    select jsonb_agg(c || jsonb_build_object('uniqueVisitors',
      (select count(distinct ip_hash) from views where nfc_item_id=(c->>'id')::uuid)) order by c->>'id') as rows
    from jsonb_array_elements(base->'cards') c
  )
  select jsonb_build_object(
    'uniqueVisitors',(select count(*) from visitors),
    'repeatVisitors',(select count(*) from visitors where visits>1),
    'trackedViews',(select count(*) from views),
    'legacyViews',(select count(*) from scoped where event_type='profile_view' and (visit_id is null or ip_hash is null)),
    'totalClicks',(select count(*) from scoped where event_type='link_click'),
    'uniqueClickers',c.clickers,'uniqueContactSavers',c.savers,
    'uniqueCtr',case when (select count(*) from visitors)>0 then round(100.0*c.clickers/(select count(*) from visitors),2) else null end,
    'contactConversionRate',case when (select count(*) from visitors)>0 then round(100.0*c.savers/(select count(*) from visitors),2) else null end,
    'daily',coalesce((select rows from daily),'[]'), 'cards',coalesce((select rows from cards),'[]')
  ) into extra from conversions c;
  return base || extra;
end $$;

revoke all on function private.validate_draft(jsonb) from public,anon,authenticated;
grant execute on function private.validate_draft(jsonb) to service_role;
revoke all on function public.save_profile_draft(uuid,bigint,jsonb),public.analytics_summary(uuid,integer,uuid),
  public.record_profile_interaction(text,text,text,text,text,uuid,uuid,bigint,integer),
  public.fetch_tracked_contact(text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.save_profile_draft(uuid,bigint,jsonb),public.analytics_summary(uuid,integer,uuid),
  public.record_profile_interaction(text,text,text,text,text,uuid,uuid,bigint,integer),
  public.fetch_tracked_contact(text,text,text,text,uuid) to service_role;

commit;
