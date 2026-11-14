-- Rapli LP: allow the CD collection module in the maintained RapliLab cloud bridge.
-- Original historical migration updated for clean installations of PR #1.
ALTER TABLE public.rapli_module_collections
  DROP CONSTRAINT IF EXISTS rapli_module_collections_module_check;
ALTER TABLE public.rapli_module_collections
  ADD CONSTRAINT rapli_module_collections_module_check
  CHECK (module = ANY (ARRAY[
    'sports'::text,'stickers'::text,'tools'::text,'lp'::text
  ]));
