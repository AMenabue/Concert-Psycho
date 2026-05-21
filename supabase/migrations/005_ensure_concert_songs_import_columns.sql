-- Idempotente: aggiunge colonne mancanti se 002/003 non erano state applicate sul progetto remoto.
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS set_name text;
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS featuring_names text;
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS song_info text;

-- Aggiorna la cache dello schema PostgREST (evita "could not find column in schema cache").
NOTIFY pgrst, 'reload schema';
