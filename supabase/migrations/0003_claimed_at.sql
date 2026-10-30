-- When a worker claimed the clip, so a second worker (GitHub Actions vs. the owner's PC)
-- only takes over uploads that are clearly stuck, never one still in progress.
alter table public.clips add column if not exists claimed_at timestamptz;
notify pgrst, 'reload schema';
