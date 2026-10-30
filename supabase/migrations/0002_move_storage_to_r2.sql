-- Clips moved from Supabase Storage to Cloudflare R2. Run once in the SQL editor
-- (only needed if you ran the first version of 0001). Then delete the empty "clips"
-- bucket in Supabase: Storage -> clips -> Delete bucket.
drop function if exists public.orphan_clip_files();
