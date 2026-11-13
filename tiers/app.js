/* Rapli Tiers List — state, rendering and manual persistence */
(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const uid=()=>crypto.randomUUID?crypto.randomUUID():'r-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
const defSettings=()=>({rankWidth:30,tileSize:90,ratio:'square',fit:'cover',shape:'square',tileBackground:'#eeeeee',textBackground:'#d9b87c',canvasBackground:'#f1eee9',scale:3,showEmpty:true,showCaptions:true});
const defList=()=>({id:uid(),title:'Nouvelle Tier List',description:'',updated:null,settings:defSettings(),waiting:[],elements:[],ranks:['S','A','B','C','D'].map((name,i)=>({id:uid(),name,bg:['#e47878','#efa76c','#e9cc72','#91bc85','#83b6c9'][i],fg:'#202020',font:22,minHeight:75,items:[]}))});
let library=[],current=defList(),dirty=false,panel='',rankId='',editId='',selected=new Set(),selectionMode=false,picked=null,undo=[],redo=[],db=null,busy=false,dragId=null,pointerDrag=null;
const element=i=>current.elements.find(x=>x.id===i),rank=i=>current.ranks.find(x=>x.id===i);
const zone=i=>i==='waiting'?current.waiting:rank(i)?.items;
const canvasColor=h=>{const c=h.replace('#','');const v=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4));return v[0]*.2126+v[1]*.7152+v[2]*.0722>.179?'#202020':'#ffffff';};
function notice(m,error=false){const n=$('#notice');n.textContent=m||'';n.dataset.error=String(error);clearTimeout(notice.timer);if(m)notice.timer=setTimeout(()=>{if(n.textContent===m)n.textContent='';},5500);}
function markDirty(v=true){dirty=v;$('#save-dot').hidden=!v;if(v)window.RapliModuleCloud?.changed?.();}
function modify(fn){undo.push(JSON.stringify(current));if(undo.length>24)undo.shift();redo=[];fn();markDirty();render();}
function historyStep(a,b){if(!a.length)return;b.push(JSON.stringify(current));current=JSON.parse(a.pop());markDirty();render();}
function discardOK(){return !dirty||confirm('Des modifications ne sont pas enregistrées. Abandonner ces modifications ?');}
function openStore(){return new Promise((resolve,reject)=>{const q=indexedDB.open('rapli-tiers-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('collections');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
function readStore(){return new Promise((resolve,reject)=>{const q=db.transaction('collections').objectStore('collections').get('saved');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
function writeStore(){return new Promise((resolve,reject)=>{const q=db.transaction('collections','readwrite').objectStore('collections').put({library,activeId:current.id},'saved');q.onsuccess=resolve;q.onerror=()=>reject(q.error);});}
function newTier(){if(!discardOK())return;current=defList();undo=[];redo=[];panel='';selectionMode=false;selected.clear();picked=null;markDirty();render();$('#tier-title').focus();$('#tier-title').select();}
function openTier(l){if(!l||!discardOK())return;current=clone(l);undo=[];redo=[];panel='';selectionMode=false;selected.clear();picked=null;markDirty(false);render();}
async function saveTier(){if(busy)return;busy=true;$('#save').disabled=true;
 try{current.title=current.title.trim()||'Nouvelle Tier List';current.updated=new Date().toISOString();const i=library.findIndex(x=>x.id===current.id);if(i<0)library.unshift(clone(current));else library[i]=clone(current);await writeStore();markDirty(false);render();
 const cloud=window.RapliModuleCloud;const ok=cloud?await cloud.saveNow(false):false;
 notice(ok?'Classement sauvegardé sur cet appareil et Supabase ✓':'Sauvegarde locale réussie · Cloud à synchroniser via ENREGISTRER',false);return !!ok;}
 catch(e){notice('Enregistrement impossible : '+e.message,true);markDirty();return false;}
 finally{busy=false;$('#save').disabled=false;}}
function move(ids,target,before=null){if(!zone(target)||!ids.length)return;modify(()=>{const set=new Set(ids);current.waiting=current.waiting.filter(x=>!set.has(x));current.ranks.forEach(r=>r.items=r.items.filter(x=>!set.has(x)));const dest=zone(target);let at=before?dest.indexOf(before):-1;if(at<0)at=dest.length;dest.splice(at,0,...ids.filter(i=>!!element(i)));});selected.clear();selectionMode=false;picked=null;render();}
function removeElements(ids){if(!ids.length)return;modify(()=>{const set=new Set(ids);current.elements=current.elements.filter(x=>!set.has(x.id));current.waiting=current.waiting.filter(x=>!set.has(x));current.ranks.forEach(r=>r.items=r.items.filter(x=>!set.has(x)));});selected.clear();selectionMode=false;picked=null;render();}
function tileDimensions(e){const s=current.settings,w=s.tileSize;let h=w;if(s.ratio==='portrait')h=Math.round(w*4/3);else if(s.ratio==='landscape')h=Math.round(w*3/4);else if(s.ratio==='original'&&e.w&&e.h)h=Math.round(w*e.h/e.w);
 if(e.type==='text')h=Math.max(h,Math.ceil((e.text||'').length/Math.max(5,Math.floor(w/9)))*12+8);return {w,h:Math.min(650,Math.max(35,h))};}
function tileHTML(i){const e=element(i);if(!e)return'';const d=tileDimensions(e),s=current.settings,r=s.shape==='circle'?'50%':s.shape==='round'?'9px':'0px';
 let inside=e.type==='text'?'<div class="tile-text" style="font-size:16px;color:'+canvasColor(s.textBackground)+'">'+esc(e.text)+'</div>':'<img alt="'+esc(e.name||e.text||'Image')+'" src="'+esc(e.src)+'" draggable="false">';
 if(e.type!=='text'&&e.text&&s.showCaptions)inside+='<span class="caption">'+esc(e.text)+'</span>';
 return '<div class="tile '+(picked===i?'is-pick ':'')+(selected.has(i)?'is-selected':'')+'" data-item="'+esc(i)+'" draggable="true" role="button" tabindex="0" style="width:'+d.w+'px;height:'+d.h+'px;--tile-bg:'+(e.type==='text'?s.textBackground:s.tileBackground)+';--tile-radius:'+r+';--tile-fit:'+s.fit+'">'+inside+'<button class="tile-x" type="button" data-remove="'+esc(i)+'" aria-label="Supprimer">×</button><button class="tile-grip" type="button" data-grip="'+esc(i)+'" aria-label="Déplacer la vignette">⠿</button><button class="tile-edit" type="button" data-edit="'+esc(i)+'" aria-label="Modifier">✎</button></div>';
}
function renderBoard(){
 $('#board').innerHTML=current.ranks.map(r=>'<div class="tier-row" data-rank="'+esc(r.id)+'" draggable="true" style="min-height:'+r.minHeight+'px"><button type="button" class="tier-name" draggable="true" data-rank-open="'+esc(r.id)+'" style="width:'+current.settings.rankWidth+'%;min-height:'+r.minHeight+'px;background:'+r.bg+';color:'+r.fg+';font-size:'+r.font+'px"><span>'+esc(r.name)+'</span><small class="rank-count">'+r.items.length+'</small><span class="rank-grip" title="Faire glisser le rang" aria-hidden="true">⠿</span></button><div class="tier-zone" data-zone="'+esc(r.id)+'" style="min-height:'+r.minHeight+'px">'+r.items.map(tileHTML).join('')+'</div></div>').join('');
 $('#waiting').innerHTML=current.waiting.map(tileHTML).join('');$('#waiting-count').textContent=current.waiting.length;document.body.classList.toggle('selection-active',selectionMode);
 $('#group-bar').hidden=!selectionMode;$('#group-count').textContent=selected.size+' élément(s) sélectionné(s)';$('#select-mode').textContent=selectionMode?'TERMINER':'SÉLECTIONNER';$('#undo').disabled=!undo.length;$('#redo').disabled=!redo.length;
 const s=$('#select-scope'),previous=s.value;s.innerHTML='<option value="">Choisir une zone</option><option value="all">Classement entier</option><option value="waiting">Zone d’attente</option>'+current.ranks.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+'</option>').join('');s.value=previous;
}
const input=(label,key,value,type='text',extra='')=>'<label class="field">'+label+'<input id="'+key+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const choose=(label,key,value,opts)=>'<label class="field">'+label+'<select id="'+key+'">'+opts.map(o=>'<option value="'+esc(o[0])+'" '+(String(o[0])===String(value)?'selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select></label>';
const check=(label,key,v)=>'<label class="field inline">'+label+'<input id="'+key+'" type="checkbox" '+(v?'checked':'')+'></label>';
const heading=label=>'<div class="panel-head"><h2>'+label+'</h2><button type="button" class="plain" data-close aria-label="Fermer">✕</button></div>';
function render(){ $('#tier-title').value=current.title;$('#save-dot').hidden=!dirty;renderBoard();renderPanel();const cloud=window.RapliModuleCloud?.getStatus?.();$('#cloud-status').textContent=cloud?.message||'Sauvegarde manuelle';}
function togglePanel(v){panel=panel===v?'':v;renderPanel();}
function renderPanel(){ $$('[data-panel]').forEach(b=>b.classList.toggle('is-open',panel===b.dataset.panel));const p=$('#settings-panel');if(!panel){p.hidden=true;p.innerHTML='';return;}p.hidden=false;
 if(panel==='library'){p.innerHTML=heading('MES TIER LISTS')+'<div class="panel-grid">'+input('Rechercher','lib-search','','search','placeholder="Nom du classement"')+choose('Trier','lib-sort','recent',[['recent','Dernière sauvegarde'],['old','Plus ancienne'],['az','Nom A–Z'],['za','Nom Z–A']])+'</div><div class="button-row"><button type="button" class="btn primary" data-create>+ NOUVELLE</button></div><div id="library-list"></div>';renderLibrary();return;}
 if(panel==='ranks'){const r=rank(rankId)||current.ranks[0];if(!r)return;rankId=r.id;p.innerHTML=heading('PERSONNALISATION DES RANGS')+'<div class="panel-grid">'+choose('Rang sélectionné','rank-select',r.id,current.ranks.map(x=>[x.id,x.name]))+input('Intitulé','rank-name',r.name)+input('Couleur du fond','rank-bg',r.bg,'color')+input('Couleur du texte','rank-fg',r.fg,'color')+input('Taille du texte (px)','rank-font',r.font,'number','min="8" max="52"')+input('Hauteur minimale (px)','rank-height',r.minHeight,'number','min="28" max="800"')+'<label class="field">Largeur des rangs <span id="width-label">'+current.settings.rankWidth+' %</span><input id="rank-width" type="range" min="15" max="50" value="'+current.settings.rankWidth+'"></label></div><div class="button-row"><button type="button" class="btn soft" data-add-rank>+ RANG EN DESSOUS</button><button type="button" class="btn soft" data-rank-up>↑ MONTER</button><button type="button" class="btn soft" data-rank-down>↓ DESCENDRE</button><button type="button" class="btn danger" data-delete-rank>SUPPRIMER</button><button type="button" class="btn soft" data-clear-board>VIDER LE CLASSEMENT</button></div><p class="panel-note">Hauteur minimale : le rang s’agrandit si nécessaire. Glisse son intitulé pour réorganiser les rangs.</p>';return;}
 if(panel==='elements'){const e=editId?element(editId):null;p.innerHTML=heading('AJOUT ET ÉDITION')+'<div class="panel-grid"><label class="field">Texte ou légende<textarea id="element-text" maxlength="5000" placeholder="Mot, nom ou phrase…">'+esc(e?.text||'')+'</textarea></label><div class="field">Importer des images<button type="button" class="btn soft" data-import>IMPORT MULTIPLE</button><button type="button" class="btn soft" data-import-url>IMAGE PAR URL</button><small>PNG/JPG/WebP/HEIC si pris en charge ; copier-coller disponible.</small></div></div><div class="button-row"><button type="button" class="btn primary" data-save-text>'+(e?'ENREGISTRER LE TEXTE':'+ CRÉER UNE VIGNETTE TEXTE')+'</button></div>';return;}
 if(panel==='style'){const s=current.settings;p.innerHTML=heading('STYLE GLOBAL DES VIGNETTES')+'<div class="panel-grid">'+input('Taille des vignettes (px)','tile-size',s.tileSize,'number','min="30" max="240"')+choose('Format','tile-ratio',s.ratio,[['square','Carré'],['portrait','Portrait 3:4'],['landscape','Paysage 4:3'],['original','Proportions originales']])+choose('Cadrage','tile-fit',s.fit,[['cover','Remplir / recadrer'],['contain','Image entière']])+choose('Forme','tile-shape',s.shape,[['square','Angles droits'],['round','Coins arrondis'],['circle','Cercle']])+input('Fond des images','tile-bg',s.tileBackground,'color')+input('Fond des vignettes texte','text-bg',s.textBackground,'color')+'</div>';return;}
 if(panel==='export'){const s=current.settings;p.innerHTML=heading('EXPORT PNG')+'<div class="panel-grid">'+choose('Résolution','export-scale',s.scale,[['1','×1 — 1 000 px'],['2','×2 — 2 000 px'],['3','×3 — 3 000 px'],['4','×4 — 4 000 px']])+input('Fond du PNG','export-bg',s.canvasBackground,'color')+check('Afficher les rangs vides','export-empty',s.showEmpty)+check('Afficher les légendes','export-captions',s.showCaptions)+'</div><p class="panel-note">Titre centré, PNG sans marges extérieures, 1 000 px de référence. Zone d’attente toujours exclue.</p><div class="button-row"><button class="btn primary" id="export-now" type="button">⇩ EXPORTER PNG</button></div>';return;}
}
function renderLibrary(){const el=$('#library-list');if(!el)return;const term=($('#lib-search')?.value||'').toLocaleLowerCase('fr'),sort=$('#lib-sort')?.value||'recent';const rows=library.filter(x=>x.title.toLocaleLowerCase('fr').includes(term));rows.sort((a,b)=>sort==='az'?a.title.localeCompare(b.title,'fr'):sort==='za'?b.title.localeCompare(a.title,'fr'):sort==='old'?String(a.updated).localeCompare(String(b.updated)):String(b.updated).localeCompare(String(a.updated)));el.innerHTML=rows.map(x=>'<div class="library-item"><button type="button" class="library-name" data-open="'+esc(x.id)+'">'+esc(x.title)+'</button><span class="library-meta">'+(x.updated?new Date(x.updated).toLocaleDateString('fr-FR'):'')+'</span><button type="button" class="mini" data-duplicate="'+esc(x.id)+'" title="Dupliquer">⧉</button><button type="button" class="mini" data-rename="'+esc(x.id)+'" title="Renommer">✎</button><button type="button" class="mini" data-delete-list="'+esc(x.id)+'" title="Supprimer">×</button></div>').join('')||'<p class="panel-note">Aucun classement trouvé.</p>';}

function addRank(){const i=current.ranks.findIndex(r=>r.id===rankId),r={id:uid(),name:'Nouveau rang',bg:'#aaaaaa',fg:'#202020',font:20,minHeight:75,items:[]};modify(()=>current.ranks.splice(i<0?current.ranks.length:i+1,0,r));rankId=r.id;renderPanel();}
function shiftRank(n){const i=current.ranks.findIndex(r=>r.id===rankId);if(i+n<0||i+n>=current.ranks.length)return;modify(()=>{const r=current.ranks.splice(i,1)[0];current.ranks.splice(i+n,0,r);});}
function deleteRank(){if(current.ranks.length<2)return notice('Au moins un rang est nécessaire.',true);modify(()=>{const r=rank(rankId);current.waiting.push(...r.items);current.ranks=current.ranks.filter(x=>x.id!==rankId);rankId=current.ranks[0].id;});}
function reorderRank(a,b){const i=current.ranks.findIndex(r=>r.id===a),j=current.ranks.findIndex(r=>r.id===b);if(i<0||j<0||i===j)return;modify(()=>{const x=current.ranks.splice(i,1)[0];current.ranks.splice(j,0,x);});}
function textEditor(i=''){editId=i;panel='elements';renderPanel();$('#element-text')?.focus();}
function saveText(){const text=$('#element-text')?.value.trim();if(!text)return notice('Écris un texte avant de valider.',true);if(editId){modify(()=>{const e=element(editId);if(e)e.text=text;});}else{const e={id:uid(),type:'text',text};modify(()=>{current.elements.push(e);current.waiting.push(e.id);});}editId='';panel='';render();}
function duplicateItem(i){const e=element(i);if(!e)return;const c=clone(e);c.id=uid();modify(()=>{current.elements.push(c);current.waiting.push(c.id);});notice('Vignette dupliquée dans la zone d’attente.');}
function clearRanks(){modify(()=>current.ranks.forEach(r=>{current.waiting.push(...r.items);r.items=[];}));}
function toggleSelection(){selectionMode=!selectionMode;selected.clear();picked=null;render();}
function selectScope(v){selected=new Set(v==='all'?[...current.waiting,...current.ranks.flatMap(r=>r.items)]:zone(v)||[]);renderBoard();}
const toDataURL=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
const imageInfo=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve({w:i.naturalWidth,h:i.naturalHeight});i.onerror=()=>reject(Error('Image illisible'));i.src=src;});
async function parseImage(file){
 if(!file||!(/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)||/^image\/(png|jpeg|webp|heic|heif)$/i.test(file.type)))throw Error('Format non pris en charge : '+file?.name);
 if(file.size>10*1024*1024)throw Error(file.name+' dépasse 10 Mo ; compresse cette image.');
 let src=await toDataURL(file),dim;
 try{dim=await imageInfo(src);}catch(e){if(!/heic|heif/i.test(file.name+' '+file.type))throw e;try{const bm=await createImageBitmap(file),c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0);src=c.toDataURL('image/jpeg',.92);dim={w:c.width,h:c.height};bm.close();}catch{throw Error('HEIC non compatible : convertir en JPG.');}}
 if(/heic|heif/i.test(file.name+' '+file.type) && !src.startsWith('data:image/jpeg;')){
  try{const im=new Image();await new Promise((res,rej)=>{im.onload=res;im.onerror=rej;im.src=src;});const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);src=c.toDataURL('image/jpeg',.92);dim={w:c.width,h:c.height};}
  catch{throw Error('Conversion HEIC impossible sur cet appareil.');}
 }
 return {id:uid(),type:'image',name:file.name,text:'',src,w:dim.w,h:dim.h};
}
async function importFiles(files){const list=Array.from(files||[]),added=[],errors=[];if(!list.length)return;notice('Import en cours…');for(const file of list){try{added.push(await parseImage(file));}catch(e){errors.push(e.message);}}
 if(added.length)modify(()=>{current.elements.push(...added);current.waiting.push(...added.map(e=>e.id));});notice(added.length+' image(s) importée(s)'+(errors.length?' · '+errors[0]:''),!!errors.length);}
async function importURL(){const raw=prompt('URL directe de l’image :');if(!raw)return;try{const u=new URL(raw);if(!['http:','https:'].includes(u.protocol))throw Error('HTTP(S) obligatoire');const res=await fetch(u.href,{mode:'cors'});if(!res.ok)throw Error('Image inaccessible : '+res.status);const blob=await res.blob();if(!blob.type.startsWith('image/'))throw Error('La réponse n’est pas une image.');await importFiles([new File([blob],u.pathname.split('/').pop()||'image.png',{type:blob.type})]);}catch(e){notice('Import URL impossible (CORS possible) : '+e.message,true);}}
function panelAction(e){const t=e.target;
 if(t.closest('[data-close]'))return togglePanel(panel);
 if(t.closest('[data-create]'))return newTier();
 if(t.closest('[data-open]'))return openTier(library.find(x=>x.id===t.closest('[data-open]').dataset.open));
 if(t.closest('[data-duplicate]')){const x=library.find(z=>z.id===t.closest('[data-duplicate]').dataset.duplicate);if(!x||!discardOK())return;current=clone(x);current.id=uid();current.updated=null;current.title+=' (copie)';panel='';undo=[];redo=[];markDirty();render();return;}
 if(t.closest('[data-rename]')){const x=library.find(z=>z.id===t.closest('[data-rename]').dataset.rename);if(!x)return;const v=prompt('Renommer la Tier List :',x.title);if(!v?.trim())return;modify(()=>{x.title=v.trim();if(current.id===x.id)current.title=x.title;});void writeStore();return;}
 if(t.closest('[data-delete-list]')){const i=t.closest('[data-delete-list]').dataset.deleteList,x=library.find(z=>z.id===i);if(!x||!confirm('Supprimer définitivement « '+x.title+' » ?'))return;library=library.filter(z=>z.id!==i);if(current.id===i)current=defList();markDirty();void writeStore();render();return;}
 if(t.closest('[data-add-rank]'))return addRank();
 if(t.closest('[data-rank-up]'))return shiftRank(-1);
 if(t.closest('[data-rank-down]'))return shiftRank(1);
 if(t.closest('[data-delete-rank]'))return deleteRank();
 if(t.closest('[data-clear-board]'))return clearRanks();
 if(t.closest('[data-duplicate-item]')&&editId)return duplicateItem(editId);
 if(t.closest('[data-save-text]'))return saveText();
 if(t.closest('[data-import]'))return $('#image-files').click();
 if(t.closest('[data-import-url]'))return void importURL();
 if(t.closest('#export-now'))return void exportPNG();
}
function panelChange(e){const t=e.target,k=t.id,v=t.type==='checkbox'?t.checked:t.value;
 if(k==='lib-search'||k==='lib-sort'){renderLibrary();return;}
 if(k==='rank-select'){rankId=v;renderPanel();return;}
 const rm={'rank-name':'name','rank-bg':'bg','rank-fg':'fg','rank-font':'font','rank-height':'minHeight'};
 if(rm[k]){const r=rank(rankId),key=rm[k];if(!r)return;let n=v;if(key==='font')n=Math.max(8,Math.min(52,Number(v)||22));if(key==='minHeight')n=Math.max(28,Math.min(800,Number(v)||75));modify(()=>r[key]=n);return;}
 const sm={'rank-width':'rankWidth','tile-size':'tileSize','tile-ratio':'ratio','tile-fit':'fit','tile-shape':'shape','tile-bg':'tileBackground','text-bg':'textBackground','export-bg':'canvasBackground','export-scale':'scale','export-empty':'showEmpty','export-captions':'showCaptions'};
 if(sm[k]){let n=v;if(k==='rank-width')n=Math.max(15,Math.min(50,Number(v)||30));if(k==='tile-size')n=Math.max(30,Math.min(240,Number(v)||90));if(k==='export-scale')n=Math.max(1,Math.min(4,Number(v)||3));modify(()=>current.settings[sm[k]]=n);}
}
function tileClick(e){const t=e.target;
 if(t.closest('[data-remove]'))return removeElements([t.closest('[data-remove]').dataset.remove]);
 if(t.closest('[data-edit]'))return textEditor(t.closest('[data-edit]').dataset.edit);
 if(t.closest('[data-grip]'))return;
 const tile=t.closest('.tile');if(tile){const i=tile.dataset.item;if(selectionMode){selected.has(i)?selected.delete(i):selected.add(i);renderBoard();return;}picked=picked===i?null:i;renderBoard();return;}
 const r=t.closest('[data-rank-open]');if(r){const rid=r.dataset.rankOpen;if(picked)return move([picked],rid);rankId=rid;panel='ranks';renderPanel();}
}
function wireDrag(){
 document.addEventListener('dragstart',e=>{const tile=e.target.closest('.tile'),r=e.target.closest('[data-rank]');
 if(tile){dragId='item:'+tile.dataset.item;e.dataTransfer.setData('text/plain',dragId);}
 else if(r&&e.target.closest('.tier-name')){dragId='rank:'+r.dataset.rank;e.dataTransfer.setData('text/plain',dragId);}
 if(dragId)e.dataTransfer.effectAllowed='move';});
 document.addEventListener('dragover',e=>{if(e.target.closest('[data-zone],#waiting,[data-rank]')||e.dataTransfer?.types?.includes('Files'))e.preventDefault();});
 document.addEventListener('drop',e=>{if(!e.target.closest('.workspace'))return;e.preventDefault();if(e.dataTransfer.files?.length){void importFiles(e.dataTransfer.files);return;}
 const data=e.dataTransfer.getData('text/plain');if(data.startsWith('rank:')){const hit=e.target.closest('[data-rank]');if(hit)reorderRank(data.slice(5),hit.dataset.rank);return;}
 if(!data.startsWith('item:'))return;const hit=e.target.closest('[data-zone],#waiting');if(hit)move([data.slice(5)],hit.id==='waiting'?'waiting':hit.dataset.zone,e.target.closest('.tile')?.dataset.item);});
 document.addEventListener('dragend',()=>dragId=null);
 document.addEventListener('pointerdown',e=>{const rankGrip=e.target.closest('.rank-grip');if(rankGrip){pointerDrag={kind:'rank',id:rankGrip.closest('[data-rank]').dataset.rank,x:e.clientX,y:e.clientY};rankGrip.setPointerCapture?.(e.pointerId);e.preventDefault();return;}const grip=e.target.closest('.tile-grip');if(!grip)return;pointerDrag={kind:'item',id:grip.closest('.tile').dataset.item,x:e.clientX,y:e.clientY};grip.setPointerCapture?.(e.pointerId);e.preventDefault();});
 document.addEventListener('pointermove',e=>{const d=pointerDrag;if(!d)return;if(!d.ghost&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>9){const el=d.kind==='rank'?$('.tier-row').find(x=>x.dataset.rank===d.id)?.querySelector('.tier-name'):$('.tile').find(x=>x.dataset.item===d.id);if(el){d.ghost=el.cloneNode(true);d.ghost.classList.add('drop-ghost');d.ghost.style.width=el.offsetWidth+'px';d.ghost.style.height=el.offsetHeight+'px';document.body.appendChild(d.ghost);}}if(d.ghost){d.ghost.style.left=e.clientX+'px';d.ghost.style.top=e.clientY+'px';}});
 document.addEventListener('pointerup',e=>{const d=pointerDrag;if(!d)return;pointerDrag=null;d.ghost?.remove();if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<9)return;const hit=document.elementFromPoint(e.clientX,e.clientY);if(d.kind==='rank'){const target=hit?.closest('[data-rank]');if(target)reorderRank(d.id,target.dataset.rank);return;}const z=hit?.closest('[data-zone],#waiting');if(z)move([d.id],z.id==='waiting'?'waiting':z.dataset.zone,hit.closest('.tile')?.dataset.item);});
 document.addEventListener('pointercancel',()=>{pointerDrag?.ghost?.remove();pointerDrag=null;});
}

async function exportPNG(){if(busy)return;busy=true;try{notice('Génération du PNG…');const info=await window.RapliTiersExporter.download(clone(current));notice('PNG téléchargé : '+info.width+' × '+info.height+' px ✓');}catch(e){notice('Export impossible : '+e.message,true);}finally{busy=false;}}
$('#settings-panel').addEventListener('click',panelAction);
$('#settings-panel').addEventListener('change',panelChange);
$('#settings-panel').addEventListener('input',e=>{if(e.target.id==='lib-search')renderLibrary();if(e.target.id==='rank-width'&&$('#width-label'))$('#width-label').textContent=e.target.value+' %';});
document.addEventListener('click',e=>{if(e.target.closest('#board,#waiting'))tileClick(e);});
document.addEventListener('keydown',e=>{
 const tile=e.target.closest('.tile');
 if(tile&&(e.key==='Enter'||e.key===' ')){e.preventDefault();tileClick({target:tile});}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input,textarea')){e.preventDefault();historyStep(e.shiftKey?redo:undo,e.shiftKey?undo:redo);}
 if(e.key==='Escape'&&picked){picked=null;renderBoard();}
});
$('[data-panel]').forEach(b=>b.addEventListener('click',()=>togglePanel(b.dataset.panel)));
$('#library-toggle').addEventListener('click',()=>togglePanel('library'));
$('#undo').addEventListener('click',()=>historyStep(undo,redo));
$('#redo').addEventListener('click',()=>historyStep(redo,undo));
$('#save').addEventListener('click',()=>void saveTier());
$('#tier-title').addEventListener('change',e=>{const v=e.target.value.trim()||'Nouvelle Tier List';if(v!==current.title)modify(()=>current.title=v);});
$('#image-files').addEventListener('change',e=>{void importFiles(e.target.files);e.target.value='';});
$('#add-image-wait').addEventListener('click',()=>$('#image-files').click());
$('#add-text-wait').addEventListener('click',()=>textEditor());
$('#select-mode').addEventListener('click',toggleSelection);
$('#leave-selection').addEventListener('click',toggleSelection);
$('#select-scope').addEventListener('change',e=>selectScope(e.target.value));
$('#group-wait').addEventListener('click',()=>move(Array.from(selected),'waiting'));
$('#group-delete').addEventListener('click',()=>removeElements(Array.from(selected)));
$('#group-move').addEventListener('click',()=>{
 const old=$('#group-destination');if(old){old.remove();return;}
 const select=document.createElement('select');select.id='group-destination';select.setAttribute('aria-label','Choisir le rang de destination');
 select.innerHTML='<option value="">Choisir un rang…</option>'+current.ranks.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+'</option>').join('');
 $('#group-move').after(select);
 select.addEventListener('change',()=>{if(select.value)move(Array.from(selected),select.value);select.remove();});select.focus();
});
$('#waiting').addEventListener('click',e=>{if(!e.target.closest('.tile')&&picked)move([picked],'waiting');});
document.addEventListener('paste',e=>{
 if(e.target.closest('input,textarea'))return;
 const files=Array.from(e.clipboardData?.items||[]).filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);
 if(files.length){e.preventDefault();void importFiles(files);}
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
wireDrag();
window.RapliModuleBridge={
 module:'tiers',ready:false,
 getState:()=>({records:clone(library),logos:[]}),
 replaceState:async data=>{if(dirty)throw Error('Modifications non enregistrées : annule ou enregistre avant actualisation.');
  library=clone(data.records||[]);const saved=library.find(l=>l.id===current.id)||library[0];
  current=saved?clone(saved):defList();undo=[];redo=[];panel='';selectionMode=false;selected.clear();markDirty(false);await writeStore();render();},
 notify:m=>notice(m)
};
window.RapliTiers={
 saveCurrent:()=>saveTier(),hasUnsaved:()=>dirty,
 getState:()=>({library:clone(library),current:clone(current)}),
 getItemCount:()=>current.elements.length
};
async function boot(){try{db=await openStore();const data=await readStore();if(data&&Array.isArray(data.library)){
 library=data.library;const saved=library.find(l=>l.id===data.activeId)||library[0];if(saved)current=clone(saved);
 }}catch(e){notice('Stockage local indisponible : '+e.message,true);}
 render();window.RapliModuleBridge.ready=true;window.dispatchEvent(new Event('rapli-module-ready'));}
void boot();

})();