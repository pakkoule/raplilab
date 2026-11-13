/* RapliLab Cloud Bridge for Time, Sports and Refs.
 * No service role key. Uses the anonymous Supabase session and existing Archives device pairing.
 * Local IndexedDB is authoritative until a safe, revision-checked synchronization completes. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://widiyulvmthbaypdxhbw.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_aietige1gJ1QfPZ6HaHiVA_zwqcJYyF';
  const TABLE = 'rapli_module_collections';
  const BUCKET = 'rapli-archives-private';
  const REF_PREFIX = 'rapli-private://';
  const MAX_IMAGE = 10 * 1024 * 1024;
  const bridge = window.RapliModuleBridge;
  if (!bridge || !['time','sports','refs','stickers','tools','tiers','top10','coach'].includes(bridge.module)) return;
  const MODULE = bridge.module;
  const manualOnly = ['tiers','top10','coach'].includes(MODULE);
  const el = id => document.getElementById(id);
  let client, userId, ownerId, revision = 0, exists = false, ready = false, busy = false;
  let dirty = false, conflict = false, error = false, hydratedBaseline = null;
  let timer, message = 'Connexion cloud…', bootPromise = null, bootComplete = false;
  const uploadCache = new Map(), downloadCache = new Map();
  const baselineKey = 'rapli-cloud-'+MODULE+'-ack-v1';
  function snapshot() {
    const state=bridge.getState();
    if (!state || !Array.isArray(state.records) || !Array.isArray(state.logos)) throw Error('Données locales non disponibles.');
    // IndexedDB getAll may return differently ordered keys across devices.
    const sorted = list => [...list].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    return {records:sorted(state.records),logos:sorted(state.logos)};
  }
  function fingerprint(data) {
    const raw=JSON.stringify(data);
    let first=2166136261,second=0x9e3779b9;
    for(let i=0;i<raw.length;i++){
      first=Math.imul(first^raw.charCodeAt(i),16777619);
      second=Math.imul(second^raw.charCodeAt(i),2246822519);
    }
    return raw.length+':'+(first>>>0).toString(36)+':'+(second>>>0).toString(36);
  }
  function getAck() {
    try {const row=JSON.parse(localStorage.getItem(baselineKey)||'null');return row?.owner===ownerId?row:null;}catch{return null;}
  }
  function ack(state) {
    const hash=fingerprint(state);hydratedBaseline=hash;
    try {localStorage.setItem(baselineKey,JSON.stringify({owner:ownerId,revision,hash}));}catch(e){console.warn('Cloud: marque de synchronisation locale inaccessible',e);}
  }
  function hasPersonalData(state) {return state.records.some(r=>!r.demo)||state.logos.length>0;}
  function isLocalClean(state) {
    const known=getAck();
    return known?.hash === fingerprint(state) || hydratedBaseline===fingerprint(state);
  }
  function setStatus(value,kind) {
    message=value;
    if(kind==='error')error=true;
    if(kind==='ok')error=false;
    paint();
  }
  function paint() {
    const save=el('rapli-module-cloud-save'),refresh=el('rapli-module-cloud-refresh'),status=el('rapli-module-cloud-status');
    const state=busy?'busy':conflict?'conflict':error?'error':dirty?'pending':ready?'synced':'local';
    [save,refresh].forEach(b=>{if(!b)return;b.dataset.cloudState=state;b.disabled=busy||!bridge.ready;});
    if(refresh)refresh.classList.toggle('is-refreshing',busy);
    if(status){status.textContent=message;status.title=message;status.dataset.cloudState=state;}
    if(save)save.title='Enregistrer sur Supabase — '+message;
    if(refresh)refresh.title='Récupérer les modifications de l’autre appareil — '+message;
  }
  function notify(value,kind) {
    setStatus(value,kind);
    if(bridge.notify)bridge.notify(value);
  }
  async function auth() {
    if(!client){
      const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm');
      client=sdk.createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    }
    const session=await client.auth.getSession();
    if(session.error)throw session.error;
    let user=session.data.session?.user;
    if(!user){
      const result=await client.auth.signInAnonymously();
      if(result.error)throw result.error;
      user=result.data.user;
    }
    if(!user?.id)throw Error('Session Supabase indisponible.');
    if(userId!==user.id){userId=user.id;ownerId=user.id;revision=0;exists=false;hydratedBaseline=null;}
    const member=await client.from('rapli_archive_members').select('owner_id').eq('member_id',userId).maybeSingle();
    if(member.error)throw member.error;
    const resolved=member.data?.owner_id||userId;
    if(ownerId!==resolved){ownerId=resolved;revision=0;exists=false;hydratedBaseline=null;}
    return ownerId;
  }
  async function remoteRow() {
    const {data,error:e}=await client.from(TABLE).select('state,state_revision,updated_at')
      .eq('owner_id',ownerId).eq('module',MODULE).maybeSingle();
    if(e)throw e;
    return data;
  }
  function imageReference(source) {
    return typeof source==='string' && source.startsWith(REF_PREFIX);
  }
  function imageData(source) {
    return typeof source==='string' && /^data:image\/(png|jpeg|webp|gif);base64,[\w+/=]+$/i.test(source);
  }
  async function storeImage(source) {
    if(uploadCache.has(source))return uploadCache.get(source);
    const response=await fetch(source);
    if(!response.ok)throw Error('Image locale illisible.');
    const blob=await response.blob();
    if(blob.size>MAX_IMAGE)throw Error('Image supérieure à 10 Mo : utilise un format plus compact.');
    const mime=(blob.type||'').toLowerCase();
    const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[mime];
    if(!ext)throw Error('Format image non pris en charge.');
    const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    const hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const path=ownerId+'/'+MODULE+'/'+hex+'.'+ext;
    const uploaded=await client.storage.from(BUCKET).upload(path,blob,{contentType:mime,upsert:true});
    if(uploaded.error)throw uploaded.error;
    const result=REF_PREFIX+path;
    uploadCache.set(source,result);
    return result;
  }
  async function transform(data,direction) {
    if(typeof data==='string'){
      if(direction==='upload'&&imageData(data))return storeImage(data);
      if(direction==='download'&&imageReference(data)){
        if(downloadCache.has(data))return downloadCache.get(data);
        const path=data.slice(REF_PREFIX.length);
        if(!path.startsWith(ownerId+'/'+MODULE+'/') ||
           !new RegExp('^'+ownerId+'/'+MODULE+'/[a-f0-9]{64}\\.(png|jpg|webp|gif)$').test(path))
          throw Error('Référence image cloud non autorisée.');
        const {data:blob,error:e}=await client.storage.from(BUCKET).download(path);
        if(e)throw e;
        const result=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(String(reader.result||''));
          reader.onerror=()=>reject(reader.error||Error('Image inaccessible'));
          reader.readAsDataURL(blob);
        });
        downloadCache.set(data,result);
        return result;
      }
      return data;
    }
    if(Array.isArray(data)){
      const output=[];
      for(const item of data)output.push(await transform(item,direction));
      return output;
    }
    if(data&&typeof data==='object'){
      const result={};
      for(const [key,value] of Object.entries(data))result[key]=await transform(value,direction);
      return result;
    }
    return data;
  }
  async function loadRemote(row,manual) {
    if(!row?.state || !Array.isArray(row.state.records) || !Array.isArray(row.state.logos))
      throw Error('Sauvegarde Supabase invalide.');
    const local=snapshot();
    if(!isLocalClean(local) && (hasPersonalData(local) || !!getAck())){
      if(!manual){
        conflict=true;setStatus('Versions différentes — choisis ↻ pour confirmer','error');
        return false;
      }
      if(!confirm('Des fiches locales diffèrent du cloud. Restaurer la version Supabase ? Les modifications locales non exportées seront remplacées. Exporte un JSON avant de confirmer.'))
        return false;
    }
    const state=await transform(row.state,'download');
    await bridge.replaceState(state);
    revision=Number(row.state_revision||0);exists=true;ack(snapshot());dirty=false;conflict=false;
    setStatus('Collection récupérée ✓','ok');
    return true;
  }
  async function saveNow(fromAuto=false) {
    if(!bridge.ready){setStatus('Application non initialisée','error');return false;}
    if(bootPromise&&!bootComplete)await bootPromise;
    if(busy)return false;
    busy=true;paint();
    try{
      await auth();
      ready=true;
      const local=snapshot(),hash=fingerprint(local);
      const row=await remoteRow();
      const serverRev=Number(row?.state_revision||0);
      const saved=getAck();
      const seenRev=saved?.revision ?? revision;
      if(row && serverRev!==seenRev){
        if(fromAuto){
          conflict=true;setStatus('Cloud modifié sur un autre appareil — ↻', 'error');
          return false;
        }
        const replace=confirm('Le cloud contient une autre version. Envoyer les données de cet appareil la remplacerait. Continuer ?');
        if(!replace){
          conflict=true;setStatus('Conflit de versions — ↻ pour récupérer', 'error');
          return false;
        }
      } else if(row && !saved && !isLocalClean(local)) {
        if(fromAuto){conflict=true;setStatus('Deux collections présentes — ↻ pour choisir','error');return false;}
        if(!confirm('Une collection existe déjà dans Supabase. La remplacer par celle de cet appareil ?'))return false;
      }
      const transformed=await transform(local,'upload');
      let result;
      if(row){
        result=await client.from(TABLE)
          .update({state:transformed,state_revision:serverRev+1,updated_at:new Date().toISOString()})
          .eq('owner_id',ownerId).eq('module',MODULE).eq('state_revision',serverRev)
          .select('state_revision').maybeSingle();
      }else{
        result=await client.from(TABLE)
          .insert({owner_id:ownerId,module:MODULE,state:transformed,state_revision:1})
          .select('state_revision').maybeSingle();
      }
      if(result.error)throw result.error;
      if(!result.data)throw Error('La sauvegarde cloud a changé entre-temps. Actualise avant de réessayer.');
      revision=Number(result.data.state_revision||serverRev+1);exists=true;ack(local);
      conflict=false;error=false;
      dirty=fingerprint(snapshot())!==hash;
      setStatus(dirty?'Modifications en attente de sauvegarde':'Enregistré sur Supabase ✓','ok');
      if(dirty&&!manualOnly)queueSave();
      return true;
    }catch(e){
      console.warn('Rapli '+MODULE+' cloud save:',e);
      error=true;setStatus('Envoi impossible : '+(e?.message||'connexion'),'error');
      return false;
    }finally{busy=false;paint();}
  }
  async function refresh(manual=true) {
    if(!bridge.ready){setStatus('Application non initialisée','error');return false;}
    if(manual&&bootPromise&&!bootComplete)await bootPromise;
    if(busy)return false;
    busy=true;paint();
    try{
      await auth();
      ready=true;
      const row=await remoteRow();
      if(!row){
        revision=0;exists=false;setStatus('Aucune nouvelle sauvegarde cloud pour cet onglet','ok');
        return true; // No remote copy is a successful no-op, never delete local records.
      }
      const serverRev=Number(row.state_revision||0);
      const local=snapshot();
      const acked=getAck();
      if(acked?.revision===serverRev && isLocalClean(local)){
        revision=serverRev;exists=true;conflict=false;dirty=false;
        setStatus('Déjà à jour ✓','ok');return true;
      }
      return await loadRemote(row,manual);
    }catch(e){
      console.warn('Rapli '+MODULE+' cloud refresh:',e);
      error=true;setStatus('Actualisation impossible : '+(e?.message||'connexion'),'error');
      return false;
    }finally{busy=false;paint();}
  }
  function queueSave() {
    if(manualOnly)return; // Tiers List: explicit manual saves only.
    clearTimeout(timer);
    timer=setTimeout(()=>{if(dirty&&!conflict&&!busy)void saveNow(true);},1400);
  }
  function changed() {
    if(!bridge.ready)return;
    dirty=true;
    if(ready&&!conflict&&!manualOnly)queueSave();
    setStatus(conflict?'Conflit cloud — actualise avant de continuer':'Modifications locales à enregistrer','pending');
  }
  async function boot(){
    if(ready||busy)return;
    setStatus('Connexion Supabase…');
    try{
      await auth();
      const row=await remoteRow();
      ready=true;exists=!!row;revision=Number(row?.state_revision||0);
      const local=snapshot(),known=getAck();
      if(row){
        if(known?.revision===revision && known.hash===fingerprint(local)){
          ack(local);dirty=false;setStatus('Cloud synchronisé ✓','ok');
        }else if(known?.revision===revision){
          // Offline edits: the cloud has not changed since the last acknowledged sync.
          // Upload locally modified records, including deletions, rather than restoring over them.
          dirty=true;conflict=false;
          setStatus('Modifications locales hors ligne — envoi en attente','pending');
          if(!manualOnly)queueSave();
        }else{
          // Remote revision changed, or a new device has no acknowledged baseline.
          // Restore only if there is no real local collection to overwrite.
          await refresh(false);
        }
      }else if(hasPersonalData(local)){
        dirty=true;setStatus(manualOnly?'Clique Enregistrer pour envoyer dans le cloud':'Première sauvegarde cloud…','ok');if(!manualOnly)queueSave();
      }else{
        dirty=false;setStatus('Cloud connecté · prêt à enregistrer','ok');
      }
    }catch(e){
      console.warn('Rapli '+MODULE+' cloud init:',e);
      setStatus('Cloud indisponible : '+(e?.message||'connexion'),'error');
    }
  }
  el('rapli-module-cloud-save')?.addEventListener('click',()=>{void saveNow(false).then(ok=>{if(ok)notify('Enregistré sur Supabase ✓','ok');});});
  el('rapli-module-cloud-refresh')?.addEventListener('click',()=>{void refresh(true).then(ok=>{if(ok)notify('Synchronisation vérifiée ✓','ok');});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready&&!dirty&&!busy)void refresh(false);});
  window.addEventListener('focus',()=>{if(ready&&!dirty&&!busy)void refresh(false);});
  function startBoot(){
    if(!bootPromise)bootPromise=boot().finally(()=>{bootComplete=true;});
    return bootPromise;
  }
  window.RapliModuleCloud={
    changed,saveNow,refresh,
    getStatus:()=>({ready,busy,dirty,conflict,error,exists,message,module:MODULE,localReady:!!bridge.ready})
  };
  // The portal only exchanges status messages. Raw records never leave the iframe
  // except through its own authenticated, revision-checked Supabase client.
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.origin!==location.origin ||
       event.data?.type!=='RAPLI_GLOBAL_SYNC_REQUEST')return;
    const {id,operation,module}=event.data;
    if(typeof id!=='string'||id.length>90||module!==MODULE||
       !['save','refresh'].includes(operation))return;
    void(async()=>{
      let success=false;
      try{
        if(bridge.ready){
          // Global save never asks to force-overwrite another device's newer data.
          success=manualOnly && operation==='save' && (MODULE==='tiers'?window.RapliTiers?.hasUnsaved?.():MODULE==='top10'?window.RapliTop10?.hasUnsaved?.():window.RapliCoach?.hasUnsaved?.())
            ? !!(await (MODULE==='tiers'?window.RapliTiers.saveCurrent():MODULE==='top10'?window.RapliTop10.saveCurrent():window.RapliCoach.saveCurrent()))
            : operation==='save'?await saveNow(true):await refresh(true);
        }else{
          setStatus('Application non initialisée','error');
        }
      }catch(e){
        setStatus('Synchronisation impossible : '+(e?.message||'erreur inconnue'),'error');
      }
      window.parent.postMessage({
        type:'RAPLI_GLOBAL_SYNC_RESULT',id,module:MODULE,operation,
        success:!!success,message,conflict:!!conflict
      },location.origin);
    })();
  });
  paint();
  if(bridge.ready)void startBoot();
  else window.addEventListener('rapli-module-ready',()=>void startBoot(),{once:true});
})();