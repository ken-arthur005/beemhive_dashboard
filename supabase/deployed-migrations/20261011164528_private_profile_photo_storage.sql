-- Tracked separately because storage privacy is coordinated with app cutover.
update storage.buckets set public=false,file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='profile-photos';
drop policy if exists profile_photos_server_only on storage.objects;
create policy profile_photos_server_only on storage.objects as restrictive
  for all to anon,authenticated using(bucket_id<>'profile-photos') with check(bucket_id<>'profile-photos');
