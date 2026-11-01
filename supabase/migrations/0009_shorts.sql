-- YouTube Shorts. YouTube has no Short flag: vertical/square clips of 3 minutes or less become Shorts.
-- format = what the uploader chose; transform = what the worker does to the file so YouTube shows that format
-- (crop a wide clip to 9:16 for a Short, pad a vertical clip to 16:9 for a regular video). See lib/shorts.mjs.
alter table public.clips
  add column format text not null default 'regular' check (format in ('short', 'regular')),
  add column transform text not null default 'none' check (transform in ('none', 'crop', 'pad'));

-- Uploaders may see the format of their own clips (My clips).
grant select (format) on public.clips to authenticated;

-- Approval as in 0007, plus #Shorts in the description for Shorts.
create or replace function public.approve_clip(p_clip uuid, p_etag text) returns public.clips
language plpgsql security definer set search_path = '' as $$
declare
  c public.clips;
  who text;
  n int;
begin
  select * into c from public.clips where id = p_clip and status = 'queued' for update;
  if not found then raise exception 'clip % is not waiting for approval', p_clip; end if;
  perform pg_advisory_xact_lock(hashtext(c.user_id::text || '/' || c.game));
  n := coalesce(c.seq, public.next_free_seq(c.user_id, c.game));
  select display_name into who from public.profiles where id = c.user_id;
  update public.clips set
    status = 'approved',
    seq = n,
    title = public.clip_title(who, c.game, n),
    description = public.clip_description(who, c.created_at, c.note) || case when c.format = 'short' then E'\n\n#Shorts' else '' end,
    approved_etag = p_etag,
    approved_at = now()
  where id = p_clip
  returning * into c;
  return c;
end $$;

notify pgrst, 'reload schema';
