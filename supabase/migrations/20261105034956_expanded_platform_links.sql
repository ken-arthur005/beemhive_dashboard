-- Additive: preserve stored types, draft revisions, immutable publications and the eight-link limit.
begin;

create or replace function private.validate_draft(p_draft jsonb) returns void
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
      if l->>'type' is null or l->>'type' not in (
        'instagram','facebook','tiktok','twitter','youtube','bluesky','snapchat','pinterest','threads','reddit',
        'linkedin','telegram','whatsapp','messenger','discord','twitch','github','spotify','soundcloud','applemusic',
        'website','phone','email','googlemaps','googlereviews','googledrive','appstore','location','custom') then
        raise exception 'Invalid link type' using errcode='22023'; end if;
      if l->>'type'='phone' and (jsonb_typeof(l->'url') is distinct from 'string'
        or length(l->>'url')>40 or l->>'url' !~ '^(tel:)?[+0-9 ()-]*$') then
        raise exception 'Invalid phone number' using errcode='22023'; end if;
      if l ? 'phone_country' and (jsonb_typeof(l->'phone_country') is distinct from 'string'
        or l->>'phone_country' !~ '^[A-Z]{2}$') then
        raise exception 'Invalid phone country' using errcode='22023'; end if;
    end loop;
    -- Adapt only the validation copy to the original validator's types; persist the original JSON.
    select coalesce(jsonb_agg(case
      when value->>'type'='phone' then jsonb_set(value,'{url}','""')
      when value->>'type' not in ('website','instagram','twitter','linkedin','whatsapp','email','custom')
        then jsonb_set(value,'{type}','"custom"') else value end),'[]')
      into sanitized from jsonb_array_elements(p_draft->'links');
    sanitized := jsonb_set(p_draft - 'photo_shape','{links}',sanitized);
  end if;
  perform private.validate_draft_v1(sanitized);
end $$;
revoke all on function private.validate_draft(jsonb) from public, anon, authenticated;
grant execute on function private.validate_draft(jsonb) to service_role;

commit;
