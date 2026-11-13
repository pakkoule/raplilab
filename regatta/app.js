/* Rapli Regatta — race archive, private IndexedDB collection, Supabase bridge. */
(()=>{'use strict';
const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=(v,n=150)=>String(v??'').trim().slice(0,n);
const uid=()=>crypto.randomUUID?crypto.randomUUID():'race-'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const now=()=>new Date().toISOString();
const props={name:180,edition:100,boatClass:100,boat:140,start:20,end:20,rank:40,rankDepartment:40,rankNational:40,duration:100,notes:2500};
const imageKeys=['icon','result','route'];
const equipmentModes=Object.freeze({pdd:'PDD','half-fp':'1/2 FP','full-pack':'FULL PACK'});
const validEquipment=value=>Object.prototype.hasOwnProperty.call(equipmentModes,value)?value:'';
const equipmentInputs=()=>[...document.querySelectorAll('input[name="race-equipment"]')];
const validImage=v=>typeof v==='string'&&/^data:image\/(png|webp|jpeg|gif);base64,[a-z0-9+/=]+$/i.test(v);
function normal(x={}){const r={id:typeof x.id==='string'&&x.id.length<130?x.id:uid(),createdAt:x.createdAt||now(),updatedAt:x.updatedAt||now(),live:!!x.live,equipment:validEquipment(x.equipment)};for(const [k,n] of Object.entries(props))r[k]=clean(x[k],n);for(const k of imageKeys)r[k]=validImage(x[k])?x[k]:'';return r;}
let rows=[],db=null,editId='',pictures={icon:'',result:'',route:''},uploads=0,writeBusy=false,timer;
const dialog=$('race-dialog'),getField=k=>$('race-'+({boatClass:'class',rankDepartment:'rank-department',rankNational:'rank-national'}[k]||k));
function toast(t,error=false){$('notice').textContent=t;$('notice').dataset.error=String(error);clearTimeout(timer);timer=setTimeout(()=>{$('notice').textContent='';},7000);}
const req=r=>new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error||Error('IndexedDB inaccessible'));});
const done=tx=>new Promise((yes,no)=>{tx.oncomplete=yes;tx.onerror=()=>no(tx.error||Error('Sauvegarde locale impossible'));tx.onabort=()=>no(tx.error||Error('Stockage local annulé'));});
async function openDB(){if(!window.indexedDB)return;const r=indexedDB.open('rapli-regatta-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('races'))r.result.createObjectStore('races',{keyPath:'id'});};db=await req(r);}
function backup(){try{return JSON.parse(localStorage.getItem('rapli-regatta-v1')||'[]');}catch{return [];}}
async function load(){return db?(await req(db.transaction('races').objectStore('races').getAll())).map(normal):backup().map(normal);}
async function saveRow(row){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify([...rows.filter(x=>x.id!==row.id),row]));return;}const tx=db.transaction('races','readwrite');tx.objectStore('races').put(row);await done(tx);}
async function deleteRow(id){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify(rows.filter(x=>x.id!==id)));return;}const tx=db.transaction('races','readwrite');tx.objectStore('races').delete(id);await done(tx);}
async function replaceRows(next){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify(next));}else{const tx=db.transaction('races','readwrite'),store=tx.objectStore('races');store.clear();next.forEach(x=>store.put(x));await done(tx);}rows=next.map(normal);render();}
const raceStatus=r=>r.live?'live':r.end||r.rank?'finished':'planned',statusTitle={live:'COURSE EN COURS',finished:'TERMINÉE',planned:'À VENIR'};
const dateFR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'';
const imageTag=(src,alt)=>validImage(src)?'<img loading="lazy" draggable="false" alt="'+safe(alt)+'" src="'+safe(src)+'">':'<span class="shot-empty">PAS DE CAPTURE</span>';
function card(r){
 const status=raceStatus(r);
 return '<article class="card'+(r.live?' live':'')+'" data-id="'+safe(r.id)+'"><div class="card-top"><div class="race-icon card-photo">'+(validImage(r.icon)?imageTag(r.icon,'Affiche '+r.name):'<div class="icon-placeholder">⛵</div>')+'</div><span class="badge-status">'+statusTitle[status]+'</span></div><div class="card-content">'+
 '<div class="card-eyebrow"><span>'+safe(r.boatClass||'VIRTUAL REGATTA')+'</span><span class="year">'+safe(r.edition)+'</span></div>'+
 '<h2>'+safe(r.name)+'</h2><div class="card-boat">'+safe(r.boat)+'</div>'+
 '<div class="card-stats">'+(r.start?'<span class="stat-chip">DÉPART '+dateFR(r.start)+'</span>':'')+(r.rank?'<span class="stat-chip">GÉNÉRAL · '+safe(r.rank)+'</span>':'')+(r.rankDepartment?'<span class="stat-chip regional">DÉPARTEMENTAL · '+safe(r.rankDepartment)+'</span>':'')+(r.rankNational?'<span class="stat-chip national">NATIONAL · '+safe(r.rankNational)+'</span>':'')+(r.duration?'<span class="stat-chip">TEMPS '+safe(r.duration)+'</span>':'')+(validEquipment(r.equipment)?'<span class="stat-chip equipment">ÉQUIPEMENT · '+safe(equipmentModes[r.equipment])+'</span>':'')+'</div>'+
 '<div class="shots"><div class="shot"><label>CLASSEMENT FINAL</label><div class="shot-box image-preview">'+imageTag(r.result,'Classement '+r.name)+'</div></div><div class="shot"><label>TRACÉ</label><div class="shot-box image-preview">'+imageTag(r.route,'Tracé '+r.name)+'</div></div></div>'+
 (r.notes?'<p class="card-note">'+safe(r.notes)+'</p>':'')+
 '<div class="card-actions"><button type="button" class="btn secondary" data-action="edit">MODIFIER</button><button type="button" class="btn subtle" data-action="png">↓ PNG</button><button type="button" class="btn subtle" data-action="delete">×</button></div></div></article>';
}
function render(){
 let selected=$('filter-class').value;const classes=[...new Set(rows.map(x=>x.boatClass).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 $('filter-class').innerHTML='<option value="">Toutes les classes</option>'+classes.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join('');
 if(classes.includes(selected))$('filter-class').value=selected;
 const q=$('search').value.toLocaleLowerCase('fr').trim(),status=$('filter-status').value,cls=$('filter-class').value;
 let out=rows.filter(r=>(!status||raceStatus(r)===status)&&(!cls||r.boatClass===cls)&&(!q||[r.name,r.edition,r.boatClass,r.boat,r.rank,r.rankDepartment,r.rankNational,equipmentModes[r.equipment]||'',r.notes].some(v=>v.toLocaleLowerCase('fr').includes(q))));
 const sort=$('sort').value;
 out.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'fr'):sort==='old'?a.createdAt.localeCompare(b.createdAt):sort==='start'?b.start.localeCompare(a.start):b.updatedAt.localeCompare(a.updatedAt));
 $('count-total').textContent=rows.length;$('count-live').textContent=rows.filter(r=>r.live).length;$('count-finished').textContent=rows.filter(r=>raceStatus(r)==='finished').length;$('result-count').textContent=out.length+' / '+rows.length;
 $('cards').innerHTML=out.map(card).join('')||(rows.length?'<p>Aucune course ne correspond aux filtres.</p>':'');
 $('empty').hidden=rows.length!==0;
}
function preview(k){const img=$('preview-'+k),ph=$('placeholder-'+k);img.hidden=!validImage(pictures[k]);ph.hidden=validImage(pictures[k]);if(validImage(pictures[k]))img.src=pictures[k];else img.removeAttribute('src');}
function openEditor(r){editId=r?.id||'';const data=r||normal();for(const k of Object.keys(props))getField(k).value=data[k]||'';$('race-live').checked=!!data.live;equipmentInputs().forEach(input=>{input.checked=input.value===validEquipment(data.equipment);});for(const k of imageKeys){pictures[k]=data[k]||'';preview(k);}$('dialog-title').textContent=editId?'MODIFIER LA COURSE':'AJOUTER UNE COURSE';$('delete-race').hidden=!editId;if(!dialog.open)dialog.showModal();document.body.style.overflow='hidden';dialog.querySelector('.dialog-scroll').scrollTop=0;getField('name').focus({preventScroll:true});}
const closeEditor=()=>{if(dialog.open)dialog.close();};
dialog.addEventListener('close',()=>{document.body.style.overflow='';editId='';});dialog.addEventListener('click',e=>{if(e.target===dialog)closeEditor();});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeEditor));
async function saveEditor(e){
 e.preventDefault();if(writeBusy||uploads)return;
 const old=rows.find(x=>x.id===editId);const r={...(old||normal()),updatedAt:now(),live:$('race-live').checked};
 for(const k of Object.keys(props))r[k]=clean(getField(k).value,props[k]);
 const chosen=equipmentInputs().filter(input=>input.checked);if(chosen.length>1){toast('Une seule méthode d’équipement est autorisée.',true);return;}
 r.equipment=validEquipment(chosen[0]?.value);
 if(!r.name){getField('name').focus();return;}for(const k of imageKeys)r[k]=pictures[k]||'';
 writeBusy=true;$('save-race').disabled=true;
 try{await saveRow(r);rows=[...rows.filter(x=>x.id!==r.id),r];render();window.RapliModuleCloud?.changed?.();closeEditor();toast('Course enregistrée ✓');}
 catch(err){console.error(err);toast('Impossible de sauvegarder : '+err.message,true);}
 finally{writeBusy=false;$('save-race').disabled=false;}
}
async function deleteRace(id){
 const r=rows.find(x=>x.id===id);if(!r||!confirm('Supprimer « '+r.name+' » et ses images ?'))return;
 try{await deleteRow(id);rows=rows.filter(x=>x.id!==id);closeEditor();render();window.RapliModuleCloud?.changed?.();toast('Course supprimée ✓');}
 catch(err){toast('Suppression impossible : '+err.message,true);}
}
async function fileData(file,key){
 if(!file)return;
 uploads++;$('save-race').disabled=true;
 try{
  if(file.size>18*1024*1024||(!file.type.startsWith('image/')&&!/\.(heic|heif)$/i.test(file.name)))throw Error('Image non compatible ou supérieure à 18 Mo.');
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=url;await new Promise((yes,no)=>{image.onload=yes;image.onerror=()=>no(Error('Ce navigateur ne peut pas décoder cette image. Essaie JPG ou PNG.'));});
   const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);
   let data=canvas.toDataURL('image/webp',.82);if(!data.startsWith('data:image/webp'))data=canvas.toDataURL('image/jpeg',.82);
   if(data.length>12*1024*1024)throw Error('Image trop volumineuse.');pictures[key]=data;preview(key);toast('Image ajoutée ✓');
  }finally{URL.revokeObjectURL(url);}
 }catch(err){toast(err.message,true);}finally{uploads--;$('save-race').disabled=uploads>0;}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4500);}
function picture(src){return new Promise(yes=>{if(!validImage(src))return yes(null);const im=new Image();im.onload=()=>yes(im);im.onerror=()=>yes(null);im.src=src;});}
function contain(ctx,im,x,y,w,h){if(!im)return;const scale=Math.min(w/im.width,h/im.height),iw=im.width*scale,ih=im.height*scale;ctx.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih);}
function wrap(ctx,text,width,n){let result=[],line='';for(const word of String(text).split(/\s+/)){const test=(line?line+' ':'')+word;if(ctx.measureText(test).width>width&&line){result.push(line);line=word;}else line=test;if(result.length>=n)break;}if(line&&result.length<n)result.push(line);return result;}
async function exportPNG(r){
 try{
  if(document.fonts?.ready)await document.fonts.ready;
  const [im,ranking,route]=await Promise.all(imageKeys.map(k=>picture(r[k])));
  const w=1200,extra=ranking||route?450:0,h=130+675+300+extra+42,c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas indisponible');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle='#15384a';ctx.fillRect(0,0,w,130);ctx.fillStyle='#00c6c8';ctx.fillRect(0,0,900,8);ctx.fillStyle='#f30082';ctx.fillRect(900,0,300,8);
  ctx.fillStyle='#fff';ctx.font='900 51px Poppins,sans-serif';ctx.fillText('RAPLI REGATTA',49,88);
  if(validEquipment(r.equipment)){ctx.textAlign='right';ctx.fillStyle='#cbf6f4';ctx.font='800 22px Poppins,sans-serif';ctx.fillText('ÉQUIPEMENT · '+equipmentModes[r.equipment],1147,85);ctx.textAlign='left';}
  ctx.fillStyle='#e4f4f3';ctx.fillRect(0,130,w,675);contain(ctx,im,0,130,w,675);
  const y=805;ctx.fillStyle='#007d98';ctx.font='800 20px Poppins,sans-serif';ctx.fillText([r.boatClass,r.edition].filter(Boolean).join(' · ').toUpperCase()||'VIRTUAL REGATTA',48,y+38);
  ctx.fillStyle='#14364a';ctx.font='900 42px Poppins,sans-serif';wrap(ctx,r.name,1100,2).forEach((line,i)=>ctx.fillText(line,48,y+96+i*51));
  ctx.fillStyle='#567985';ctx.font='700 19px Poppins,sans-serif';const details=[r.boat,r.start?'DÉPART '+dateFR(r.start):'',r.duration?'TEMPS '+r.duration:''].filter(Boolean);wrap(ctx,details.join('  ·  '),1100,1).forEach(t=>ctx.fillText(t,48,y+209));
  const rankingData=[['GÉNÉRAL',r.rank],['DÉPARTEMENTAL',r.rankDepartment],['NATIONAL',r.rankNational]];
  for(let i=0;i<rankingData.length;i++){
    const [label,value]=rankingData[i],x=48+i*372,boxY=y+233;
    ctx.fillStyle=i===1?'#e9f7f6':i===2?'#f8eef3':'#eff7f9';
    ctx.fillRect(x,boxY,352,58);
    ctx.fillStyle='#557785';ctx.font='800 13px Poppins,sans-serif';ctx.fillText(label,x+11,boxY+19);
    ctx.fillStyle='#163a50';ctx.font='800 22px Poppins,sans-serif';
    let shown=String(value||'—');while(ctx.measureText(shown).width>326&&shown.length>2)shown=shown.slice(0,-2)+'…';
    ctx.fillText(shown,x+11,boxY+45);
  }
  if(extra){const yy=1105;ctx.fillStyle='#e7f3f5';ctx.fillRect(0,yy,w,450);for(const [idx,im,label] of [[0,ranking,'CLASSEMENT FINAL'],[1,route,'TRACÉ DE COURSE']]){const xx=30+idx*582;ctx.fillStyle='#244b5e';ctx.font='800 20px Poppins,sans-serif';ctx.fillText(label,xx,yy+31);ctx.fillStyle='#d0e5e7';ctx.fillRect(xx,yy+43,556,377);contain(ctx,im,xx,yy+43,556,377);}}
  ctx.fillStyle='#15384a';ctx.fillRect(0,h-42,w,42);ctx.fillStyle='#d6f0f0';ctx.font='700 14px Poppins,sans-serif';ctx.fillText('RAPLI REGATTA  ·  '+(r.live?'COURSE EN COURS':'JOURNAL DE COURSE'),37,h-16);
  const blob=await new Promise((yes,no)=>c.toBlob(b=>b?yes(b):no(Error('Export PNG impossible')),'image/png'));
  download(blob,'Rapli_Regatta_'+r.name.replace(/[^a-z0-9-]+/gi,'_').slice(0,65)+'.png');toast('PNG exporté ✓');
 }catch(err){console.error(err);toast('Export PNG : '+err.message,true);}
}
function exportJSON(){download(new Blob([JSON.stringify({app:'Rapli Regatta',version:1,exportedAt:now(),races:rows},null,2)],{type:'application/json'}),'Rapli_Regatta_'+now().slice(0,10)+'.json');toast('JSON exporté ✓');}
async function importJSON(file){if(!file)return;try{if(file.size>120e6)throw Error('Fichier trop volumineux');const obj=JSON.parse(await file.text());if(obj.app!=='Rapli Regatta'||!Array.isArray(obj.races)||obj.races.length>20000)throw Error('Fichier de sauvegarde invalide');const next=obj.races.map(normal);if(new Set(next.map(r=>r.id)).size!==next.length)throw Error('IDs dupliqués');if(!confirm('Importer '+next.length+' courses et remplacer la collection locale ?'))return;await replaceRows(next);window.RapliModuleCloud?.changed?.();toast('Collection importée ✓');}catch(err){toast(err.message,true);}finally{$('import-json').value='';}}
$('race-equipment-group').addEventListener('change',event=>{
 const selected=event.target.closest('input[name="race-equipment"]');
 if(!selected||!selected.checked)return;
 equipmentInputs().forEach(input=>{if(input!==selected)input.checked=false;});
});
$('new-race').addEventListener('click',()=>openEditor());$('empty-add').addEventListener('click',()=>openEditor());$('race-form').addEventListener('submit',saveEditor);$('delete-race').addEventListener('click',()=>{if(editId)deleteRace(editId);});
for(const id of ['search','filter-status','filter-class','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
for(const key of imageKeys){$('image-'+key).addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';fileData(f,key);});document.querySelector('[data-remove="'+key+'"]').addEventListener('click',()=>{pictures[key]='';preview(key);});const zone=document.querySelector('[data-image="'+key+'"] .upload-preview');zone.addEventListener('dragover',e=>{e.preventDefault();});zone.addEventListener('drop',e=>{e.preventDefault();fileData(e.dataTransfer?.files[0],key);});}
$('cards').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const r=rows.find(x=>x.id===btn.closest('[data-id]')?.dataset.id);if(!r)return;if(btn.dataset.action==='edit')openEditor(r);if(btn.dataset.action==='delete')deleteRace(r.id);if(btn.dataset.action==='png')exportPNG(r);});
$('export-json').addEventListener('click',exportJSON);$('import-json').addEventListener('change',e=>importJSON(e.target.files[0]));document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!dialog.open){e.preventDefault();$('search').focus();}});
const bridge=window.RapliModuleBridge={module:'regatta',ready:false,getState:()=>({records:rows,logos:[]}),notify:msg=>toast(msg),replaceState:async data=>{if(!Array.isArray(data?.records)||!Array.isArray(data?.logos)||data.records.length>20000||data.logos.length)throw Error('Collection Regatta cloud invalide');const next=data.records.map(normal);if(new Set(next.map(r=>r.id)).size!==next.length)throw Error('Doublons cloud');await replaceRows(next);}};
window.RapliRegatta={getCount:()=>rows.length};
(async()=>{try{await openDB();rows=await load();render();}catch(err){console.warn(err);rows=[];render();toast('Stockage local indisponible',true);}bridge.ready=true;window.dispatchEvent(new Event('rapli-module-ready'));})();
})();