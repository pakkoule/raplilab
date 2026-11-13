-- Add Rapli Coach without deleting existing module data or changing RLS.
ALTER TABLE public.rapli_module_collections
 DROP CONSTRAINT IF EXISTS rapli_module_collections_module_check;
ALTER TABLE public.rapli_module_collections
 ADD CONSTRAINT rapli_module_collections_module_check
 CHECK (module = ANY (ARRAY['time'::text,'sports'::text,'refs'::text,'stickers'::text,'tools'::text,'tiers'::text,'top10'::text,'coach'::text]));
