-- Task 4.3: on references INSERT, POST to enqueue-pose-extraction via pg_net.
create extension if not exists pg_net with schema extensions;

create or replace function public.enqueue_pose_extraction_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://pxlzkqcmctdxvxnueguu.supabase.co/functions/v1/enqueue-pose-extraction',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
end;
$$;

create trigger references_insert_enqueue_pose_extraction
  after insert on public.references
  for each row
  execute function public.enqueue_pose_extraction_on_insert();
