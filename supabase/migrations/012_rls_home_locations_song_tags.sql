-- RLS per tabelle usate dal client autenticato (oltre a concert_lineup_artists → già 011).

-- ---------------------------------------------------------------------------
-- home_locations: solo le righe dell’utente loggato
-- ---------------------------------------------------------------------------
ALTER TABLE public.home_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_locations_select_own" ON public.home_locations;
CREATE POLICY "home_locations_select_own"
  ON public.home_locations FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "home_locations_insert_own" ON public.home_locations;
CREATE POLICY "home_locations_insert_own"
  ON public.home_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "home_locations_update_own" ON public.home_locations;
CREATE POLICY "home_locations_update_own"
  ON public.home_locations FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "home_locations_delete_own" ON public.home_locations;
CREATE POLICY "home_locations_delete_own"
  ON public.home_locations FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- concert_song_tags: solo canzoni di concerti dell’utente (anche CASCADE delete)
-- ---------------------------------------------------------------------------
ALTER TABLE public.concert_song_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "concert_song_tags_select_own" ON public.concert_song_tags;
CREATE POLICY "concert_song_tags_select_own"
  ON public.concert_song_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.concert_songs cs
      JOIN public.concerts c ON c.id = cs.concert_id
      WHERE cs.id = concert_song_tags.concert_song_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "concert_song_tags_insert_own" ON public.concert_song_tags;
CREATE POLICY "concert_song_tags_insert_own"
  ON public.concert_song_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.concert_songs cs
      JOIN public.concerts c ON c.id = cs.concert_id
      WHERE cs.id = concert_song_tags.concert_song_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "concert_song_tags_delete_own" ON public.concert_song_tags;
CREATE POLICY "concert_song_tags_delete_own"
  ON public.concert_song_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.concert_songs cs
      JOIN public.concerts c ON c.id = cs.concert_id
      WHERE cs.id = concert_song_tags.concert_song_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- song_tags: catalogo globale (lettura + creazione nuovi slug dall’app)
-- ---------------------------------------------------------------------------
ALTER TABLE public.song_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "song_tags_select_all" ON public.song_tags;
CREATE POLICY "song_tags_select_all"
  ON public.song_tags FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "song_tags_insert_all" ON public.song_tags;
CREATE POLICY "song_tags_insert_all"
  ON public.song_tags FOR INSERT TO authenticated
  WITH CHECK (true);

-- Aggiorna la cache API (PostgREST) dopo DDL su policy/tabelle
NOTIFY pgrst, 'reload schema';
