-- Album per riga scaletta: valorizzabile in futuro da MusicBrainz / enrichment (l’API Setlist.fm non espone l’album sul brano).
ALTER TABLE public.gig_songs
  ADD COLUMN IF NOT EXISTS album_title text;

COMMENT ON COLUMN public.gig_songs.album_title IS
  'Titolo album opzionale per statistiche; non fornito dalla risposta JSON standard Setlist.fm.';

NOTIFY pgrst, 'reload schema';
