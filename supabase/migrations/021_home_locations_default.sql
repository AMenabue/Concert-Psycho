-- One default departure home per user (used when adding/editing concerts with no departure yet)
ALTER TABLE public.home_locations
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS home_locations_one_default_per_user
  ON public.home_locations (user_id)
  WHERE is_default = true;

NOTIFY pgrst, 'reload schema';
