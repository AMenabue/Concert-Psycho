-- Distinguish Setlist.fm billing splits (Gemitaiz & Madman) from opening acts in line-up.
ALTER TABLE public.gig_lineup_artists
  ADD COLUMN IF NOT EXISTS is_co_headliner boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS gig_lineup_artists_co_headliner_idx
  ON public.gig_lineup_artists (gig_id)
  WHERE is_co_headliner = true;

NOTIFY pgrst, 'reload schema';
