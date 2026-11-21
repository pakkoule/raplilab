-- Apply only when the custom-font importer is ready for release.
-- Keep all existing image MIME types and RLS/storage policies unchanged.
-- The existing private bucket has a 10 MB limit; the app enforces 5 MB per font.
BEGIN;
UPDATE storage.buckets AS bucket
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT mime
  FROM unnest(
    coalesce(bucket.allowed_mime_types,ARRAY[]::text[]) ||
    ARRAY['font/woff2','font/woff','font/ttf','font/otf']::text[]
  ) AS extension(mime)
  ORDER BY mime
)
WHERE bucket.id = 'rapli-archives-private';
COMMIT;
