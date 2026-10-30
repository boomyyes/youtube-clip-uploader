-- Clip numbers are assigned at upload, so the number shown on the upload page is exact.
-- Each new clip takes the lowest number not held by that user's clips in that game. Rejecting a clip frees its
-- number (the reject action sets seq = null), and the next upload reuses it: no gaps, order may differ slightly.

-- volatile (the default) on purpose: it must see rows committed by a concurrent upload after the lock is taken.
create function public.next_free_seq(p_user uuid, p_game text) returns int
language sql set search_path = '' as $$
  select min(s)::int
  from generate_series(1, (select count(*)::int + 1 from public.clips where user_id = p_user and game = p_game and seq is not null)) s
  where not exists (select 1 from public.clips where user_id = p_user and game = p_game and seq = s)
$$;

create function public.assign_clip_seq() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || '/' || new.game));
  new.seq := coalesce(new.seq, public.next_free_seq(new.user_id, new.game));
  return new;
end $$;

create trigger clips_assign_seq before insert on public.clips
  for each row execute function public.assign_clip_seq();

-- Approval keeps the clip's number (falls back to the lowest free one for any clip without a number).
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
    description = public.clip_description(who, c.created_at, c.note),
    approved_etag = p_etag,
    approved_at = now()
  where id = p_clip
  returning * into c;
  return c;
end $$;

-- Backfill: clips already waiting for review get their number now, oldest first.
do $$
declare r record;
begin
  for r in select id, user_id, game from public.clips where status = 'queued' and seq is null order by created_at loop
    update public.clips set seq = public.next_free_seq(r.user_id, r.game) where id = r.id;
  end loop;
end $$;

revoke execute on function public.next_free_seq(uuid, text) from public, anon, authenticated;
revoke execute on function public.assign_clip_seq() from public, anon, authenticated;

notify pgrst, 'reload schema';
