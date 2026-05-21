-- home_locations: RLS alone is not enough — authenticated needs table GRANTs
-- (same fix as 013_concert_lineup_artists_grants.sql).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.home_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.home_locations TO service_role;

-- Idempotent: ensure RLS policies exist if 012 was skipped or partially applied
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

NOTIFY pgrst, 'reload schema';
