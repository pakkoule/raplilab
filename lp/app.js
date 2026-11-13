/* Rapli LP — private CD library, IndexedDB backed with shared Supabase bridge. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const uid = () => crypto.randomUUID?.() || ('lp-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const asText=(v,max)=>String(v??'').trim().slice(0,max);
  const now=()=>new Date().toISOString();
  const validImage=s=>typeof s==='string' && (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(s) || /^rapli-private:\/\//i.test(s));
  const normRecord=r=>({
    id:typeof r?.id==='string'&&r.id.length<150?r.id:uid(),
    artist:asText(r?.artist,160),album:asText(r?.album,200),
    status:r?.status==='wish'?'wish':'own',
    editionNote:asText(r?.editionNote,1500),
    tags:Array.isArray(r?.tags)?[...new Set(r.tags.map(t=>asText(t,64)).filter(Boolean))].slice(0,25):[],
    photo:typeof r?.photo==='string'?r.photo:'',
    createdAt:r?.createdAt||now(),updatedAt:r?.updatedAt||now()
  });
  let albums=[],db=null,editing=null,pendingPhoto='',pendingTags=[],isBusy=false,noticeTimer=null;
  let dbAvailable=false,bootFinished=false;
  const dialog=$('album-dialog');
  function notify(message,error=false){
    const el=$('notice');el.textContent=message;el.dataset.error=String(error);
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{if(el.textContent===message)el.textContent='';},6000);
  }
  function listHTML(rows){
    if(!rows.length)return '';
    return rows.map(record=>{
      const image=validImage(record.photo)?'<img src="'+esc(record.photo)+'" alt="Pochette de '+esc(record.album)+' — '+esc(record.artist)+'" loading="lazy">':
        '<div class="placeholder"><svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="8"/><circle cx="32" cy="32" r="2" fill="currentColor"/><path d="M32 6c14 0 26 12 26 26M32 13a19 19 0 0 1 19 19"/></svg>RAPLI LP</div>';
      return '<article class="card" data-id="'+esc(record.id)+'">'+
        '<div class="card-photo">'+image+'</div>'+
        '<div class="card-info">'+
          '<span class="card-artist">'+esc(record.artist)+'</span>'+
          '<strong class="card-album">'+esc(record.album)+'</strong>'+
          (record.editionNote?'<div class="card-note">'+esc(record.editionNote)+'</div>':'')+
          (record.tags.length?'<div class="card-tags">'+record.tags.map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</div>':'')+
          '<div class="card-bottom"><span class="status-pill '+(record.status==='wish'?'wish':'')+'">'+(record.status==='wish'?'ENVIES':'JE POSSÈDE')+'</span>'+
          '<button type="button" class="card-edit" data-edit="'+esc(record.id)+'" aria-label="Modifier '+esc(record.album)+'">MODIFIER</button></div>'+
        '</div></article>';
    }).join('');
  }
  function render(){
    $('count-total').textContent=albums.length;
    $('count-own').textContent=albums.filter(r=>r.status==='own').length;
    $('count-wish').textContent=albums.filter(r=>r.status==='wish').length;
    const selected=$('filter-artist').value;
    const artists=[...new Set(albums.map(r=>r.artist).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    $('filter-artist').innerHTML='<option value="">Tous les artistes</option>'+artists.map(a=>'<option value="'+esc(a)+'">'+esc(a)+'</option>').join('');
    $('filter-artist').value=artists.includes(selected)?selected:'';
    const q=$('search').value.trim().toLocaleLowerCase('fr-FR'),state=$('filter-status').value,artist=$('filter-artist').value;
    let list=albums.filter(r=>(!state||r.status===state)&&(!artist||r.artist===artist)&&(!q||
      [r.artist,r.album,r.editionNote,...r.tags].some(t=>String(t).toLocaleLowerCase('fr-FR').includes(q))));
    const sort=$('sort').value;
    list=[...list].sort((a,b)=>{
      if(sort==='artist')return a.artist.localeCompare(b.artist,'fr')||a.album.localeCompare(b.album,'fr');
      if(sort==='album')return a.album.localeCompare(b.album,'fr');
      return sort==='old'?String(a.createdAt).localeCompare(String(b.createdAt)):
        String(b.createdAt).localeCompare(String(a.createdAt));
    });
    $('cards').innerHTML=listHTML(list);
    $('result-count').textContent=list.length+' résultat'+(list.length>1?'s':'');
    $('empty').hidden=list.length>0;
    if(list.length===0)$('empty').textContent=albums.length?'Aucun album ne correspond à tes filtres.':'Aucun album ici pour le moment. Ajoute ton premier CD !';
  }
  function chipView(){
    $('chips').innerHTML=pendingTags.map((t,i)=>'<span class="edit-chip">'+esc(t)+
      '<button type="button" data-remove-tag="'+i+'" aria-label="Supprimer '+esc(t)+'">×</button></span>').join('');
  }
  function commitTag(){
    const input=$('tag-field');
    const items=input.value.split(/[,;\n]+/).map(s=>asText(s,64)).filter(Boolean);
    for(const item of items){
      if(pendingTags.length>=25)break;
      if(!pendingTags.some(t=>t.toLocaleLowerCase('fr-FR')===item.toLocaleLowerCase('fr-FR')))pendingTags.push(item);
    }
    input.value='';
    chipView();
  }
  function photoPreview(){
    const ok=validImage(pendingPhoto);
    $('photo-preview').hidden=!ok;$('photo-hint').hidden=ok;
    $('remove-photo').hidden=!ok;
    if(ok)$('photo-preview').src=pendingPhoto;else $('photo-preview').removeAttribute('src');
  }
  function openAlbum(id=null){
    const record=id?albums.find(r=>r.id===id):null;
    if(id&&!record)return;
    editing=record?record.id:null;
    pendingTags=[...(record?.tags||[])];
    pendingPhoto=record?.photo||'';
    $('dialog-title').textContent=record?'MODIFIER UN CD':'AJOUTER UN CD';
    $('artist').value=record?.artist||'';$('album').value=record?.album||'';
    $('status').value=record?.status||'own';$('edition-note').value=record?.editionNote||'';
    $('tag-field').value='';$('photo-file').value='';
    $('delete-album').hidden=!record;
    $('submit-album').textContent=record?'ENREGISTRER LES MODIFICATIONS':'ENREGISTRER LE CD';
    chipView();photoPreview();dialog.showModal();
  }
  function closeAlbum(){if(dialog.open)dialog.close();}
  function openDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('rapli-lp-v1',1);
      req.onupgradeneeded=()=>{const store=req.result;if(!store.objectStoreNames.contains('albums'))store.createObjectStore('albums',{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('IndexedDB non disponible'));
    });
  }
  function loadAlbums(){
    return new Promise((resolve,reject)=>{
      const req=db.transaction('albums').objectStore('albums').getAll();
      req.onsuccess=()=>resolve(req.result.map(normRecord));
      req.onerror=()=>reject(req.error);
    });
  }
  function persistAll(rows){
    if(!dbAvailable)return Promise.reject(Error('Stockage local indisponible'));
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('albums','readwrite'),store=tx.objectStore('albums');
      store.clear();for(const row of rows)store.put(row);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Transaction annulée'));
    });
  }
  async function mutate(action){
    if(isBusy) return;
    isBusy=true;
    const previous=albums;
    try{
      const next=action(previous.map(x=>({...x,tags:[...x.tags]})));
      await persistAll(next);
      albums=next;
      render();window.RapliModuleCloud?.changed?.();
      notify('Collection enregistrée ✓');
      return true;
    }catch(e){notify('Enregistrement impossible : '+(e?.message||e),true);return false;}
    finally{isBusy=false;}
  }
  async function photoData(file){
    if(file.size>12*1024*1024)throw Error('Image supérieure à 12 Mo');
    if(!/^(image\/(?:png|jpeg|webp|gif))$/i.test(file.type||'')&&!/\.(png|jpe?g|webp|gif)$/i.test(file.name||''))
      throw Error('Format non pris en charge (PNG, JPG, WEBP ou GIF)');
    const url=URL.createObjectURL(file),img=new Image();
    try{
      await new Promise((resolve,reject)=>{
        img.onload=resolve;img.onerror=()=>reject(Error('Image illisible ou non prise en charge'));
        img.src=url;
      });
      // Preserve proportions: the square is a presentation frame, not a destructive crop.
      const scale=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const result=canvas.toDataURL('image/webp',.88);
      if(!result.startsWith('data:image/webp'))throw Error('Conversion WebP non prise en charge');
      return result;
    }finally{URL.revokeObjectURL(url);}
  }
  async function saveAlbum(event){
    event.preventDefault();
    commitTag();
    const artist=asText($('artist').value,160),album=asText($('album').value,200);
    if(!artist){$('artist').focus();notify('Renseigne un artiste.',true);return;}
    if(!album){$('album').focus();notify('Renseigne un album.',true);return;}
    const existing=editing?albums.find(r=>r.id===editing):null;
    const next=normRecord({
      ...(existing||{}),id:existing?.id||uid(),artist,album,
      status:$('status').value,editionNote:$('edition-note').value,
      tags:pendingTags,photo:pendingPhoto,updatedAt:now(),
      createdAt:existing?.createdAt||now()
    });
    if(isBusy)return;
    isBusy=true;$('submit-album').disabled=true;
    try{
      const updated=[...albums.filter(r=>r.id!==next.id),next];
      await persistAll(updated);
      albums=updated;render();closeAlbum();
      window.RapliModuleCloud?.changed?.();
      notify(existing?'Album modifié ✓':'Album ajouté à la collection ✓');
    }catch(e){notify('Sauvegarde impossible : '+e.message,true);}
    finally{isBusy=false;$('submit-album').disabled=false;}
  }
  async function removeAlbum(){
    if(!editing)return;
    const r=albums.find(x=>x.id===editing);
    if(!r||!confirm('Supprimer définitivement « '+r.album+' » de la collection ?'))return;
    if(await mutate(rows=>rows.filter(x=>x.id!==editing)))closeAlbum();
  }
  function backup(){
    const doc={app:'Rapli LP',version:1,exportedAt:now(),albums};
    const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='Rapli_LP_'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    notify('Sauvegarde JSON téléchargée ✓');
  }
  async function restore(file){
    if(!file||file.size>35*1024*1024)throw Error('Fichier JSON absent ou trop volumineux.');
    const input=JSON.parse(await file.text());
    if(input?.app!=='Rapli LP'||!Array.isArray(input?.albums))throw Error('Ce fichier n’est pas une sauvegarde Rapli LP.');
    if(input.albums.length>10000)throw Error('Collection trop volumineuse.');
    const rows=input.albums.map(normRecord);
    if(rows.some(r=>!r.artist||!r.album))throw Error('Au moins une fiche n’a pas d’artiste ou d’album.');
    if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Identifiants de fiches en doublon.');
    if(!confirm('Remplacer les '+albums.length+' albums actuels par les '+rows.length+' albums importés ? Exporte d’abord une sauvegarde JSON si nécessaire.'))return;
    await mutate(()=>rows);
  }
  function wire(){
    $('add-album').onclick=()=>openAlbum();
    $('add-bottom').onclick=()=>openAlbum();
    $('cards').addEventListener('click',e=>{
      const btn=e.target.closest('[data-edit]');if(btn)openAlbum(btn.dataset.edit);
    });
    $('album-form').addEventListener('submit',saveAlbum);
    dialog.querySelectorAll('[data-dismiss]').forEach(btn=>btn.addEventListener('click',closeAlbum));
    $('delete-album').addEventListener('click',()=>void removeAlbum());
    $('remove-photo').addEventListener('click',()=>{pendingPhoto='';photoPreview();});
    $('photo-file').addEventListener('change',async e=>{
      const f=e.target.files?.[0];if(!f)return;
      try{pendingPhoto=await photoData(f);photoPreview();notify('Pochette prête ✓');}
      catch(err){notify('Import de la pochette impossible : '+err.message,true);}
      e.target.value='';
    });
    $('photo-drop').addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();$('photo-file').click();}
    });
    $('photo-drop').addEventListener('dragover',e=>{e.preventDefault();});
    $('photo-drop').addEventListener('drop',async e=>{
      e.preventDefault();const f=e.dataTransfer.files?.[0];if(!f)return;
      try{pendingPhoto=await photoData(f);photoPreview();}
      catch(err){notify('Import impossible : '+err.message,true);}
    });
    $('tag-field').addEventListener('keydown',e=>{
      if(['Enter',',',';'].includes(e.key)){e.preventDefault();commitTag();}
      if(e.key==='Backspace'&&!e.target.value&&pendingTags.length){pendingTags.pop();chipView();}
    });
    $('tag-field').addEventListener('blur',commitTag);
    $('chips').addEventListener('click',e=>{
      const btn=e.target.closest('[data-remove-tag]');if(!btn)return;
      pendingTags.splice(Number(btn.dataset.removeTag),1);chipView();
    });
    ['search','filter-status','filter-artist','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
    $('clear-filters').addEventListener('click',()=>{
      $('search').value='';$('filter-status').value='';$('filter-artist').value='';$('sort').value='recent';render();
    });
    $('export-json').onclick=backup;
    $('import-json').addEventListener('change',e=>{
      const f=e.target.files?.[0];if(!f)return;
      void restore(f).catch(err=>notify('Import JSON impossible : '+err.message,true));
      e.target.value='';
    });
  }
  const bridge=window.RapliModuleBridge={
    module:'lp',ready:false,
    getState:()=>({records:albums.map(r=>({...r,tags:[...r.tags]})),logos:[]}),
    replaceState:async state=>{
      if(!Array.isArray(state?.records)||!Array.isArray(state?.logos))throw Error('Sauvegarde cloud invalide.');
      const rows=state.records.map(normRecord);
      if(rows.some(r=>!r.artist||!r.album))throw Error('Collection distante incomplète.');
      await persistAll(rows);albums=rows;render();
    },
    notify:message=>notify(message)
  };
  async function boot(){
    try{
      db=await openDB();dbAvailable=true;
      albums=await loadAlbums();bootFinished=true;
      wire();render();bridge.ready=true;
      window.dispatchEvent(new Event('rapli-module-ready'));
    }catch(e){
      console.error('Rapli LP IndexedDB:',e);
      notify('Stockage IndexedDB indisponible. Vérifie les paramètres du navigateur.',true);
    }
  }
  void boot();
})();