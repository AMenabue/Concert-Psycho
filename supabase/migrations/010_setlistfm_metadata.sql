-- Metadati Setlist.fm (versioning, URL attribuzione, venue id, geografia, durata, tape, profilo sync)

-- Venue: id Setlist + URL + geo estesa
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS setlistfm_venue_id text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS setlistfm_url text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS city_geo_id text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS state_code text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS country_code text;

CREATE UNIQUE INDEX IF NOT EXISTS venues_setlistfm_venue_id_uidx
  ON public.venues (setlistfm_venue_id)
  WHERE setlistfm_venue_id IS NOT NULL;

-- Concerto: sync Setlist + JSON orari opzionali + durata (manuale o da API in futuro)
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS setlistfm_version_id text;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS setlistfm_last_updated timestamptz;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS setlistfm_url text;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS setlistfm_artist_url text;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS setlistfm_venue_url text;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS setlistfm_clock_json jsonb;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS concert_duration_minutes integer;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS setlistfm_info text;

CREATE UNIQUE INDEX IF NOT EXISTS concerts_user_setlistfm_setlist_id_uidx
  ON public.concerts (user_id, setlistfm_setlist_id)
  WHERE setlistfm_setlist_id IS NOT NULL;

-- Brani: tape (importato, nascosto in UI) + mbid autore cover
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS is_tape boolean NOT NULL DEFAULT false;
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS cover_original_artist_mbid text;

-- Username Setlist.fm (path /user/{userId}) per import attended
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS setlistfm_user_id text;

NOTIFY pgrst, 'reload schema';
