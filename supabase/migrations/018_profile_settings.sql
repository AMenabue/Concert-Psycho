-- Profile display & avatar for settings page
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS profile_tagline text;

-- Default tagline for existing users
UPDATE public.profiles
SET profile_tagline = COALESCE(NULLIF(TRIM(profile_tagline), ''), 'My concert log')
WHERE profile_tagline IS NULL;
