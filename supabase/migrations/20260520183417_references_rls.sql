alter table public.references enable row level security;

create policy "users read own references"
  on public.references for select
  using (auth.uid() = user_id);

create policy "users insert own references"
  on public.references for insert
  with check (auth.uid() = user_id);

create policy "users update own references"
  on public.references for update
  using (auth.uid() = user_id);

create policy "users delete own references"
  on public.references for delete
  using (auth.uid() = user_id);
