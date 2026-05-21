insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do update set public = false;

create policy "users read own captures"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users insert own captures"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own captures"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own captures"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
