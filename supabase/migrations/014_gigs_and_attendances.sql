-- Concerti condivisi (gigs) + partecipazione utente (gig_attendances).
-- Elimina i dati legacy su concerts / concert_songs / … e ricrea il modello multi-utente.
-- Tabelle non usate dall’app (openers, concert_trips) vengono droppate senza ricreazione.

DROP TABLE IF EXISTS public.concert_song_tags CASCADE;
DROP TABLE IF EXISTS public.concert_songs CASCADE;
DROP TABLE IF EXISTS public.concert_lineup_artists CASCADE;
DROP TABLE IF EXISTS public.concert_trips CASCADE;
DROP TABLE IF EXISTS public.openers CASCADE;
DROP TABLE IF EXISTS public.concerts CASCADE;

CREATE TABLE public.gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists (id),
  venue_id uuid NOT NULL REFERENCES public.venues (id),
  gig_date date NOT NULL,
  start_time time without time zone,
  tour_name text,
  is_festival boolean NOT NULL DEFAULT false,
  was_cancelled boolean NOT NULL DEFAULT false,
  source text DEFAULT 'manual',
  setlistfm_setlist_id text,
  setlistfm_version_id text,
  setlistfm_last_updated timestamptz,
  setlistfm_url text,
  setlistfm_artist_url text,
  setlistfm_venue_url text,
  setlistfm_clock_json jsonb,
  setlistfm_info text,
  concert_duration_minutes integer,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX gigs_setlistfm_setlist_id_uidx
  ON public.gigs (setlistfm_setlist_id)
  WHERE (setlistfm_setlist_id IS NOT NULL);

CREATE INDEX gigs_artist_id_idx ON public.gigs (artist_id);
CREATE INDEX gigs_venue_id_idx ON public.gigs (venue_id);
CREATE INDEX gigs_gig_date_idx ON public.gigs (gig_date);

CREATE TABLE public.gig_attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  gig_id uuid NOT NULL REFERENCES public.gigs (id) ON DELETE CASCADE,
  sector text,
  is_standing boolean NOT NULL DEFAULT false,
  is_vip boolean NOT NULL DEFAULT false,
  ticket_price_cents integer,
  ticket_currency text DEFAULT 'EUR'::text,
  ticket_vendor text,
  days_bought_in_advance integer,
  is_resale boolean DEFAULT false,
  departure_city text,
  departure_country text,
  departure_lat double precision,
  departure_lng double precision,
  travel_km double precision,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT gig_attendances_user_gig_uidx UNIQUE (user_id, gig_id)
);

CREATE INDEX gig_attendances_user_id_idx ON public.gig_attendances (user_id);
CREATE INDEX gig_attendances_gig_id_idx ON public.gig_attendances (gig_id);

CREATE TABLE public.gig_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs (id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL,
  is_encore boolean DEFAULT false,
  is_cover boolean DEFAULT false,
  is_tape boolean NOT NULL DEFAULT false,
  guest_artist_id uuid REFERENCES public.artists (id),
  set_name text,
  featuring_names text,
  song_info text,
  cover_original_artist text,
  cover_original_artist_mbid text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX gig_songs_gig_id_idx ON public.gig_songs (gig_id);

CREATE TABLE public.gig_lineup_artists (
  gig_id uuid NOT NULL REFERENCES public.gigs (id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists (id),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (gig_id, artist_id)
);

CREATE INDEX gig_lineup_artists_artist_id_idx ON public.gig_lineup_artists (artist_id);

CREATE TABLE public.gig_song_tags (
  gig_song_id uuid NOT NULL REFERENCES public.gig_songs (id) ON DELETE CASCADE,
  song_tag_id uuid NOT NULL REFERENCES public.song_tags (id) ON DELETE CASCADE,
  PRIMARY KEY (gig_song_id, song_tag_id)
);

CREATE INDEX gig_song_tags_song_tag_id_idx ON public.gig_song_tags (song_tag_id);

-- RLS
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_lineup_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_song_tags ENABLE ROW LEVEL SECURITY;

-- gigs: tutti gli autenticati leggono (dedup import); solo chi partecipa aggiorna; insert libero; delete solo orfani
CREATE POLICY gigs_select_authenticated ON public.gigs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY gigs_insert_authenticated ON public.gigs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY gigs_update_attendees ON public.gigs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gigs.id AND ga.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gigs.id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gigs_delete_orphan ON public.gigs
  FOR DELETE TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.gig_attendances ga WHERE ga.gig_id = gigs.id)
  );

CREATE POLICY ga_select_own ON public.gig_attendances
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY ga_insert_own ON public.gig_attendances
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ga_update_own ON public.gig_attendances
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ga_delete_own ON public.gig_attendances
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY gig_songs_select_own ON public.gig_songs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_songs.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_songs_insert_own ON public.gig_songs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_songs.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_songs_update_own ON public.gig_songs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_songs.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_songs.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_songs_delete_own ON public.gig_songs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_songs.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_lineup_select_own ON public.gig_lineup_artists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_lineup_artists.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_lineup_insert_own ON public.gig_lineup_artists
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_lineup_artists.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_lineup_delete_own ON public.gig_lineup_artists
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_lineup_artists.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_lineup_update_own ON public.gig_lineup_artists
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_lineup_artists.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gig_attendances ga
      WHERE ga.gig_id = gig_lineup_artists.gig_id AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_song_tags_select_own ON public.gig_song_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.gig_songs gs
      JOIN public.gig_attendances ga ON ga.gig_id = gs.gig_id
      WHERE gs.id = gig_song_tags.gig_song_id
        AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_song_tags_insert_own ON public.gig_song_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.gig_songs gs
      JOIN public.gig_attendances ga ON ga.gig_id = gs.gig_id
      WHERE gs.id = gig_song_tags.gig_song_id
        AND ga.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY gig_song_tags_delete_own ON public.gig_song_tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.gig_songs gs
      JOIN public.gig_attendances ga ON ga.gig_id = gs.gig_id
      WHERE gs.id = gig_song_tags.gig_song_id
        AND ga.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gigs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gig_attendances TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gig_songs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gig_lineup_artists TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gig_song_tags TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
