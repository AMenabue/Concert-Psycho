-- Esegui in SQL Editor (aggiunte / rimozioni allineate all’app)

-- Lineup billing (Salmo / Noyz, Gemitaiz & Madman → più artist_id)
CREATE TABLE IF NOT EXISTS public.concert_lineup_artists (
  concert_id uuid NOT NULL REFERENCES public.concerts (id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists (id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (concert_id, artist_id)
);

CREATE INDEX IF NOT EXISTS concert_lineup_artists_artist_id_idx
  ON public.concert_lineup_artists (artist_id);

-- Cover: testo originale in UI; tag canale resta "Cover"
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS cover_original_artist text;

-- Era / prima volta: non più memorizzati (statistiche da storico)
ALTER TABLE public.concerts DROP COLUMN IF EXISTS era_tag;
ALTER TABLE public.concerts DROP COLUMN IF EXISTS is_first_time;

NOTIFY pgrst, 'reload schema';
