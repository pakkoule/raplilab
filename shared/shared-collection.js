/* Rapli Lab — collection Sports partagée.
 * Supabase reste le stockage central; aucun appairage ni bouton Cloud.
 * Les visiteurs lisent, seul l'éditeur vérifié peut enregistrer (RLS côté serveur).
 * Ne jamais écrire dans une autre collection que la référence sélectionnée. */
(() => {
  'use strict';
  const bridge = window.RapliModuleBridge;
  if (!bridge || bridge.module !== 'sports') return;
  const MODULE = bridge.module;

  const SUPABASE_URL = 'https://widiyulvmthbaypdxhbw.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_aietige1gJ1QfPZ6HaHiVA_zwqcJYyF';
  const OWNER_ID = '91a067ed-796a-45c0-b4b1-c04f3bfbe35e';
  const TABLE = 'rapli_module_collections';
  const BUCKET = 'rapli-archives-private';
  const IMAGE_PREFIX = 'rapli-private://';
  const ACK_KEY = 'rapli-cloud-' + MODULE + '-ack-v1'; // Reuse the old local sync marker.
  const CHECK_TTL = 60000;
  const CHECK_KEY = 'rapli-last-check-v1-'+OWNER_ID+'-'+MODULE;
  const MAX_IMAGE = 10 * 1024 * 1024;
  const MAX_FONT = 5 * 1024 * 1024; // Small, validated font uploads (below the bucket's 10 MB limit).
  const FONT_MIMES = Object.freeze({'font/woff2':'woff2','font/woff':'woff','font/ttf':'ttf','font/otf':'otf'});
  const Diff = window.RapliCollectionDiff;
  const emptyState = () => ({records:[], logos:[]});
  let remoteState = emptyState(), baseDisplay = emptyState(), hashes = {};
  let mediaIncomplete = false;
  let lastCheck = 0, checkpointChain = Promise.resolve(), cacheDatabase;
  let restoredPending = false, legacyLocal = null, failures = 0, bootReady = false;
  // Lightweight public collection metadata in localStorage; images belong in IndexedDB.
  const STATE_CACHE_KEY = 'rapli-shared-public-state-v2-' + MODULE;

  let client = null, revision = null, initialized = false, dirty = false;
  let busy = false, blocked = false, bootPromise = null, saveTimer = null;
  let refreshTimer = null;
  const uploaded = new Map(), downloaded = new Map();
  const loader = MODULE === 'sports' ? document.getElementById('rapliSharedLoading') : null;
  const loaderMessage = document.getElementById('rapliSharedLoadingMessage');
  const loaderProgress = document.getElementById('rapliSharedProgress');
  const loaderProgressFill = document.getElementById('rapliSharedProgressFill');
  const loaderPercent = document.getElementById('rapliSharedPercent');
  const retryButton = document.getElementById('rapliSharedRetry');
  let imageTotal = 0, imageCompleted = 0, cachedVisible = false;
  const completedImages = new Set();
  let cacheDbPromise = null, mediaCacheUnavailable = false;
  function mediaDb() {
    if (mediaCacheUnavailable || !('indexedDB' in window)) return Promise.resolve(null);
    if (!cacheDbPromise) cacheDbPromise = new Promise(resolve => {
      try {
        const request = indexedDB.open('rapli-shared-public-images-v1', 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('images'))
            request.result.createObjectStore('images');
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => { database.close(); cacheDbPromise = null; };
          resolve(database);
        };
        request.onerror = request.onblocked = () => {
          mediaCacheUnavailable = true;
          resolve(null);
        };
      } catch (_) { mediaCacheUnavailable = true; resolve(null); }
    });
    return cacheDbPromise;
  }
  function blobAsDataURI(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || Error('Image illisible.'));
      reader.readAsDataURL(blob);
    });
  }
  async function cachedImage(ref) {
    const database = await mediaDb();
    if (!database) return null;
    try {
      const blob = await new Promise((resolve, reject) => {
        const request = database.transaction('images', 'readonly').objectStore('images').get(ref);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      return blob instanceof Blob ? normaliseFontURI(ref,await blobAsDataURI(blob)) : null;
    } catch (_) { return null; }
  }
  async function rememberImage(ref, blob) {
    const database = await mediaDb();
    if (!database) return;
    try {
      await new Promise((resolve, reject) => {
        const tx = database.transaction('images', 'readwrite');
        tx.objectStore('images').put(blob, ref);
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error || Error('Cache image indisponible.'));
      });
    } catch (error) {
      // Browser quotas and private-browsing modes may disallow caching.
      // The online collection must remain usable when this happens.
      mediaCacheUnavailable = true;
      console.info('Rapli : cache images local indisponible ; chargement en ligne maintenu.', error?.name || '');
    }
  }
  function readStateCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(STATE_CACHE_KEY) || 'null');
      if (cached?.owner !== OWNER_ID || cached?.module !== MODULE ||
          !Number.isFinite(cached.revision) || !Array.isArray(cached.state?.records) ||
          !Array.isArray(cached.state?.logos)) return null;
      return cached;
    } catch (_) { return null; }
  }
  function markImageLoaded(ref) {
    if (!imageTotal || completedImages.has(ref)) return;
    completedImages.add(ref);
    imageCompleted = completedImages.size;
    showImageProgress();
  }
  function stateDb() {
    if (!cacheDatabase) cacheDatabase = new Promise((resolve,reject) => {
      const req=indexedDB.open('rapli-collection-sync-v1',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('states');
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
      req.onblocked=()=>reject(Error('Cache local bloqué.'));
    });
    return cacheDatabase;
  }
  async function readCheckpoint() {
    try {
      const db=await stateDb();
      return await new Promise((resolve,reject)=>{
        const req=db.transaction('states').objectStore('states').get(OWNER_ID+'/'+MODULE);
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
    } catch (_) { return null; }
  }
  function checkpoint() {
    // Capture now; serialize commits so a delayed write cannot replace a newer edit.
    const value=structuredClone({revision,remoteState,baseDisplay,hashes,working:snapshot(),dirty,mediaIncomplete});
    checkpointChain=checkpointChain.catch(()=>{}).then(async()=>{
      const db=await stateDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('states','readwrite');
        tx.objectStore('states').put(value,OWNER_ID+'/'+MODULE);
        tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);
      });
    });
    return checkpointChain;
  }
  function seedImages(remote, display) {
    if (isReference(remote) && isImage(display)) {
      uploaded.set(display,remote);downloaded.set(remote,display);
    } else if (Array.isArray(remote) && Array.isArray(display)) {
      const byId=new Map(display.map(row=>[row?.id,row]));
      remote.forEach((row,i)=>seedImages(row,row?.id?byId.get(row.id):display[i]));
    } else if(remote && display && typeof remote==='object' && typeof display==='object') {
      Object.keys(remote).forEach(key=>seedImages(remote[key],display[key]));
    }
  }
  async function showCachedPreview() {
    legacyLocal=snapshot(); // Keep unsent legacy edits even before authentication resolves.
    const cached=await readCheckpoint();
    if (cached && Number.isFinite(cached.revision) &&
        Array.isArray(cached.remoteState?.records) && Array.isArray(cached.baseDisplay?.records) &&
        Array.isArray(cached.working?.records)) {
      revision=cached.revision;remoteState=cached.remoteState;baseDisplay=cached.baseDisplay;
      hashes=cached.hashes||{};restoredPending=Boolean(cached.dirty);dirty=restoredPending;
      seedImages(remoteState,baseDisplay);
      mediaIncomplete=Boolean(cached.mediaIncomplete)||[...collectImages(remoteState)].some(ref=>!downloaded.has(ref));
      if(!Diff.equal(snapshot(),Diff.apply(cached.working,[])))bridge.previewState(cached.working);
      initialized=true;cachedVisible=true;
    } else {
      const old=readStateCache();
      if(old) {
        remoteState=old.state;revision=old.revision;
        baseDisplay=await transfer(remoteState,'cached');
        seedImages(remoteState,baseDisplay);
        bridge.previewState(baseDisplay);cachedVisible=true;
        // Missing photos in a legacy cache must still be hydrated on the first refresh.
      }
    }
    if(cachedVisible) {
      loading('Collection enregistrée sur cet appareil','ready');
      status('Collection locale affichée · vérification en arrière-plan…','pending');
    }
  }
  function loading(message, mode = 'loading') {
    if (!loader) return;
    document.documentElement.dataset.rapliSharedState = mode === 'ready' ? 'ready' : mode;
    loader.dataset.status = mode;
    if (loaderMessage && message) loaderMessage.textContent = message;
    if (retryButton) retryButton.hidden = mode !== 'error';
    if (mode === 'loading' && loaderProgress && !imageTotal) {
      loaderProgress.dataset.indeterminate = 'true';
      loaderProgress.removeAttribute('aria-valuenow');
      if (loaderProgressFill) loaderProgressFill.style.width = '20%';
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
    loaderProgress.dataset.indeterminate = 'false';
    const percentage = imageTotal ? Math.round(imageCompleted / imageTotal * 100) : 100;
    loaderProgress.setAttribute('aria-valuenow', String(percentage));
    loaderProgress.setAttribute('aria-valuetext', imageTotal ?
      imageCompleted + ' images chargées sur ' + imageTotal : 'Données chargées');
    if (loaderProgressFill) loaderProgressFill.style.width = percentage + '%';
    if (loaderPercent) loaderPercent.textContent = imageTotal ?
      percentage + '% · ' + imageCompleted + ' / ' + imageTotal + ' images' : '100%';
    if (loaderMessage) loaderMessage.textContent = imageTotal ?
      'Chargement des photos et logos…' : 'Finalisation de la collection…';
  }
  if (retryButton) retryButton.addEventListener('click', () => {
    loading('Nouvelle tentative de chargement…');
    void refresh();
  });

  const isEditor = () => window.RapliAdminAccess?.isEditor?.() === true;
  const canEdit = () => isEditor() && bootReady && initialized && !blocked && !busyLoading && !mediaIncomplete;
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
    if(!client && window.RapliAdminAccess?.getClient)client=await window.RapliAdminAccess.getClient();
    if (!client) {
      const sdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm');
      client = sdk.createClient(SUPABASE_URL, PUBLIC_KEY, {
        auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false}
      });
    }
    return client;
  }
  async function remoteVersion() {
    const {data,error}=await (await supabase()).from(TABLE).select('state_revision')
      .eq('owner_id',OWNER_ID).eq('module',MODULE).maybeSingle();
    if(error)throw error;
    if(!data)throw Error('Collection commune inaccessible.');
    return Number(data.state_revision);
  }
  async function fetchDelta() {
    const {data,error}=await (await supabase()).rpc('rapli_collection_delta',{
      p_owner:OWNER_ID,p_module:MODULE,p_known:hashes
    });
    if(error)throw error;
    return data;
  }

  const isImage = value => typeof value === 'string' &&
    /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value);
  const isFont = value => typeof value === 'string' &&
    /^data:font\/(woff2|woff|ttf|otf);base64,[A-Za-z0-9+/=]+$/i.test(value);
  // Supabase may return a font Blob as application/octet-stream.
  // Restore the exact validated font MIME using its hashed file extension.
  function normaliseFontURI(ref,value) {
    const match=String(ref).match(/\.(woff2|woff|ttf|otf)$/);
    return match ? String(value).replace(/^data:[^,]*;base64,/i,'data:font/'+match[1]+';base64,') : value;
  }
  const isReference = value => typeof value === 'string' && value.startsWith(IMAGE_PREFIX);
  async function uploadImage(value) {
    if (uploaded.has(value)) return uploaded.get(value);
    const response = await fetch(value);
    if (!response.ok) throw Error('Image locale illisible.');
    const blob = await response.blob();
    const mime = (blob.type || '').toLowerCase();
    const ext = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif',...FONT_MIMES}[mime];
    if (!ext) throw Error('Format de ressource non pris en charge.');
    if (mime.startsWith('font/') && blob.size > MAX_FONT) throw Error('Police de flocage trop volumineuse (5 Mo max).');
    if (!mime.startsWith('font/') && blob.size > MAX_IMAGE) throw Error('Une image dépasse 10 Mo.');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hex = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    const path = OWNER_ID + '/' + MODULE + '/' + hex + '.' + ext;
    const result = await (await supabase()).storage.from(BUCKET).upload(path, blob, {contentType:mime, upsert:true});
    if (result.error) throw result.error;
    const ref = IMAGE_PREFIX + path;
    uploaded.set(value, ref);
    downloaded.set(ref, value);
    await rememberImage(ref, blob);
    return ref;
  }
  function safeImagePath(value) {
    const path = value.slice(IMAGE_PREFIX.length);
    const prefix = OWNER_ID + '/' + MODULE + '/';
    if (!path.startsWith(prefix) ||
        !/^[a-f0-9]{64}\.(png|jpg|webp|gif|woff2|woff|ttf|otf)$/.test(path.slice(prefix.length)))
      throw Error('Référence image en dehors de la collection commune.');
    return path;
  }
  async function transfer(value, direction) {
    if (typeof value === 'string') {
      if (direction === 'upload' && (isImage(value)||isFont(value))) return uploadImage(value);
      if ((direction === 'download' || direction === 'cached') && isReference(value)) {
        const path = safeImagePath(value);
        if (downloaded.has(value)) {
          if (direction === 'download') markImageLoaded(value);
          return downloaded.get(value);
        }
        const fromDisk = await cachedImage(value);
        if (fromDisk) {
          downloaded.set(value, fromDisk);
          uploaded.set(fromDisk, value);
          if (direction === 'download') markImageLoaded(value);
          return fromDisk;
        }
        if (direction === 'cached') return value; // Retain the reference while its image is still pending.
        const {data, error} = await (await supabase()).storage.from(BUCKET).download(path);
        if (error) throw error;
        const dataUri = normaliseFontURI(value,await blobAsDataURI(data));
        downloaded.set(value, dataUri);
        uploaded.set(dataUri, value);
        markImageLoaded(value);
        await rememberImage(value, data);
        return dataUri;
      }
      return value;
    }
    // Keep the proven sequential transfer order: parallelizing 175 remote requests
    // previously caused a regression. Disk hits are quick and network misses are safe.
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
    // Keep all tiles visible, and retain the local journal for recovery.
    if(!cachedVisible) loading('Conflit de versions. Tes modifications locales sont conservées.','conflict');
    status('Même fiche modifiée ailleurs : modifications locales conservées. Exporte-les avant de résoudre le conflit.','error');
  }
  // Keep image references in the model until resolved. Never turn a pending photo
  // into an empty field that an editor could accidentally save back to the server.
  function withKnownImages(value) {
    if(isReference(value))return downloaded.get(value)||value;
    if(Array.isArray(value))return value.map(withKnownImages);
    if(value && typeof value==='object')return Object.fromEntries(
      Object.entries(value).map(([key,item])=>[key,withKnownImages(item)]));
    return value;
  }
  async function acceptDelta(delta, newerEdits=[]) {
    const nextRemote=Diff.mergeDelta(remoteState,delta);
    const refs=[...collectImages(nextRemote)];
    imageTotal=refs.length;imageCompleted=0;completedImages.clear();
    // Paint cached content immediately, then progressively replace placeholders.
    // Four workers are deliberately bounded: never issue hundreds of requests at once.
    let next=0,lastPaint=0;
    const paint=()=>{
      bridge.previewState(Diff.apply(withKnownImages(nextRemote),newerEdits));
      cachedVisible=true;loading('Chargement des images en arrière-plan…','ready');
      status('Photos et logos : '+imageCompleted+' / '+imageTotal,'pending');
      lastPaint=Date.now();
    };
    paint();lastPaint=0; // Show the first completed image immediately.
    await Promise.all(Array.from({length:Math.min(4,refs.length)},async()=>{
      while(next<refs.length){
        const ref=refs[next++];
        try{await transfer(ref,'download');}
        catch(error){console.warn('Rapli : une image reste à charger',error?.message||error);}
        if(Date.now()-lastPaint>350)paint();
      }
    }));
    const display=withKnownImages(nextRemote);
    const working=Diff.apply(display,newerEdits);
    mediaIncomplete=refs.some(ref=>!downloaded.has(ref));
    // Incomplete media never replace the module's durable editor database.
    if(isEditor() && !mediaIncomplete) await bridge.replaceState(working);
    else bridge.previewState(working);
    remoteState=nextRemote;hashes=delta.hashes;revision=Number(delta.revision);
    baseDisplay=display;
    if(!newerEdits.length)baseDisplay=snapshot();
    initialized=true;cachedVisible=true;dirty=newerEdits.length>0;
    seedImages(remoteState,baseDisplay);
    if(!dirty && !mediaIncomplete && isEditor()) acknowledge(snapshot());
    try{await checkpoint();}catch(error){console.warn('Rapli : cache local inaccessible',error);}
    loading('Collection disponible','ready');
    status(mediaIncomplete?'Certaines images restent à charger · appuie sur ↻ pour réessayer.':
      dirty?'Enregistré sur cet appareil · synchronisation…':'Synchronisé ✓',mediaIncomplete?'error':dirty?'pending':'ok');
  }
  function rememberCheck(){
    lastCheck=Date.now();
    try{localStorage.setItem(CHECK_KEY,JSON.stringify({revision,at:lastCheck}));}catch(_){}
  }
  function recentlyChecked(){
    if(!initialized || mediaIncomplete)return false;
    try{
      const check=JSON.parse(localStorage.getItem(CHECK_KEY)||'null');
      const age=Date.now()-check?.at;
      return check?.revision===revision && age>=0 && age<CHECK_TTL;
    }catch(_){return false;}
  }
  async function refresh(force=false) {
    if (!bridge.ready || busy || blocked || busyLoading) return;
    if(dirty && !mediaIncomplete) { if(isEditor())void saveNow(); return; }
    if (document.querySelector('dialog[open]') && initialized) return;
    if(!force && recentlyChecked()){status('Collection locale · vérifiée il y a moins d’une minute');return;}
    if(!force && Date.now()-lastCheck<1000)return;
    lastCheck=Date.now();busyLoading=true;
    if(!cachedVisible)loading('Connexion à Supabase…');
    try {
      if(mediaIncomplete && initialized){
        await acceptDelta({changed:{},deleted:{},hashes,revision},Diff.changes(baseDisplay,snapshot()));
        if(dirty && !mediaIncomplete)queueSave();
        return;
      }
      // On an empty/legacy cache, the delta is needed anyway: skip the pre-read.
      if(initialized){
        const current=await remoteVersion();
        if(current===revision){rememberCheck();status('Synchronisé ✓');return;}
      }
      status('Vérification des nouveautés…','pending');
      const delta=await fetchDelta();
      await acceptDelta(delta);
      if(!mediaIncomplete)rememberCheck();
      failures=0;
    } catch(error) {
      console.warn('Rapli : synchronisation indisponible',error);
      if(!cachedVisible)loading('Chargement impossible. Réessaie lorsque la connexion est rétablie.','error');
      status(cachedVisible?'Collection locale disponible · vérification en ligne impossible.':'Collection inaccessible · réessaie la connexion.','error');
    } finally { busyLoading=false; }
  }
  function queueSave(delay=850) {
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{void saveNow();},delay);
  }
  async function saveNow() {
    if(!dirty || !canEdit() || busy)return;
    busy=true;
    const sent=snapshot();
    status('Enregistré sur cet appareil · synchronisation…','pending');
    try {
      await checkpoint().catch(()=>{});
      const edits=Diff.changes(baseDisplay,sent);
      if(!edits.length){dirty=false;await checkpoint().catch(()=>{});status('Synchronisé ✓');return;}
      // Upload only new images in modified records; known image references survive reloads.
      const patches=[];
      for(const edit of edits)patches.push({
        kind:edit.kind,id:edit.id,before:hashes[edit.kind]?.[edit.id]||null,
        after:edit.after===null?null:await transfer(edit.after,'upload')
      });
      const {data,error}=await (await supabase()).rpc('rapli_collection_patch',{
        p_owner:OWNER_ID,p_module:MODULE,p_changes:patches,p_known:hashes
      });
      if(error){if(error.code==='40001'){blockOnConflict();return;}throw error;}
      // Edits made while an upload is in flight belong to the next batch.
      busyLoading=true;
      const newer=Diff.changes(sent,snapshot());
      await acceptDelta(data,newer);
      if(!mediaIncomplete)rememberCheck();
      failures=0;
    }catch(error){
      failures++;
      console.warn('Rapli : envoi en attente',error);
      status('Enregistré sur cet appareil · envoi en attente de connexion.','error');
    }finally{
      busyLoading=false;busy=false;
      if(dirty&&!blocked&&navigator.onLine!==false)queueSave(Math.min(60000,4000*2**Math.min(failures,4)));
    }
  }
  function changed() {
    if(!canEdit())return;
    dirty=true;
    status('Enregistré sur cet appareil · synchronisation…','pending');
    void checkpoint().catch(error=>console.warn('Rapli : journal local inaccessible',error));
    queueSave();
  }
  function scheduleRefresh() {
    if(document.hidden)return;
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{if(dirty && !mediaIncomplete)void saveNow();else void refresh();},400);
  }
  async function boot() {
    if(bootPromise)return bootPromise;
    bootPromise=(async()=>{
      // Cached tiles are visible before any auth/database request finishes.
      await showCachedPreview();
      await window.RapliAdminAccess?.initialize?.();
      if(isEditor()) {
        const ack=knownBaseline();
        if(MODULE==='sports' && ack && ack.hash!==fingerprint(legacyLocal)) {
          if(!cachedVisible){blockOnConflict();return;}
          bridge.previewState(legacyLocal);dirty=true;restoredPending=true;
        } else if(MODULE==='sports' && !ack && !restoredPending &&
            (legacyLocal.records.some(row=>!row.demo)||legacyLocal.logos.length) &&
            (!cachedVisible || !Diff.equal(legacyLocal,snapshot()))) {
          blockOnConflict();return;
        }
        if(restoredPending) {
          // Normalize/persist the journal without losing the state captured before login.
          initialized=true;
          if(!mediaIncomplete)await bridge.replaceState(snapshot());
          await checkpoint().catch(()=>{});
          // Legacy cache has no server fingerprints: hydrate its baseline via a read,
          // then reconcile explicitly instead of blindly overwriting remote changes.
          if(!Object.keys(hashes).length){blockOnConflict();return;}
          bootReady=true;if(mediaIncomplete)await refresh(true);else await saveNow();return;
        }
        if(initialized && !mediaIncomplete){
          if(!Diff.equal(legacyLocal,snapshot()))await bridge.replaceState(snapshot());
          acknowledge(snapshot());
        }
      } else if(dirty) {
        bootReady=true;status('Ajouts locaux en attente · connecte-toi pour les synchroniser.','pending');return;
      }
      bootReady=true;await refresh();
    })().catch(error=>{
      console.warn('Rapli : initialisation impossible',error);
      if(!cachedVisible)loading('Connexion impossible. Réessaie le chargement.','error');
      status('Collection locale conservée · connexion à vérifier.','error');
    });
    return bootPromise;
  }
  window.RapliSharedCollection={changed,canEdit,refresh:()=>refresh(true),
    getStatus:()=>({initialized,revision,dirty,blocked,busy,mediaIncomplete,busyLoading})};
  // Explicit refresh rather than full polling or an always-on Realtime connection.
  const statusElement=document.getElementById('rapli-shared-status-'+MODULE);
  if(statusElement){
    const button=document.createElement('button');
    button.type='button';button.textContent='↻';button.title='Vérifier les nouveautés';
    button.setAttribute('aria-label','Actualiser la collection');
    button.style.cssText='margin-left:8px;border:1px solid #b8c8c9;border-radius:50%;width:28px;height:28px;cursor:pointer;background:linear-gradient(120deg,#d2f2e6,#dbe6f9,#f3dfd8);color:#182b3b';
    button.onclick=()=>{lastCheck=0;if(dirty && !mediaIncomplete)void saveNow();else void refresh(true);};
    statusElement.after(button);
  }
  window.addEventListener('rapli-module-ready',()=>{void boot();},{once:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRefresh();});
  window.addEventListener('focus',scheduleRefresh);
  window.addEventListener('online',()=>{lastCheck=0;scheduleRefresh();});
  window.addEventListener('rapli-admin-access-change',()=>{
    if(!isEditor() || !bootReady || !initialized || blocked || mediaIncomplete)return;
    // A viewer can become editor without a reload. Persist the displayed collection
    // before enabling per-record edits in the module's local database.
    bootReady=false;
    void bridge.replaceState(snapshot()).then(()=>{
      bootReady=true;if(dirty)queueSave(300);else acknowledge(snapshot());
    }).catch(error=>{status('Stockage local inaccessible : édition suspendue.','error');console.warn(error);});
  });
  if(bridge.ready)void boot();
})();
