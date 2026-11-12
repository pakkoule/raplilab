/* Rapli Archives — sauvegarde cloud facultative, RLS, anonymat par appareil.
   Aucun contenu de ce fichier ne nécessite une clé service_role. */
(() => {
  'use strict';
  const PROJECT_URL = 'https://widiyulvmthbaypdxhbw.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_aietige1gJ1QfPZ6HaHiVA_zwqcJYyF';
  const TABLE = 'rapli_archive_collections';
  const FLAG = 'rapli-archives-cloud-enabled-v1';
  let context=null, client=null, userId=null, ready=false, busy=false, blocked=false, suspended=false, timer=0, pending=false, remoteData=null, label='Local uniquement', error=false;
  const getData=()=>({copies:context.get().copies||[],wishlist:context.get().wishlist||[]});
  const normalize=(v)=>({copies:Array.isArray(v?.copies)?v.copies:[],wishlist:Array.isArray(v?.wishlist)?v.wishlist:[]});
  const stable=(v)=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  const matches=(a,b)=>stable(normalize(a))===stable(normalize(b));
  const hasData=(x)=>!!(x?.copies?.length||x?.wishlist?.length);
  function ui(){
    const status=document.getElementById('rapli-cloud-status');
    if(status){status.textContent=label;status.style.color=error?'#b64d56':'#547e71';}
    const start=document.getElementById('rapli-cloud-start');
    if(start){start.hidden=ready||busy;start.disabled=busy;start.textContent=error?'Réessayer la connexion':'Activer la sauvegarde cloud';}
    const sync=document.getElementById('rapli-cloud-sync');if(sync){sync.hidden=!ready||blocked;sync.disabled=busy;}
    const decisions=document.getElementById('rapli-cloud-conflict');if(decisions)decisions.hidden=!blocked;
    const note=document.getElementById('rapli-cloud-note');if(note){note.textContent=ready?'Session anonyme liée à ce navigateur. Une autre machine utilise une collection distincte sans appairage.':'Ta collection reste sur cet appareil tant que le cloud n’est pas activé.';}
  }
  function setStatus(next,isError=false){label=next;error=isError;ui();}
  function card(){return '<section class="rapli-cloud-card"><div class="rapli-cloud-top"><strong>☁ Sauvegarde de ma collection</strong><span id="rapli-cloud-status">'+escapeText(label)+'</span></div><p id="rapli-cloud-note">Ta collection reste sur cet appareil tant que le cloud n’est pas activé.</p><div class="rapli-cloud-buttons"><button type="button" id="rapli-cloud-start" data-rapli-cloud="start" class="primary-button small">Activer la sauvegarde cloud</button><button type="button" id="rapli-cloud-sync" data-rapli-cloud="sync" class="secondary-button small" hidden>Synchroniser maintenant</button></div><div id="rapli-cloud-conflict" hidden><p><strong>Deux collections différentes détectées.</strong> Aucun remplacement automatique. Choisis la version à conserver avant de synchroniser.</p><div class="rapli-cloud-buttons"><button type="button" class="secondary-button small" data-rapli-cloud="local">Garder cette collection</button><button type="button" class="secondary-button small" data-rapli-cloud="remote">Restaurer la version cloud</button></div></div><small>Synchronise les cartes OWNED, leurs exemplaires et la wishlist, sans écran de connexion. Les nouvelles références personnalisées hors catalogue ne sont pas encore partagées entre appareils. Conserve également une sauvegarde JSON.</small></section>';}
  function escapeText(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  async function connect(){
    if(busy||ready||!context)return;
    busy=true;setStatus('Connexion à Supabase…');
    try {
      const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.83.0/+esm');
      client=sdk.createClient(PROJECT_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const session=await client.auth.getSession();if(session.error)throw session.error;
      let user=session.data.session?.user;
      if(!user){const result=await client.auth.signInAnonymously();if(result.error)throw result.error;user=result.data.user;}
      if(!user?.id)throw new Error('Session anonyme indisponible');
      userId=user.id;
      const res=await client.from(TABLE).select('payload,updated_at').eq('user_id',userId).maybeSingle();
      if(res.error)throw res.error;
      remoteData=res.data?normalize(res.data.payload):null;
      const local=getData();
      ready=true;blocked=false;
      try{localStorage.setItem(FLAG,'1');}catch(_){}
      if(remoteData){
        if(!hasData(local)&&hasData(remoteData)){
          await apply(remoteData);setStatus('Collection cloud restaurée ✓');
        }else if(!matches(local,remoteData)){
          blocked=true;setStatus('Conflit : choisis la collection à conserver',true);
        }else setStatus('Collection synchronisée ✓');
      }else if(hasData(local)){
        await flush(true);
      }else setStatus('Cloud activé · collection vide');
    }catch(e){
      ready=false;client=null;userId=null;blocked=false;
      try{localStorage.removeItem(FLAG);}catch(_){}
      console.warn('Rapli cloud indisponible',e);
      setStatus('Cloud indisponible : '+(e.message||'activer Anonymous Sign-Ins dans Supabase'),true);
    }finally{busy=false;ui();}
  }
  async function apply(data){
    if(!context)return;
    suspended=true;
    try{
      const arc=context.get(),ids=new Set(arc.variants.map(v=>v.id));
      // Ne restaurer que les exemplaires dont la référence existe déjà dans le catalogue local.
      arc.copies=normalize(data).copies.filter(c=>c&&typeof c.id==='string'&&ids.has(c.variantId));
      arc.wishlist=normalize(data).wishlist.filter(w=>w&&typeof w.id==='string'&&ids.has(w.variantId));
      await context.persist();
      context.refresh();
    }finally{suspended=false;}
  }
  async function flush(force=false){
    if(!ready||blocked||suspended){return;}
    if(busy){pending=true;return;}
    busy=true;setStatus('Synchronisation en cours…');
    try{
      const payload=getData();
      const write=await client.from(TABLE).upsert({user_id:userId,payload,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(write.error)throw write.error;
      remoteData=normalize(payload);pending=false;setStatus('Collection synchronisée ✓');
    }catch(e){
      pending=true;
      console.warn('Échec synchronisation Rapli',e);
      setStatus('Modifications locales conservées · cloud en attente',true);
    }finally{
      busy=false;ui();
      if(pending&&navigator.onLine&&ready&&!blocked){/* clic de synchronisation pour retenter, pas de boucle réseau */}
    }
  }
  function changed(){
    if(!ready||blocked||suspended)return;
    pending=true;clearTimeout(timer);timer=setTimeout(()=>flush(),1100);setStatus('Modifications locales · synchronisation prévue');
  }
  async function decide(mode){
    if(!blocked||!ready||!remoteData)return;
    if(mode==='remote'){
      await apply(remoteData);blocked=false;pending=false;setStatus('Collection cloud restaurée ✓');
    }else{
      blocked=false;pending=true;await flush(true);
    }
    ui();
  }
  function init(ctx){
    context=ctx;
    document.addEventListener('click',e=>{
      const button=e.target.closest('[data-rapli-cloud]');if(!button)return;
      e.preventDefault();
      const action=button.dataset.rapliCloud;
      if(action==='start')connect();
      else if(action==='sync')flush(true);
      else if(action==='local'||action==='remote')decide(action);
    });
    window.addEventListener('online',()=>{if(ready&&!blocked&&pending)flush();});
    try{if(localStorage.getItem(FLAG)==='1')connect();}catch(_){}
    ui();
  }
  window.RapliCloud={init,changed,card,ui};
})();
