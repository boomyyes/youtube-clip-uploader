-- 1. Fingerprint (R2 ETag) of the file the owner approved. The worker only uploads bytes that
--    still match it, so a file swapped after review never reaches YouTube.
alter table public.clips add column if not exists approved_etag text;

-- 2. Uploaders may read only the display columns of their own clips. upload_session_url is a
--    live YouTube upload credential and must never reach a browser.
revoke select on public.clips from authenticated;
grant select (id, user_id, game, title, status, reject_reason, youtube_video_id, created_at) on public.clips to authenticated;

-- 3. Approval records the approved file's ETag in the same transaction, so the worker never
--    sees an approved clip without it.
drop function if exists public.approve_clip(uuid);
create function public.approve_clip(p_clip uuid, p_etag text) returns public.clips
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
  -- YouTube rejects < and > in titles/descriptions.
  select translate(display_name, '<>', '') into who from public.profiles where id = c.user_id;
  update public.clips set
    status = 'approved',
    seq = n,
    title = left(who || '''s clip in ' || c.game || ' #' || n, 100),
    -- shortcut: date shown in India time (the owner's zone); make it per-user if users span zones.
    description = 'Uploaded by ' || who || ' on ' || to_char(c.created_at at time zone 'Asia/Kolkata', 'DD Mon YYYY')
      || coalesce(E'\n\n' || translate(nullif(c.note, ''), '<>', ''), ''),
    approved_etag = p_etag,
    approved_at = now()
  where id = p_clip
  returning * into c;
  return c;
end $$;
revoke execute on function public.approve_clip(uuid, text) from public, anon, authenticated;
grant execute on function public.approve_clip(uuid, text) to service_role;

notify pgrst, 'reload schema';
