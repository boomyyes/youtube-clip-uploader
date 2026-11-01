-- Simple editing at upload: keep only part of the clip (trim) and choose where a Short is cropped from.
-- The worker applies both with ffmpeg (lib/shorts.mjs). null = untouched / centre crop.
alter table public.clips
  add column trim_start numeric check (trim_start >= 0),
  add column trim_end numeric,
  add column crop_x real check (crop_x between 0 and 1),
  add constraint clips_trim_check check ((trim_start is null) = (trim_end is null) and trim_end - trim_start >= 1);

notify pgrst, 'reload schema';
