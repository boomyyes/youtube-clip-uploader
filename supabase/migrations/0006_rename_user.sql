-- Users can change their display name. Titles/descriptions come from one formula (used by approval).
-- A new name applies only to clips approved afterwards: approved titles are what the owner reviewed,
-- so a rename must never change them (or a user could approve-then-rename past moderation).

-- YouTube rejects < and > in titles/descriptions.
create function public.clip_title(who text, game text, n int) returns text
language sql immutable set search_path = '' as $$
  select left(translate(who, '<>', '') || '''s clip in ' || game || ' #' || n, 100)
$$;

-- shortcut: date shown in India time (the owner's zone); make it per-user if users span zones.
create function public.clip_description(who text, created timestamptz, note text) returns text
language sql stable set search_path = '' as $$
  select 'Uploaded by ' || translate(who, '<>', '') || ' on ' || to_char(created at time zone 'Asia/Kolkata', 'DD Mon YYYY')
    || coalesce(E'\n\n' || translate(nullif(note, ''), '<>', ''), '')
$$;

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
  select coalesce(max(seq), 0) + 1 into n from public.clips where user_id = c.user_id and game = c.game;
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

-- Renames a user. Already-approved clips keep the title the owner approved.
create function public.rename_user(p_user uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  name text := btrim(p_name);
begin
  if char_length(name) not between 1 and 40 then raise exception 'Name must be 1 to 40 characters'; end if;
  update public.profiles set display_name = name where id = p_user;
  if not found then raise exception 'No such user'; end if;
end $$;

revoke execute on function public.clip_title(text, text, int) from public, anon, authenticated;
revoke execute on function public.clip_description(text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.rename_user(uuid, text) from public, anon, authenticated;
grant execute on function public.rename_user(uuid, text) to service_role;

notify pgrst, 'reload schema';
