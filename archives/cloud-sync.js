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

  let context, client, userId, ready = false, connecting = false, uploading = false;
  let suspended = false, conflict = false, pending = false, timer, status = 'Local uniquement';
  let error = false, remote = null, remoteRevision = 0, rowExists = false;
  let lastConfirmed = '', storageReady = false;
  const uploadedImages = new Set();

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
    return {path: userId + '/' + hex + '.' + ext, blob};
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
      if (!path.startsWith(userId + '/') || path.includes('..'))
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
      const result = await client.from(TABLE)
        .select('archive_state,payload,state_revision,updated_at').eq('user_id',userId).maybeSingle();
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
          show('Toutes les données sont synchronisées ✓');
        } else {
          conflict = true;
          show('Deux versions différentes : sélection nécessaire', true);
        }
      } else {
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
        show('Toutes les données sont synchronisées ✓');
        return;
      }
      let output;
      if (!rowExists) {
        const result = await client.from(TABLE)
          .insert({user_id:userId,archive_state:packed,
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
          .eq('user_id',userId).eq('state_revision',remoteRevision)
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

  async function restoreCloud() {
    if (!ready || !remote || !context) return;
    if (!confirm('Restaurer la version Supabase ? Les modifications locales non exportées seront remplacées. Fais d’abord une sauvegarde JSON.')) return;
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
      .eq('user_id',userId).maybeSingle();
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
    }, true);
    window.addEventListener('online', () => {
      if (!ready) { try { if (localStorage.getItem(FLAG)==='1') void start(); } catch (_) {} }
      else if (pending && !conflict) void flush();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ready && pending && !conflict) void flush();
    });
    try { if (localStorage.getItem(FLAG) === '1') void start(); } catch (_) {}
    ui();
  }
  window.RapliCloud = { init, changed, card, ui };
})();
