-- Run once in the Supabase SQL editor.

-- Users ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select using ((select auth.uid()) = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- YouTube connection (one row, server-only: RLS on, no policies) -------
create table public.youtube_connection (
  id int primary key default 1 check (id = 1),
  refresh_token_enc text not null,
  channel_id text not null,
  channel_title text not null,
  revoked boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.youtube_connection enable row level security;

-- Clips: the row is also the upload job ----------------------------------
create table public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  game text not null check (char_length(game) between 1 and 40),
  note text check (char_length(note) <= 500),
  storage_path text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'approved', 'uploading', 'on_youtube', 'public', 'rejected', 'failed')),
  seq int,
  title text,
  description text,
  reject_reason text,
  youtube_video_id text,
  upload_session_url text,
  upload_session_started_at timestamptz,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  uploaded_at timestamptz,
  unique (user_id, game, seq)
);
alter table public.clips enable row level security;
create policy "read own clips" on public.clips for select using ((select auth.uid()) = user_id);
create index clips_status_idx on public.clips (status, approved_at);

-- Audit trail of every YouTube upload (server-only) ----------------------
create table public.upload_log (
  id bigint generated always as identity primary key,
  clip_id uuid not null,
  uploader_id uuid not null,
  youtube_video_id text not null,
  uploaded_at timestamptz not null default now()
);
alter table public.upload_log enable row level security;

-- Approve: numbers the clip and fills title/description in one transaction.
-- The advisory lock serializes approvals per (user, game) so numbers never collide.
create function public.approve_clip(p_clip uuid) returns public.clips
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
    approved_at = now()
  where id = p_clip
  returning * into c;
  return c;
end $$;

-- Explicit grants: new projects may not auto-expose tables to the Data API.
-- Signed-in users only read their own rows (RLS above); every write goes through the server's secret key.
grant select on public.profiles, public.clips to authenticated;
grant all on public.profiles, public.clips, public.youtube_connection, public.upload_log to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.approve_clip(uuid) from public, anon, authenticated;
grant execute on function public.approve_clip(uuid) to service_role;

-- Clip files live in Cloudflare R2, not Supabase Storage. `storage_path` is the R2 object key.
