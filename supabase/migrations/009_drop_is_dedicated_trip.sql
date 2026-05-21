-- Rimuove il flag «viaggio dedicato solo a questo concerto» (non usato)
ALTER TABLE public.concerts DROP COLUMN IF EXISTS is_dedicated_trip;

NOTIFY pgrst, 'reload schema';
