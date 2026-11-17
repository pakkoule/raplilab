/* Rapli Lab — collections Sports et Regatta communes.
 * Supabase reste le stockage central; aucun appairage ni bouton Cloud.
 * Les visiteurs lisent, seul l'éditeur vérifié peut enregistrer (RLS côté serveur).
 * Ne jamais écrire dans une autre collection que la référence sélectionnée. */
(() => {
  'use strict';
  const bridge = window.RapliModuleBridge;
  if (!bridge || !['sports','regatta'].includes(bridge.module)) return;
  const MODULE = bridge.module;

  const SUPABASE_URL = 'https://widiyulvmthbaypdxhbw.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_aietige1gJ1QfPZ6HaHiVA_zwqcJYyF';
  const OWNER_ID = '91a067ed-796a-45c0-b4b1-c04f3bfbe35e';
  const TABLE = 'rapli_module_collections';
  const BUCKET = 'rapli-archives-private';
  const IMAGE_PREFIX = 'rapli-private://';
  const ACK_KEY = 'rapli-cloud-' + MODULE + '-ack-v1'; // Reuse the old local sync marker.
  const MAX_IMAGE = 10 * 1024 * 1024;

  let client = null, revision = null, initialized = false, dirty = false;
  let busy = false, blocked = false, bootPromise = null, saveTimer = null;
  let refreshTimer = null, retryTimer = null;
  const uploaded = new Map(), downloaded = new Map();
  const loader = MODULE === 'sports' ? document.getElementById('rapliSharedLoading') : null;
  const loaderMessage = document.getElementById('rapliSharedLoadingMessage');
  const loaderProgress = document.getElementById('rapliSharedProgress');
  const loaderPercent = document.getElementById('rapliSharedPercent');
  const retryButton = document.getElementById('rapliSharedRetry');
  let imageTotal = 0, imageCompleted = 0;
  function loading(message, mode = 'loading') {
    if (!loader) return;
    document.documentElement.dataset.rapliSharedState = mode === 'ready' ? 'ready' : mode;
    loader.dataset.status = mode;
    if (loaderMessage && message) loaderMessage.textContent = message;
    if (retryButton) retryButton.hidden = mode !== 'error';
    if (mode === 'loading' && loaderProgress && !imageTotal) {
      loaderProgress.removeAttribute('value');
      if (loaderPercent) loaderPercent.textContent = '';
    }
  }
  function collectImages(node, refs = new Set()) {
    if (typeof node === 'string') {
      if (node.startsWith(IMAGE_PREFIX)) refs.add(node);
    } else if (Array.isArray(node)) {
      node.forEach(value => collectImages(value, refs));
    } else if (node && typeof node === 'object') {
      Object.values(node).forEach(value => collectImages(value, refs));
    }
    return refs;
  }
  function showImageProgress() {
    if (!loader || !loaderProgress) return;
    if (!imageTotal) { loaderProgress.removeAttribute('value'); return; }
    loaderProgress.max = imageTotal;
    loaderProgress.value = Math.min(imageCompleted, imageTotal);
    if (loaderPercent)
      loaderPercent.textContent = imageCompleted + ' / ' + imageTotal + ' images';
    if (loaderMessage) loaderMessage.textContent = 'Chargement des photos et logos…';
  }
  if (retryButton) retryButton.addEventListener('click', () => {
    loading('Nouvelle tentative de chargement…');
    void refresh();
  });

  const isEditor = () => window.RapliAdminAccess?.isEditor?.() === true;
  const canEdit = () => isEditor() && initialized && !blocked && !busyLoading;
  let busyLoading = false;
  const sorted = rows => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  function snapshot() {
    const state = bridge.getState();
    if (!state || !Array.isArray(state.records) || !Array.isArray(state.logos))
      throw Error('Collection locale inaccessible.');
    return {records: sorted(state.records), logos: sorted(state.logos)};
  }
  // Match the previous sync fingerprint so that old offline changes are not lost.
  function fingerprint(data) {
    const raw = JSON.stringify(data);
    let first = 2166136261, second = 0x9e3779b9;
    for (let i = 0; i < raw.length; i++) {
      first = Math.imul(first ^ raw.charCodeAt(i), 16777619);
      second = Math.imul(second ^ raw.charCodeAt(i), 2246822519);
    }
    return raw.length + ':' + (first >>> 0).toString(36) + ':' + (second >>> 0).toString(36);
  }
  function knownBaseline() {
    try {
      const value = JSON.parse(localStorage.getItem(ACK_KEY) || 'null');
      return value?.owner === OWNER_ID ? value : null;
    } catch (_) { return null; }
  }
  function acknowledge(state) {
    try {
      localStorage.setItem(ACK_KEY, JSON.stringify({
        owner: OWNER_ID, revision, hash: fingerprint(state)
      }));
    } catch (error) {
      console.warn('Rapli Sports : marque de sauvegarde locale inaccessible', error);
    }
  }
  function status(message, level = 'ok') {
    const element = document.getElementById('rapli-shared-status-' + MODULE);
    if (element) {
      element.textContent = message;
      element.dataset.status = level;
    }
    if (window.parent !== window)
      window.parent.postMessage({type: 'RAPLI_SHARED_STATUS', module: MODULE, message, level}, location.origin);
  }
  async function supabase() {
    if (!client) {
      const sdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm');
      client = sdk.createClient(SUPABASE_URL, PUBLIC_KEY, {
        auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false}
      });
    }
    return client;
  }
  async function remoteRow() {
    const sdk = await supabase();
    const {data, error} = await sdk.from(TABLE).select('state,state_revision,updated_at')
      .eq('owner_id', OWNER_ID).eq('module', MODULE).maybeSingle();
    if (error) throw error;
    if (!data) throw Error('Collection commune non accessible. Vérifie les règles de lecture Supabase.');
    if (!data.state || !Array.isArray(data.state.records) || !Array.isArray(data.state.logos))
      throw Error('La collection commune est invalide.');
    return data;
  }

  const isImage = value => typeof value === 'string' &&
    /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value);
  const isReference = value => typeof value === 'string' && value.startsWith(IMAGE_PREFIX);
  async function uploadImage(value) {
    if (uploaded.has(value)) return uploaded.get(value);
    const response = await fetch(value);
    if (!response.ok) throw Error('Image locale illisible.');
    const blob = await response.blob();
    if (blob.size > MAX_IMAGE) throw Error('Une image dépasse 10 Mo.');
    const mime = (blob.type || '').toLowerCase();
    const ext = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[mime];
    if (!ext) throw Error('Format image non pris en charge.');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hex = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    const path = OWNER_ID + '/' + MODULE + '/' + hex + '.' + ext;
    const result = await (await supabase()).storage.from(BUCKET).upload(path, blob, {contentType:mime, upsert:true});
    if (result.error) throw result.error;
    const ref = IMAGE_PREFIX + path;
    uploaded.set(value, ref);
    downloaded.set(ref, value);
    return ref;
  }
  async function transfer(value, direction) {
    if (typeof value === 'string') {
      if (direction === 'upload' && isImage(value)) return uploadImage(value);
      if (direction === 'download' && isReference(value)) {
        if (downloaded.has(value)) return downloaded.get(value);
        const path = value.slice(IMAGE_PREFIX.length);
        const prefix = OWNER_ID + '/' + MODULE + '/';
        if (!path.startsWith(prefix) || !/^[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(path.slice(prefix.length)))
          throw Error('Référence image en dehors de la collection commune.');
        const {data, error} = await (await supabase()).storage.from(BUCKET).download(path);
        if (error) throw error;
        const dataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || Error('Image illisible.'));
          reader.readAsDataURL(data);
        });
        downloaded.set(value, dataUri);
        if (imageTotal) { imageCompleted++; showImageProgress(); }
        return dataUri;
      }
      return value;
    }
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value) result.push(await transfer(item, direction));
      return result;
    }
    if (value && typeof value === 'object') {
      const result = {};
      for (const [key, item] of Object.entries(value)) result[key] = await transfer(item, direction);
      return result;
    }
    return value;
  }
  function blockOnConflict() {
    blocked = true;
    loading('Conflit local détecté. Exporte tes données locales avant de recharger.', 'conflict');
    status('Conflit de versions : exporte tes données locales avant de recharger la page.', 'error');
  }
  async function refresh() {
    if (!bridge.ready || busy || dirty || blocked || busyLoading) return;
    if (document.querySelector('dialog[open]') && initialized) return; // Preserve an open form.
    busyLoading = true;
    if (!initialized) loading('Connexion à Supabase…');
    try {
      const row = await remoteRow();
      const current = Number(row.state_revision || 0);
      if (initialized && current === revision) return;
      // Sports still checks pending local edits; Regatta retains its old IndexedDB untouched.
      if (MODULE === 'sports' && !initialized && isEditor()) {
        const baseline = knownBaseline();
        const local = snapshot();
        // A first-time editor on a different device may have unsent local records.
        // Never replace real local data without a matching acknowledged baseline.
        if ((baseline && baseline.hash !== fingerprint(local)) ||
            (!baseline && (local.records.some(card => !card.demo) || local.logos.length > 0))) {
          blockOnConflict();
          return;
        }
      }
      status(initialized ? 'Actualisation de la collection…' : 'Chargement de la collection…', 'pending');
      if (!initialized && loader) {
        imageTotal = collectImages(row.state).size;
        imageCompleted = 0;
        showImageProgress();
      }
      const state = await transfer(row.state, 'download');
      // Keep historical Regatta IndexedDB untouched; use the published version in memory.
      if (MODULE === 'regatta') bridge.previewState(state);
      else if (isEditor()) await bridge.replaceState(state);
      else bridge.previewState(state);
      revision = current;
      initialized = true;
      if (isEditor()) acknowledge(snapshot());
      loading('Collection à jour ✓', 'ready');
      status('Collection à jour ✓');
    } catch (error) {
      console.warn('Rapli Sports : lecture partagée impossible', error);
      loading('Chargement impossible. Vérifie ta connexion puis réessaie.', 'error');
      status('Collection indisponible : lecture impossible sur Supabase.', 'error');
      if (!initialized && !isEditor())
        bridge.previewState({records:[], logos:[]}); // Never display local demo data as public collection.
    } finally {
      busyLoading = false;
    }
  }
  function queueSave(delay = 850) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void saveNow(); }, delay);
  }
  async function saveNow() {
    if (!dirty || !canEdit() || busy) return;
    busy = true;
    const state = snapshot(), hash = fingerprint(state), baseRevision = revision;
    status('Enregistrement automatique…', 'pending');
    try {
      const remote = await remoteRow();
      if (Number(remote.state_revision || 0) !== baseRevision) {
        blockOnConflict(); return;
      }
      const serialized = await transfer(state, 'upload');
      const {data, error} = await (await supabase()).from(TABLE)
        .update({state:serialized, state_revision:baseRevision + 1, updated_at:new Date().toISOString()})
        .eq('owner_id', OWNER_ID).eq('module', MODULE).eq('state_revision', baseRevision)
        .select('state_revision').maybeSingle();
      if (error) throw error;
      if (!data) { blockOnConflict(); return; }
      revision = Number(data.state_revision);
      acknowledge(state);
      dirty = fingerprint(snapshot()) !== hash;
      status(dirty ? 'Modifications en cours…' : 'Enregistré pour tous ✓', dirty ? 'pending' : 'ok');
    } catch (error) {
      console.warn('Rapli Sports : écriture partagée impossible', error);
      status('Enregistrement en attente : connexion ou autorisations Supabase à vérifier.', 'error');
    } finally {
      busy = false;
      if (dirty && !blocked) queueSave(8000); // Preserve local edits and retry without forcing an overwrite.
    }
  }
  function changed() {
    if (!canEdit()) return;
    dirty = true;
    status('Modifications en attente…', 'pending');
    queueSave();
  }
  function scheduleRefresh() {
    if (dirty || blocked || busy || busyLoading) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { void refresh(); }, 400);
  }
  async function boot() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      await window.RapliAdminAccess?.initialize?.();
      await supabase();
      await refresh();
      // Realtime improves latency; polling and focus events remain a fallback
      // until the publication is enabled by the separate, reviewed RLS migration.
      client.channel('rapli-' + MODULE + '-public-v2')
        .on('postgres_changes', {
          event:'UPDATE', schema:'public', table:TABLE, filter:'owner_id=eq.' + OWNER_ID
        }, payload => {
          if (payload.new?.module === MODULE) scheduleRefresh();
        }).subscribe();
      setInterval(() => { void refresh(); }, 20000);
    })().catch(error => {
      console.warn('Rapli Sports : initialisation commune impossible', error);
      loading('Connexion impossible. Réessaie le chargement.', 'error');
      status('Collection indisponible : connexion à vérifier.', 'error');
    });
    return bootPromise;
  }
  window.RapliSharedCollection = {
    changed, canEdit, refresh,
    getStatus: () => ({initialized, revision, dirty, blocked, busy})
  };
  window.addEventListener('rapli-module-ready', () => { void boot(); }, {once:true});
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { if (dirty) queueSave(300); else scheduleRefresh(); }
  });
  window.addEventListener('focus', () => {
    if (dirty) queueSave(300);
    else scheduleRefresh();
  });
  window.addEventListener('online', () => {
    if (dirty) queueSave(300);
    else scheduleRefresh();
  });
  if (bridge.ready) void boot();
})();