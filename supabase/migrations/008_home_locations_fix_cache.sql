-- Se vedi: "Could not find the table 'public.home_locations' in the schema cache"
-- 1) assicurati che la tabella esista (già in 006_travel_km_home_locations.sql)
-- 2) esegui questo per far ricaricare lo schema a PostgREST

NOTIFY pgrst, 'reload schema';
