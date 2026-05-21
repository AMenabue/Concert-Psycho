-- Corregge "Database error saving new user": trigger su auth.users che fallisce
-- (RLS, colonne mancanti, search_path, owner della funzione).
--
-- Esegui da Supabase Dashboard → SQL Editor, oppure: supabase db push / link

-- Funzione: SECURITY DEFINER + owner postgres = insert su public.profiles non bloccato da RLS.
-- search_path vuoto + nomi qualificati (raccomandazione Supabase).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    home_city,
    home_country,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(
        TRIM(
          COALESCE(
            NEW.raw_user_meta_data ->> 'display_name',
            NEW.raw_user_meta_data ->> 'full_name'
          )
        ),
        ''
      ),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NULL,
    NULL,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
