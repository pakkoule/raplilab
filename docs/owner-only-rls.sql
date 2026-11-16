-- PR #1 — Activate only AFTER the administrator has signed in with the emailed
-- link and the public read-only client has been deployed/tested.
-- This file is deliberately NOT applied to the live Supabase project by this PR.
-- Existing owner rows and images remain unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.rapli_is_single_editor()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT auth.uid() IS NOT NULL
   AND lower(coalesce(auth.jwt()->>'email',''))='rapharcadium@pm.me'
   AND coalesce((auth.jwt()->>'is_anonymous')::boolean,true)=false
$$;
REVOKE ALL ON FUNCTION public.rapli_is_single_editor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rapli_is_single_editor() TO anon, authenticated;

DROP POLICY IF EXISTS "Module owner delete" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Module owner or linked member insert" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Module owner or linked member read" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Module owner or linked member update" ON public.rapli_module_collections;

CREATE POLICY "Rapli public Sports read" ON public.rapli_module_collections
 FOR SELECT TO anon,authenticated
 USING ((module='sports' AND owner_id='49965cdc-d361-4515-ae53-d9a5bead243e'::uuid)
     OR (public.rapli_is_single_editor() AND owner_id='49965cdc-d361-4515-ae53-d9a5bead243e'::uuid));
CREATE POLICY "Rapli editor insert" ON public.rapli_module_collections
 FOR INSERT TO authenticated
 WITH CHECK(public.rapli_is_single_editor() AND owner_id='49965cdc-d361-4515-ae53-d9a5bead243e'::uuid);
CREATE POLICY "Rapli editor update" ON public.rapli_module_collections
 FOR UPDATE TO authenticated
 USING(public.rapli_is_single_editor() AND owner_id='49965cdc-d361-4515-ae53-d9a5bead243e'::uuid)
 WITH CHECK(public.rapli_is_single_editor() AND owner_id='49965cdc-d361-4515-ae53-d9a5bead243e'::uuid);
CREATE POLICY "Rapli editor delete" ON public.rapli_module_collections
 FOR DELETE TO authenticated
 USING(public.rapli_is_single_editor() AND owner_id='49965cdc-d361-4515-ae53-d9a5bead243e'::uuid);

GRANT SELECT ON public.rapli_module_collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rapli_module_collections TO authenticated;

DROP POLICY IF EXISTS "Rapli images appareils creation" ON storage.objects;
DROP POLICY IF EXISTS "Rapli images appareils lecture" ON storage.objects;
DROP POLICY IF EXISTS "Rapli images appareils modification" ON storage.objects;
DROP POLICY IF EXISTS "Rapli images personnelles suppression" ON storage.objects;

-- Readable Sports imagery is necessary for public card browsing.
-- Regatta images stay private to the verified editor.
CREATE POLICY "Rapli public Sports images" ON storage.objects
 FOR SELECT TO anon, authenticated
 USING(bucket_id='rapli-archives-private' AND
       ((name LIKE '49965cdc-d361-4515-ae53-d9a5bead243e/sports/%')
        OR (public.rapli_is_single_editor()
            AND name LIKE '49965cdc-d361-4515-ae53-d9a5bead243e/%')));
CREATE POLICY "Rapli editor image insert" ON storage.objects
 FOR INSERT TO authenticated
 WITH CHECK(bucket_id='rapli-archives-private'
            AND public.rapli_is_single_editor()
            AND name LIKE '49965cdc-d361-4515-ae53-d9a5bead243e/%');
CREATE POLICY "Rapli editor image update" ON storage.objects
 FOR UPDATE TO authenticated
 USING(bucket_id='rapli-archives-private'
       AND public.rapli_is_single_editor()
       AND name LIKE '49965cdc-d361-4515-ae53-d9a5bead243e/%')
 WITH CHECK(bucket_id='rapli-archives-private'
       AND public.rapli_is_single_editor()
       AND name LIKE '49965cdc-d361-4515-ae53-d9a5bead243e/%');
CREATE POLICY "Rapli editor image delete" ON storage.objects
 FOR DELETE TO authenticated
 USING(bucket_id='rapli-archives-private'
       AND public.rapli_is_single_editor()
       AND name LIKE '49965cdc-d361-4515-ae53-d9a5bead243e/%');

COMMIT;
