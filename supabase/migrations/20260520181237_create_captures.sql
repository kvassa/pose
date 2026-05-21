create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_id uuid references public.references(id) on delete set null,
  match_score int,
  image_path text,
  created_at timestamptz default now()
);

create index on public.captures (user_id, created_at desc);
