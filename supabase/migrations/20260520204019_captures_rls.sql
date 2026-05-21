alter table public.captures enable row level security;

create policy "users read own captures"
  on public.captures for select
  using (auth.uid() = user_id);

create policy "users insert own captures"
  on public.captures for insert
  with check (auth.uid() = user_id);

create policy "users update own captures"
  on public.captures for update
  using (auth.uid() = user_id);

create policy "users delete own captures"
  on public.captures for delete
  using (auth.uid() = user_id);
