-- RapliLab PR #1 — retiring obsolete workspaces and their cloud state.
-- Scope: only time, refs, tiers, top10 and coach. Archives is stored separately.
-- IMPORTANT: delete private images with the Supabase Storage API (not SQL).
-- Storage bucket rapli-archives-private remains shared by active modules.
DELETE FROM public.rapli_module_collections
WHERE module IN ('time','refs','tiers','top10','coach');

ALTER TABLE public.rapli_module_collections
  DROP CONSTRAINT IF EXISTS rapli_module_collections_module_check;

ALTER TABLE public.rapli_module_collections
  ADD CONSTRAINT rapli_module_collections_module_check
  CHECK (module = ANY (ARRAY[
    'sports'::text, 'stickers'::text, 'tools'::text, 'lp'::text, 'regatta'::text
  ]));
