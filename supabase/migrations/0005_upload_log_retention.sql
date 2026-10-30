-- Upload records outlive account deletion (for copyright/abuse complaints), so they carry the
-- uploader's email; uploader_id may then point at a deleted user. Kept 12 months (worker prunes).
alter table public.upload_log add column if not exists uploader_email text;
update public.upload_log l set uploader_email = p.email from public.profiles p where p.id = l.uploader_id and l.uploader_email is null;
notify pgrst, 'reload schema';
