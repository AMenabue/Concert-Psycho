-- Distanza linea d'aria partenza → venue
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS travel_km double precision;

-- Coordinate punto di partenza (con città/paese già presenti su concerts)
-- Nota: in PostgreSQL è ADD COLUMN IF NOT EXISTS (non "IF EXISTS").
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS departure_lat double precision;
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS departure_lng double precision;

-- Case "casa" / home dell'utente
CREATE TABLE IF NOT EXISTS public.home_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  label text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS home_locations_user_id_idx ON public.home_locations (user_id);
