-- RLS su concert_lineup_artists (fix "permission denied" da client autenticato)
-- + policy UPDATE per eventuali modifiche future

ALTER TABLE public.concert_lineup_artists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "concert_lineup_artists_select_own" ON public.concert_lineup_artists;
CREATE POLICY "concert_lineup_artists_select_own"
  ON public.concert_lineup_artists
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.concerts c
      WHERE c.id = concert_lineup_artists.concert_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "concert_lineup_artists_insert_own" ON public.concert_lineup_artists;
CREATE POLICY "concert_lineup_artists_insert_own"
  ON public.concert_lineup_artists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.concerts c
      WHERE c.id = concert_lineup_artists.concert_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "concert_lineup_artists_delete_own" ON public.concert_lineup_artists;
CREATE POLICY "concert_lineup_artists_delete_own"
  ON public.concert_lineup_artists
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.concerts c
      WHERE c.id = concert_lineup_artists.concert_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "concert_lineup_artists_update_own" ON public.concert_lineup_artists;
CREATE POLICY "concert_lineup_artists_update_own"
  ON public.concert_lineup_artists
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.concerts c
      WHERE c.id = concert_lineup_artists.concert_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.concerts c
      WHERE c.id = concert_lineup_artists.concert_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

-- Profilo: salvataggio user id Setlist.fm dalla dashboard
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
