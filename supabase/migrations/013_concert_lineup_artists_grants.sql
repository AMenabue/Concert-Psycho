-- Privilegi su concert_lineup_artists: "permission denied" può venire da mancanza di GRANT
-- (RLS da solo non basta se il ruolo non ha USAGE/SELECT sulla tabella).
-- Se hai già RLS attivo, applica anche `011_concert_lineup_rls_profiles_update.sql`.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.concert_lineup_artists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.concert_lineup_artists TO service_role;

NOTIFY pgrst, 'reload schema';
