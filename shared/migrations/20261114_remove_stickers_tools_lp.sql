-- PR #1: retrait de Stickers Lab, Rapli Tools et Rapli LP.
-- Supprimer uniquement leurs collections; les autres modules restent intacts.
-- Ne jamais supprimer les objets de Storage par SQL: utiliser l'API Storage.
DELETE FROM public.rapli_module_collections WHERE module IN ('stickers','tools','lp');
ALTER TABLE public.rapli_module_collections DROP CONSTRAINT IF EXISTS rapli_module_collections_module_check;
ALTER TABLE public.rapli_module_collections ADD CONSTRAINT rapli_module_collections_module_check
 CHECK (module = ANY (ARRAY['sports'::text,'regatta'::text]));
