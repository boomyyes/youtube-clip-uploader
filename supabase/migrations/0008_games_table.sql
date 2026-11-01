-- The game list moves from code (lib/games.ts) to the database, so the owner can edit it on /admin.
-- Upload forms subscribe to changes through Supabase Realtime and update live.
create table public.games (
  name text primary key check (char_length(name) between 1 and 40 and name !~ '[<>]'),
  created_at timestamptz not null default now()
);
-- "valorant" and "Valorant" would get separate clip numbers, so names are unique ignoring case.
create unique index games_name_lower_idx on public.games (lower(name));

insert into public.games (name) values ('Valorant'), ('Minecraft'), ('Arc Raiders'), ('The Finals'), ('Roblox'), ('Other');

alter table public.games enable row level security;
-- Signed-in users read the list (and receive Realtime changes); only the server (owner actions) writes.
create policy "signed-in users read games" on public.games for select to authenticated using (true);
grant select on public.games to authenticated;

alter publication supabase_realtime add table public.games;

notify pgrst, 'reload schema';
