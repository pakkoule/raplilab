-- Rapli Regatta — support the final active modules only.
-- Archives uses its separate tables. Retired keys are not allowed.
ALTER TABLE public.rapli_module_collections
  DROP CONSTRAINT IF EXISTS rapli_module_collections_module_check;
ALTER TABLE public.rapli_module_collections
  ADD CONSTRAINT rapli_module_collections_module_check
  CHECK (module = ANY (ARRAY[
    'sports'::text,'stickers'::text,'tools'::text,'lp'::text,'regatta'::text
  ]));
