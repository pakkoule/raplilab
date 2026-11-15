-- Rapli Lab / PR #1 : retire exclusively Dragon Blanc catalogue storage.
-- The pairing tables (rapli_archive_members, rapli_archive_pair_codes,
-- rapli_archive_pair_attempts) MUST remain for Sports/Regatta device linking.
-- The private Storage bucket is shared with Sports/Regatta and MUST remain.
-- Storage image objects must be removed separately through the Supabase Storage API.
DROP TABLE IF EXISTS public.rapli_archive_collections;
