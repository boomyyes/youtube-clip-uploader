-- Optional custom title from the uploader, put in front of the generated one:
-- "Insane 1v5 clutch | Boomy's clip in Valorant #3". YouTube rejects < and >, and caps titles at 100 characters.
alter table public.clips
  add column custom_title text check (char_length(custom_title) between 1 and 50 and custom_title !~ '[<>]');

-- Approval as in 0009, plus the custom title.
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
    title = left(coalesce(c.custom_title || ' | ', '') || public.clip_title(who, c.game, n), 100),
    description = public.clip_description(who, c.created_at, c.note) || case when c.format = 'short' then E'\n\n#Shorts' else '' end,
    approved_etag = p_etag,
    approved_at = now()
  where id = p_clip
  returning * into c;
  return c;
end $$;

notify pgrst, 'reload schema';
