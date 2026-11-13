/* Rapli Regatta — race archive, private IndexedDB collection, Supabase bridge. */
(()=>{'use strict';
const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=(v,n=150)=>String(v??'').trim().slice(0,n);
const uid=()=>crypto.randomUUID?crypto.randomUUID():'race-'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const now=()=>new Date().toISOString();
const props={name:180,edition:100,boatClass:100,boat:140,start:20,startTime:8,end:20,endTime:8,rank:40,rankTotal:12,rankDepartment:40,rankDepartmentTotal:12,rankNational:40,rankNationalTotal:12,rankCity:40,rankCityTotal:12,rankTeam:40,rankTeamTotal:12,duration:100,durationDays:4,durationHours:2,durationMinutes:2,durationSeconds:2,classColor:7,vsr:5,notes:2500};
const imageKeys=['icon','result','route'];

/* A date and clock time represent the course's own civil time.
   UTC-based calendar arithmetic avoids differences between users' browser timezones. */
function parseRaceDuration(raw){
 const source=String(raw??'').trim().toLowerCase().replace(/\s+/g,' ');
 if(!source)return {status:'missing'};
 let text=source;
 if(/^\d{1,5}:\d{2}(?::\d{2})?$/.test(text)){
   const [h,m,sec=0]=text.split(':').map(Number);
   if(m>59||sec>59||h>87600)return {status:'invalid'};
   return {status:'valid',seconds:h*3600+m*60+sec};
 }
 // Support existing shorthand, including "8h35" and full duration with seconds.
 text=text.replace(/(\d+)\s*h\s*(\d{1,2})\s*$/,'$1h$2min');
 let seconds=0,tokens=0;
 const remaining=text.replace(/(\d+)\s*(jours?|j|heures?|h|minutes?|mins?|min|mn|m|secondes?|secs?|sec|s)(?![a-z])/g,(_match,n,unit)=>{
   const value=Number(n);
   const amount=/^(j|jour)/.test(unit)?86400:/^(h|heure)/.test(unit)?3600:/^(s|sec|seconde)/.test(unit)?1:60;
   seconds+=value*amount;tokens++;
   return ' ';
 });
 if(!tokens||remaining.trim()||!Number.isSafeInteger(seconds)||seconds>315360000)return {status:'invalid'};
 return {status:'valid',seconds};
}
function durationComponents(total){
 if(!Number.isSafeInteger(total)||total<0)return null;
 return {durationDays:String(Math.floor(total/86400)),durationHours:String(Math.floor(total%86400/3600)),durationMinutes:String(Math.floor(total%3600/60)),durationSeconds:String(total%60)};
}
function durationFromParts(r){
 const keys=['durationDays','durationHours','durationMinutes','durationSeconds'];
 const entries=keys.map(k=>String(r[k]??'').trim());
 if(entries.every(x=>x===''))return '';
 const caps=[3650,23,59,59];
 if(entries.some((v,i)=>v&&!/^\d+$/.test(v)||Number(v)>caps[i]))return null;
 const [d,h,m,sec]=entries.map(x=>Number(x||0));
 return d+' j '+h+' h '+m+' min '+sec+' s';
}
function calculateArrival(day,time,duration){
 if(!day||!time||!String(duration||'').trim())return {status:'waiting'};
 const validTime=/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
 const validDate=/^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
 if(!validTime||!validDate)return {status:'invalid-date'};
 const [year,month,date]=validDate.slice(1).map(Number),hour=Number(validTime[1]),minute=Number(validTime[2]),second=Number(validTime[3]||0);
 const start=new Date(Date.UTC(year,month-1,date,hour,minute,second));
 if(start.getUTCFullYear()!==year||start.getUTCMonth()+1!==month||start.getUTCDate()!==date)
   return {status:'invalid-date'};
 const parsed=parseRaceDuration(duration);
 if(parsed.status!=='valid')return {status:'invalid-duration'};
 const end=new Date(start.getTime()+parsed.seconds*1000);
 if(!Number.isFinite(end.getTime())||end.getUTCFullYear()>9999)return {status:'invalid-duration'};
 const iso=end.toISOString();
 return {status:'ready',end:iso.slice(0,10),endTime:iso.slice(11,19)};
}
const dateTimeFR=(day,time)=>[dateFR(day),/^\d{2}:\d{2}(?::\d{2})?$/.test(time||'')?time:''].filter(Boolean).join(' · ');
let legacyArrival=null;
function updateArrival(){
 const date=getField('start').value,time=getField('startTime').value,duration=syncDurationInput();
 const outcome=calculateArrival(date,time,duration);
 const message=$('arrival-feedback');
 if(outcome.status==='ready'){
   getField('end').value=outcome.end;getField('endTime').value=outcome.endTime;
   message.textContent='Arrivée calculée automatiquement · '+dateTimeFR(outcome.end,outcome.endTime);
   message.dataset.state='ok';
 }else{
   const sameAsLegacy=legacyArrival&&date===legacyArrival.start&&time===legacyArrival.startTime&&
   (duration===legacyArrival.duration||(duration===''&&parseRaceDuration(legacyArrival.duration).status!=='valid'));
   getField('end').value=sameAsLegacy?legacyArrival.end:'';
   getField('endTime').value=sameAsLegacy?legacyArrival.endTime:'';
   message.dataset.state=outcome.status.startsWith('invalid')?'error':'waiting';
   if(sameAsLegacy && legacyArrival.end)
     message.textContent='Ancienne date d’arrivée conservée. Renseigne l’heure de départ et la durée pour la recalculer.';
   else if(outcome.status==='invalid-duration')
     message.textContent='Durée invalide : jours 0–3650, heures 0–23, minutes et secondes 0–59.';
   else if(outcome.status==='invalid-date')
     message.textContent='Date ou heure de départ invalide.';
   else
     message.textContent='Renseigne la date, l’heure de départ et la durée pour calculer l’arrivée.';
 }
 return outcome;
}

const equipmentModes=Object.freeze({pdd:'PDD','half-fp':'1/2 FP','full-pack':'FULL PACK'});
const validEquipment=value=>Object.prototype.hasOwnProperty.call(equipmentModes,value)?value:'';
const equipmentInputs=()=>[...document.querySelectorAll('input[name="race-equipment"]')];
const VSR=Object.freeze({hc:'HORS CATÉGORIE',vsr1:'VSR 1',vsr2:'VSR 2',vsr3:'VSR 3'});
const colorSafe=v=>/^#[a-f0-9]{6}$/i.test(v||'')?v:'#008fa1';
const classTextColor=color=>{
 const hex=colorSafe(color).slice(1),channels=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255)
   .map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
 const luminance=0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];
 return luminance>0.30?'#132d3f':'#ffffff';
};
const intString=v=>{const raw=String(v??'').trim().replace(/\s|\u00a0/g,'');return /^\d{1,12}$/.test(raw)?String(Number(raw)):'';};
const rankPairs=[['rank','rankTotal'],['rankNational','rankNationalTotal'],['rankDepartment','rankDepartmentTotal'],['rankCity','rankCityTotal'],['rankTeam','rankTeamTotal']];
const rankDisplay=(rank,total)=>rank?rank+(total?' / '+Number(total).toLocaleString('fr-FR'):''):'';
const rankHtml=(emoji,label,rank,total,kind='')=>rank?'<div class="rank-plate '+kind+'"><span class="rank-icon" aria-hidden="true">'+emoji+'</span><div class="rank-value"><span class="rank-type">'+label+'</span><strong>'+safe(rankDisplay(rank,total))+'</strong></div></div>':'';
const validImage=v=>typeof v==='string'&&/^data:image\/(png|webp|jpeg|gif);base64,[a-z0-9+/=]+$/i.test(v);

function syncDurationInput(){
 const parts={durationDays:getField('durationDays').value,durationHours:getField('durationHours').value,durationMinutes:getField('durationMinutes').value,durationSeconds:getField('durationSeconds').value};
 const value=durationFromParts(parts);
 getField('duration').value=value===null?'invalid':value;
 return getField('duration').value;
}
function normalizeRanking(r){
 for(const [key,totalKey] of rankPairs){
   const legacy=String(r[key]||'');
   const pieces=legacy.split('/');
   const place=intString(pieces[0].trim().replace(/(?:ème|eme|er|e)$/i,''));
   const total=intString(r[totalKey]||pieces[1]||'');
   if(place){r[key]=place;r[totalKey]=total;}
   else {r[key]='';r[totalKey]='';}
 }
}
function normal(x={}){const r={id:typeof x.id==='string'&&x.id.length<130?x.id:uid(),createdAt:x.createdAt||now(),updatedAt:x.updatedAt||now(),live:!!x.live,upcoming:!!x.upcoming&&!x.live,equipment:validEquipment(x.equipment)};for(const [k,n] of Object.entries(props))r[k]=clean(x[k],n);
 r.classColor=colorSafe(r.classColor);r.vsr=VSR[r.vsr]?r.vsr:'';
 normalizeRanking(r);
 const durationKeys=['durationDays','durationHours','durationMinutes','durationSeconds'];
 if(durationKeys.every(k=>r[k]==='')){
   const old=parseRaceDuration(r.duration);
   if(old.status==='valid')Object.assign(r,durationComponents(old.seconds));
 }
 const formatted=durationFromParts(r);
 if(formatted!==null&&formatted!=='')r.duration=formatted;
 for(const k of imageKeys)r[k]=validImage(x[k])?x[k]:'';const arrival=calculateArrival(r.start,r.startTime,r.duration);if(arrival.status==='ready'){r.end=arrival.end;r.endTime=arrival.endTime;}return r;}
let rows=[],db=null,editId='',pictures={icon:'',result:'',route:''},uploads=0,writeBusy=false,timer;
const dialog=$('race-dialog'),getField=k=>$('race-'+({boatClass:'class',startTime:'start-time',endTime:'end-time',rankDepartment:'rank-department',rankNational:'rank-national',rankTotal:'rank-total',rankNationalTotal:'rank-national-total',rankDepartmentTotal:'rank-department-total',rankCity:'rank-city',rankCityTotal:'rank-city-total',rankTeam:'rank-team',rankTeamTotal:'rank-team-total',durationDays:'days',durationHours:'hours',durationMinutes:'minutes',durationSeconds:'seconds',classColor:'class-color'}[k]||k));
function toast(t,error=false){$('notice').textContent=t;$('notice').dataset.error=String(error);clearTimeout(timer);timer=setTimeout(()=>{$('notice').textContent='';},7000);}
const req=r=>new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error||Error('IndexedDB inaccessible'));});
const done=tx=>new Promise((yes,no)=>{tx.oncomplete=yes;tx.onerror=()=>no(tx.error||Error('Sauvegarde locale impossible'));tx.onabort=()=>no(tx.error||Error('Stockage local annulé'));});
async function openDB(){if(!window.indexedDB)return;const r=indexedDB.open('rapli-regatta-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('races'))r.result.createObjectStore('races',{keyPath:'id'});};db=await req(r);}
function backup(){try{return JSON.parse(localStorage.getItem('rapli-regatta-v1')||'[]');}catch{return [];}}
async function load(){return db?(await req(db.transaction('races').objectStore('races').getAll())).map(normal):backup().map(normal);}
async function saveRow(row){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify([...rows.filter(x=>x.id!==row.id),row]));return;}const tx=db.transaction('races','readwrite');tx.objectStore('races').put(row);await done(tx);}
async function deleteRow(id){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify(rows.filter(x=>x.id!==id)));return;}const tx=db.transaction('races','readwrite');tx.objectStore('races').delete(id);await done(tx);}
async function replaceRows(next){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify(next));}else{const tx=db.transaction('races','readwrite'),store=tx.objectStore('races');store.clear();next.forEach(x=>store.put(x));await done(tx);}rows=next.map(normal);render();}
const raceStatus=r=>{if(r.upcoming)return 'planned';if(r.live)return 'live';if(r.rank)return 'finished';if(!r.end)return 'planned';if(!r.endTime)return 'finished';const current=new Date();const local=[current.getFullYear(),String(current.getMonth()+1).padStart(2,'0'),String(current.getDate()).padStart(2,'0')].join('-')+'T'+String(current.getHours()).padStart(2,'0')+':'+String(current.getMinutes()).padStart(2,'0');return (r.end+'T'+r.endTime)<=local?'finished':'planned';},statusTitle={live:'COURSE EN COURS',finished:'TERMINÉE',planned:'À VENIR'};
const dateFR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'';
const imageTag=(src,alt)=>validImage(src)?'<img loading="lazy" draggable="false" alt="'+safe(alt)+'" src="'+safe(src)+'">':'<span class="shot-empty">PAS DE CAPTURE</span>';
function card(r){
 const status=raceStatus(r),tag=colorSafe(r.classColor),mode=VSR[r.vsr]||'';
 const rankBlocks=rankHtml('🏆','CLASSEMENT GÉNÉRAL',r.rank,r.rankTotal,'rank-main')+
   rankHtml('🇫🇷','NATIONAL',r.rankNational,r.rankNationalTotal,'rank-national')+
   rankHtml('🇨🇶','DÉPARTEMENTAL',r.rankDepartment,r.rankDepartmentTotal,'rank-department')+
   rankHtml('🏙️','VILLE',r.rankCity,r.rankCityTotal,'rank-city')+
   rankHtml('🏴‍☠️','TEAM',r.rankTeam,r.rankTeamTotal,'rank-team');
 return '<article class="card'+(r.live?' live':'')+(r.upcoming?' upcoming':'')+'" data-id="'+safe(r.id)+'" style="--class-tag:'+tag+';--class-ink:'+classTextColor(tag)+'">'+
 '<div class="card-top"><div class="race-icon card-photo">'+(validImage(r.icon)?imageTag(r.icon,'Affiche '+r.name):'<div class="icon-placeholder">⛵</div>')+'</div><span class="badge-status">'+statusTitle[status]+'</span></div>'+
 '<div class="card-content"><div class="card-eyebrow"><span class="class-tag">'+safe(r.boatClass||'VIRTUAL REGATTA')+'</span><span class="year">'+safe(r.edition)+'</span></div>'+
 '<div class="card-category">'+(mode?'<span class="vsr-badge'+(r.vsr==='hc'?' hc':'')+'">'+safe(mode)+'</span>':'')+'</div>'+
 '<h2>'+safe(r.name)+'</h2><div class="card-boat">'+safe(r.boat)+'</div>'+
 '<div class="card-stats">'+(r.start?'<span class="stat-chip">DÉPART '+safe(dateTimeFR(r.start,r.startTime))+'</span>':'')+
 (r.end?'<span class="stat-chip arrival-chip">ARRIVÉE '+safe(dateTimeFR(r.end,r.endTime))+'</span>':'')+
 (r.duration?'<span class="stat-chip duration-chip">⏱ '+safe(r.duration)+'</span>':'')+
 (validEquipment(r.equipment)?'<span class="stat-chip equipment">ÉQUIPEMENT · '+safe(equipmentModes[r.equipment])+'</span>':'')+'</div>'+
 (rankBlocks?'<div class="rank-grid">'+rankBlocks+'</div>':'')+
 '<div class="shots"><div class="shot"><label>CLASSEMENT FINAL</label><div class="shot-box image-preview">'+imageTag(r.result,'Classement '+r.name)+'</div></div>'+
 '<div class="shot"><label>TRACÉ</label><div class="shot-box image-preview">'+imageTag(r.route,'Tracé '+r.name)+'</div></div></div>'+
 (r.notes?'<p class="card-note">'+safe(r.notes)+'</p>':'')+
 '<div class="card-actions"><button type="button" class="btn secondary" data-action="edit">MODIFIER</button><button type="button" class="btn subtle" data-action="png">↓ PNG</button>'+
 (r.upcoming?'<button type="button" class="btn calendar-btn" data-action="calendar" title="Ajouter cette course à Apple Calendrier">📅 CALENDRIER</button>':'')+
 '<button type="button" class="btn subtle" data-action="delete">×</button></div></div></article>';
}
function render(){
 const selected=$('filter-class').value;
 const classes=[...new Set(rows.map(x=>x.boatClass).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 $('filter-class').innerHTML='<option value="">Toutes les classes</option>'+classes.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join('');
 if(classes.includes(selected))$('filter-class').value=selected;
 const q=$('search').value.toLocaleLowerCase('fr').trim(),status=$('filter-status').value,cls=$('filter-class').value,vsr=$('filter-vsr').value;
 const filtered=rows.filter(r=>(!status||raceStatus(r)===status)&&(!cls||r.boatClass===cls)&&(!vsr||r.vsr===vsr)&&
   (!q||[r.name,r.edition,r.boatClass,r.boat,r.rank,r.rankNational,r.rankDepartment,r.rankCity,r.rankTeam,
           r.startTime,r.end,r.endTime,VSR[r.vsr]||'',equipmentModes[r.equipment]||'',r.notes].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q))));
 const out=[...filtered],sort=$('sort').value;
 const chronological=r=>(r.start?r.start+'T'+(r.startTime||'00:00'):r.createdAt||'');
 out.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'fr'):
  sort==='old'?a.createdAt.localeCompare(b.createdAt):
  sort==='recent'?b.updatedAt.localeCompare(a.updatedAt):
  chronological(b).localeCompare(chronological(a))||b.createdAt.localeCompare(a.createdAt));
 $('count-total').textContent=rows.length;$('count-live').textContent=rows.filter(r=>r.live).length;
 $('count-finished').textContent=rows.filter(r=>raceStatus(r)==='finished').length;
 $('result-count').textContent=out.length+' / '+rows.length;
 $('cards').innerHTML=out.map(card).join('')||(rows.length?'<p>Aucune course ne correspond aux filtres.</p>':'');
 $('empty').hidden=rows.length!==0;
 renderStatistics();
}
function renderStatistics(){
 const total=rows.length,finished=rows.filter(r=>raceStatus(r)==='finished'),
       future=rows.filter(r=>r.upcoming),live=rows.filter(r=>r.live);
 const completedRanks=finished.filter(r=>Number(r.rank)>0),best=[...completedRanks].sort((a,b)=>Number(a.rank)-Number(b.rank))[0];
 const durations=finished.map(r=>parseRaceDuration(r.duration)).filter(x=>x.status==='valid');
 const avg=durations.length?Math.round(durations.reduce((a,b)=>a+b.seconds,0)/durations.length):null;
 const formatAverage=seconds=>{if(seconds===null)return '—';const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60);return (d?d+'j ':'')+String(h).padStart(2,'0')+'h '+String(m).padStart(2,'0')+'m';};
 const metrics=[
   ['COURSES',total],['TERMINÉES',finished.length],['EN COURS',live.length],['À VENIR',future.length],
   ['MEILLEUR CLASSEMENT',best?'#'+Number(best.rank).toLocaleString('fr-FR'):'—'],
   ['DURÉE MOYENNE',formatAverage(avg)]
 ];
 $('stats-summary').textContent=total+' courses recensées';
 const section=(title,entries)=>{
   if(!entries.length)return '<div class="stats-empty">Aucune donnée pour cette catégorie.</div>';
   const max=Math.max(1,...entries.map(x=>x[1]));
   return '<div class="stats-breakdown"><h3>'+title+'</h3>'+
     entries.map(([key,count])=>'<div class="stat-breakdown-row"><span>'+safe(key)+'</span><div class="stat-bar-track"><div class="stat-bar-fill" style="width:'+Math.round(count/max*100)+'%"></div></div><strong>'+count+'</strong></div>').join('')+'</div>';
 };
 const buckets=key=>[...new Set(rows.map(r=>key(r)).filter(Boolean))]
   .map(name=>[name,rows.filter(r=>key(r)===name).length]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'fr'));
 $('stats-content').innerHTML='<div class="stats-metrics">'+metrics.map(([key,value])=>'<div class="stats-metric"><span>'+safe(key)+'</span><strong>'+safe(value)+'</strong></div>').join('')+'</div>'+
   '<div class="stats-breakdowns">'+section('CATÉGORIE VSR',buckets(r=>VSR[r.vsr]||'Non renseignée'))+
   section('CLASSES DE BATEAUX',buckets(r=>r.boatClass||'Non renseignée'))+
   section('ÉQUIPEMENTS',buckets(r=>equipmentModes[r.equipment]||'Non renseigné'))+'</div>';
}
function selectWorkspace(view){
 const showStats=view==='stats';
 $('races-panel').hidden=showStats;$('stats-panel').hidden=!showStats;
 for(const [id,active] of [['view-races',!showStats],['view-stats',showStats]]){
   const el=$(id);el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;
 }
 if(showStats)renderStatistics();
}
function preview(k){const img=$('preview-'+k),ph=$('placeholder-'+k);img.hidden=!validImage(pictures[k]);ph.hidden=validImage(pictures[k]);if(validImage(pictures[k]))img.src=pictures[k];else img.removeAttribute('src');}
function openEditor(r){
 editId=r?.id||'';
 const data=r||normal();
 for(const k of Object.keys(props))getField(k).value=data[k]||'';
 getField('classColor').value=colorSafe(data.classColor);
 legacyArrival={start:data.start,startTime:data.startTime,duration:data.duration,end:data.end,endTime:data.endTime};
 updateArrival();
 $('race-live').checked=!!data.live;
 $('race-upcoming').checked=!!data.upcoming;
 equipmentInputs().forEach(input=>{input.checked=input.value===validEquipment(data.equipment);});
 for(const k of imageKeys){pictures[k]=data[k]||'';preview(k);}
 $('dialog-title').textContent=editId?'MODIFIER LA COURSE':'AJOUTER UNE COURSE';
 $('delete-race').hidden=!editId;
 if(!dialog.open)dialog.showModal();
 document.body.style.overflow='hidden';dialog.querySelector('.dialog-scroll').scrollTop=0;
 getField('name').focus({preventScroll:true});
}
const closeEditor=()=>{if(dialog.open)dialog.close();};
dialog.addEventListener('close',()=>{document.body.style.overflow='';editId='';});dialog.addEventListener('click',e=>{if(e.target===dialog)closeEditor();});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeEditor));
async function saveEditor(e){
 e.preventDefault();if(writeBusy||uploads)return;
 const old=rows.find(x=>x.id===editId);const r={...(old||normal()),updatedAt:now(),live:$('race-live').checked,upcoming:$('race-upcoming').checked};
 if(r.live&&r.upcoming){toast('Une course ne peut pas être à venir et en cours simultanément.',true);return;}
 const arrival=updateArrival();if(arrival.status==='invalid-duration'||arrival.status==='invalid-date'){toast('Corrige la durée ou les horaires avant d’enregistrer.',true);getField(arrival.status==='invalid-duration'?'durationDays':'start').focus();return;}
 if(syncDurationInput()==='invalid'){toast('Durée incorrecte : vérifie les jours, heures, minutes et secondes.',true);getField('durationDays').focus();return;}
 for(const k of Object.keys(props))r[k]=clean(getField(k).value,props[k]);
 for(const [place,total] of rankPairs){
   const input=getField(place),run=getField(total);
   const placeText=input.value.trim(),totalText=run.value.trim();
   if(placeText&&!intString(placeText)){toast('Classement invalide : saisis une position numérique.',true);input.focus();return;}
   if(totalText&&!intString(totalText)){toast('Nombre de joueurs invalide.',true);run.focus();return;}
   if(totalText&&!placeText){toast('Renseigne aussi la position du classement.',true);input.focus();return;}
   if(placeText&&totalText&&Number(intString(placeText))>Number(intString(totalText))){toast('La position ne peut pas dépasser le nombre de joueurs.',true);input.focus();return;}
   r[place]=intString(placeText);r[total]=intString(totalText);
 }
 r.classColor=colorSafe(r.classColor);r.vsr=VSR[r.vsr]?r.vsr:'';
 if(arrival.status==='ready'){r.end=arrival.end;r.endTime=arrival.endTime;}
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
  const W=1200,HEADER=130,PHOTO=675,INFO=620,EXTRA=(ranking||route)?450:0,FOOT=46;
  const height=HEADER+PHOTO+INFO+EXTRA+FOOT,c=document.createElement('canvas');
  c.width=W;c.height=height;const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas indisponible');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,height);
  ctx.fillStyle='#15384a';ctx.fillRect(0,0,W,HEADER);
  ctx.fillStyle='#00c6c8';ctx.fillRect(0,0,900,8);ctx.fillStyle='#f30082';ctx.fillRect(900,0,300,8);
  ctx.fillStyle='#fff';ctx.font='900 49px Poppins,sans-serif';ctx.fillText('RAPLI REGATTA',49,82);
  ctx.textAlign='right';ctx.font=(r.vsr==='hc'?'900 21px':'800 19px')+' Poppins,sans-serif';ctx.fillStyle=r.vsr==='hc'?'#e6bb54':'#caecf2';
  if(VSR[r.vsr])ctx.fillText(VSR[r.vsr],1151,62);
  if(equipmentModes[r.equipment]){ctx.font='700 15px Poppins,sans-serif';ctx.fillText('ÉQUIPEMENT · '+equipmentModes[r.equipment],1151,92);}
  ctx.textAlign='left';
  ctx.fillStyle='#e4f4f3';ctx.fillRect(0,HEADER,W,PHOTO);contain(ctx,im,0,HEADER,W,PHOTO);
  if(r.upcoming||r.live){
   ctx.fillStyle=r.upcoming?'#176cce':'#eb007c';ctx.fillRect(32,HEADER+24,330,43);
   ctx.font='900 19px Poppins,sans-serif';ctx.fillStyle='#fff';ctx.fillText(r.upcoming?'🔵 À VENIR':'COURSE EN COURS',46,HEADER+53);
  }
  const y=HEADER+PHOTO;
  const tag=colorSafe(r.classColor);
  ctx.fillStyle=tag;ctx.fillRect(48,y+24,Math.min(560,Math.max(140,ctx.measureText(r.boatClass||'VIRTUAL REGATTA').width+45)),36);
  ctx.fillStyle=classTextColor(tag);ctx.font='800 18px Poppins,sans-serif';ctx.fillText((r.boatClass||'VIRTUAL REGATTA').toUpperCase().slice(0,28),61,y+49);
  ctx.fillStyle='#73909e';ctx.textAlign='right';ctx.font='700 17px Poppins,sans-serif';ctx.fillText((r.edition||'').slice(0,40),1151,y+49);ctx.textAlign='left';
  ctx.fillStyle='#123648';ctx.font='900 43px Poppins,sans-serif';wrap(ctx,r.name,1090,2).forEach((line,i)=>ctx.fillText(line,48,y+111+i*51));
  if(r.boat){ctx.fillStyle='#7a919d';ctx.font='700 18px Poppins,sans-serif';wrap(ctx,r.boat,1050,1).forEach(t=>ctx.fillText(t,48,y+202));}
  ctx.fillStyle='#245c6c';ctx.font='800 17px Poppins,sans-serif';
  if(r.start)ctx.fillText('DÉPART · '+dateTimeFR(r.start,r.startTime),48,y+238);
  if(r.end)ctx.fillText('ARRIVÉE · '+dateTimeFR(r.end,r.endTime),48,y+270);
  if(r.duration){
   ctx.font='700 21px "Courier Prime","American Typewriter",monospace';ctx.fillStyle='#1a5368';
   wrap(ctx,'DURÉE · '+r.duration,590,1).forEach(t=>ctx.fillText(t,555,y+270));
  }
  const ranks=[
   ['🏆','CLASSEMENT GÉNÉRAL',r.rank,r.rankTotal],
   ['🇫🇷','NATIONAL',r.rankNational,r.rankNationalTotal],
   ['🇨🇶','DÉPARTEMENTAL',r.rankDepartment,r.rankDepartmentTotal],
   ['🏙️','VILLE',r.rankCity,r.rankCityTotal],
   ['🏴‍☠️','TEAM',r.rankTeam,r.rankTeamTotal]
  ];
  const drawRank=(i,x,top,width,h)=>{
   const [emoji,label,place,total]=ranks[i];
   ctx.fillStyle=i===0?'#135772':i===1?'#eef5fc':i===2?'#edf9f5':i===3?'#f7f3f9':'#f7f4ef';
   ctx.fillRect(x,top,width,h);
   ctx.strokeStyle=i===0?'#0f7690':'#d1e3e6';ctx.lineWidth=2;ctx.strokeRect(x,top,width,h);
   ctx.fillStyle=i===0?'#fff':'#244b5e';
   ctx.font='24px "Apple Color Emoji","Segoe UI Emoji",sans-serif';ctx.fillText(emoji,x+13,top+33);
   ctx.fillStyle=i===0?'#b1e6ef':'#7d929e';ctx.font='800 14px Poppins,sans-serif';ctx.fillText(label,x+56,top+28);
   ctx.font=(i===0?'700 33px':'700 27px')+' Georgia,serif';ctx.fillStyle=i===0?'#fff':'#193e57';
   let value=rankDisplay(place,total)||'—';
   while(ctx.measureText(value).width>width-75&&value.length>2)value=value.slice(0,-2)+'…';
   ctx.fillText(value,x+56,top+h-14);
  };
  drawRank(0,48,y+313,1104,80);
  for(let i=1;i<5;i++){
   const x=48+(i%2===0?564:0),row=Math.floor((i-1)/2),yy=y+406+row*82;
   drawRank(i,x,yy,540,72);
  }
  if(EXTRA){
   const y2=y+INFO;ctx.fillStyle='#e7f3f5';ctx.fillRect(0,y2,W,EXTRA);
   for(const [i,image,label] of [[0,ranking,'CLASSEMENT FINAL'],[1,route,'TRACÉ DE COURSE']]){
    const x=30+i*582;ctx.fillStyle='#244b5e';ctx.font='800 20px Poppins,sans-serif';ctx.fillText(label,x,y2+31);
    ctx.fillStyle='#d0e5e7';ctx.fillRect(x,y2+43,556,377);contain(ctx,image,x,y2+43,556,377);
   }
  }
  ctx.fillStyle='#15384a';ctx.fillRect(0,height-FOOT,W,FOOT);
  ctx.fillStyle='#d6f0f0';ctx.font='700 15px Poppins,sans-serif';
  ctx.fillText('RAPLI REGATTA · '+(r.upcoming?'À VENIR':r.live?'COURSE EN COURS':'JOURNAL DE COURSE'),37,height-18);
  const blob=await new Promise((yes,no)=>c.toBlob(b=>b?yes(b):no(Error('Export PNG impossible')),'image/png'));
  download(blob,'Rapli_Regatta_'+r.name.replace(/[^a-z0-9-]+/gi,'_').slice(0,65)+'.png');toast('PNG exporté ✓');
 }catch(err){console.error(err);toast('Export PNG : '+err.message,true);}
}
function calendarEscape(input){
 return String(input??'').replace(/\r\n?/g,'\n').replace(/\\/g,'\\\\')
   .replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').slice(0,6000);
}
function toIcsTime(date,clock='00:00'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(clock))return '';
 return date.replace(/-/g,'')+'T'+clock.replace(/:/g,'').padEnd(6,'0');
}
function foldCalendarLine(line){
 const encoder=new TextEncoder();
 let result='',bytes=0;
 for(const ch of line){
   const size=encoder.encode(ch).length;
   if(bytes+size>75){result+='\r\n ';bytes=1;}
   result+=ch;bytes+=size;
 }
 return result;
}
function calendarText(r){
 if(!r.upcoming)throw Error('Disponible uniquement pour une course à venir.');
 if(!r.start)throw Error('Renseigne la date de départ pour exporter dans Calendrier.');
 const startClock=r.startTime||'';
 let start='',finish='',allDay=false,placeholder=false;
 if(startClock){
   start=toIcsTime(r.start,startClock);
   if(!start)throw Error('Heure de départ invalide.');
   const end=calculateArrival(r.start,startClock,r.duration);
   if(end.status==='ready'&&parseRaceDuration(r.duration).seconds>0){
     finish=toIcsTime(end.end,end.endTime);
   }else{
     const [year,month,day]=r.start.split('-').map(Number);
     const [h,m,sec=0]=startClock.split(':').map(Number);
     const next=new Date(Date.UTC(year,month-1,day,h+1,m,sec)).toISOString();
     finish=next.slice(0,10).replace(/-/g,'')+'T'+next.slice(11,19).replace(/:/g,'');
     placeholder=true;
   }
 }else{
   allDay=true;start=r.start.replace(/-/g,'');
   const [year,month,day]=r.start.split('-').map(Number);
   const next=new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);
   finish=next.replace(/-/g,'');
 }
 const descriptions=[
   'Édition : '+(r.edition||'Non renseignée'),
   'Bateau : '+(r.boat||'Non renseigné'),
   'Classe : '+(r.boatClass||'Non renseignée'),
   'Catégorie VSR : '+(VSR[r.vsr]||'Non renseignée'),
   'Équipement : '+(equipmentModes[r.equipment]||'Non renseigné'),
   'Durée : '+(r.duration||'Non renseignée'),
   placeholder?'Plage de calendrier indicative : 1 heure après le départ.':'',
   r.notes||''
 ].filter(Boolean).join('\n');
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');
 const uidValue=String(r.id||'race').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)+'@regatta.raplilab';
 const times=allDay?'DTSTART;VALUE=DATE:'+start+'\r\nDTEND;VALUE=DATE:'+finish:
   'DTSTART:'+start+'\r\nDTEND:'+finish;
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Rapli Regatta//FR','CALSCALE:GREGORIAN',
  'BEGIN:VEVENT','UID:'+uidValue,'DTSTAMP:'+stamp,'SUMMARY:'+calendarEscape(r.name),
  ...times.split('\r\n'),'DESCRIPTION:'+calendarEscape(descriptions),'END:VEVENT','END:VCALENDAR',''].map(foldCalendarLine).join('\r\n');
}
function exportCalendar(r){
 try{
  const ics=calendarText(r);
  download(new Blob([ics],{type:'text/calendar;charset=utf-8'}),'Rapli_Regatta_'+r.name.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,55)+'.ics');
  toast('Fichier calendrier .ics prêt : ouvre-le pour ajouter la course à Apple Calendrier.');
 }catch(error){toast(error.message||'Export calendrier indisponible',true);}
}

function exportJSON(){download(new Blob([JSON.stringify({app:'Rapli Regatta',version:1,exportedAt:now(),races:rows},null,2)],{type:'application/json'}),'Rapli_Regatta_'+now().slice(0,10)+'.json');toast('JSON exporté ✓');}
async function importJSON(file){if(!file)return;try{if(file.size>120e6)throw Error('Fichier trop volumineux');const obj=JSON.parse(await file.text());if(obj.app!=='Rapli Regatta'||!Array.isArray(obj.races)||obj.races.length>20000)throw Error('Fichier de sauvegarde invalide');const next=obj.races.map(normal);if(new Set(next.map(r=>r.id)).size!==next.length)throw Error('IDs dupliqués');if(!confirm('Importer '+next.length+' courses et remplacer la collection locale ?'))return;await replaceRows(next);window.RapliModuleCloud?.changed?.();toast('Collection importée ✓');}catch(err){toast(err.message,true);}finally{$('import-json').value='';}}
$('race-equipment-group').addEventListener('change',event=>{
 const selected=event.target.closest('input[name="race-equipment"]');
 if(!selected||!selected.checked)return;
 equipmentInputs().forEach(input=>{if(input!==selected)input.checked=false;});
});
for(const key of ['start','startTime','durationDays','durationHours','durationMinutes','durationSeconds'])
  getField(key).addEventListener('input',updateArrival);
for(const key of ['start','startTime','durationDays','durationHours','durationMinutes','durationSeconds'])
  getField(key).addEventListener('change',updateArrival);
$('race-live').addEventListener('change',event=>{if(event.target.checked)$('race-upcoming').checked=false;});
$('race-upcoming').addEventListener('change',event=>{if(event.target.checked)$('race-live').checked=false;});
for(const view of ['races','stats'])$('view-'+view).addEventListener('click',()=>selectWorkspace(view));
$('new-race').addEventListener('click',()=>openEditor());$('empty-add').addEventListener('click',()=>openEditor());$('race-form').addEventListener('submit',saveEditor);$('delete-race').addEventListener('click',()=>{if(editId)deleteRace(editId);});
for(const id of ['search','filter-status','filter-vsr','filter-class','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
for(const key of imageKeys){$('image-'+key).addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';fileData(f,key);});document.querySelector('[data-remove="'+key+'"]').addEventListener('click',()=>{pictures[key]='';preview(key);});const zone=document.querySelector('[data-image="'+key+'"] .upload-preview');zone.addEventListener('dragover',e=>{e.preventDefault();});zone.addEventListener('drop',e=>{e.preventDefault();fileData(e.dataTransfer?.files[0],key);});}
$('cards').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const r=rows.find(x=>x.id===btn.closest('[data-id]')?.dataset.id);if(!r)return;if(btn.dataset.action==='edit')openEditor(r);if(btn.dataset.action==='delete')deleteRace(r.id);if(btn.dataset.action==='png')exportPNG(r);if(btn.dataset.action==='calendar')exportCalendar(r);});
$('export-json').addEventListener('click',exportJSON);$('import-json').addEventListener('change',e=>importJSON(e.target.files[0]));document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!dialog.open){e.preventDefault();$('search').focus();}});
const bridge=window.RapliModuleBridge={module:'regatta',ready:false,getState:()=>({records:rows,logos:[]}),notify:msg=>toast(msg),replaceState:async data=>{if(!Array.isArray(data?.records)||!Array.isArray(data?.logos)||data.records.length>20000||data.logos.length)throw Error('Collection Regatta cloud invalide');const next=data.records.map(normal);if(new Set(next.map(r=>r.id)).size!==next.length)throw Error('Doublons cloud');await replaceRows(next);}};
window.RapliRegatta={getCount:()=>rows.length};
(async()=>{try{await openDB();rows=await load();render();}catch(err){console.warn(err);rows=[];render();toast('Stockage local indisponible',true);}bridge.ready=true;window.dispatchEvent(new Event('rapli-module-ready'));})();
})();