-- Tag normalizzati (Live Debut, New Song, …) riusabili per filtri e statistiche
CREATE TABLE IF NOT EXISTS public.song_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT song_tags_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS song_tags_label_lower_idx ON public.song_tags (lower(trim(label)));

CREATE TABLE IF NOT EXISTS public.concert_song_tags (
  concert_song_id uuid NOT NULL REFERENCES public.concert_songs (id) ON DELETE CASCADE,
  song_tag_id uuid NOT NULL REFERENCES public.song_tags (id) ON DELETE CASCADE,
  PRIMARY KEY (concert_song_id, song_tag_id)
);

CREATE INDEX IF NOT EXISTS concert_song_tags_song_tag_id_idx ON public.concert_song_tags (song_tag_id);
