-- Run separately AFTER deploying gated photo streaming and server-only writes.
-- Deliberately not in migrations/: the initial migration must not cut over media.
-- Existing objects, including unmatched legacy objects, are never deleted here.
begin;
update storage.buckets set public=false, file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id='profile-photos';

-- A restrictive policy fences this bucket even if a legacy broad permissive
-- policy remains. Other buckets retain their existing policy behavior.
drop policy if exists profile_photos_server_only on storage.objects;
create policy profile_photos_server_only on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'profile-photos')
with check (bucket_id <> 'profile-photos');
commit;
