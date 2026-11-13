-- Rapli Regatta — module complémentaire sans création de table.
-- Le module utilise la table existante avec les mêmes règles RLS et le bucket privé.
-- Migration appliquée au projet Supabase RapliLab le 13/11/2026.
ALTER TABLE public.rapli_module_collections
  DROP CONSTRAINT IF EXISTS rapli_module_collections_module_check;

ALTER TABLE public.rapli_module_collections
  ADD CONSTRAINT rapli_module_collections_module_check
  CHECK (module IN (
    'time', 'sports', 'refs', 'stickers', 'tools',
    'tiers', 'top10', 'coach', 'lp', 'regatta'
  ));
