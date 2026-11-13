# Rapli Top Tiers — Cloud Sync (PR #1)

This workspace uses the existing RapliLab authenticated, revision-checked cloud bridge in \`shared/module-cloud.js\`.

- Module key: \`tiers\`.
- Database: \`public.rapli_module_collections\` (primary key: \`owner_id, module\`).
- Private image storage: bucket \`rapli-archives-private\`, paths \`{owner_id}/tiers/{sha256}.{ext}\`.
- Owner/device pairing: existing \`rapli_archive_members\` relationship; all database and storage access remains RLS-protected.
- No user secrets / service-role key in the browser.
- **No autosave:** changes remain local/in memory until clicking **ENREGISTRER** in Top Tiers, or choosing the explicit global save action.
- Cloud conflicts require an explicit choice; a newer revision is not silently overwritten.
- The page's local IndexedDB copy is an offline fallback; cross-device access requires a working Supabase session and (if needed) device pairing via Archives.
- The image codec used for cloud upload is PNG, JPEG, WebP or GIF. HEIC is converted on import when the browser supports decoding it.
- The public Supabase schema's allowed module keys must include \`tiers\`. The additive migration is below.

## Additive migration

\`\`\`sql
ALTER TABLE public.rapli_module_collections
  DROP CONSTRAINT IF EXISTS rapli_module_collections_module_check;

ALTER TABLE public.rapli_module_collections
  ADD CONSTRAINT rapli_module_collections_module_check
  CHECK (module = ANY (ARRAY[
    'time'::text, 'sports'::text, 'refs'::text,
    'stickers'::text, 'tools'::text, 'tiers'::text
  ]));
\`\`\`

This adds one allowed module without changing existing rows or existing RLS policies. Run it on the linked RapliLab Supabase project, then confirm via \`pg_constraint\` and check Supabase security advisors.

## Manual QA

1. Create a Tier List; add images, a text tile, and a caption; click ENREGISTRER; reload and verify IndexedDB restore.
2. Pair an iPhone in Archives, open the same Deploy Preview, select Top Tiers and use global refresh; verify the saved Tier List appears with images.
3. Delete/move/sort items, then leave with unsaved changes; confirm the discard warning.
4. Verify that a change to a cloud revision from the other device causes a conflict, rather than an automatic overwrite.
5. Test PNG ×1 and ×3, with/without blank ranks and captions. Verify output dimensions, no waiting area and no exterior margin.
6. Run on Safari iOS, especially HEIC decoding, touch gestures, long titles, and browser memory on ×4 exports.
