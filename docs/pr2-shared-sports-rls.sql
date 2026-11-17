-- Rapli Lab PR #2 — shared Sports (reviewed deployment step, NOT auto-applied).
-- IMPORTANT: deploy preview + verify admin email login BEFORE applying.
-- This migration changes permissions, not records; no DELETE / TRUNCATE.
-- Sports canonical owner: latest explicitly confirmed saved collection
-- 91a067ed-796a-45c0-b4b1-c04f3bfbe35e (56 cards / 107 logos on 2026-11-17).
-- Older Sports 49965cdc-d361-4515-ae53-d9a5bead243e is retained as backup.
-- Regatta stays hidden and private, with historical owner/member access unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.rapli_is_single_editor()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT (select auth.uid()) IS NOT NULL
   AND lower(coalesce((select auth.jwt())->>'email',''))='rapharcadium@pm.me'
   AND coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true)=false
$$;
REVOKE ALL ON FUNCTION public.rapli_is_single_editor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rapli_is_single_editor() TO anon, authenticated;

DROP POLICY IF EXISTS "Module owner delete" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Module owner or linked member insert" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Module owner or linked member read" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Module owner or linked member update" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Rapli public Sports read" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Rapli editor insert" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Rapli public Sports anonymous read" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Rapli editor update" ON public.rapli_module_collections;
DROP POLICY IF EXISTS "Rapli editor delete" ON public.rapli_module_collections;

-- Sports: single published collection, public SELECT, confirmed owner-only writes.
-- Regatta: preserve private legacy owner/paired member reads only.
CREATE POLICY "Rapli shared Sports read, private Regatta read" ON public.rapli_module_collections
 FOR SELECT TO authenticated
 USING (
   (module='sports' AND owner_id='91a067ed-796a-45c0-b4b1-c04f3bfbe35e'::uuid)
   OR (module='regatta' AND
     (owner_id=(select auth.uid()) OR EXISTS (
       SELECT 1 FROM public.rapli_archive_members m
       WHERE m.owner_id=rapli_module_collections.owner_id
         AND m.member_id=(select auth.uid())
     )))
 );
CREATE POLICY "Rapli public Sports anonymous read" ON public.rapli_module_collections
 FOR SELECT TO anon
 USING (module='sports' AND owner_id='91a067ed-796a-45c0-b4b1-c04f3bfbe35e'::uuid);
CREATE POLICY "Rapli shared editor insert" ON public.rapli_module_collections
 FOR INSERT TO authenticated
 WITH CHECK (
    (module='sports' AND owner_id='91a067ed-796a-45c0-b4b1-c04f3bfbe35e'::uuid
      AND public.rapli_is_single_editor())
    OR (module='regatta' AND owner_id=(select auth.uid())
      AND public.rapli_is_single_editor())
 );
CREATE POLICY "Rapli shared editor update" ON public.rapli_module_collections
 FOR UPDATE TO authenticated
 USING (
    (module='sports' AND owner_id='91a067ed-796a-45c0-b4b1-c04f3bfbe35e'::uuid
      AND public.rapli_is_single_editor())
    OR (module='regatta' AND
      (owner_id=(select auth.uid()) OR EXISTS (
        SELECT 1 FROM public.rapli_archive_members m
        WHERE m.owner_id=rapli_module_collections.owner_id
          AND m.member_id=(select auth.uid())
      )) AND public.rapli_is_single_editor())
 )
 WITH CHECK (
    (module='sports' AND owner_id='91a067ed-796a-45c0-b4b1-c04f3bfbe35e'::uuid
      AND public.rapli_is_single_editor())
    OR (module='regatta' AND public.rapli_is_single_editor()
       AND (owner_id=(select auth.uid()) OR EXISTS (
          SELECT 1 FROM public.rapli_archive_members m
          WHERE m.owner_id=rapli_module_collections.owner_id
            AND m.member_id=(select auth.uid())
       )))
 );
CREATE POLICY "Rapli shared editor delete" ON public.rapli_module_collections
 FOR DELETE TO authenticated
 USING (
    (module='sports' AND owner_id='91a067ed-796a-45c0-b4b1-c04f3bfbe35e'::uuid
      AND public.rapli_is_single_editor())
    OR (module='regatta' AND public.rapli_is_single_editor()
       AND (owner_id=(select auth.uid()) OR EXISTS (
         SELECT 1 FROM public.rapli_archive_members m
         WHERE m.owner_id=rapli_module_collections.owner_id
           AND m.member_id=(select auth.uid())
       )))
 );
GRANT SELECT ON public.rapli_module_collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rapli_module_collections TO authenticated;

-- Storage stays in existing private bucket. Only selected Sports directory is public-read.
DROP POLICY IF EXISTS "Rapli images appareils creation" ON storage.objects;
DROP POLICY IF EXISTS "Rapli images appareils lecture" ON storage.objects;
DROP POLICY IF EXISTS "Rapli images appareils modification" ON storage.objects;
DROP POLICY IF EXISTS "Rapli images personnelles suppression" ON storage.objects;
DROP POLICY IF EXISTS "Rapli public Sports images" ON storage.objects;
DROP POLICY IF EXISTS "Rapli editor image insert" ON storage.objects;
DROP POLICY IF EXISTS "Rapli public Sports anonymous images" ON storage.objects;
DROP POLICY IF EXISTS "Rapli editor image update" ON storage.objects;
DROP POLICY IF EXISTS "Rapli editor image delete" ON storage.objects;

CREATE POLICY "Rapli shared Sports images and legacy private images" ON storage.objects
 FOR SELECT TO authenticated
 USING (
   bucket_id='rapli-archives-private' AND (
     name LIKE '91a067ed-796a-45c0-b4b1-c04f3bfbe35e/sports/%'
     OR (
        (storage.foldername(name))[1]=(select auth.uid())::text
        OR EXISTS (
          SELECT 1 FROM public.rapli_archive_members m
          WHERE m.member_id=(select auth.uid())
            AND m.owner_id::text=(storage.foldername(name))[1]
        )
     )
   )
 );
CREATE POLICY "Rapli public Sports anonymous images" ON storage.objects
 FOR SELECT TO anon
 USING (bucket_id='rapli-archives-private'
   AND name LIKE '91a067ed-796a-45c0-b4b1-c04f3bfbe35e/sports/%');
CREATE POLICY "Rapli shared editor image insert" ON storage.objects
 FOR INSERT TO authenticated
 WITH CHECK (
   bucket_id='rapli-archives-private'
   AND public.rapli_is_single_editor()
   AND name LIKE '91a067ed-796a-45c0-b4b1-c04f3bfbe35e/sports/%'
 );
CREATE POLICY "Rapli shared editor image update" ON storage.objects
 FOR UPDATE TO authenticated
 USING (
   bucket_id='rapli-archives-private' AND public.rapli_is_single_editor()
   AND name LIKE '91a067ed-796a-45c0-b4b1-c04f3bfbe35e/sports/%'
 )
 WITH CHECK (
   bucket_id='rapli-archives-private' AND public.rapli_is_single_editor()
   AND name LIKE '91a067ed-796a-45c0-b4b1-c04f3bfbe35e/sports/%'
 );
CREATE POLICY "Rapli shared editor image delete" ON storage.objects
 FOR DELETE TO authenticated
 USING (
   bucket_id='rapli-archives-private' AND public.rapli_is_single_editor()
   AND name LIKE '91a067ed-796a-45c0-b4b1-c04f3bfbe35e/sports/%'
 );
COMMIT;

-- Optional, after verifying RLS and deploying the preview:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.rapli_module_collections;
-- Only run once if absent; polling/focus already provide fallback refresh.
