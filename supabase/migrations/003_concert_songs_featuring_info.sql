-- Featuring multipli (testo unico) e campo info Setlist.fm (live debut, snippet, …)
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS featuring_names text;
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS song_info text;
