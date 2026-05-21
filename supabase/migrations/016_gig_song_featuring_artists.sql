-- Ogni featuring su un brano collegato a `artists` (non solo il primo).

CREATE TABLE public.gig_song_featuring_artists (
  gig_song_id uuid NOT NULL REFERENCES public.gig_songs (id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists (id),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (gig_song_id, artist_id)
);

CREATE INDEX gig_song_featuring_artists_artist_id_idx
  ON public.gig_song_featuring_artists (artist_id);

ALTER TABLE public.gig_song_featuring_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY gig_song_featuring_select_own ON public.gig_song_featuring_artists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.gig_songs gs
      JOIN public.gig_attendances ga ON ga.gig_id = gs.gig_id
      WHERE gs.id = gig_song_featuring_artists.gig_song_id
        AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_song_featuring_insert_own ON public.gig_song_featuring_artists
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.gig_songs gs
      JOIN public.gig_attendances ga ON ga.gig_id = gs.gig_id
      WHERE gs.id = gig_song_featuring_artists.gig_song_id
        AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_song_featuring_delete_own ON public.gig_song_featuring_artists
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.gig_songs gs
      JOIN public.gig_attendances ga ON ga.gig_id = gs.gig_id
      WHERE gs.id = gig_song_featuring_artists.gig_song_id
        AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_song_featuring_update_own ON public.gig_song_featuring_artists
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.gig_songs gs
      JOIN public.gig_attendances ga ON ga.gig_id = gs.gig_id
      WHERE gs.id = gig_song_featuring_artists.gig_song_id
        AND ga.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.gig_songs gs
      JOIN public.gig_attendances ga ON ga.gig_id = gs.gig_id
      WHERE gs.id = gig_song_featuring_artists.gig_song_id
        AND ga.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gig_song_featuring_artists TO authenticated, service_role;

-- Backfill da colonna legacy (un ospite per brano).
INSERT INTO public.gig_song_featuring_artists (gig_song_id, artist_id, sort_order)
SELECT id, guest_artist_id, 0
FROM public.gig_songs
WHERE guest_artist_id IS NOT NULL
ON CONFLICT (gig_song_id, artist_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
