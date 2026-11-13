/* Rapli Top 10 — manual-only editor and offline library */
(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));
const id=()=>crypto.randomUUID?.()||'r-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const THEMES=['magazine','sport','minimal','vintage'];
const VIEWS=['classic','visual','podium'];
const defaults=()=>({view:'classic',theme:'sport',columns:'auto',primary:'',background:'',font:'default',scale:3});
const blank=()=>({id:id(),name:'',image:'',subtitle:'',description:'',logo:'',score:''});
const newList=()=>({id:id(),title:'Mon Top 10',updated:null,settings:defaults(),positions:Array.from({length:10},blank)});
const ensureSettings=s=>({...defaults(),...(s||{})});
const normalizeList=x=>({id:x?.id||id(),title:String(x?.title||'Mon Top 10'),updated:x?.updated||null,settings:ensureSettings(x?.settings),positions:Array.isArray(x?.positions)?x.positions.map(p=>({id:p?.id||id(),name:String(p?.name||''),image:p?.image||'',subtitle:String(p?.subtitle||''),description:String(p?.description||''),logo:p?.logo||'',score:String(p?.score||'')})):Array.from({length:10},blank)});
let library=[],current=newList(),dirty=false,activePanel='presentation',editId='',db=null,writeBusy=false,dragging='',pointerDrag=null,noticeTimeout=null,booted=false;
const isDirty=()=>dirty;
function notice(s,isError=false){const el=$('#notice');if(!el)return;el.textContent=s;el.dataset.error=String(isError);clearTimeout(noticeTimeout);noticeTimeout=setTimeout(()=>{if(el.textContent===s)el.textContent='';},5600);}
function dirtyMark(v=true){dirty=v;$('#dirty-dot').hidden=!v;if(v)window.RapliModuleCloud?.changed?.();}
function allowDiscard(){return !dirty||confirm('Des modifications ne sont pas enregistrées. Les abandonner ?');}
function mark(){dirtyMark();render();}
function transact(fn){fn();mark();}
function openDB(){return new Promise((res,rej)=>{const req=indexedDB.open('rapli-top10-v1',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('collections'))req.result.createObjectStore('collections');};req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});}
function loadDB(){return new Promise((res,rej)=>{const req=db.transaction('collections').objectStore('collections').get('saved');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});}
function persist(){return new Promise((res,rej)=>{const req=db.transaction('collections','readwrite').objectStore('collections').put({library,activeId:current.id},'saved');req.onsuccess=res;req.onerror=()=>rej(req.error);});}
const TOP_PRESETS=[3,5,10,15,20,25,30,50,75,100];
function renderQuickCount(){
  const select=$('#quick-count'),currentCount=current.positions.length;
  const numbers=[...new Set([...TOP_PRESETS,currentCount])].sort((a,b)=>a-b);
  select.innerHTML=numbers.map(n=>'<option value="'+n+'">TOP '+n+'</option>').join('')+'<option value="custom">PERSONNALISÉ…</option>';
  select.value=String(currentCount);
  $('#custom-count').value=String(currentCount);
  $('#custom-count-wrap').hidden=true;
}
function render(){const title=$('#list-title');if(document.activeElement!==title)title.value=current.title;$('#dirty-dot').hidden=!dirty;$('#board-title').textContent=current.title||'Sans titre';$('#count-label').textContent=current.positions.length+' POSITION'+(current.positions.length>1?'S':'');renderQuickCount();
  $$('.tool-button').forEach(b=>b.classList.toggle('is-active',b.dataset.panel===activePanel));
  renderSettings();renderRanking();renderEditor();if(!$('#library').hidden)renderLibrary();
}
function safeColor(s){return /^#[0-9a-f]{6}$/i.test(String(s))?s:'';}
const palette={magazine:{bg:'#f5f0e4',fg:'#242321',accent:'#9d7545'},sport:{bg:'#f6f9ff',fg:'#142847',accent:'#2458a3'},minimal:{bg:'#27292c',fg:'#f7f8fa',accent:'#d0d4d9'},vintage:{bg:'#ead2aa',fg:'#543f31',accent:'#aa542e'}};
function hexBrightness(color){const c=(color||'').replace('#','');const rgb=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function effectiveColors(){const th=palette[current.settings.theme]||palette.sport;const background=safeColor(current.settings.background)||th.bg;const primary=safeColor(current.settings.primary)||th.accent;const fg=hexBrightness(background)>.2?'#1d2939':'#f7f8fa';return {...th,bg:background,fg:current.settings.background?fg:th.fg,accent:primary};}
function columnCount(){if(current.settings.columns!=='auto'){const count=Number(current.settings.columns);return Math.min(4,Math.max(1,Number.isFinite(count)?count:1));}const n=current.positions.length,view=current.settings.view;return view==='classic'?(n>24?2:1):n>35?4:n>16?3:2;}
function cardTemplate(p,index,{podium=false}={}){const img=p.image?'<img class="rank-image" alt="" src="'+escapeHTML(p.image)+'">':'<span class="rank-image no-image" aria-hidden="true"></span>';const logo=p.logo?'<img class="rank-logo" alt="" src="'+escapeHTML(p.logo)+'">':'';
const up='<button type="button" class="move-up" data-action="up" aria-label="Monter la position '+(index+1)+'" '+(index===0?'disabled':'')+'>↑</button>';
const down='<button type="button" class="move-down" data-action="down" aria-label="Descendre la position '+(index+1)+'" '+(index===current.positions.length-1?'disabled':'')+'>↓</button>';
return '<article class="rank-card" tabindex="0" role="button" data-id="'+escapeHTML(p.id)+'" data-place="'+(index+1)+'" aria-label="Modifier position '+(index+1)+': '+escapeHTML(p.name||'Sans nom')+'"><span class="rank-number">'+String(index+1).padStart(2,'0')+'</span>'+img+'<div class="rank-copy"><h3 class="rank-name '+(!p.name?'placeholder-name':'')+'">'+escapeHTML(p.name||'Ajouter un nom')+'</h3>'+(p.subtitle?'<p class="rank-subtitle">'+escapeHTML(p.subtitle)+'</p>':'')+(p.description?'<p class="rank-description">'+escapeHTML(p.description)+'</p>':'')+(p.score?'<span class="rank-score">'+escapeHTML(p.score)+'</span>':'')+'</div>'+logo+'<div class="move-buttons">'+up+down+'</div>'+(podium?'':'<button type="button" class="drag-handle" draggable="true" aria-label="Glisser pour déplacer">⠿</button>')+'</article>';}
function renderRanking(){const board=$('#ranking'),s=current.settings,col=columnCount(),colors=effectiveColors();board.dataset.mode=s.view;board.dataset.theme=s.theme;board.style.setProperty('--surface',colors.bg);board.style.setProperty('--ink',colors.fg);board.style.setProperty('--accent',colors.accent);board.style.setProperty('--columns',col);
board.style.setProperty('--font',s.font==='serif'?'"Libre Baskerville",Georgia,serif':s.font==='poppins'?'Poppins,sans-serif':s.font==='display'?'"DM Serif Display",Georgia,serif':s.theme==='magazine'?'"Libre Baskerville",Georgia,serif':s.theme==='vintage'?'"DM Serif Display",Georgia,serif':'Poppins,sans-serif');
const top=current.positions.slice(0,3),others=current.positions.slice(3);let cards;
if(s.view==='podium'){cards='<div class="podium-wrap">'+[top[1],top[0],top[2]].map(p=>p?cardTemplate(p,current.positions.indexOf(p),{podium:true}):'').join('')+'</div><div class="ranking-grid">'+others.map((p,i)=>cardTemplate(p,i+3)).join('')+'</div>';}
else cards='<div class="ranking-grid">'+current.positions.map((p,i)=>cardTemplate(p,i)).join('')+'</div>';
board.innerHTML='<h2 class="print-title">'+escapeHTML(current.title||'Sans titre')+'</h2>'+cards;
}
function choices(options,value){return options.map(([v,l])=>'<option value="'+escapeHTML(v)+'" '+(v===value?'selected':'')+'>'+escapeHTML(l)+'</option>').join('');}
function renderSettings(){const s=current.settings,p=$('#settings');let html='';
switch(activePanel){
case 'presentation':html='<h2>PRÉSENTATION DU CLASSEMENT</h2><div class="segment">'+[['classic','CLASSIQUE'],['visual','VISUEL'],['podium','PODIUM']].map(([v,l])=>'<button type="button" data-view="'+v+'" class="'+(s.view===v?'active':'')+'">'+l+'</button>').join('')+'</div><p class="helper">Trois rendus interchangeables. Toutes les positions et données sont conservées.</p>';break;
case 'style':html='<h2>STYLE DU CLASSEMENT</h2><div class="setting-grid"><div class="setting-field"><label for="theme">Thème graphique</label><select id="theme">'+choices([['magazine','MAGAZINE'],['sport','SPORT'],['minimal','MINIMALISTE'],['vintage','VINTAGE']],s.theme)+'</select></div><div class="setting-field"><label for="main-color">Couleur principale</label><input id="main-color" type="color" value="'+(safeColor(s.primary)||(palette[s.theme]||palette.sport).accent)+'"></div><div class="setting-field"><label for="bg-color">Couleur du fond</label><input id="bg-color" type="color" value="'+(safeColor(s.background)||(palette[s.theme]||palette.sport).bg)+'"></div><div class="setting-field"><label for="font">Typographie</label><select id="font">'+choices([['default','Thème (défaut)'],['poppins','Poppins'],['serif','Libre Baskerville'],['display','DM Serif Display']],s.font)+'</select></div></div><button type="button" class="button ghost small" id="reset-palette">RÉTABLIR LES COULEURS DU THÈME</button>';break;
case 'layout':html='<h2>COLONNES ET POSITIONS</h2><div class="setting-grid"><div class="setting-field"><label for="columns">Colonnes</label><select id="columns">'+choices([['auto','AUTO — '+columnCount()+' colonne(s)'],...Array.from({length:4},(_,i)=>[String(i+1),String(i+1)+' colonne(s)'])],s.columns)+'</select></div><div class="setting-field"><label for="positions-count">Nombre total de positions</label><input id="positions-count" type="number" value="'+current.positions.length+'" min="1" max="1000" step="1"></div></div><p class="helper">Nombre libre. Pour éviter une suppression involontaire, une réduction du classement demande confirmation et retire les dernières positions.</p>';break;
case 'export':html='<h2>EXPORT PNG</h2><div class="setting-grid"><div class="setting-field"><label for="scale">Résolution de l’image</label><select id="scale">'+choices([['1','×1 — 1 080 px'],['2','×2 — 2 160 px'],['3','×3 — 3 240 px'],['4','×4 — 4 320 px']],String(s.scale))+'</select></div><div class="setting-field"><label for="export-columns">Colonnes</label><select id="export-columns">'+choices([['auto','Automatique'],...Array.from({length:4},(_,i)=>[String(i+1),String(i+1)])],s.columns)+'</select></div></div><p class="helper">Un seul PNG vertical, titre toujours inclus, sans boutons ni poignées. Hauteur adaptée au classement ; en cas d’image trop grande, baisse la résolution.</p><button type="button" class="button blue export-cta" id="download-png">⇩ TÉLÉCHARGER LE PNG</button>';break;
}
p.innerHTML=html;}
function renderEditor(){const target=$('#position-editor');if(!editId){target.hidden=true;target.innerHTML='';return;}const i=current.positions.findIndex(p=>p.id===editId);if(i<0){editId='';target.hidden=true;return;}const p=current.positions[i];target.hidden=false;
const picture=(key,label)=>'<div class="setting-field"><label>'+label+'</label><div class="image-row">'+(p[key]?'<img class="image-preview" alt="Aperçu" src="'+escapeHTML(p[key])+'">':'')+'<button type="button" class="button ghost small" data-image="'+key+'">'+(p[key]?'REMPLACER':'IMPORTER')+'</button>'+(p[key]?'<button type="button" class="button danger small" data-clear="'+key+'">RETIRER</button>':'')+'</div></div>';
target.innerHTML='<div class="panel-heading"><strong>MODIFIER LA POSITION '+(i+1)+'</strong><button type="button" id="close-editor" class="close" aria-label="Fermer">✕</button></div><form class="editor-form" id="edit-form"><label class="wide">Nom ou titre *<input name="name" maxlength="200" required value="'+escapeHTML(p.name)+'" placeholder="Nom de la position"></label><label>Sous-titre<input name="subtitle" maxlength="180" value="'+escapeHTML(p.subtitle)+'" placeholder="Équipe, marque…"></label><label>Note / score<input name="score" maxlength="60" value="'+escapeHTML(p.score)+'" placeholder="9,5/10"></label><label class="wide">Description courte<textarea name="description" maxlength="500" placeholder="Pourquoi ce choix ?">'+escapeHTML(p.description)+'</textarea></label>'+picture('image','Image principale')+picture('logo','Petit logo secondaire')+'<div class="editor-actions"><button type="button" class="button danger small" id="delete-position">SUPPRIMER LA POSITION</button><button type="button" class="button blue small" id="close-edit-done">TERMINER</button></div></form>';
}
function renderLibrary(){const search=$('#library-search').value.trim().toLowerCase(),sort=$('#library-sort').value;let items=library.filter(x=>x.title.toLowerCase().includes(search));items.sort((a,b)=>sort==='az'?a.title.localeCompare(b.title,'fr'):sort==='za'?b.title.localeCompare(a.title,'fr'):sort==='old'?String(a.updated||'').localeCompare(String(b.updated||'')):String(b.updated||'').localeCompare(String(a.updated||'')));
$('#library-items').innerHTML=items.length?items.map(x=>'<div class="library-item" data-id="'+escapeHTML(x.id)+'"><div class="metadata"><strong>'+escapeHTML(x.title)+'</strong><small>'+(x.positions?.length||0)+' positions · '+(x.updated?new Date(x.updated).toLocaleString('fr-FR'):'Non daté')+'</small></div><div class="tools"><button type="button" data-library="open">OUVRIR</button><button type="button" data-library="rename">RENOMMER</button><button type="button" data-library="duplicate">DUPLIQUER</button><button type="button" data-library="delete">SUPPRIMER</button></div></div>').join(''):'<div class="library-empty">Aucun classement trouvé. Enregistre ton premier Top 10 !</div>';}
async function commitLibrary(action){if(writeBusy)return false;writeBusy=true;$('#save-list').disabled=true;try{await persist();const cloud=window.RapliModuleCloud;const success=cloud?await cloud.saveNow(false):false;notice(success?'Bibliothèque enregistrée sur cet appareil et Supabase ✓':'Bibliothèque enregistrée localement · Synchronisation cloud non confirmée');return true;}catch(e){notice('Impossible d’enregistrer : '+e.message,true);return false;}finally{writeBusy=false;$('#save-list').disabled=false;}}
async function save(){if(writeBusy)return false;writeBusy=true;$('#save-list').disabled=true;try{const invalid=current.positions.findIndex(p=>!p.name.trim());if(invalid>=0)notice('Position '+(invalid+1)+' sans nom : complète-la avant l’export.',true);
current.title=current.title.trim()||'Mon Top 10';current.updated=new Date().toISOString();const i=library.findIndex(x=>x.id===current.id);if(i<0)library.unshift(clone(current));else library[i]=clone(current);await persist();dirtyMark(false);render();const success=window.RapliModuleCloud?await window.RapliModuleCloud.saveNow(false):false;notice(success?'Classement enregistré localement et sur Supabase ✓':'Classement enregistré localement · Cloud à synchroniser');return !!success;}catch(e){notice('Enregistrement impossible : '+e.message,true);dirtyMark();return false;}finally{writeBusy=false;$('#save-list').disabled=false;}}
function chooseNew(){if(!allowDiscard())return;current=newList();editId='';activePanel='presentation';dirtyMark();render();$('#list-title').focus();$('#list-title').select();}
function openSaved(item){if(!allowDiscard())return;current=normalizeList(clone(item));dirtyMark(false);editId='';$('#library').hidden=true;render();}
function addPosition(){transact(()=>current.positions.push(blank()));editId=current.positions.at(-1).id;render();$('#position-editor input[name=name]')?.focus();}
function movePosition(source,target){if(source<0||target<0||source>=current.positions.length||target>=current.positions.length||source===target)return;transact(()=>{const [p]=current.positions.splice(source,1);current.positions.splice(target,0,p);});}
function removePosition(){const i=current.positions.findIndex(p=>p.id===editId);if(i<0)return;if(!confirm('Supprimer cette position du classement ?'))return;transact(()=>{current.positions.splice(i,1);if(!current.positions.length)current.positions.push(blank());});editId='';render();}
function resizePositions(n){
  if(!Number.isInteger(n)||n<1||n>1000){
    notice('Choisis un nombre entier de 1 à 1000 positions.',true);
    renderQuickCount();renderSettings();return false;
  }
  const old=current.positions.length;
  if(n===old){renderQuickCount();renderSettings();return true;}
  const removed=n<old?current.positions.slice(n):[];
  const hasContent=removed.some(p=>p.name.trim()||p.image||p.subtitle.trim()||p.description.trim()||p.logo||p.score.trim());
  if(hasContent&&!confirm('Passer de TOP '+old+' à TOP '+n+' supprimera '+removed.length+' position(s), dont certaines sont remplies. Continuer ?')){
    renderQuickCount();renderSettings();return false;
  }
  transact(()=>{if(n<old)current.positions.length=n;else while(current.positions.length<n)current.positions.push(blank());});
  if(editId&&!current.positions.some(p=>p.id===editId)){editId='';renderEditor();}
  notice('Classement ajusté : TOP '+n+' ✓');
  return true;
}
async function imageFile(file,key){if(!file)return;if(!/^image\/(png|jpeg|webp|gif|heic|heif)$/i.test(file.type) && !/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name)){notice('Format non pris en charge.',true);return;}if(file.size>15*1024*1024){notice('Image trop volumineuse (15 Mo maximum).',true);return;}
try{const img=await createImageBitmap(file);const w=Math.min(1100,img.width),h=Math.max(1,Math.round(img.height*w/img.width));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);img.close?.();const data=canvas.toDataURL('image/webp',.84);
const p=current.positions.find(x=>x.id===editId);if(!p)return;transact(()=>{p[key]=data;});notice('Image importée ✓');}catch(e){notice('Image illisible dans ce navigateur : '+e.message,true);}}
function wire(){
$('#new-list').addEventListener('click',chooseNew);
$('#library-toggle').addEventListener('click',()=>{$('#library').hidden=!$('#library').hidden;if(!$('#library').hidden)renderLibrary();});
$('#close-library').addEventListener('click',()=>$('#library').hidden=true);
$('#library-search').addEventListener('input',renderLibrary);$('#library-sort').addEventListener('change',renderLibrary);
$('#save-list').addEventListener('click',()=>void save());
$('#add-position').addEventListener('click',addPosition);$('#add-position-bottom').addEventListener('click',addPosition);
$('#quick-count').addEventListener('change',e=>{
  if(e.target.value==='custom'){
    $('#custom-count-wrap').hidden=false;
    $('#custom-count').value=String(current.positions.length);
    $('#custom-count').focus();
    $('#custom-count').select();
  }else resizePositions(Number(e.target.value));
});
$('#custom-count-apply').addEventListener('click',()=>resizePositions(Number($('#custom-count').value)));
$('#custom-count-cancel').addEventListener('click',renderQuickCount);
$('#custom-count').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();resizePositions(Number(e.target.value));}
  if(e.key==='Escape'){e.preventDefault();renderQuickCount();}
});
$('#list-title').addEventListener('input',e=>{current.title=e.target.value;dirtyMark();$('#board-title').textContent=current.title||'Sans titre';$('#ranking .print-title').textContent=current.title||'Sans titre';});
$$('.tool-button').forEach(b=>b.addEventListener('click',()=>{activePanel=activePanel===b.dataset.panel?'':b.dataset.panel;renderSettings();$$('.tool-button').forEach(t=>t.classList.toggle('is-active',t.dataset.panel===activePanel));}));
$('#settings').addEventListener('click',e=>{const view=e.target.closest('[data-view]');if(view){transact(()=>current.settings.view=view.dataset.view);return;}if(e.target.closest('#reset-palette'))transact(()=>{current.settings.primary='';current.settings.background='';});if(e.target.closest('#download-png'))void download();});
$('#settings').addEventListener('change',e=>{const key={'theme':'theme','main-color':'primary','bg-color':'background','font':'font','columns':'columns','export-columns':'columns','scale':'scale'}[e.target.id];if(key){transact(()=>{current.settings[key]=key==='scale'?Number(e.target.value):e.target.value;if(key==='theme'){current.settings.primary='';current.settings.background='';}});return;}if(e.target.id==='positions-count')resizePositions(Number(e.target.value));});
$('#ranking').addEventListener('click',e=>{const card=e.target.closest('.rank-card');if(!card)return;const i=current.positions.findIndex(p=>p.id===card.dataset.id);if(i<0)return;if(e.target.closest('[data-action]')){const dir=e.target.closest('[data-action]').dataset.action;movePosition(i,i+(dir==='up'?-1:1));return;}if(e.target.closest('.drag-handle'))return;editId=card.dataset.id;renderEditor();$('#position-editor').scrollIntoView({behavior:'smooth',block:'nearest'});});
$('#ranking').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ') && e.target.classList.contains('rank-card')){e.preventDefault();editId=e.target.dataset.id;renderEditor();}});
$('#ranking').addEventListener('dragstart',e=>{const handle=e.target.closest('.drag-handle');if(!handle)return;const card=handle.closest('.rank-card');if(!card)return;dragging=card.dataset.id;card.classList.add('dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragging);}});
$('#ranking').addEventListener('dragover',e=>{if(!dragging)return;const card=e.target.closest('.rank-card');if(!card)return;e.preventDefault();$$('.rank-card.drop-target').forEach(c=>c.classList.remove('drop-target'));card.classList.add('drop-target');});
$('#ranking').addEventListener('drop',e=>{if(!dragging)return;e.preventDefault();const target=e.target.closest('.rank-card');if(target){const a=current.positions.findIndex(p=>p.id===dragging),b=current.positions.findIndex(p=>p.id===target.dataset.id);movePosition(a,b);}dragging='';render();});
$('#ranking').addEventListener('dragend',()=>{dragging='';$$('.rank-card').forEach(c=>c.classList.remove('dragging','drop-target'));});
$('#ranking').addEventListener('pointerdown',e=>{const handle=e.target.closest('.drag-handle');if(!handle||e.pointerType==='mouse')return;const card=handle.closest('.rank-card');if(!card)return;pointerDrag={id:card.dataset.id,startX:e.clientX,startY:e.clientY,moved:false,pointerId:e.pointerId};handle.setPointerCapture?.(e.pointerId);});
$('#ranking').addEventListener('pointermove',e=>{if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;if(Math.hypot(e.clientX-pointerDrag.startX,e.clientY-pointerDrag.startY)>8)pointerDrag.moved=true;$$('.rank-card.drop-target').forEach(c=>c.classList.remove('drop-target'));const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.rank-card');if(target&&pointerDrag.moved)target.classList.add('drop-target');});
$('#ranking').addEventListener('pointerup',e=>{if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;const drag=pointerDrag;pointerDrag=null;$$('.rank-card.drop-target').forEach(c=>c.classList.remove('drop-target'));if(!drag.moved)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.rank-card');if(!target)return;movePosition(current.positions.findIndex(p=>p.id===drag.id),current.positions.findIndex(p=>p.id===target.dataset.id));});
$('#ranking').addEventListener('pointercancel',()=>pointerDrag=null);
$('#position-editor').addEventListener('input',e=>{const field=e.target.name;if(!['name','subtitle','description','score'].includes(field))return;const p=current.positions.find(x=>x.id===editId);if(!p)return;p[field]=e.target.value;dirtyMark();renderRanking();});
$('#position-editor').addEventListener('submit',e=>e.preventDefault());
$('#position-editor').addEventListener('click',e=>{if(e.target.closest('#close-editor')||e.target.closest('#close-edit-done')){editId='';renderEditor();return;}if(e.target.closest('#delete-position')){removePosition();return;}const image=e.target.closest('[data-image]');if(image){const picker=$('#'+(image.dataset.image==='image'?'photo-picker':'logo-picker'));picker.value='';picker.click();return;}const clear=e.target.closest('[data-clear]');if(clear){const p=current.positions.find(x=>x.id===editId);if(p)transact(()=>p[clear.dataset.clear]='');}});
$('#photo-picker').addEventListener('change',e=>void imageFile(e.target.files?.[0],'image'));
$('#logo-picker').addEventListener('change',e=>void imageFile(e.target.files?.[0],'logo'));
$('#library-items').addEventListener('click',async e=>{const btn=e.target.closest('[data-library]'),row=e.target.closest('.library-item');if(!btn||!row)return;const item=library.find(x=>x.id===row.dataset.id);if(!item)return;const action=btn.dataset.library;
if(action==='open'){openSaved(item);return;}
if(action==='rename'){if(current.id===item.id&&dirty){if(!allowDiscard())return;current=normalizeList(clone(item));dirtyMark(false);}const name=prompt('Nouveau titre du classement :',item.title);if(!name?.trim())return;item.title=name.trim().slice(0,160);if(current.id===item.id){current.title=item.title;dirtyMark(false);}await commitLibrary();render();return;}
if(action==='duplicate'){const copy=clone(item);copy.id=id();copy.title=(item.title+' — copie').slice(0,160);copy.updated=new Date().toISOString();library.unshift(copy);await commitLibrary();renderLibrary();return;}
if(action==='delete'){if(current.id===item.id&&dirty&&!allowDiscard())return;if(!confirm('Supprimer définitivement « '+item.title+' » de la bibliothèque ?'))return;library=library.filter(x=>x.id!==item.id);if(current.id===item.id){current=newList();editId='';dirtyMark(false);}await commitLibrary();render();}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
}
async function download(){const missing=current.positions.findIndex(x=>!x.name.trim());if(missing>=0){notice('Renseigne le nom de la position '+(missing+1)+' avant d’exporter.',true);editId=current.positions[missing].id;renderEditor();return;}const btn=$('#download-png');if(btn)btn.disabled=true;try{notice('Création du PNG…');const result=await window.RapliTop10Exporter.download(clone(current));notice('PNG téléchargé · '+result.width+' × '+result.height+' px ✓');}catch(e){notice('Export PNG impossible : '+e.message,true);}finally{if(btn)btn.disabled=false;}}
window.RapliModuleBridge={module:'top10',ready:false,getState:()=>({records:clone(dirty?[...library.filter(x=>x.id!==current.id),current]:library),logos:[]}),replaceState:async state=>{if(!Array.isArray(state?.records))throw Error('Sauvegarde cloud invalide.');const next=state.records.map(normalizeList);library=next;const existing=library.find(x=>x.id===current.id);current=existing?clone(existing):library.length?clone(library[0]):newList();editId='';dirtyMark(false);await persist();render();},notify:message=>notice(message)};
window.RapliTop10={hasUnsaved:isDirty,saveCurrent:save,getCurrent:()=>clone(current),getLibrary:()=>clone(library)};
async function boot(){try{db=await openDB();const state=await loadDB();if(state?.library&&Array.isArray(state.library))library=state.library.map(normalizeList);const found=library.find(x=>x.id===state?.activeId);if(found)current=clone(found);}catch(e){console.warn('Top 10 offline IndexedDB:',e);notice('Stockage local indisponible : '+e.message,true); // Prevent cloud writes until the local library can be persisted.
return;}wire();render();booted=true;window.RapliModuleBridge.ready=true;window.dispatchEvent(new Event('rapli-module-ready'));}
void boot();
})();
