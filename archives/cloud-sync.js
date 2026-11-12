/* Rapli Archives — personal full-state synchronization, opt-in and offline-first.
   Private images live in Supabase Storage. Only the publishable browser key is used. */
(() => {
  'use strict';
  const PROJECT_URL = 'https://widiyulvmthbaypdxhbw.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_aietige1gJ1QfPZ6HaHiVA_zwqcJYyF';
  const TABLE = 'rapli_archive_collections';
  const BUCKET = 'rapli-archives-private';
  const FLAG = 'rapli-archives-cloud-enabled-v1';
  const DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,/i;
  const PRIVATE_REF = 'rapli-private://';
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const FIELDS = ['groups', 'variants', 'copies', 'wishlist', 'settings', 'createdAt', 'version'];

  let context, client, userId, ownerId, ready = false, connecting = false, uploading = false;
  let suspended = false, conflict = false, pending = false, timer, status = 'Local uniquement';
  let error = false, remote = null, remoteRevision = 0, rowExists = false;
  let lastConfirmed = '', storageReady = false;
  const uploadedImages = new Set();
  const SYNC_MARK = 'rapli-archives-last-successful-cloud-v1';
  function fingerprint(value) {
    // Fast non-cryptographic change detector. RLS/session security does not use this.
    const str=stable(value);let a=2166136261,b=0x9e3779b9;
    for(let i=0;i<str.length;i++) { a=Math.imul(a^str.charCodeAt(i),16777619); b=Math.imul(b^str.charCodeAt(i),2246822519); }
    return str.length+':'+(a>>>0).toString(36)+':'+(b>>>0).toString(36);
  }
  function rememberSynced(value) {
    try { localStorage.setItem(SYNC_MARK,JSON.stringify({owner:ownerId,signature:fingerprint(value)})); }catch(_){}
  }
  function isLocallyUnchanged(value) {
    try{
      const marker=JSON.parse(localStorage.getItem(SYNC_MARK)||'null');
      return !!marker&&marker.owner===ownerId&&marker.signature===fingerprint(value);
    }catch(_){return false;}
  }

  function state() {
    const a = context.get();
    return Object.fromEntries(FIELDS.filter(k => Object.prototype.hasOwnProperty.call(a, k))
      .map(k => [k, a[k]]));
  }
  function normalize(value) {
    if (!value || !Array.isArray(value.groups) || !Array.isArray(value.variants) ||
        !Array.isArray(value.copies) || !Array.isArray(value.wishlist))
      throw new Error('Sauvegarde cloud invalide : tableaux du catalogue absents.');
    return {
      version: value.version || 2, groups: value.groups, variants: value.variants,
      copies: value.copies, wishlist: value.wishlist, settings: value.settings || {},
      createdAt: value.createdAt || new Date().toISOString()
    };
  }
  function stable(value) {
    return JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v);
  }
  function equal(a, b) { return stable(a) === stable(b); }
  function safeText(value) {
    return String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function ui() {
    const label = document.getElementById('rapli-cloud-status');
    if (label) { label.textContent = status; label.style.color = error ? '#b64d56' : '#3c7966'; }
    const start = document.getElementById('rapli-cloud-start');
    if (start) {
      start.hidden = ready || connecting;
      start.disabled = connecting;
      start.textContent = error ? 'Réessayer la connexion' : 'Activer la sauvegarde cloud';
    }
    const sync = document.getElementById('rapli-cloud-sync');
    if (sync) { sync.hidden = !ready || conflict; sync.disabled = uploading || connecting; }
    const choices = document.getElementById('rapli-cloud-conflict');
    if (choices) choices.hidden = !conflict;
    const pairCode = document.getElementById('rapli-cloud-pair-code');
    const ownerLabel = document.getElementById('rapli-cloud-linked-status');
    if (ownerLabel) ownerLabel.textContent = !ready ? 'Cloud non connecté'
      : ownerId !== userId ? 'Appareil associé à une collection partagée' : 'Appareil principal';
    const issue = document.getElementById('rapli-cloud-issue');
    if (issue) { issue.hidden = !ready || ownerId !== userId; issue.disabled = connecting || uploading; }
    const redeem = document.getElementById('rapli-cloud-redeem');
    if (redeem) redeem.disabled = !ready || connecting || uploading;
    const details = document.getElementById('rapli-cloud-details');
    if (details) details.textContent = ready
      ? 'Catalogue, tuiles, éditions, paramètres et images personnelles. Session liée à ce navigateur.'
      : 'Les données restent d’abord stockées sur cet appareil. Une session anonyme est propre à ce navigateur.';
  }
  function show(text, bad = false) { status = text; error = bad; ui(); }
  function card() {
    return '<section class="rapli-cloud-card" aria-label="Sauvegarde cloud Archives">' +
      '<div class="rapli-cloud-top"><strong>☁ Sauvegarde cloud — Rapli Archives</strong>' +
      '<span id="rapli-cloud-status" aria-live="polite">' + safeText(status) + '</span></div>' +
      '<p id="rapli-cloud-details">Sauvegarde des cartes OWNED et des personnalisations des tuiles et éditions.</p>' +
      '<div class="rapli-cloud-buttons">' +
      '<button type="button" id="rapli-cloud-start" class="primary-button small" data-rapli-cloud="start">Activer la sauvegarde cloud</button>' +
      '<button type="button" id="rapli-cloud-sync" class="secondary-button small" data-rapli-cloud="sync" hidden>Synchroniser maintenant</button></div>' +
      '<div id="rapli-cloud-conflict" hidden><p><strong>Deux versions différentes détectées.</strong> ' +
      'Exporte d’abord ton JSON de sauvegarde. Choisis ensuite quelle version conserver : ' +
      'l’autre sera remplacée, sans fusion automatique.</p>' +
      '<div class="rapli-cloud-buttons"><button type="button" class="secondary-button small" data-rapli-cloud="local">' +
      'Conserver cet appareil (remplacer le cloud)</button><button type="button" class="secondary-button small" ' +
      'data-rapli-cloud="remote">Restaurer le cloud (remplacer cet appareil)</button></div></div>' +
      '<div class="rapli-cloud-pairing" style="margin-top:15px;padding-top:13px;border-top:1px solid #dbe7e1">' +
      '<strong style="display:block;margin-bottom:6px">📱 Même collection sur PC et téléphone</strong>' +
      '<p id="rapli-cloud-linked-status" style="font-size:12px;margin-bottom:8px">Cloud non connecté</p>' +
      '<button type="button" id="rapli-cloud-issue" data-rapli-cloud="issue" class="secondary-button small">Générer un code sur cet appareil</button>' +
      '<div id="rapli-cloud-pair-code" style="font-weight:850;letter-spacing:1px;overflow-wrap:anywhere;margin:8px 0" aria-live="polite"></div>' +
      '<div class="rapli-cloud-buttons" style="margin-top:10px"><input type="text" id="rapli-cloud-pair-input" maxlength="35" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code de liaison du PC" aria-label="Code de liaison" style="padding:8px;min-width:180px;max-width:280px;border:1px solid #bccfca;border-radius:8px;font:inherit" />' +
      '<button type="button" id="rapli-cloud-redeem" data-rapli-cloud="redeem" class="primary-button small">Associer cet appareil</button></div>' +
      '<small>Code à usage unique, valable 10 minutes. Exporte ton JSON avant de restaurer la collection du PC. Ne partage jamais ce code publiquement.</small></div>' +
      '<small>Les références du site restent disponibles hors ligne. Les images personnalisées sont sauvegardées ' +
      'dans un espace privé Supabase. Exporte régulièrement aussi ton JSON. ' +
      'Un autre appareil ne partage pas automatiquement cette session sans appairage.</small></section>';
  }

  function dataToBlob(data) {
    const comma = data.indexOf(',');
    if (comma < 0) throw new Error('Image non conforme');
    const type = (data.slice(5, comma).split(';')[0] || '').toLowerCase();
    const bytes = Uint8Array.from(atob(data.slice(comma + 1)), c => c.charCodeAt(0));
    return new Blob([bytes], {type});
  }
  async function imagePath(value) {
    const match = value.match(DATA_URL);
    if (!match) return null;
    const blob = dataToBlob(value);
    if (blob.size > MAX_IMAGE_SIZE)
      throw new Error('Image personnelle supérieure à 10 Mo : compresse-la avant la synchronisation.');
    if (!globalThis.crypto?.subtle)
      throw new Error('Empreintes SHA-256 indisponibles dans ce navigateur.');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
    const ext = {jpeg:'jpg',png:'png',webp:'webp',gif:'gif'}[match[1].toLowerCase()];
    return {path: ownerId + '/' + hex + '.' + ext, blob};
  }
  async function uploadOne(path, blob) {
    if (uploadedImages.has(path)) return;
    const {error: problem} = await client.storage.from(BUCKET)
      .upload(path, blob, {contentType: blob.type, cacheControl: '3600', upsert: false});
    if (problem && problem.statusCode !== '409' &&
        !/already exists|duplicate/i.test(problem.message || '')) throw problem;
    uploadedImages.add(path);
  }
  async function convertImages(value, upload) {
    if (typeof value === 'string') {
      if (!DATA_URL.test(value)) return value;
      const file = await imagePath(value);
      if (upload) await uploadOne(file.path, file.blob);
      return PRIVATE_REF + file.path;
    }
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value) result.push(await convertImages(item, upload));
      return result;
    }
    if (value && typeof value === 'object') {
      const out = {};
      for (const [key, item] of Object.entries(value))
        out[key] = await convertImages(item, upload);
      return out;
    }
    return value;
  }
  function blobAsDataUrl(blob) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Lecture image impossible'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }
  async function restoreImages(value) {
    if (typeof value === 'string' && value.startsWith(PRIVATE_REF)) {
      const path = value.slice(PRIVATE_REF.length);
      if (!path.startsWith(ownerId + '/') || path.includes('..'))
        throw new Error('Référence image cloud incorrecte');
      const {data, error: problem} = await client.storage.from(BUCKET).download(path);
      if (problem || !data) throw problem || new Error('Image cloud introuvable : ' + path);
      return blobAsDataUrl(data);
    }
    if (Array.isArray(value)) {
      const array = [];
      for (const x of value) array.push(await restoreImages(x));
      return array;
    }
    if (value && typeof value === 'object') {
      const object = {};
      for (const [key, item] of Object.entries(value)) object[key] = await restoreImages(item);
      return object;
    }
    return value;
  }

  async function start() {
    if (connecting || ready || !context) return;
    connecting = true;
    show('Connexion à Supabase…');
    try {
      const sdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm');
      client = sdk.createClient(PROJECT_URL, PUBLIC_KEY, {
        auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}
      });
      const session = await client.auth.getSession();
      if (session.error) throw session.error;
      let user = session.data.session?.user;
      if (!user) {
        const result = await client.auth.signInAnonymously();
        if (result.error) throw result.error;
        user = result.data.user;
      }
      if (!user?.id) throw new Error('Session anonyme indisponible');
      userId = user.id;
      const member = await client.from('rapli_archive_members').select('owner_id')
        .eq('member_id',userId).maybeSingle();
      if (member.error) throw member.error;
      ownerId = member.data?.owner_id || userId;
      const result = await client.from(TABLE)
        .select('archive_state,payload,state_revision,updated_at').eq('user_id',ownerId).maybeSingle();
      if (result.error) throw result.error;
      rowExists = !!result.data;
      remoteRevision = Number(result.data?.state_revision || 0);
      remote = result.data?.archive_state ? normalize(result.data.archive_state) : null;
      ready = true;
      try { localStorage.setItem(FLAG, '1'); } catch (_) {}
      if (remote) {
        const localPacked = await convertImages(state(), false);
        if (equal(localPacked, remote)) {
          lastConfirmed = stable(localPacked);
          rememberSynced(remote);
          show('Toutes les données sont synchronisées ✓');
        } else if (isLocallyUnchanged(localPacked)) {
          // A different device saved a newer version while this one was idle.
          // Only overwrite when we can prove the local archive has not changed.
          await restoreCloud(true);
        } else {
          conflict = true;
          show('Deux versions différentes : sélection nécessaire', true);
        }
      } else {
        if (ownerId !== userId) throw new Error('Collection principale introuvable');
        // Migration from the legacy copies-only row, or first opt-in on this browser.
        // Never replace a populated local catalogue with the old copies-only payload.
        pending = true;
        show('Import initial des données locales prévu…');
      }
    } catch (e) {
      ready = false; conflict = false;
      console.warn('Rapli Archives cloud', e);
      show('Cloud indisponible : ' + (e.message || 'connexion impossible'), true);
    } finally {
      connecting = false;
      ui();
      if (ready && pending && !conflict) setTimeout(() => flush(), 200);
    }
  }

  async function flush() {
    if (!ready || conflict || suspended || !client) return;
    if (uploading || connecting) { pending = true; return; }
    uploading = true;
    pending = false;
    show('Sauvegarde en cours (catalogue et images)…');
    try {
      // Images must be uploaded before the JSON points to them.
      const snapshot = state();
      const packed = normalize(await convertImages(snapshot, true));
      const sameRemote = remote && equal(packed, remote);
      if (sameRemote && !pending) {
        lastConfirmed = stable(packed);
        rememberSynced(packed);
        show('Toutes les données sont synchronisées ✓');
        return;
      }
      let output;
      if (!rowExists) {
        const result = await client.from(TABLE)
          .insert({user_id:ownerId,archive_state:packed,
            payload:{copies:snapshot.copies,wishlist:snapshot.wishlist},state_revision:1,
            updated_at:new Date().toISOString()})
          .select('state_revision').single();
        if (result.error) throw result.error;
        output = result.data;
      } else {
        const result = await client.from(TABLE)
          .update({archive_state:packed,
            payload:{copies:snapshot.copies,wishlist:snapshot.wishlist},
            state_revision:remoteRevision+1,updated_at:new Date().toISOString()})
          .eq('user_id',ownerId).eq('state_revision',remoteRevision)
          .select('state_revision').maybeSingle();
        if (result.error) throw result.error;
        output = result.data;
        if (!output) {
          conflict = true;
          throw new Error('La version cloud a changé depuis la dernière lecture. Rafraîchis avant de choisir laquelle garder.');
        }
      }
      rowExists = true;
      remoteRevision = Number(output.state_revision);
      remote = packed;
      lastConfirmed = stable(packed);
      rememberSynced(packed);
      // Detect a local edit made during image uploads; schedule another push.
      const latest = await convertImages(state(), false);
      if (!equal(latest, packed)) pending = true;
      show(pending ? 'Nouvelles modifications en attente…' : 'Toutes les données sont synchronisées ✓');
    } catch(e) {
      pending = true;
      console.warn('Rapli Archives sync upload error:', e);
      show('Données locales conservées · ' + (e.message || 'sauvegarde cloud en attente'), true);
    } finally {
      uploading = false;
      ui();
      if (pending && ready && !conflict && navigator.onLine) {
        clearTimeout(timer);
        timer = setTimeout(() => { if (!uploading) void flush(); }, 6000);
      }
    }
  }

  async function restoreCloud(silent=false) {
    if (!ready || !remote || !context) return;
    if (!silent && !confirm('Restaurer la version Supabase ? Les modifications locales non exportées seront remplacées. Fais d’abord une sauvegarde JSON.')) return;
    suspended = true;
    show('Restauration du catalogue et des images…');
    try {
      // Download every private image before modifying any local state.
      const hydrated = normalize(await restoreImages(remote));
      const a = context.get();
      const previous = structuredClone(state());
      Object.assign(a, hydrated);
      if (!await context.persist()) {
        Object.assign(a, previous);
        throw new Error('Enregistrement local impossible');
      }
      context.refresh();
      conflict = false;
      pending = false;
      lastConfirmed = stable(remote);
      rememberSynced(remote);
      show('Catalogue et personnalisations restaurés ✓');
    } catch(e) {
      console.warn('Rapli Archives cloud restore error:', e);
      show('Restauration interrompue · données locales conservées : ' + (e.message || ''), true);
    } finally { suspended = false; ui(); }
  }
  async function keepLocal() {
    if (!conflict || !ready) return;
    if (!confirm('Remplacer la version Supabase par toutes les données de cet appareil ? Exporte le JSON avant de continuer.')) return;
    // Re-read latest revision before editing, so concurrent writes cannot silently disappear.
    const result = await client.from(TABLE).select('archive_state,state_revision')
      .eq('user_id',ownerId).maybeSingle();
    if (result.error) { show('Impossible de vérifier la version cloud : ' + result.error.message, true); return; }
    if (Number(result.data?.state_revision || 0) !== remoteRevision) {
      remoteRevision = Number(result.data?.state_revision || 0);
      remote = result.data?.archive_state || null;
      show('Le cloud a changé. Actualise la page avant de remplacer sa version.', true);
      return;
    }
    conflict = false;
    pending = true;
    void flush();
  }
  async function issueCode() {
    if (!ready || ownerId !== userId || uploading) {
      show('Synchronise d’abord la collection principale sur cet appareil.',true);
      return;
    }
    try {
      show('Création du code de liaison…');
      const {data,error:problem}=await client.functions.invoke('rapli-archives-pair',{body:{action:'issue'}});
      if(problem||!data?.code)throw new Error(data?.error||problem?.message||'Code indisponible');
      const el=document.getElementById('rapli-cloud-pair-code');
      if(el)el.textContent=data.code+' · valable 10 minutes';
      show('Code créé : saisis-le sur ton téléphone');
    } catch(e){show('Impossible de créer le code : '+e.message,true);}
  }
  async function redeemCode() {
    if(!ready || uploading) return;
    const input=document.getElementById('rapli-cloud-pair-input');
    const code=(input?.value||'').trim().toUpperCase();
    if(!code){show('Saisis le code affiché sur ton PC',true);return;}
    const consent=confirm('Associer cet appareil à la collection du PC ? Fais une sauvegarde JSON avant de restaurer les données du PC. Les données actuelles du téléphone resteront locales tant que tu ne choisis pas de restaurer le cloud.');
    if(!consent)return;
    try {
      show('Association des appareils…');
      const {data,error:problem}=await client.functions.invoke('rapli-archives-pair',{body:{action:'redeem',code}});
      if(problem || !data?.linked || !data?.owner_id)throw new Error(data?.error||problem?.message||'Code invalide');
      ownerId=data.owner_id;
      // Never send the phone's local state automatically to the newly linked owner.
      clearTimeout(timer); pending=false; conflict=true; remote=null; rowExists=false;
      const result=await client.from(TABLE).select('archive_state,payload,state_revision')
        .eq('user_id',ownerId).maybeSingle();
      if(result.error || !result.data?.archive_state)throw new Error(result.error?.message||'Collection principale introuvable');
      rowExists=true;
      remoteRevision=Number(result.data.state_revision||0);
      remote=normalize(result.data.archive_state);
      show('Appareil associé ✓ · choisis « Restaurer le cloud » pour afficher la même collection.');
      if(input)input.value='';
    } catch(e){show('Liaison impossible : '+e.message,true);}
  }
  async function checkRemoteChanges() {
    if(!ready||uploading||connecting||conflict||pending||suspended)return;
    const latest=await client.from(TABLE).select('archive_state,state_revision').eq('user_id',ownerId).maybeSingle();
    if(latest.error||!latest.data?.archive_state)return;
    const newer=Number(latest.data.state_revision||0);
    if(newer<=remoteRevision)return;
    remoteRevision=newer;remote=normalize(latest.data.archive_state);rowExists=true;
    const localPacked=await convertImages(state(),false);
    if(equal(localPacked,remote)){rememberSynced(remote);return;}
    if(isLocallyUnchanged(localPacked))await restoreCloud(true);
    else{conflict=true;show('Le cloud a changé : choisis la version à garder',true);}
  }
  function changed() {
    if (!ready || conflict || suspended) return;
    pending = true;
    show('Modifications enregistrées localement · synchronisation prévue');
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 1300);
  }
  function init(ctx) {
    context = ctx;
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-rapli-cloud]');
      if (!button) return;
      event.preventDefault(); event.stopPropagation();
      const action = button.dataset.rapliCloud;
      if (action === 'start') void start();
      else if (action === 'sync') { pending = true; void flush(); }
      else if (action === 'remote') void restoreCloud();
      else if (action === 'local') void keepLocal();
      else if (action === 'issue') void issueCode();
      else if (action === 'redeem') void redeemCode();
    }, true);
    window.addEventListener('online', () => {
      if (!ready) { try { if (localStorage.getItem(FLAG)==='1') void start(); } catch (_) {} }
      else if (pending && !conflict) void flush();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !ready) return;
      if (pending && !conflict) void flush();
      else void checkRemoteChanges().catch(e => console.warn('Cloud refresh:',e));
    });
    try { if (localStorage.getItem(FLAG) === '1') void start(); } catch (_) {}
    ui();
  }
  window.RapliCloud = { init, changed, card, ui };
})();
