create table public.references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  thumbnail_path text,
  status text not null default 'processing',
  keypoints jsonb,
  bounding_box jsonb,
  scene_tags text[],
  error_message text,
  created_at timestamptz default now()
);

create index on public.references (user_id, created_at desc);
