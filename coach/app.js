/* Rapli Coach — football & basketball formation editor.
 * Compositions are saved only on explicit action. Reusable player cards persist on confirmation.
 * The shared cloud bridge sees ONLY saved compositions and reusable players, not the working draft. */
(() => {
'use strict';
const $=selector=>document.querySelector(selector);
const clone=value=>structuredClone(value);
const uid=()=>crypto.randomUUID?.()||'rc-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const DEFAULTS={outside:'#edf0eb',field:'#416458',lines:'#e5efdf',titleBg:'#263c34',titleText:'#ffffff',dot:'#a5c0ab',border:'#ffffff',borderWidth:4,nameText:'#ffffff',nameFont:'Poppins',nameSize:21,portraitSize:73};
const ROWS={
  '4-3-3':[['BU','AG','AD'],['MC','MC','MC'],['DG','DC','DC','DD'],['GB']],
  '4-4-2':[['BU','BU'],['MG','MC','MC','MD'],['DG','DC','DC','DD'],['GB']],
  '4-2-3-1':[['BU'],['MOG','MOC','MOD'],['MDC','MDC'],['DG','DC','DC','DD'],['GB']],
  '3-5-2':[['BU','BU'],['MG','MC','MOC','MC','MD'],['DC','DC','DC'],['GB']],
  '3-4-3':[['AG','BU','AD'],['MG','MC','MC','MD'],['DC','DC','DC'],['GB']]
};
const FOOT_Y={'4-3-3':[.28,.49,.69,.85],'4-4-2':[.28,.5,.69,.85],'4-2-3-1':[.26,.4,.55,.7,.85],'3-5-2':[.28,.5,.7,.85],'3-4-3':[.28,.5,.7,.85]};
const BASKET=[{name:'PG',x:.5,y:.81},{name:'SG',x:.26,y:.59},{name:'SF',x:.74,y:.59},{name:'PF',x:.36,y:.39},{name:'C',x:.64,y:.39}];
const CIRCLE_LABEL='#292d2c';
const makeSlots=(sport,formation)=>{
  if(sport==='basketball')return BASKET.map((p,i)=>({id:'b-'+i,label:p.name,x:p.x,y:p.y,player:null}));
  const rows=ROWS[formation]||ROWS['4-3-3'];
  const output=[];
  for(let ri=0;ri<rows.length;ri++){
    const row=rows[ri];
    for(let j=0;j<row.length;j++){
      const x=row.length===1?.5:.18+(j/(row.length-1))*.64;
      output.push({id:'f-'+ri+'-'+j,label:row[j],x,y:FOOT_Y[formation][ri],player:null});
    }
  }
  return output;
};
const fresh=sport=>({id:uid(),sport,title:sport==='football'?'Mon XI':'Mon cinq majeur',formation:sport==='football'?'4-3-3':'1-2-2',mode:'dots',settings:clone(DEFAULTS),slots:makeSlots(sport,'4-3-3'),updated:null});
const normComp=raw=>{
  const sport=raw?.sport==='basketball'?'basketball':'football';
  const formation=sport==='football'&&ROWS[raw?.formation]?raw.formation:sport==='basketball'?'1-2-2':'4-3-3';
  const base=fresh(sport);base.id=raw?.id||uid();base.sport=sport;base.formation=formation;
  base.title=String(raw?.title||base.title).slice(0,140);base.mode=['dots','photos','photos-only'].includes(raw?.mode)?raw.mode:'dots';
  base.settings={...DEFAULTS,...(raw?.settings||{})};
  const slots=makeSlots(sport,formation);
  base.slots=slots.map((s,i)=>({...s,player:raw?.slots?.[i]?.player||null}));base.updated=raw?.updated||null;
  return base;
};
const normPlayer=p=>({id:p?.id||uid(),full:String(p?.full||'').trim(),short:String(p?.short||'').trim(),photo:p?.photo||'',crop:{zoom:Number(p?.crop?.zoom||1),x:Number(p?.crop?.x||0),y:Number(p?.crop?.y||0)}});
const fileName=s=>(s||'Composition').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 -_]/g,'').trim().replace(/\s+/g,'_').slice(0,100)||'Composition';
let current=fresh('football'),library=[],players=[],db=null,dirty=false,undo=[],redo=[],reassign=null,images=new Map(),busy=false,noticeTimer=null;
const dialog=$('#dialog'),modal=$('#dialog-content');
function notice(message,error=false){const n=$('#notice');n.textContent=message;n.dataset.error=String(error);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{if(n.textContent===message)n.textContent='';},6500);}
function show(html){modal.onclick=null;modal.innerHTML=html;dialog.showModal();}
function close(){if(dialog.open)dialog.close();}
function actionButtons(items){return '<div class="modal-actions">'+items.map(({label,id,kind})=>'<button type="button" data-modal="'+id+'" class="'+(kind||'')+'">'+label+'</button>').join('')+'</div>';}
const promptDiscard=()=>!dirty||confirm('Des modifications non enregistrées seront perdues. Continuer ?');
function clearHistory(){undo=[];redo=[];updateUndo();}
function updateUndo(){$('#undo').disabled=!undo.length;$('#redo').disabled=!redo.length;}
function mark(){dirty=true;$('#dirty').hidden=false;render();void saveDraft(); }
function edit(mutate){if(reassign)return;undo.push(clone(current));redo=[];mutate();mark();updateUndo();}
function history(dir){if(reassign)return;const source=dir==='undo'?undo:redo,target=dir==='undo'?redo:undo;if(!source.length)return;target.push(clone(current));current=source.pop();mark();updateUndo();}
function clearDirty(){dirty=false;$('#dirty').hidden=true;}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('rapli-coach-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function dbGet(key){return new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function dbPut(key,value){return new Promise((resolve,reject)=>{const r=db.transaction('state','readwrite').objectStore('state').put(value,key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
async function savePersist(){await dbPut('saved',{library,players,activeId:current.id});}
async function saveDraft(){try{if(db)await dbPut('draft',dirty?clone(current):null);}catch(e){console.warn('Brouillon local indisponible',e);}}
function savedState(){return {records:[...library.map(c=>({kind:'composition',...clone(c)})),...players.map(p=>({kind:'player',...clone(p)}))],logos:[]};}
async function cloudChanged(){window.RapliModuleCloud?.changed?.();const api=window.RapliModuleCloud;if(api?.getStatus?.().ready){try{const ok=await api.saveNow(false);if(!ok)notice('Enregistré localement · synchronisation cloud à vérifier',true);}catch(e){notice('Cloud indisponible : '+e.message,true);}}}
async function persistPlayer(p){
 const existing=players.findIndex(q=>q.id===p.id);
 if(existing<0)players.push(clone(p));else players[existing]=clone(p);
 await savePersist();
 // Player profiles persist independently of composition-save actions.
 void cloudChanged();
}
function imageFor(data){if(!data)return null;if(!images.has(data)){const img=new Image();images.set(data,{img,loaded:false});img.onload=()=>{images.get(data).loaded=true;draw()};img.onerror=()=>images.delete(data);img.src=data;}const item=images.get(data);return item?.loaded?item.img:null;}
function fitText(ctx,text,maxWidth,size,min=8){let fontSize=size;while(fontSize>min&&ctx.measureText(text).width>maxWidth){fontSize-=1;ctx.font=ctx.font.replace(/\d+(?:\.\d+)?px/,fontSize+'px');}return fontSize;}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function pitch(ctx,c,S){
 const v=S;const field=c.settings.field,lines=c.settings.lines;
 ctx.fillStyle=c.settings.outside;ctx.fillRect(0,0,v,v);
 ctx.fillStyle=c.settings.titleBg;rounded(ctx,.09*v,.035*v,.82*v,.1*v,.014*v);ctx.fill();
 const title=String(c.title||'').trim()||' ';ctx.fillStyle=c.settings.titleText;ctx.textAlign='center';ctx.textBaseline='middle';
 let linesTitle=[title];ctx.font='700 '+Math.round(v*.047)+'px Poppins, sans-serif';
 if(ctx.measureText(title).width>v*.75){const words=title.split(/\s+/),first=[],second=[];for(const word of words){ctx.font='700 '+Math.round(v*.043)+'px Poppins,sans-serif';if(!second.length&&ctx.measureText([...first,word].join(' ')).width<v*.73)first.push(word);else second.push(word);}linesTitle=[first.join(' '),second.join(' ')].filter(Boolean).slice(0,2);}
 let size=linesTitle.length===1?v*.047:v*.036;
 while(size>v*.014&&linesTitle.some(t=>{ctx.font='700 '+size+'px Poppins,sans-serif';return ctx.measureText(t).width>v*.755;}))size-=1;
 ctx.font='700 '+size+'px Poppins,sans-serif';linesTitle.forEach((text,i)=>ctx.fillText(text,v*.5,v*(.085+(i-(linesTitle.length-1)/2)*.035),v*.77));
 const x=v*.12,y=v*.16,w=v*.76,h=v*.76;
 ctx.fillStyle=field;ctx.fillRect(x,y,w,h);
 ctx.strokeStyle=lines;ctx.lineWidth=v*.002;ctx.globalAlpha=.85;
 ctx.strokeRect(x+3,y+3,w-6,h-6);
 if(c.sport==='football'){
  ctx.beginPath();ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2);ctx.stroke();
  ctx.beginPath();ctx.arc(x+w/2,y+h/2,w*.118,0,Math.PI*2);ctx.stroke();
  ctx.strokeRect(x+w*.24,y,w*.52,h*.14);
  ctx.strokeRect(x+w*.38,y,w*.24,h*.045);
  ctx.strokeRect(x+w*.24,y+h-h*.14,w*.52,h*.14);
  ctx.strokeRect(x+w*.38,y+h-h*.045,w*.24,h*.045);
  ctx.beginPath();ctx.arc(x+w/2,y+h-h*.095,v*.003,0,7);ctx.arc(x+w/2,y+h*.095,v*.003,0,7);ctx.fillStyle=lines;ctx.fill();
 }else{
  // Half-court: hoop and key near the top, three-point arc and midcourt guide below.
  ctx.strokeRect(x+w*.35,y,w*.3,h*.27);
  ctx.beginPath();ctx.arc(x+w/2,y+h*.27,w*.11,0,Math.PI);ctx.stroke();
  ctx.beginPath();ctx.arc(x+w/2,y+h*.14,w*.045,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(x+w/2,y+h*.12,w*.013,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+w*.1,y+h*.09);ctx.lineTo(x+w*.1,y+h*.3);ctx.arc(x+w/2,y+h*.3,w*.4,Math.PI,0,true);ctx.lineTo(x+w*.9,y+h*.09);ctx.stroke();
  ctx.beginPath();ctx.arc(x+w/2,y+h,.13*w,Math.PI,Math.PI*2);ctx.stroke();
 }
 ctx.globalAlpha=1;
}
function drawPlayers(ctx,c,S,editor=false){
 for(const slot of c.slots){
  const x=slot.x*S,y=slot.y*S,p=slot.player;
    // Scale diameter against the 1024 logical canvas, keeping player positions fixed.
  const R=c.mode==='dots'?S*.029:S*(Number(c.settings.portraitSize||73)/2048)*1.0;
  if(!p){
    ctx.save();ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.setLineDash([S*.007,S*.006]);ctx.strokeStyle='#ffffff';ctx.globalAlpha=.67;ctx.lineWidth=S*.0022;ctx.stroke();ctx.restore();
    if(editor){ctx.fillStyle='#ffffff';ctx.font='600 '+S*.013+'px Poppins,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(slot.label,x,y);}
    continue;
  }
  ctx.save();ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=c.settings.dot;ctx.fillRect(x-R,y-R,R*2,R*2);
  if(c.mode!=='dots'){
    const img=imageFor(p.photo);
    if(img){
      const crop=p.crop||{zoom:1,x:0,y:0},zoom=Math.max(1,Math.min(3,Number(crop.zoom)||1));
      const dim=R*2*zoom,scale=Math.max(dim/img.width,dim/img.height),W=img.width*scale,H=img.height*scale;
      ctx.drawImage(img,x-W/2+(Number(crop.x)||0)*R*.8,y-H/2+(Number(crop.y)||0)*R*.8,W,H);
    }else{
      ctx.strokeStyle=CIRCLE_LABEL;ctx.lineWidth=S*.005;ctx.beginPath();ctx.arc(x,y-R*.28,R*.25,0,7);ctx.stroke();
      ctx.beginPath();ctx.arc(x,y+R*.5,R*.54,Math.PI,2*Math.PI);ctx.stroke();
    }
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(x,y,R,0,7);ctx.lineWidth=Number(c.settings.borderWidth||4)*S/1024;ctx.strokeStyle=c.settings.border;ctx.stroke();
  if(c.mode==='photos-only')continue;
  const name=String(p.short||p.full||'').toLocaleUpperCase('fr-FR');
  const labelWidth=S*.134,labelHeight=S*.034;
  const yLabel=y+R*.52;
  ctx.fillStyle=CIRCLE_LABEL;rounded(ctx,x-labelWidth/2,yLabel,labelWidth,labelHeight,S*.005);ctx.fill();
  ctx.fillStyle=c.settings.nameText;ctx.textAlign='center';ctx.textBaseline='middle';
  let size=S*(Number(c.settings.nameSize)||21)/1024;
  const family=c.settings.nameFont==='Georgia'?'Georgia,serif':c.settings.nameFont==='Impact'?'Impact,sans-serif':c.settings.nameFont==='Arial'?'Arial,sans-serif':'Poppins,sans-serif';
  ctx.font='700 '+size+'px '+family;
  while(size>S*.007&&ctx.measureText(name).width>labelWidth-S*.007){size-=.6;ctx.font='700 '+size+'px '+family;}
  ctx.fillText(name,x,yLabel+labelHeight*.55,labelWidth-S*.006);
 }
}
function drawTo(ctx,c,size,editor=false){ctx.save();ctx.clearRect(0,0,size,size);pitch(ctx,c,size);drawPlayers(ctx,c,size,editor);ctx.restore();}
function draw(){const cv=$('#board');const ctx=cv.getContext('2d');drawTo(ctx,current,1024,true);overlay();}
function nearestLimit(slots){let dist=Infinity;for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)dist=Math.min(dist,Math.hypot(slots[i].x-slots[j].x,slots[i].y-slots[j].y));return Math.max(46,Math.min(100,Math.floor(dist*1024-12)));}
function overlay(){const host=$('#slot-overlay');host.innerHTML='';
 for(let i=0;i<current.slots.length;i++){const s=current.slots[i],b=document.createElement('button');b.type='button';b.className='slot-button';b.dataset.slot=String(i);b.style.left=(s.x*100)+'%';b.style.top=(s.y*100)+'%';
 const diameter=(current.mode==='dots'?66:Number(current.settings.portraitSize||73))*100/1024;
 b.style.width=Math.max(diameter,8)+'%';b.style.height=Math.max(diameter,8)+'%';b.title=(s.player?(s.player.short||s.player.full):'Ajouter un joueur')+' · '+s.label;b.setAttribute('aria-label',b.title);
 host.appendChild(b);
 }}
function render(){
 $('#comp-title').value=current.title;
 $('#sport-display').textContent=current.sport==='football'?'FOOTBALL':'BASKETBALL';
 $('#formation-wrap').hidden=current.sport!=='football';
 $('#formation').value=current.sport==='football'?current.formation:'4-3-3';
 $('#mode').value=current.mode;
 const limit=nearestLimit(current.slots);const size=$('#portrait-size');size.max=String(limit);
 if(current.settings.portraitSize>limit)current.settings.portraitSize=limit;
 for(const input of document.querySelectorAll('[data-setting]')){const k=input.dataset.setting;input.value=String(current.settings[k]??DEFAULTS[k]);const out=$('#'+k+'-output');if(out)out.textContent=String(input.value);}
 $('#library-count').textContent=library.length+' composition'+(library.length>1?'s':'');
 draw();renderLibrary();
}
function renderLibrary(){
 const term=$('#library-search').value.trim().toLocaleLowerCase('fr-FR'),sport=$('#library-sport').value;
 const list=[...library].filter(x=>(sport==='all'||x.sport===sport)&&x.title.toLocaleLowerCase('fr-FR').includes(term)).sort((a,b)=>String(b.updated||'').localeCompare(a.updated||''));
 $('#library-items').innerHTML=list.length?list.map(c=>'<div class="library-item" data-id="'+escapeHTML(c.id)+'"><div class="library-info"><strong>'+escapeHTML(c.title)+'</strong><span>'+(c.sport==='football'?escapeHTML(c.formation):'BASKETBALL 1-2-2')+' · '+(c.updated?new Date(c.updated).toLocaleDateString('fr-FR'):'Non datée')+'</span></div><div class="library-buttons">'+[['open','OUVRIR'],['rename','RENOMMER'],['duplicate','DUPLIQUER'],['delete','SUPPRIMER']].map(([id,label])=>'<button data-action="'+id+'">'+label+'</button>').join('')+'</div></div>').join(''):'<p class="helper">Aucune composition enregistrée.</p>';
}
function editor(slotIndex){
 if(reassign){pickCandidate(slotIndex);return;}
 const slot=current.slots[slotIndex],prior=slot.player?clone(slot.player):null;
 let selection=prior?clone(prior):normPlayer(null);
 show('<h2>'+(prior?'MODIFIER LE JOUEUR':'AJOUTER UN JOUEUR')+' · '+escapeHTML(slot.label)+'</h2>'+
 '<form id="player-form"><label>RECHERCHER UN JOUEUR EXISTANT<input type="search" id="player-search" placeholder="Nom ou nom court…" autocomplete="off"></label>'+
 '<div id="player-results" class="player-results"></div>'+
 '<label>NOM COMPLET *<input id="player-full" required maxlength="100" placeholder="Zinédine Zidane" value="'+escapeHTML(selection.full)+'"></label>'+
 '<label>NOM COURT (FACULTATIF)<input id="player-short" maxlength="35" placeholder="Zidane" value="'+escapeHTML(selection.short)+'"></label>'+
 '<label>PHOTO (FACULTATIVE)<input type="file" id="player-photo" accept="image/png,image/jpeg,image/webp,image/gif"></label>'+
 '<div class="crop-area"><canvas id="crop-preview" width="200" height="200" aria-label="Prévisualisation recadrage"></canvas><div class="crop-controls"><label>ZOOM<input id="crop-zoom" type="range" min="1" max="3" step=".05" value="'+selection.crop.zoom+'"></label><label>HORIZONTAL<input id="crop-x" type="range" min="-1" max="1" step=".05" value="'+selection.crop.x+'"></label><label>VERTICAL<input id="crop-y" type="range" min="-1" max="1" step=".05" value="'+selection.crop.y+'"></label></div></div>'+
 actionButtons([{label:'ANNULER',id:'cancel'},...(prior?[{label:'VIDER CET EMPLACEMENT',id:'empty',kind:'danger'}]:[]),{label:'VALIDER LE JOUEUR',id:'submit',kind:'action'}])+'</form>');
 function fill(){modal.querySelector('#player-full').value=selection.full;modal.querySelector('#player-short').value=selection.short;modal.querySelector('#crop-zoom').value=selection.crop.zoom;modal.querySelector('#crop-x').value=selection.crop.x;modal.querySelector('#crop-y').value=selection.crop.y;drawCrop();}
 function drawCrop(){const cv=$('#crop-preview'),ctx=cv.getContext('2d');ctx.clearRect(0,0,200,200);ctx.fillStyle=current.settings.dot;ctx.fillRect(0,0,200,200);ctx.save();ctx.beginPath();ctx.arc(100,100,100,0,7);ctx.clip();const img=imageFor(selection.photo);if(img){const z=selection.crop.zoom,w=200*z,h=200*z,sc=Math.max(w/img.width,h/img.height),W=img.width*sc,H=img.height*sc;ctx.drawImage(img,100-W/2+selection.crop.x*80,100-H/2+selection.crop.y*80,W,H);}else{ctx.strokeStyle=CIRCLE_LABEL;ctx.lineWidth=6;ctx.beginPath();ctx.arc(100,72,23,0,7);ctx.stroke();ctx.beginPath();ctx.arc(100,165,60,Math.PI,2*Math.PI);ctx.stroke();}ctx.restore();}
 const input=$('#player-search'),results=$('#player-results');function options(){
 const q=input.value.trim().toLocaleLowerCase('fr-FR');if(!q){results.innerHTML='';return;}
 results.innerHTML=players.filter(p=>p.full.toLocaleLowerCase('fr-FR').includes(q)||p.short.toLocaleLowerCase('fr-FR').includes(q)).slice(0,12).map(p=>'<button type="button" data-reuse="'+escapeHTML(p.id)+'">'+escapeHTML(p.full)+(p.short?' · '+escapeHTML(p.short):'')+'</button>').join('')||'<span>Aucun joueur trouvé — crée une nouvelle fiche.</span>';
 }
 input.addEventListener('input',options);results.addEventListener('click',e=>{const b=e.target.closest('[data-reuse]');if(!b)return;selection=clone(players.find(p=>p.id===b.dataset.reuse));fill();input.value='';options();});
 for(const [id,k] of [['crop-zoom','zoom'],['crop-x','x'],['crop-y','y']])$('#'+id).addEventListener('input',e=>{selection.crop[k]=Number(e.target.value);drawCrop();});
 $('#player-photo').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{selection.photo=await photoData(f);images.delete(selection.photo);drawCrop();const img=new Image();img.onload=drawCrop;img.src=selection.photo;}catch(err){notice('Photo illisible : '+err.message,true);}});
 $('#player-form').addEventListener('submit',e=>{e.preventDefault();void submit();});
 async function submit(){
 const full=$('#player-full').value.trim(),short=$('#player-short').value.trim();
 if(!full){$('#player-full').focus();return;}
 selection.full=full;selection.short=short;
 try{await persistPlayer(selection);edit(()=>{current.slots[slotIndex].player=clone(selection)});close();notice('Joueur disponible dans les prochaines compositions ✓');}catch(err){notice('Impossible de conserver le joueur : '+err.message,true);}
 }
 modal.onclick=e=>{const btn=e.target.closest('[data-modal]');if(!btn)return;if(btn.dataset.modal==='cancel')close();if(btn.dataset.modal==='empty'){edit(()=>{current.slots[slotIndex].player=null});close();}if(btn.dataset.modal==='submit')void submit();};
 drawCrop();
}
async function photoData(file){
 if(file.size>12*1024*1024)throw Error('Fichier supérieur à 12 Mo.');
 if(!file.type.startsWith('image/'))throw Error('Format non reconnu.');
 const url=URL.createObjectURL(file),im=new Image();
 try{await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('Décodage impossible'));im.src=url;});
 const k=Math.min(1,900/Math.max(im.width,im.height)),cv=document.createElement('canvas');
 cv.width=Math.max(1,Math.round(im.width*k));cv.height=Math.max(1,Math.round(im.height*k));
 cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
 return cv.toDataURL('image/webp',.82);
 }finally{URL.revokeObjectURL(url);}
}
function pickCandidate(slotIndex){
 const candidates=reassign.queue;
 show('<h2>RÉAFFECTER · '+escapeHTML(current.slots[slotIndex].label)+'</h2><p>Choisis un joueur conservé de l’ancienne formation.</p><div class="candidate-list">'+candidates.map((p,i)=>'<button data-candidate="'+i+'">'+escapeHTML(p.short||p.full)+'</button>').join('')+'</div>'+actionButtons([{label:'ANNULER',id:'cancel'}]));
 modal.onclick=e=>{
 const btn=e.target.closest('[data-candidate]');if(btn){
 const player=reassign.queue.splice(Number(btn.dataset.candidate),1)[0];
 if(current.slots[slotIndex].player)reassign.queue.push(current.slots[slotIndex].player);
 current.slots[slotIndex].player=player;close();render();updateReassignBar();return;
 }
 if(e.target.closest('[data-modal="cancel"]'))close();
 };
}
function startReassignment(next){
 if(next===current.formation)return;
 const prev=clone(current),candidates=current.slots.map(x=>x.player).filter(Boolean);
 reassign={prev,queue:candidates};current.formation=next;current.slots=makeSlots('football',next);render();
 $('#formation').disabled=true;$('#new').disabled=true;$('#save').disabled=true;
 notice('Choisis chaque poste pour replacer les joueurs.');
 const bar=document.createElement('div');bar.id='reassign-bar';bar.className='viewbar';bar.innerHTML='<strong id="reassign-count"></strong><button class="btn primary" id="reassign-finish">TERMINER LA RÉAFFECTATION</button><button class="btn quiet" id="reassign-cancel">ANNULER</button>';
 $('.board-holder').after(bar);updateReassignBar();
 $('#reassign-finish').onclick=()=>{
 if(reassign.queue.length&&!confirm(reassign.queue.map(p=>p.full).join(', ')+' : ces joueurs seront retirés de CETTE composition. Continuer ?'))return;
 undo.push(reassign.prev);redo=[];endReassignment();mark();updateUndo();
 };
 $('#reassign-cancel').onclick=()=>{current=reassign.prev;endReassignment();render();};
}
function updateReassignBar(){const el=$('#reassign-count');if(el)el.textContent=reassign.queue.length+' JOUEUR(S) À REPLACER';}
function endReassignment(){reassign=null;$('#reassign-bar')?.remove();$('#formation').disabled=false;$('#new').disabled=false;$('#save').disabled=false;}
function newComposition(){
 if(reassign){notice('Termine ou annule d’abord la réaffectation.',true);return;}
 if(!promptDiscard())return;
 show('<h2>NOUVELLE COMPOSITION</h2><p>Choisis ton sport. Ce choix restera fixe.</p><div class="sport-choices"><button data-sport="football">⚽ FOOTBALL</button><button data-sport="basketball">🏀 BASKETBALL</button></div>'+actionButtons([{label:'ANNULER',id:'cancel'}]));
 modal.onclick=e=>{const b=e.target.closest('[data-sport]');if(b){current=fresh(b.dataset.sport);clearHistory();clearDirty();void saveDraft();render();close();return;}if(e.target.closest('[data-modal="cancel"]'))close();};
}
async function save(){
 if(reassign){notice('Termine d’abord la réaffectation.',true);return false;}
 if(busy)return false;busy=true;$('#save').disabled=true;
 try{
 current.title=current.title.trim()||(current.sport==='football'?'Mon XI':'Mon cinq majeur');current.updated=new Date().toISOString();
 const i=library.findIndex(x=>x.id===current.id);if(i<0)library.unshift(clone(current));else library[i]=clone(current);
 await savePersist();clearDirty();await saveDraft();render();
 const api=window.RapliModuleCloud;
 if(api){api.changed();const ok=await api.saveNow(false);notice(ok?'Composition enregistrée ✓':'Composition enregistrée sur cet appareil · Cloud à vérifier',!ok);}
 else notice('Composition enregistrée localement · cloud indisponible',true);
 return true;
 }catch(e){notice('Enregistrement impossible : '+e.message,true);return false;}
 finally{busy=false;$('#save').disabled=false;}
}
async function requestExport(){
 if(reassign){notice('Termine ou annule la réaffectation.',true);return;}
 if(!dirty){await download();return;}
 show('<h2>EXPORTER UNE COMPOSITION MODIFIÉE</h2><p>Des modifications ne sont pas enregistrées. Comment souhaites-tu procéder ?</p>'+
 actionButtons([{label:'ANNULER',id:'cancel'}, {label:'EXPORTER SANS ENREGISTRER',id:'export-current'}, {label:'ENREGISTRER ET EXPORTER',id:'save-export',kind:'action'}]));
 modal.onclick=e=>{const b=e.target.closest('[data-modal]');if(!b)return;const a=b.dataset.modal;close();if(a==='export-current')void download();if(a==='save-export')void (async()=>{if(await save())await download()})();};
}
async function download(){
 try{const cnv=document.createElement('canvas');cnv.width=2048;cnv.height=2048;
 await document.fonts.ready;
 // Ensure imported pictures are decoded before using them in high-res output.
 await Promise.all(current.slots.filter(s=>s.player?.photo).map(s=>new Promise(resolve=>{const source=s.player.photo;const img=new Image();img.onload=()=>{images.set(source,{img,loaded:true});resolve();};img.onerror=resolve;img.src=source;})));
 drawTo(cnv.getContext('2d'),current,2048,false);
 const blob=await new Promise((resolve,reject)=>cnv.toBlob(b=>b?resolve(b):reject(Error('PNG non généré')),'image/png'));
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName(current.title)+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);notice('PNG téléchargé · 2048 × 2048 ✓');
 }catch(e){notice('Export impossible : '+e.message,true);}
}
async function libraryAction(action,id){
 const saved=library.find(c=>c.id===id);if(!saved)return;
 if(action==='open'){if(!promptDiscard())return;current=normComp(clone(saved));clearDirty();clearHistory();void saveDraft();render();$('#library').open=false;return;}
 if(action==='rename'){const name=prompt('Nouveau titre :',saved.title);if(!name?.trim())return;saved.title=name.trim().slice(0,140);saved.updated=new Date().toISOString();if(current.id===id&&!dirty)current.title=saved.title;}
 if(action==='duplicate'){const c=clone(saved);c.id=uid();let suffix=' (copie)',index=2;while(library.some(x=>x.title===saved.title+suffix)){suffix=' (copie '+index+++')';}c.title=saved.title+suffix;c.updated=new Date().toISOString();library.unshift(c);}
 if(action==='delete'){if(current.id===id&&dirty&&!promptDiscard())return;if(!confirm('Supprimer définitivement « '+saved.title+' » ?'))return;library=library.filter(x=>x.id!==id);if(current.id===id){current=fresh(saved.sport);clearDirty();clearHistory();}}
 try{await savePersist();const api=window.RapliModuleCloud;if(api){api.changed();const ok=await api.saveNow(false);notice(ok?'Bibliothèque synchronisée ✓':'Bibliothèque modifiée localement · Cloud à vérifier',!ok);}else notice('Bibliothèque modifiée localement');render();}
 catch(e){notice('Échec de la modification : '+e.message,true);}
}
function wire(){
 $('#comp-title').addEventListener('focus',e=>{e.target.dataset.before=current.title;});
 $('#comp-title').addEventListener('change',e=>{const name=e.target.value.trim().slice(0,140)||'Mon XI';if(current.title!==name)edit(()=>current.title=name);});
 $('#mode').addEventListener('change',e=>edit(()=>{current.mode=e.target.value;}));
 $('#formation').addEventListener('change',e=>startReassignment(e.target.value));
 $('#new').onclick=newComposition;$('#save').onclick=()=>void save();$('#export').onclick=()=>void requestExport();
 $('#undo').onclick=()=>history('undo');$('#redo').onclick=()=>history('redo');
 $('#clear').onclick=()=>{if(!current.slots.some(s=>s.player))return;if(confirm('Vider tous les joueurs de cette composition ? Le titre, le style et la formation seront conservés.'))edit(()=>current.slots.forEach(s=>s.player=null));};
 for(const input of document.querySelectorAll('[data-setting]')){
 const event=input.type==='range'||input.type==='color'?'change':'change';
 input.addEventListener(event,e=>{const k=e.target.dataset.setting;edit(()=>current.settings[k]=['portraitSize','nameSize','borderWidth'].includes(k)?Number(e.target.value):e.target.value);});
 }
 $('#library-search').addEventListener('input',renderLibrary);$('#library-sport').addEventListener('change',renderLibrary);
 $('#library-items').addEventListener('click',e=>{const b=e.target.closest('[data-action]');const row=b?.closest('[data-id]');if(b&&row)void libraryAction(b.dataset.action,row.dataset.id);});
 $('#slot-overlay').addEventListener('click',e=>{if(e.target.closest('[data-slot]')&&!dragSuppressed){editor(Number(e.target.closest('[data-slot]').dataset.slot));}dragSuppressed=false;});
 let pointer=null;$('#slot-overlay').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-slot]');if(!b||!current.slots[Number(b.dataset.slot)].player||reassign)return;pointer={index:Number(b.dataset.slot),x:e.clientX,y:e.clientY,drag:false};});
 window.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>12)pointer.drag=true;});
 window.addEventListener('pointerup',e=>{if(!pointer)return;const p=pointer;pointer=null;if(!p.drag)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');if(!target)return;const targetIndex=Number(target.dataset.slot);if(targetIndex===p.index)return;dragSuppressed=true;edit(()=>{const a=current.slots[p.index],b=current.slots[targetIndex];[a.player,b.player]=[b.player,a.player];});setTimeout(()=>dragSuppressed=false,80);});
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='RAPLI_APP_ACTIVITY')return;});
}
let dragSuppressed=false;
window.RapliModuleBridge={
 module:'coach',ready:false,
 getState:()=>savedState(),
 replaceState:async state=>{
  if(!Array.isArray(state?.records))throw Error('État cloud invalide.');
  if(dirty&&!confirm('Des modifications de la composition sont en cours. Actualiser les données enregistrées sans perdre ce brouillon ?'))throw Error('Actualisation annulée.');
  library=state.records.filter(r=>r.kind==='composition').map(normComp);
  players=state.records.filter(r=>r.kind==='player').map(normPlayer);
  const saved=library.find(x=>x.id===current.id);
  if(!dirty)current=saved?clone(saved):library.length?clone(library[0]):fresh('football');
  await savePersist();render();
 },
 notify:message=>notice(message)
};
window.RapliCoach={hasUnsaved:()=>dirty,saveCurrent:save,getState:savedState};
async function boot(){
 try{
  db=await openDB();
  const state=await dbGet('saved');
  if(state){library=(state.library||[]).map(normComp);players=(state.players||[]).map(normPlayer);
   const active=library.find(x=>x.id===state.activeId);if(active)current=clone(active);}
  const draft=await dbGet('draft');
  if(draft&&confirm('Un brouillon temporaire de Rapli Coach a été retrouvé. Souhaites-tu reprendre ta composition non enregistrée ?')){current=normComp(draft);dirty=true;$('#dirty').hidden=false;}
 }catch(e){notice('Stockage local indisponible : '+e.message,true);console.error(e);return;}
 wire();render();window.RapliModuleBridge.ready=true;window.dispatchEvent(new Event('rapli-module-ready'));
}
void boot();
})();