insert into storage.buckets (id, name, public)
values ('reference-images', 'reference-images', false)
on conflict (id) do update set public = false;

create policy "users read own reference images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users insert own reference images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own reference images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own reference images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
