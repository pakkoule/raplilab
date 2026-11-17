-- Additive API: retain the existing collection and RLS so old clients keep working.
-- Network transfers are per record; the canonical JSON document remains server-side.
BEGIN;
CREATE OR REPLACE FUNCTION public.rapli_collection_delta(
  p_owner uuid, p_module text, p_known jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  collection public.rapli_module_collections%ROWTYPE;
  kind text; items jsonb; manifest jsonb; changed jsonb; deleted jsonb;
  result jsonb := '{"changed":{},"deleted":{},"hashes":{}}'::jsonb;
BEGIN
  IF jsonb_typeof(p_known) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid manifest' USING ERRCODE='22023';
  END IF;
  SELECT * INTO collection FROM public.rapli_module_collections
    WHERE owner_id=p_owner AND module=p_module;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection inaccessible' USING ERRCODE='42501'; END IF;
  FOREACH kind IN ARRAY ARRAY['records','logos'] LOOP
    items := collection.state->kind;
    SELECT coalesce(jsonb_object_agg(item->>'id',md5(item::text)),'{}'::jsonb),
      coalesce(jsonb_agg(item ORDER BY item->>'id') FILTER
        (WHERE p_known->kind->>(item->>'id') IS DISTINCT FROM md5(item::text)),'[]'::jsonb)
      INTO manifest,changed FROM jsonb_array_elements(items) AS x(item);
    SELECT coalesce(jsonb_agg(id ORDER BY id),'[]'::jsonb) INTO deleted
      FROM jsonb_object_keys(coalesce(p_known->kind,'{}'::jsonb)) AS x(id)
      WHERE NOT manifest ? id;
    result := jsonb_set(result,ARRAY['changed',kind],changed);
    result := jsonb_set(result,ARRAY['deleted',kind],deleted);
    result := jsonb_set(result,ARRAY['hashes',kind],manifest);
  END LOOP;
  RETURN result || jsonb_build_object('revision',collection.state_revision);
END $$;
REVOKE ALL ON FUNCTION public.rapli_collection_delta(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rapli_collection_delta(uuid,text,jsonb) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.rapli_collection_patch(
  p_owner uuid, p_module text, p_changes jsonb, p_known jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  collection public.rapli_module_collections%ROWTYPE;
  edit jsonb; kind text; record_id text; current_item jsonb; next_item jsonb;
  next_state jsonb; items jsonb; modified boolean := false; affected integer;
BEGIN
  IF NOT public.rapli_is_single_editor() THEN
    RAISE EXCEPTION 'Editor required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_changes)>25000 THEN
    RAISE EXCEPTION 'Invalid changes' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_changes) e
      GROUP BY e->>'kind',e->>'id' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Duplicate changes' USING ERRCODE='22023';
  END IF;
  SELECT * INTO collection FROM public.rapli_module_collections
    WHERE owner_id=p_owner AND module=p_module FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection inaccessible' USING ERRCODE='42501'; END IF;
  next_state:=collection.state;
  FOR edit IN SELECT * FROM jsonb_array_elements(p_changes) LOOP
    kind:=edit->>'kind'; record_id:=edit->>'id'; next_item:=nullif(edit->'after','null'::jsonb);
    IF kind IS NULL OR kind NOT IN ('records','logos') OR record_id IS NULL OR
       length(record_id) NOT BETWEEN 1 AND 180 OR NOT (edit ? 'after') OR NOT (edit ? 'before') OR
       (next_item IS NOT NULL AND (jsonb_typeof(next_item)<>'object' OR
         next_item->>'id' IS DISTINCT FROM record_id)) THEN
      RAISE EXCEPTION 'Invalid record change' USING ERRCODE='22023';
    END IF;
    SELECT item INTO current_item FROM jsonb_array_elements(next_state->kind) x(item)
      WHERE item->>'id'=record_id;
    -- Idempotent retry after a lost network response must not duplicate or conflict.
    IF current_item IS NOT DISTINCT FROM next_item THEN CONTINUE; END IF;
    IF md5(current_item::text) IS DISTINCT FROM edit->>'before' THEN
      RAISE EXCEPTION 'Record modified on another device: %/%',kind,record_id USING ERRCODE='40001';
    END IF;
    SELECT coalesce(jsonb_agg(item),'[]'::jsonb) INTO items
      FROM jsonb_array_elements(next_state->kind) x(item) WHERE item->>'id'<>record_id;
    IF next_item IS NOT NULL THEN items:=items||jsonb_build_array(next_item); END IF;
    next_state:=jsonb_set(next_state,ARRAY[kind],items);modified:=true;
  END LOOP;
  IF jsonb_array_length(next_state->'records')>20000 OR jsonb_array_length(next_state->'logos')>5000 THEN
    RAISE EXCEPTION 'Collection limit exceeded' USING ERRCODE='22023';
  END IF;
  IF modified THEN
    UPDATE public.rapli_module_collections SET state=next_state,
      state_revision=collection.state_revision+1,updated_at=clock_timestamp()
      WHERE owner_id=p_owner AND module=p_module;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN RAISE EXCEPTION 'Write denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN public.rapli_collection_delta(p_owner,p_module,p_known);
END $$;
REVOKE ALL ON FUNCTION public.rapli_collection_patch(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rapli_collection_patch(uuid,text,jsonb,jsonb) TO authenticated;
COMMIT;
