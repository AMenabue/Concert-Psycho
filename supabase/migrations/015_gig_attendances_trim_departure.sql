-- Rimuove campi non usati da gig_attendances + coordinate partenza (solo città/paese + travel_km calcolato)
ALTER TABLE public.gig_attendances DROP COLUMN IF EXISTS is_vip;
ALTER TABLE public.gig_attendances DROP COLUMN IF EXISTS is_resale;
ALTER TABLE public.gig_attendances DROP COLUMN IF EXISTS ticket_vendor;
ALTER TABLE public.gig_attendances DROP COLUMN IF EXISTS departure_lat;
ALTER TABLE public.gig_attendances DROP COLUMN IF EXISTS departure_lng;

NOTIFY pgrst, 'reload schema';
