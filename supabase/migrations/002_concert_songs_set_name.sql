-- Nome del set Setlist.fm (es. "Main Set", "Acoustic") per ogni brano
ALTER TABLE public.concert_songs ADD COLUMN IF NOT EXISTS set_name text;
